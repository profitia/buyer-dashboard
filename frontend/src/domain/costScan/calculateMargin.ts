export function calculateMargin(
  supplierPrice: number,
  shouldCostAbsolute: number
): {
  absolute: number;
  percent: number;
  isOvercharge: boolean;
} {
  const absolute = supplierPrice - shouldCostAbsolute;
  const percent = (absolute / shouldCostAbsolute) * 100;
  return {
    absolute,
    percent,
    isOvercharge: absolute > 0,
  };
}
