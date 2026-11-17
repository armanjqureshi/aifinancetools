import { describe, expect, it } from "vitest";
import { calculateSebiMarketCapAllocation, normalizeSecurityName } from "./sebiMarketCapCalculation";

describe("SEBI/AMFI holdings-based market-cap calculation", () => {
  it("maps exact official names, normalizes legal suffixes, and separates non-equity asset types", () => {
    const result = calculateSebiMarketCapAllocation(
      [
        { companyName: "Reliance Industries Limited", percentage: 10 },
        { companyName: "Aster DM Healthcare Ltd.", percentage: 8 },
        { companyName: "TREPS", percentage: 4 },
        { companyName: "Unknown Holdings Pvt Ltd", percentage: 3 },
      ],
      [
        { companyName: "Reliance Industries Ltd", normalizedName: normalizeSecurityName("Reliance Industries Ltd"), isin: "INE002A01018", category: "large_cap", rank: 1 },
        { companyName: "Aster DM Healthcare Limited", normalizedName: normalizeSecurityName("Aster DM Healthcare Limited"), category: "small_cap", rank: 600 },
      ]
    );

    expect(result.totals).toMatchObject({ large_cap: 10, small_cap: 8, cash: 4, unresolved: 3 });
    expect(result.calculationStatus).toBe("insufficient_portfolio_data");
    expect(result.coveragePercent).toBeCloseTo(88);
    expect(result.mappedHoldings[0]?.matchMethod).toBe("name");
  });

  it("does not call a calculation verified when the factsheet exposes only a partial portfolio", () => {
    const result = calculateSebiMarketCapAllocation(
      [{ companyName: "Reliance Industries Limited", percentage: 12 }],
      [{ companyName: "Reliance Industries Ltd", normalizedName: normalizeSecurityName("Reliance Industries Ltd"), category: "large_cap", rank: 1 }]
    );
    expect(result.calculationStatus).toBe("insufficient_portfolio_data");
  });

  it("withholds a top-holdings table even if its visible rows happen to add to the full portfolio weight", () => {
    const result = calculateSebiMarketCapAllocation(
      [{ companyName: "Reliance Industries Limited", percentage: 100 }],
      [{ companyName: "Reliance Industries Ltd", normalizedName: normalizeSecurityName("Reliance Industries Ltd"), category: "large_cap", rank: 1 }],
      { portfolioTableScope: "top_holdings" },
    );
    expect(result.calculationStatus).toBe("insufficient_portfolio_data");
  });

  it("can report a complete, fully mapped table as verified", () => {
    const result = calculateSebiMarketCapAllocation(
      [{ companyName: "Reliance Industries Limited", percentage: 100, isin: "INE002A01018" }],
      [{ companyName: "Reliance Industries Ltd", normalizedName: normalizeSecurityName("Reliance Industries Ltd"), isin: "INE002A01018", category: "large_cap", rank: 1 }],
      { portfolioTableScope: "full_portfolio" },
    );
    expect(result.calculationStatus).toBe("verified");
    expect(result.mappedHoldings[0]?.matchMethod).toBe("isin");
  });
});
