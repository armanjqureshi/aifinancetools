export type AllocationChartInput = {
  label: string;
  percentage: number;
};

export type AllocationChartRow = AllocationChartInput & {
  index: number;
};

/** Converts parsed allocation entries into safe, descending chart rows. */
export function toAllocationChartRows(items: AllocationChartInput[], limit = 8): AllocationChartRow[] {
  return items
    .filter((item) => item.label.trim().length > 0 && Number.isFinite(item.percentage) && item.percentage >= 0 && item.percentage <= 100)
    .sort((left, right) => right.percentage - left.percentage || left.label.localeCompare(right.label))
    .slice(0, limit)
    .map((item, index) => ({ ...item, index }));
}
