export type AmfiCategory = "large_cap" | "mid_cap" | "small_cap";

export type OfficialSecurityClassification = {
  companyName: string;
  normalizedName: string;
  isin?: string | null;
  nseSymbol?: string | null;
  category: AmfiCategory;
  rank: number;
};

export type PortfolioHoldingForCalculation = {
  companyName: string;
  percentage: number;
  isin?: string | null;
  nseSymbol?: string | null;
};

export type CalculatedHolding = PortfolioHoldingForCalculation & {
  category: AmfiCategory | "cash" | "debt" | "other" | "unresolved";
  matchMethod: "isin" | "symbol" | "name" | "asset_type" | "unresolved";
  officialCompanyName?: string;
  officialRank?: number;
};

export function normalizeSecurityName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|incorporated|inc|corporation|corp|company|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assetTypeCategory(name: string): CalculatedHolding["category"] | undefined {
  const normalized = normalizeSecurityName(name);
  if (/(cash|treps|triparty repo|repo|net receivable|payable|money market)/.test(normalized)) return "cash";
  if (/(bond|debenture|commercial paper|certificate of deposit|government security|g sec|t bill|sdl)/.test(normalized)) return "debt";
  if (/(etf|exchange traded fund|reit|invit|future|option|swap)/.test(normalized)) return "other";
  return undefined;
}

export function calculateSebiMarketCapAllocation(
  holdings: PortfolioHoldingForCalculation[],
  classifications: OfficialSecurityClassification[],
  options?: { portfolioTableScope?: "full_portfolio" | "top_holdings" | "unknown" },
) {
  const byIsin = new Map(classifications.filter((row) => row.isin).map((row) => [row.isin!.toUpperCase(), row]));
  const bySymbol = new Map(classifications.filter((row) => row.nseSymbol).map((row) => [row.nseSymbol!.toUpperCase(), row]));
  const byName = new Map(classifications.map((row) => [row.normalizedName, row]));
  const totals: Record<CalculatedHolding["category"], number> = { large_cap: 0, mid_cap: 0, small_cap: 0, cash: 0, debt: 0, other: 0, unresolved: 0 };

  const mappedHoldings: CalculatedHolding[] = holdings.map((holding) => {
    const weight = Number(holding.percentage);
    const predefined = assetTypeCategory(holding.companyName);
    let classification: OfficialSecurityClassification | undefined;
    let matchMethod: CalculatedHolding["matchMethod"] = "unresolved";
    if (predefined) {
      totals[predefined] += weight;
      return { ...holding, percentage: weight, category: predefined, matchMethod: "asset_type" };
    }
    if (holding.isin) {
      classification = byIsin.get(holding.isin.toUpperCase());
      if (classification) matchMethod = "isin";
    }
    if (!classification && holding.nseSymbol) {
      classification = bySymbol.get(holding.nseSymbol.toUpperCase());
      if (classification) matchMethod = "symbol";
    }
    if (!classification) {
      classification = byName.get(normalizeSecurityName(holding.companyName));
      if (classification) matchMethod = "name";
    }
    if (!classification) {
      totals.unresolved += weight;
      return { ...holding, percentage: weight, category: "unresolved", matchMethod };
    }
    totals[classification.category] += weight;
    return {
      ...holding,
      percentage: weight,
      category: classification.category,
      matchMethod,
      officialCompanyName: classification.companyName,
      officialRank: classification.rank,
    };
  });

  const totalWeight = holdings.reduce((sum, holding) => sum + Number(holding.percentage || 0), 0);
  const resolvedWeight = totalWeight - totals.unresolved;
  const coveragePercent = totalWeight > 0 ? (resolvedWeight / totalWeight) * 100 : 0;
  const calculationStatus: "verified" | "partial" | "insufficient_portfolio_data" = options?.portfolioTableScope !== "full_portfolio" || totalWeight < 80
    ? "insufficient_portfolio_data"
    : totals.unresolved === 0
      ? "verified"
      : "partial";

  return { totals, mappedHoldings, unresolvedHoldings: mappedHoldings.filter((holding) => holding.category === "unresolved"), totalWeight, coveragePercent, calculationStatus };
}
