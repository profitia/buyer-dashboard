import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import type { ChatRequest, ChatResponse, SourceLink } from '../../../shared/types';

export const chatRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ── Trusted domains (safeguard against hallucinated deep links) ───────────────

const TRUSTED_DOMAINS = [
  'reuters.com',
  'lme.com',
  'iea.org',
  'worldbank.org',
  'fred.stlouisfed.org',
  'imf.org',
  'ec.europa.eu',
  'oecd.org',
  'platts.com',
  'argusmedia.com',
  'steelbenchmarker.com',
  'bls.gov',
  'eurostat.ec.europa.eu',
];

function isTrustedUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return TRUSTED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// Extract "Sources:" block from AI reply and return { cleanReply, sources }
function extractSources(raw: string): { cleanReply: string; sources: SourceLink[] } {
  const sourcesIdx = raw.search(/\n{0,2}Sources?:/i);
  if (sourcesIdx === -1) return { cleanReply: raw.trim(), sources: [] };

  const body = raw.slice(0, sourcesIdx).trim();
  const block = raw.slice(sourcesIdx);

  // Match lines like:
  //   - Name: https://...
  //   - [Name] https://...
  //   - [Name]: https://...
  const lineRe = /-\s*(?:\[([^\]]+)\]|([^:\n(]+?))[\s:]+?(https?:\/\/[^\s),\n]+)/gi;
  const sources: SourceLink[] = [];
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(block)) !== null) {
    const name = (m[1] ?? m[2] ?? '').trim().replace(/:$/, '');
    const url = m[3].replace(/[).,:;]+$/, '').trim();
    if (!name) continue;

    if (isTrustedUrl(url)) {
      sources.push({ name, url });
    } else if (url.startsWith('http')) {
      // Keep only root domain for untrusted/uncertain deep links
      try {
        const root = new URL(url);
        const rootUrl = `${root.protocol}//${root.hostname}`;
        if (isTrustedUrl(rootUrl)) {
          sources.push({ name, url: rootUrl });
        }
      } catch {
        // skip
      }
    }
  }

  return { cleanReply: body, sources };
}

function buildSystemPrompt(ctx: ChatRequest['context'], language: string): string {
  const lang = language === 'pl' ? 'Polish' : 'English';
  const { weights, basePrice, latestSupplierPrice, supplierPrices, dateRange, categoryName } = ctx;

  const supplierHistory = supplierPrices.length > 0
    ? `Supplier price history: ${supplierPrices.map((e) => `${e.date}: €${e.price}`).join(', ')}.`
    : 'Supplier price: not provided yet.';

  const marginInfo = latestSupplierPrice
    ? `Latest supplier price: ${latestSupplierPrice.toFixed(2)} EUR. Base product price: ${basePrice} EUR. ${supplierHistory}`
    : `Base product price: ${basePrice} EUR. ${supplierHistory}`;

  const categoryLine = categoryName ? `Current cost category: "${categoryName}"` : '';

  return `You are Buyer Dashboard, an intelligent procurement cost analyst assistant embedded in the Buyer Dashboard platform.

Your personality:
- Smart, friendly, engaging — like a brilliant colleague, not a chatbot
- Use emojis occasionally (not excessively) to make insights feel alive
- Be specific: mention exact numbers, percentages, component names
- Short, punchy sentences. Maximum 3-4 sentences per response unless user asks for detail.
- Never be vague. Always tie insights to business impact (negotiation leverage, cost savings, margin protection).

Current cost model context:
${categoryLine}
- Component weights: Steel ${weights.steel}%, Aluminum ${weights.aluminum}%, Transport ${weights.transport}%, Energy ${weights.energy}%
- Base product price (Jan 2021 baseline): ${basePrice} EUR
- ${marginInfo}
- Selected time range: ${dateRange}
- Data covers: January 2021 to December 2025 (daily commodity prices)

Cost components:
- Steel: global steel prices ($/ton)
- Aluminum: global aluminum prices ($/ton)
- Transport: freight/logistics index
- Energy: energy price index

SOURCE LINKS POLICY (CRITICAL — follow exactly):
1. You ARE allowed and encouraged to provide links to sources.
2. Only link to well-known, public, trusted websites such as:
   Reuters (reuters.com), LME (lme.com), IEA (iea.org), World Bank (worldbank.org),
   FRED (fred.stlouisfed.org), IMF (imf.org), Eurostat (eurostat.ec.europa.eu),
   OECD (oecd.org), BLS (bls.gov), Platts (platts.com).
3. If unsure of the exact deep URL — provide only the root domain (e.g. https://www.lme.com).
4. NEVER say "I cannot access the internet" or "I cannot provide links". You can always suggest sources.
5. If no reliable link exists, say "You can check sources such as: [Name1], [Name2]" (names only, no fake URLs).
6. NEVER embed links inside sentences.
7. ALWAYS put links in a separate "Sources:" section at the end — formatted exactly as:

Sources:
- Name: https://domain.com
- Name: https://domain.com

8. Each link must be on its own line, starting with "- ".
9. Do NOT wrap URLs in parentheses or brackets.
10. Do NOT concatenate multiple links on one line.

ALWAYS respond in ${lang}.`;
}

// Generate a short session title (max 5 words) from the first user message
async function generateSessionTitle(message: string, language: string): Promise<string> {
  try {
    const lang = language === 'pl' ? 'Polish' : 'English';
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_CHEAP_MODEL ?? 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Generate a short title (max 5 words, no quotes) for a procurement analysis conversation based on the user's first message. Respond in ${lang}. Return ONLY the title text.`,
        },
        { role: 'user', content: message },
      ],
      max_tokens: 20,
      temperature: 0.5,
    });
    return completion.choices[0]?.message?.content?.trim() ?? 'New conversation';
  } catch {
    return 'New conversation';
  }
}

chatRouter.post('/chat', async (req: Request, res: Response): Promise<void> => {
  const body = req.body as ChatRequest & { sessionId?: string; categoryId?: string };

  if (!body?.message?.trim()) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-...') {
    res.status(503).json({
      error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to backend/.env'
    });
    return;
  }

  try {
    const systemPrompt = buildSystemPrompt(body.context, body.language);

    // Append format reminder to user message
    const userMessage = body.message.trim() +
      '\n\n[If you include sources, format them at the end exactly as:\nSources:\n- Name: https://domain.com\nEach on its own line.]';

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_PRIMARY_MODEL ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 400,
      temperature: 0.7,
    });

    const rawReply = completion.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';
    const { cleanReply: reply, sources } = extractSources(rawReply);

    // Persist to DB and manage session title (fire-and-forget)
    const sessionId = body.sessionId;
    let sessionTitle: string | undefined;
    if (sessionId) {
      (async () => {
        try {
          // Check if session exists and has a default title
          const existing = await prisma.chatSession.findUnique({ where: { id: sessionId } });

          let title = existing?.title;
          const isDefaultTitle = !title || title === 'New conversation';

          if (isDefaultTitle) {
            title = await generateSessionTitle(body.message, body.language);
          }

          await prisma.chatSession.upsert({
            where: { id: sessionId },
            update: { title: title!, updatedAt: new Date() },
            create: { id: sessionId, title: title!, language: body.language },
          });

          await prisma.chatMessage.createMany({
            data: [
              { sessionId, role: 'user',      content: body.message },
              { sessionId, role: 'assistant', content: reply },
            ],
          });

          sessionTitle = title!;
        } catch (err) {
          console.error('[DB persist error]', err);
        }
      })();
    }

    const response: ChatResponse = { reply, sessionTitle, sources: sources.length > 0 ? sources : undefined };
    res.json(response);
  } catch (err: unknown) {
    console.error('[Chat API Error]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'AI service error', details: message });
  }
});

