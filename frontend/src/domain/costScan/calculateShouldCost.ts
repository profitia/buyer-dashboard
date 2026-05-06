import type { CostDataRow, ComponentWeights } from '../../../../shared/types';
import {
  calculateWeightedComponents,
  calculateShouldCostFromWeighted,
  type WeightedComponents,
} from './calculateWeightedComponents';

export type { WeightedComponents };

/**
 * Calculate absolute Should Cost (EUR) for a given data row.
 * Formula: sum of (price_ratio × weight% × basePrice) for each component.
 */
export function calculateShouldCost(
  row: CostDataRow,
  baseline: CostDataRow,
  weights: ComponentWeights,
  basePrice: number
): number {
  const wc = calculateWeightedComponents(row, baseline, weights, basePrice);
  return calculateShouldCostFromWeighted(wc);
}

/**
 * Should Cost as an index (100 = baseline period).
 * Used for header stat badges.
 */
export function calculateShouldCostIndex(
  row: CostDataRow,
  baseline: CostDataRow,
  weights: ComponentWeights
): number {
  const wc = calculateWeightedComponents(row, baseline, weights, 100);
  return calculateShouldCostFromWeighted(wc);
}

/** @deprecated prefer calculateShouldCost */
export function calculateShouldCostAbsolute(index: number, basePrice: number): number {
  return (index / 100) * basePrice;
}

/** Helper: raw price → index vs baseline */
export function toIndex(current: number, base: number): number {
  return (current / base) * 100;
}
