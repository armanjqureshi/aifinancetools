import { describe, expect, it } from "vitest";
import { shouldUseHoldingsMarketCapFallback } from "./marketCapFallbackPolicy";

describe("market-cap disclosure-first fallback policy", () => {
  it("does not allow the holdings calculation when page-verified factsheet allocation exists", () => {
    expect(shouldUseHoldingsMarketCapFallback([
      { label: "Large Cap", percentage: 44.79 },
      { label: "Mid Cap", percentage: 19.13 },
    ])).toBe(false);
  });

  it("allows the holdings calculation only when no verified disclosed allocation exists", () => {
    expect(shouldUseHoldingsMarketCapFallback([])).toBe(true);
    expect(shouldUseHoldingsMarketCapFallback(undefined)).toBe(true);
  });

  it("does not treat empty or invalid disclosed values as a factsheet allocation", () => {
    expect(shouldUseHoldingsMarketCapFallback([{ label: "Large Cap", percentage: 0 }])).toBe(true);
  });
});
