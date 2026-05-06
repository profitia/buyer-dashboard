import type { CostDataRow, ComponentWeights } from '../../../../shared/types';

export interface WeightedComponents {
  steel: number;
  aluminum: number;
  transport: number;
  energy: number;
}

/**
 * Converts raw component prices into their absolute weighted contribution (EUR).
 * 
 * Formula: weighted = (raw_price / baseline_price) * (weight / 100) * base_product_price
 * 
 * Example: steel = 110, baseline steel = 100, weight 40%, base price 1000
 * → 110/100 * 0.40 * 1000 = 440 EUR
 */
export function calculateWeightedComponents(
  row: CostDataRow,
  baseline: CostDataRow,
  weights: ComponentWeights,
  basePrice: number
): WeightedComponents {
  const steelRatio    = row.steel    / baseline.steel;
  const aluminumRatio = row.aluminum / baseline.aluminum;
  const transportRatio = row.transport / baseline.transport;
  const energyRatio   = row.energy   / baseline.energy;

  return {
    steel:     steelRatio    * (weights.steel    / 100) * basePrice,
    aluminum:  aluminumRatio * (weights.aluminum  / 100) * basePrice,
    transport: transportRatio * (weights.transport / 100) * basePrice,
    energy:    energyRatio   * (weights.energy   / 100) * basePrice,
  };
}

/**
 * Should Cost = sum of all weighted components (EUR)
 */
export function calculateShouldCostFromWeighted(wc: WeightedComponents): number {
  return wc.steel + wc.aluminum + wc.transport + wc.energy;
}

/**
 * Returns contribution share of each component as % of total should cost.
 * Used for business-language insights.
 */
export function calculateComponentShares(wc: WeightedComponents): WeightedComponents {
  const total = calculateShouldCostFromWeighted(wc);
  if (total === 0) return { steel: 0, aluminum: 0, transport: 0, energy: 0 };
  return {
    steel:     (wc.steel    / total) * 100,
    aluminum:  (wc.aluminum  / total) * 100,
    transport: (wc.transport / total) * 100,
    energy:    (wc.energy   / total) * 100,
  };
}
