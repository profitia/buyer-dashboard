import { calculateMargin } from '../../domain/costScan/calculateMargin';
import { calculateShouldCostAbsolute } from '../../domain/costScan/calculateShouldCost';

export interface MarginAnalysis {
  shouldCostAbsolute: number;
  margin: {
    absolute: number;
    percent: number;
    isOvercharge: boolean;
  };
  shouldCostIndex: number;
}

export function detectMarginChange(
  currentShouldCostIndex: number,
  basePrice: number,
  supplierPrice: number | null
): MarginAnalysis | null {
  if (supplierPrice === null) return null;

  const shouldCostAbsolute = calculateShouldCostAbsolute(currentShouldCostIndex, basePrice);
  const margin = calculateMargin(supplierPrice, shouldCostAbsolute);

  return {
    shouldCostAbsolute,
    margin,
    shouldCostIndex: currentShouldCostIndex,
  };
}
