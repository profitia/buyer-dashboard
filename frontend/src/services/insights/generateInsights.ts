import type { CostDataRow, ComponentWeights, Language } from '../../../../shared/types';
import { detectSpikes } from './detectSpikes';
import { aggregateMonthly } from '../../data/providers/csvProvider';
import { calculateWeightedComponents, calculateShouldCostFromWeighted, calculateComponentShares } from '../../domain/costScan/calculateWeightedComponents';

export interface AutoInsight {
  key: string;
  messageKey: string;
  params: Record<string, string>;
  delay: number;
}

function fmtDate(date: string, lang: Language): string {
  const d = new Date(date + '-01');
  return d.toLocaleDateString(lang === 'pl' ? 'pl-PL' : 'en-US', {
    year: 'numeric',
    month: 'long',
  });
}

const COMPONENT_NAMES: Record<string, { pl: string; en: string }> = {
  steel:     { pl: 'Stal',       en: 'Steel' },
  aluminum:  { pl: 'Aluminium',  en: 'Aluminum' },
  transport: { pl: 'Transport',  en: 'Transport' },
  energy:    { pl: 'Energia',    en: 'Energy' },
};

export function generateInsights(
  allData: CostDataRow[],
  weights: ComponentWeights,
  lang: Language,
  basePrice: number
): AutoInsight[] {
  const monthly = aggregateMonthly(allData);
  if (monthly.length < 2) return [];

  const baseline = monthly[0];
  const latest   = monthly[monthly.length - 1];
  const insights: AutoInsight[] = [];

  // --- Insight 1: Which component dominates should cost today ---
  const latestWC = calculateWeightedComponents(latest, baseline, weights, basePrice);
  const shares   = calculateComponentShares(latestWC);
  const dominant = (Object.entries(shares) as [string, number][])
    .sort(([, a], [, b]) => b - a)[0];

  if (dominant) {
    insights.push({
      key: 'dominant_component',
      messageKey: 'insight.dominantComponent',
      params: {
        component: lang === 'pl' ? COMPONENT_NAMES[dominant[0]]?.pl : COMPONENT_NAMES[dominant[0]]?.en,
        pct: dominant[1].toFixed(0),
      },
      delay: 1500,
    });
  }

  // --- Insight 2: Should Cost change vs baseline (business framing) ---
  const baselineWC   = calculateWeightedComponents(baseline, baseline, weights, basePrice);
  const baselineSC   = calculateShouldCostFromWeighted(baselineWC);
  const latestSC     = calculateShouldCostFromWeighted(latestWC);
  const scChangePct  = ((latestSC - baselineSC) / baselineSC) * 100;
  const scChangeAbs  = latestSC - baselineSC;

  if (Math.abs(scChangePct) > 1) {
    insights.push({
      key: 'should_cost_change',
      messageKey: scChangePct > 0 ? 'insight.shouldCostUp' : 'insight.shouldCostDown',
      params: {
        pct: Math.abs(scChangePct).toFixed(1),
        abs: Math.abs(scChangeAbs).toFixed(0),
      },
      delay: 3000,
    });
  }

  // --- Insight 3: Biggest driver of cost increase ---
  // Compare which component moved most in absolute EUR terms
  const baselineContribs = { ...baselineWC };
  const latestContribs   = { ...latestWC };
  const deltas = (Object.keys(weights) as (keyof ComponentWeights)[]).map((key) => ({
    key,
    delta: (latestContribs[key] ?? 0) - (baselineContribs[key] ?? 0),
  }));
  const biggestDelta = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  if (biggestDelta && Math.abs(biggestDelta.delta) > 5) {
    const compName = lang === 'pl'
      ? COMPONENT_NAMES[biggestDelta.key]?.pl
      : COMPONENT_NAMES[biggestDelta.key]?.en;
    insights.push({
      key: `driver_${biggestDelta.key}`,
      messageKey: biggestDelta.delta > 0 ? 'insight.biggestDriver' : 'insight.biggestSaver',
      params: {
        component: compName,
        abs: Math.abs(biggestDelta.delta).toFixed(0),
        pct: Math.abs((biggestDelta.delta / baselineSC) * 100).toFixed(1),
      },
      delay: 4500,
    });
  }

  // --- Insight 4: Notable spike in recent 18 months ---
  const recentStart = new Date(latest.date + '-01');
  recentStart.setMonth(recentStart.getMonth() - 18);
  const recentCutoff = recentStart.toISOString().substring(0, 7);
  const recentMonthly = monthly.filter((r) => r.date >= recentCutoff);
  const spikes = detectSpikes(recentMonthly);

  // Pick spike whose component has highest weight (most business impact)
  const weightedSpikes = spikes
    .map((s) => ({ ...s, weightedImpact: Math.abs(s.changePct) * weights[s.component] }))
    .sort((a, b) => b.weightedImpact - a.weightedImpact);

  const topSpike = weightedSpikes[0];
  if (topSpike) {
    const compName = lang === 'pl'
      ? COMPONENT_NAMES[topSpike.component]?.pl
      : COMPONENT_NAMES[topSpike.component]?.en;
    insights.push({
      key: `spike_${topSpike.component}`,
      messageKey: 'insight.weightedSpike',
      params: {
        component: compName,
        weight: weights[topSpike.component].toString(),
        pct: Math.abs(topSpike.changePct).toFixed(1),
        date: fmtDate(topSpike.date, lang),
      },
      delay: 6000,
    });
  }

  return insights;
}

