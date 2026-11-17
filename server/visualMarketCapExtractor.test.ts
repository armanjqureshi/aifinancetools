import { describe, expect, it } from "vitest";
import { extractConsolidatedMarketCapFromPageText, hasSelectedSchemeMarketCapSignal, parseVisualMarketCapResponse } from "./visualMarketCapExtractor";

describe("visual market-cap response validation", () => {
  it("skips visual reading when the selected scheme page has no market-cap signal", () => {
    expect(hasSelectedSchemeMarketCapSignal([
      { text: "DSP Global Innovation Overseas Equity Omni FoF\nPortfolio\nName of Instrument % to Net Assets" },
    ], "DSP Global Innovation Overseas Equity Omni FoF")).toBe(false);
  });

  it("does not treat a contents or consolidated-page mention as a visual scheme-page signal", () => {
    expect(hasSelectedSchemeMarketCapSignal([
      { text: "Market Cap Allocation\nDSP Global Innovation Overseas Equity Omni FoF 126" },
    ], "DSP Global Innovation Overseas Equity Omni FoF")).toBe(false);
  });

  it("retains only supported positive chart labels with a verified page", () => {
    const parsed = parseVisualMarketCapResponse(JSON.stringify({
      found: true,
      page: 9,
      evidence: "Chart is on the selected scheme page.",
      allocations: [
        { label: "Large Cap", percentage: 44.79 },
        { label: "Small Cap", percentage: 29.2 },
        { label: "Unrelated label", percentage: 10 },
      ],
    }));
    expect(parsed).toEqual({
      found: true,
      page: 9,
      evidence: "Chart is on the selected scheme page.",
      allocations: [
        { label: "Large Cap", percentage: 44.79 },
        { label: "Small Cap", percentage: 29.2 },
      ],
    });
  });

  it("rejects a claimed chart without a source page or sufficient allocations", () => {
    expect(parseVisualMarketCapResponse(JSON.stringify({ found: true, page: null, evidence: "", allocations: [] }))).toBeUndefined();
  });

  it("rejects a chart unless the selected scheme and allocation are verified on the same page", () => {
    const raw = JSON.stringify({
      found: true,
      page: 9,
      schemePageVerified: true,
      schemeHeading: "Abakkus Small Cap Fund",
      marketCapOnSamePage: true,
      evidence: "A market-cap chart is visible.",
      allocations: [{ label: "Large Cap", percentage: 44.79 }, { label: "Small Cap", percentage: 29.2 }],
    });
    expect(parseVisualMarketCapResponse(raw, "Abakkus Flexi Cap Fund")).toBeUndefined();
  });

  it("accepts visual values only when the exact scheme heading and chart share a page", () => {
    const raw = JSON.stringify({
      found: true,
      page: 9,
      schemePageVerified: true,
      schemeHeading: "Abakkus Flexi Cap Fund",
      marketCapOnSamePage: true,
      evidence: "Page heading and market-cap chart match.",
      allocations: [{ label: "Large Cap", percentage: 44.79 }, { label: "Small Cap", percentage: 29.2 }],
    });
    expect(parseVisualMarketCapResponse(raw, "Abakkus Flexi Cap Fund")).toEqual(expect.objectContaining({ page: 9, allocations: expect.any(Array) }));
  });

  it("accepts a renamed scheme only when its page explicitly states the selected former name", () => {
    const raw = JSON.stringify({
      found: true,
      page: 13,
      schemePageVerified: true,
      schemeHeading: "SBI Large Cap Fund",
      schemeAliasVerified: true,
      aliasStatement: "Previously known as SBI Bluechip Fund",
      marketCapOnSamePage: true,
      evidence: "The renamed scheme page contains the chart.",
      allocations: [{ label: "Large Cap", percentage: 85 }, { label: "Mid Cap", percentage: 10 }],
    });
    expect(parseVisualMarketCapResponse(raw, "SBI Bluechip Fund")).toEqual(expect.objectContaining({ page: 13 }));
  });

  it("accepts a selected-scheme row inside a clearly evidenced consolidated market-cap table", () => {
    const raw = JSON.stringify({
      found: true,
      page: 107,
      schemePageVerified: false,
      schemeHeading: "",
      schemeAliasVerified: false,
      aliasStatement: "",
      schemeRowVerified: true,
      schemeRow: "HDFC Flexi Cap Fund",
      marketCapOnSamePage: true,
      evidence: "The MARKET CAP table has an HDFC Flexi Cap Fund row with Large Cap, MidCap, and SmallCap columns.",
      allocations: [{ label: "Large Cap", percentage: 70.94 }, { label: "Mid Cap", percentage: 14.42 }, { label: "Small Cap", percentage: 11 }],
    });
    expect(parseVisualMarketCapResponse(raw, "HDFC Flexi Cap Fund")).toEqual(expect.objectContaining({ page: 107 }));
  });

  it("extracts only the exact selected-scheme row from a page-level consolidated market-cap table", () => {
    const pageText = `
      MARKET CAP ALLOCATION
      SCHEME                         Large Cap    MidCap    SmallCap
      HDFC Flexi Cap Fund             70.94%      14.42%    11.00%
      HDFC Small Cap Fund              6.77%      10.76%    72.50%
    `;
    expect(extractConsolidatedMarketCapFromPageText(pageText, "HDFC Flexi Cap Fund")).toEqual([
      { label: "Large Cap", percentage: 70.94 },
      { label: "Mid Cap", percentage: 14.42 },
      { label: "Small Cap", percentage: 11 },
    ]);
    expect(extractConsolidatedMarketCapFromPageText(pageText, "HDFC Small Cap Fund")).toEqual([
      { label: "Large Cap", percentage: 6.77 },
      { label: "Mid Cap", percentage: 10.76 },
      { label: "Small Cap", percentage: 72.5 },
    ]);
  });

  it("treats an empty provider response as an unavailable visual result", () => {
    expect(parseVisualMarketCapResponse("")).toBeUndefined();
  });
});
