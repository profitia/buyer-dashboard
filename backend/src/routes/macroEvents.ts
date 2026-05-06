import { Router, Request, Response } from 'express';

export const macroEventsRouter = Router();

// ─── types ────────────────────────────────────────────────────────────────────

export interface MacroEvent {
  id: string;
  date: string;         // YYYY-MM-DD
  time: string;         // HH:MM or 'All day'
  country: string;      // 'US' | 'EU' | ...
  flag: string;         // emoji flag
  event: string;        // display name
  seriesId: string;     // FRED series id
  importance: 'high' | 'medium' | 'low';
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  change: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  unit: string;
  affects: string[];    // component keys
  insight: string;
}

// ─── impact map ───────────────────────────────────────────────────────────────

const IMPACT_MAP: Record<string, string[]> = {
  CPIAUCSL:  ['energy', 'transport'],
  PPIACO:    ['steel', 'aluminum'],
  FEDFUNDS:  ['steel', 'aluminum', 'transport', 'energy'],
  DCOILWTICO: ['energy', 'transport'],
  MHHNGSP:   ['energy'],
};

const SERIES_META: Record<string, {
  name: string;
  nameEn: string;
  unit: string;
  importance: 'high' | 'medium' | 'low';
  country: string;
  flag: string;
  insightFn: (val: number, prev: number) => string;
  insightFnEn: (val: number, prev: number) => string;
}> = {
  CPIAUCSL: {
    name: 'CPI (inflacja)',
    nameEn: 'CPI (inflation)',
    unit: '%',
    importance: 'high',
    country: 'US',
    flag: '🇺🇸',
    insightFn: (v, p) => v > p
      ? `Inflacja rośnie (${v.toFixed(1)}%). Koszty energii i transportu mogą wzrosnąć w kolejnych miesiącach.`
      : `Inflacja spada (${v.toFixed(1)}%). Presja kosztowa słabnie — dobry moment na negocjacje długoterminowe.`,
    insightFnEn: (v, p) => v > p
      ? `Inflation rising (${v.toFixed(1)}%). Energy and transport costs may increase in coming months.`
      : `Inflation falling (${v.toFixed(1)}%). Cost pressure easing — good time for long-term contract negotiations.`,
  },
  PPIACO: {
    name: 'PPI (ceny producenta)',
    nameEn: 'PPI (producer prices)',
    unit: '%',
    importance: 'high',
    country: 'US',
    flag: '🇺🇸',
    insightFn: (v, p) => v > p
      ? `PPI powyżej poprzedniego odczytu (${v.toFixed(1)}). Surowce drożeją — wyceny stali i aluminium mogą pójść w górę.`
      : `PPI spada (${v.toFixed(1)}). Presja na ceny surowców maleje.`,
    insightFnEn: (v, p) => v > p
      ? `PPI above previous reading (${v.toFixed(1)}). Raw materials getting more expensive — steel and aluminum prices may rise.`
      : `PPI falling (${v.toFixed(1)}). Commodity price pressure decreasing.`,
  },
  FEDFUNDS: {
    name: 'Stopy Fed',
    nameEn: 'Fed Funds Rate',
    unit: '%',
    importance: 'medium',
    country: 'US',
    flag: '🇺🇸',
    insightFn: (v, p) => v > p
      ? `Fed podniósł stopy (${v.toFixed(2)}%). Wyższy koszt finansowania → droższe rezerwy surowcowe.`
      : v < p
        ? `Fed obniżył stopy (${v.toFixed(2)}%). Tańszy pieniądz może stymulować popyt na surowce.`
        : `Stopy Fed bez zmian (${v.toFixed(2)}%). Rynek w trybie oczekiwania.`,
    insightFnEn: (v, p) => v > p
      ? `Fed raised rates (${v.toFixed(2)}%). Higher financing costs → more expensive commodity reserves.`
      : v < p
        ? `Fed cut rates (${v.toFixed(2)}%). Cheaper money may stimulate commodity demand.`
        : `Fed rates unchanged (${v.toFixed(2)}%). Market in wait-and-see mode.`,
  },
  DCOILWTICO: {
    name: 'Ropa WTI',
    nameEn: 'WTI Crude Oil',
    unit: '$/bbl',
    importance: 'high',
    country: 'US',
    flag: '🇺🇸',
    insightFn: (v, p) => v > p
      ? `Ropa WTI drożeje ($${v.toFixed(1)}/bbl). Bezpośredni wpływ na koszt transportu i energii.`
      : `Ropa WTI tanieje ($${v.toFixed(1)}/bbl). Transport i energia mogą lekko spaść.`,
    insightFnEn: (v, p) => v > p
      ? `WTI crude rising ($${v.toFixed(1)}/bbl). Direct impact on transport and energy costs.`
      : `WTI crude falling ($${v.toFixed(1)}/bbl). Transport and energy costs may ease slightly.`,
  },
  MHHNGSP: {
    name: 'Gaz ziemny',
    nameEn: 'Natural Gas',
    unit: '$/MMBtu',
    importance: 'medium',
    country: 'US',
    flag: '🇺🇸',
    insightFn: (v, p) => v > p
      ? `Gaz drożeje ($${v.toFixed(2)}/MMBtu). Koszty energochłonnych procesów produkcyjnych rosną.`
      : `Gaz tanieje ($${v.toFixed(2)}/MMBtu). Ulga dla energochłonnych kategorii.`,
    insightFnEn: (v, p) => v > p
      ? `Natural gas rising ($${v.toFixed(2)}/MMBtu). Energy-intensive production costs increasing.`
      : `Natural gas falling ($${v.toFixed(2)}/MMBtu). Relief for energy-intensive categories.`,
  },
};

// ─── mock fallback ────────────────────────────────────────────────────────────

function getMockEvents(lang: string): MacroEvent[] {
  const en = lang === 'en';
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  return [
    {
      id: 'mock-cpi',
      date: today,
      time: '14:30',
      country: 'US',
      flag: '🇺🇸',
      event: en ? 'CPI (inflation)' : 'CPI (inflacja)',
      seriesId: 'CPIAUCSL',
      importance: 'high',
      actual: 3.4,
      forecast: 3.2,
      previous: 3.0,
      change: 0.4,
      trend: 'up',
      unit: '%',
      affects: ['energy', 'transport'],
      insight: en
        ? 'Inflation above expectations. Energy and transport costs may rise in coming months.'
        : 'Inflacja powyżej oczekiwań. Koszty energii i transportu mogą wzrosnąć w kolejnych miesiącach.',
    },
    {
      id: 'mock-ppi',
      date: today,
      time: '14:30',
      country: 'US',
      flag: '🇺🇸',
      event: en ? 'PPI (producer prices)' : 'PPI (ceny producenta)',
      seriesId: 'PPIACO',
      importance: 'high',
      actual: 1.8,
      forecast: 2.0,
      previous: 1.6,
      change: 0.2,
      trend: 'up',
      unit: '%',
      affects: ['steel', 'aluminum'],
      insight: en
        ? 'PPI in line with upward trend. Industrial raw materials getting more expensive — consider securing prices.'
        : 'PPI zgodny z trendem wzrostowym. Surowce przemysłowe drożeją — rozważ zabezpieczenie cen.',
    },
    {
      id: 'mock-fedfunds',
      date: yesterday,
      time: '20:00',
      country: 'US',
      flag: '🇺🇸',
      event: en ? 'Fed Funds Rate' : 'Stopy Fed',
      seriesId: 'FEDFUNDS',
      importance: 'medium',
      actual: 5.33,
      forecast: 5.33,
      previous: 5.33,
      change: 0,
      trend: 'flat',
      unit: '%',
      affects: ['steel', 'aluminum', 'transport', 'energy'],
      insight: en
        ? 'Rates unchanged. Market in wait-and-see mode — change expected when inflation drops below 3%.'
        : 'Stopy bez zmian. Rynek w trybie oczekiwania — zmiana nastąpi przy odczycie inflacji poniżej 3%.',
    },
    {
      id: 'mock-oil',
      date: yesterday,
      time: 'All day',
      country: 'US',
      flag: '🇺🇸',
      event: en ? 'WTI Crude Oil' : 'Ropa WTI',
      seriesId: 'DCOILWTICO',
      importance: 'high',
      actual: 78.4,
      forecast: 76.0,
      previous: 74.2,
      change: 4.2,
      trend: 'up',
      unit: '$/bbl',
      affects: ['energy', 'transport'],
      insight: en
        ? 'Crude above forecast. Transport and energy costs rising — worth monitoring supplier offers.'
        : 'Ropa powyżej prognoz. Koszty transportu i energii rosną — warto monitorować oferty dostawców.',
    },
  ];
}

// ─── FRED fetch ───────────────────────────────────────────────────────────────

async function fetchFredSeries(seriesId: string, apiKey: string): Promise<{ value: number; date: string }[]> {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=6`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FRED ${seriesId}: HTTP ${res.status}`);
  const data = await res.json() as { observations: Array<{ date: string; value: string }> };
  return data.observations
    .filter((o) => o.value !== '.')
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
}

function calcTrend(obs: { value: number }[]): 'up' | 'down' | 'flat' {
  if (obs.length < 2) return 'flat';
  const last3 = obs.slice(0, 3).map((o) => o.value);
  if (last3[0] > last3[last3.length - 1]) return 'up';
  if (last3[0] < last3[last3.length - 1]) return 'down';
  return 'flat';
}

// How many recent observations to surface per series as separate events
// Monthly series: 2 (current + previous month)
// Daily/weekly series: 1 (just the latest — avoid flooding the panel)
const SERIES_MAX_EVENTS: Record<string, number> = {
  CPIAUCSL:  2,
  PPIACO:    2,
  FEDFUNDS:  2,
  DCOILWTICO: 1,
  MHHNGSP:   1,
};

async function buildFredEvents(apiKey: string, lang: string): Promise<MacroEvent[]> {
  const results: MacroEvent[] = [];
  const en = lang === 'en';

  for (const [seriesId, meta] of Object.entries(SERIES_META)) {
    try {
      const obs = await fetchFredSeries(seriesId, apiKey);
      if (obs.length === 0) continue;

      const maxEvents = SERIES_MAX_EVENTS[seriesId] ?? 1;
      const trend = calcTrend(obs);
      const insightFn = en ? meta.insightFnEn : meta.insightFn;

      // Emit one event per observation (up to maxEvents)
      for (let i = 0; i < Math.min(maxEvents, obs.length); i++) {
        const latest = obs[i];
        const prev = obs[i + 1] ?? null;
        const change = prev ? latest.value - prev.value : null;
        const fallbackInsight = en
          ? `Latest value: ${latest.value} ${meta.unit}`
          : `Ostatnia wartość: ${latest.value} ${meta.unit}`;

        results.push({
          id: `fred-${seriesId.toLowerCase()}-${latest.date}`,
          date: latest.date,
          time: 'All day',
          country: meta.country,
          flag: meta.flag,
          event: en ? meta.nameEn : meta.name,
          seriesId,
          importance: meta.importance,
          actual: latest.value,
          forecast: null,
          previous: prev?.value ?? null,
          change,
          trend: i === 0 ? trend : null,
          unit: meta.unit,
          affects: IMPACT_MAP[seriesId] ?? [],
          insight: prev ? insightFn(latest.value, prev.value) : fallbackInsight,
        });
      }
    } catch (err) {
      console.warn(`[FRED] Skipping ${seriesId}:`, (err as Error).message);
    }
  }

  return results;
}

// ─── route ────────────────────────────────────────────────────────────────────

// Simple in-memory cache per language (10 min TTL)
const caches: Record<string, { data: MacroEvent[]; ts: number }> = {};
const CACHE_TTL = 10 * 60 * 1000;

macroEventsRouter.get('/macro-events', async (req: Request, res: Response): Promise<void> => {
  const lang = (req.query.lang as string) === 'en' ? 'en' : 'pl';
  const nocache = req.query.nocache === '1';
  const cached = caches[lang];

  if (!nocache && cached && Date.now() - cached.ts < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  const fredKey = process.env.FRED_API_KEY;

  if (!fredKey) {
    res.json(getMockEvents(lang));
    return;
  }

  try {
    const events = await buildFredEvents(fredKey, lang);
    const sorted = events.sort((a, b) => b.date.localeCompare(a.date));
    caches[lang] = { data: sorted, ts: Date.now() };
    res.json(sorted);
  } catch (err) {
    console.error('[macro-events] FRED error, falling back to mock:', err);
    res.json(getMockEvents(lang));
  }
});
