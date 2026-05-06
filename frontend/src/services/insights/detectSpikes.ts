import type { CostDataRow, ComponentKey } from '../../../../shared/types';

export interface Spike {
  component: ComponentKey;
  date: string;
  changePct: number;
  direction: 'up' | 'down';
}

const SPIKE_THRESHOLD = 0.08; // 8% monthly change = significant

export function detectSpikes(monthlyData: CostDataRow[]): Spike[] {
  const spikes: Spike[] = [];
  const components: ComponentKey[] = ['steel', 'aluminum', 'transport', 'energy'];

  for (let i = 1; i < monthlyData.length; i++) {
    const prev = monthlyData[i - 1];
    const curr = monthlyData[i];

    for (const comp of components) {
      const prevVal = prev[comp] as number;
      const currVal = curr[comp] as number;
      const changePct = (currVal - prevVal) / prevVal;

      if (Math.abs(changePct) >= SPIKE_THRESHOLD) {
        spikes.push({
          component: comp,
          date: curr.date,
          changePct: changePct * 100,
          direction: changePct > 0 ? 'up' : 'down',
        });
      }
    }
  }

  return spikes;
}

export function getLargestSpike(spikes: Spike[]): Spike | null {
  if (spikes.length === 0) return null;
  return spikes.reduce((max, s) =>
    Math.abs(s.changePct) > Math.abs(max.changePct) ? s : max
  );
}

export function getRecentSpikes(spikes: Spike[], monthsBack = 12): Spike[] {
  const cutoffDate = new Date('2025-12-01');
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsBack);
  const cutoff = cutoffDate.toISOString().substring(0, 7);
  return spikes.filter((s) => s.date >= cutoff);
}
