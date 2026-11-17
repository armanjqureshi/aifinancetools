import { describe, expect, it } from "vitest";
import { chooseComparisonMarketCap } from "../client/src/lib/schemeComparison";

describe("multi-scheme comparison market-cap source", () => {
  it("uses page-verified factsheet disclosure ahead of a calculated fallback", () => {
    const result = chooseComparisonMarketCap({
      disclosed: [{ label: "Large Cap", percentage: 60 }],
      calculated: [{ label: "Large Cap", percentage: 55 }],
      calculationStatus: "verified",
    });
    expect(result).toMatchObject({ source: "factsheet", allocations: [{ label: "Large Cap", percentage: 60 }] });
  });

  it("uses a valid calculated fallback only when factsheet disclosure is absent", () => {
    const result = chooseComparisonMarketCap({ disclosed: [], calculated: [{ label: "Mid Cap", percentage: 20 }], calculationStatus: "partial" });
    expect(result.source).toBe("calculated");
  });

  it("shows unavailable when neither source is eligible", () => {
    expect(chooseComparisonMarketCap({ disclosed: [], calculated: [{ label: "Small Cap", percentage: 10 }], calculationStatus: "insufficient_portfolio_data" }).source).toBe("unavailable");
  });
});
