import Papa from 'papaparse';
import type { CostDataRow } from '../../../../shared/types';

let cachedData: CostDataRow[] | null = null;

export async function getCostData(): Promise<CostDataRow[]> {
  if (cachedData) return cachedData;

  return new Promise((resolve, reject) => {
    Papa.parse('/data/cost_scan.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = (results.data as CostDataRow[]).filter(
          (row) =>
            row.date &&
            typeof row.steel === 'number' &&
            typeof row.aluminum === 'number' &&
            typeof row.transport === 'number' &&
            typeof row.energy === 'number'
        );
        cachedData = data;
        resolve(data);
      },
      error: (err) => {
        reject(new Error(`CSV parse error: ${err.message}`));
      },
    });
  });
}

export function aggregateMonthly(data: CostDataRow[]): CostDataRow[] {
  const monthMap = new Map<string, { steel: number[]; aluminum: number[]; transport: number[]; energy: number[] }>();

  for (const row of data) {
    const month = row.date.substring(0, 7);
    if (!monthMap.has(month)) {
      monthMap.set(month, { steel: [], aluminum: [], transport: [], energy: [] });
    }
    const entry = monthMap.get(month)!;
    entry.steel.push(row.steel);
    entry.aluminum.push(row.aluminum);
    entry.transport.push(row.transport);
    entry.energy.push(row.energy);
  }

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  return Array.from(monthMap.entries()).map(([month, vals]) => ({
    date: month,
    steel: avg(vals.steel),
    aluminum: avg(vals.aluminum),
    transport: avg(vals.transport),
    energy: avg(vals.energy),
  }));
}

export function filterByTimeRange(data: CostDataRow[], range: string): CostDataRow[] {
  if (range === 'all') return data;

  const lastDate = new Date(data[data.length - 1].date + '-01');
  const cutoff = new Date(lastDate);

  switch (range) {
    case '1M': cutoff.setMonth(cutoff.getMonth() - 1); break;
    case '3M': cutoff.setMonth(cutoff.getMonth() - 3); break;
    case '6M': cutoff.setMonth(cutoff.getMonth() - 6); break;
    case '1Y': cutoff.setFullYear(cutoff.getFullYear() - 1); break;
    case '3Y': cutoff.setFullYear(cutoff.getFullYear() - 3); break;
    default: return data;
  }

  return data.filter((row) => {
    const rowDate = new Date(row.date + (row.date.length === 7 ? '-01' : ''));
    return rowDate >= cutoff;
  });
}
