import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export const fredEventsRouter = Router();
const prisma = new PrismaClient();

// ─── Series config ────────────────────────────────────────────────────────────

const SERIES_CONFIG: Record<string, {
  name: string;
  impact: 'high' | 'medium' | 'low';
  affects: string[];
  spikeThreshold: number;   // absolute changePct % to flag spike/drop
}> = {
  CPIAUCSL:   { name: 'CPI',          impact: 'high',   affects: ['energy', 'transport'],            spikeThreshold: 0.3 },
  PPIACO:     { name: 'PPI',          impact: 'high',   affects: ['steel', 'aluminum'],               spikeThreshold: 0.5 },
  FEDFUNDS:   { name: 'Fed Funds',    impact: 'medium', affects: ['steel', 'aluminum', 'transport', 'energy'], spikeThreshold: 0.1 },
  DCOILWTICO: { name: 'WTI Crude',    impact: 'high',   affects: ['energy', 'transport'],            spikeThreshold: 3.0 },
  MHHNGSP:    { name: 'Natural Gas',  impact: 'medium', affects: ['energy'],                          spikeThreshold: 0.1 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchFredObservations(
  seriesId: string,
  apiKey: string,
  limit = 24,
): Promise<{ date: string; value: number }[]> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`);
  const data = await res.json() as { observations: Array<{ date: string; value: string }> };
  return data.observations
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }))
    .reverse(); // chronological order
}

type EventType = 'spike' | 'trend' | 'drop';

function detectEventType(
  obs: { date: string; value: number }[],
  idx: number,
  spikeThreshold: number,
): { type: EventType; changePct: number } | null {
  if (idx === 0) return null;
  const curr = obs[idx].value;
  const prev = obs[idx - 1].value;
  if (prev === 0) return null;

  const changePct = ((curr - prev) / Math.abs(prev)) * 100;

  if (changePct > spikeThreshold) return { type: 'spike', changePct };
  if (changePct < -spikeThreshold) return { type: 'drop', changePct };

  // TREND: 3 consecutive moves in same direction
  if (idx >= 3) {
    const vals = obs.slice(idx - 3, idx + 1).map((o) => o.value);
    const allUp   = vals.every((v, i) => i === 0 || v > vals[i - 1]);
    const allDown = vals.every((v, i) => i === 0 || v < vals[i - 1]);
    if (allUp)   return { type: 'trend', changePct };
    if (allDown) return { type: 'drop',  changePct };
  }

  return null;
}

// ─── Core fetch+detect+save logic ────────────────────────────────────────────

export async function runFredEventDetection(apiKey: string): Promise<{
  processed: number;
  saved: number;
  skipped: number;
}> {
  let processed = 0;
  let saved = 0;
  let skipped = 0;

  for (const [seriesId, cfg] of Object.entries(SERIES_CONFIG)) {
    try {
      const obs = await fetchFredObservations(seriesId, apiKey, 24);
      if (obs.length < 2) continue;

      for (let i = 1; i < obs.length; i++) {
        const detection = detectEventType(obs, i, cfg.spikeThreshold);
        if (!detection) continue;
        processed++;

        const { type, changePct } = detection;
        const curr = obs[i];
        const prev = obs[i - 1];
        const date = new Date(curr.date + 'T00:00:00.000Z');

        // Only save high/medium impact events to keep DB clean
        const eventImpact: 'high' | 'medium' | 'low' =
          Math.abs(changePct) > cfg.spikeThreshold * 2 ? 'high'
          : type === 'trend' ? 'medium'
          : cfg.impact;

        try {
          await prisma.macroHistoricalEvent.upsert({
            where: { seriesId_date: { seriesId, date } },
            create: {
              seriesId,
              name: cfg.name,
              date,
              value: curr.value,
              prevValue: prev.value,
              changePct,
              type,
              impact: eventImpact,
              affects: cfg.affects,
            },
            update: {
              value: curr.value,
              prevValue: prev.value,
              changePct,
              type,
              impact: eventImpact,
            },
          });
          saved++;
        } catch {
          skipped++;
        }
      }
    } catch (err) {
      console.warn(`[fredEvents] Skipping ${seriesId}:`, (err as Error).message);
    }
  }

  return { processed, saved, skipped };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/fred/fetch — manually trigger event detection
fredEventsRouter.post('/fred/fetch', async (req: Request, res: Response): Promise<void> => {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'FRED_API_KEY not configured' });
    return;
  }
  try {
    const result = await runFredEventDetection(apiKey);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// GET /api/events — return stored macro historical events
fredEventsRouter.get('/events', async (req: Request, res: Response): Promise<void> => {
  const category = req.query.category as string | undefined;
  const from     = req.query.from     as string | undefined;
  const to       = req.query.to       as string | undefined;
  const limit    = Math.min(Number(req.query.limit ?? 200), 500);

  try {
    const events = await prisma.macroHistoricalEvent.findMany({
      where: {
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
        // Filter by category: affects JSON array contains the category string
        ...(category ? {
          affects: { array_contains: category },
        } : {}),
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    // Map to a clean chart-friendly format
    const result = events.map((e) => ({
      id:        e.id,
      seriesId:  e.seriesId,
      name:      e.name,
      date:      e.date.toISOString().slice(0, 10),          // YYYY-MM-DD
      dateMonth: e.date.toISOString().slice(0, 7),           // YYYY-MM for chart x-axis
      value:     e.value,
      prevValue: e.prevValue,
      changePct: e.changePct,
      type:      e.type,
      impact:    e.impact,
      affects:   e.affects as string[],
      label:     buildLabel(e.name, e.type, e.changePct),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

function buildLabel(name: string, type: string, changePct: number | null): string {
  const sign = changePct !== null && changePct > 0 ? '+' : '';
  const pct  = changePct !== null ? ` ${sign}${changePct.toFixed(1)}%` : '';
  if (type === 'spike') return `${name} spike${pct}`;
  if (type === 'drop')  return `${name} drop${pct}`;
  if (type === 'trend') return `${name} trend${pct}`;
  return `${name}${pct}`;
}
