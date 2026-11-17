export type MarketCapAllocationForPolicy = { label: string; percentage: number };

/**
 * Factsheet disclosure is primary. Holdings-based AMFI calculation is allowed
 * only when no page-verified market-cap allocation was found in that factsheet.
 */
export function shouldUseHoldingsMarketCapFallback(disclosedAllocations: MarketCapAllocationForPolicy[] | undefined) {
  return !disclosedAllocations?.some((allocation) => Number.isFinite(allocation.percentage) && allocation.percentage > 0);
}
