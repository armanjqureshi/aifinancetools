export type ComparisonAllocation = { label: string; percentage: number };
export type ComparisonSource = "factsheet" | "calculated" | "unavailable";

export function chooseComparisonMarketCap(input: {
  disclosed: ComparisonAllocation[];
  calculated?: ComparisonAllocation[];
  calculationStatus?: "verified" | "partial" | "insufficient_portfolio_data";
}) {
  if (input.disclosed.length > 0) {
    return {
      allocations: input.disclosed,
      source: "factsheet" as const,
      note: "Page-verified factsheet disclosure",
    };
  }
  if (input.calculationStatus !== "insufficient_portfolio_data" && (input.calculated?.length ?? 0) > 0) {
    return {
      allocations: input.calculated ?? [],
      source: "calculated" as const,
      note: "Calculated fallback because no page-verified factsheet allocation was disclosed",
    };
  }
  return {
    allocations: [],
    source: "unavailable" as const,
    note: "No verified factsheet allocation or eligible calculated fallback is available",
  };
}
