import { describe, expect, it } from "vitest";
import { extractSchemeAllocations, extractSchemeNames } from "./pdfParser";

// Test the internal parsing logic by importing the extraction functions
// We test them indirectly via the exported parseFactsheet function
// For unit tests, we test the regex patterns directly

describe("PDF Parser - allocation extraction patterns", () => {
  it("extracts percentage values correctly", () => {
    const extractPercentage = (text: string): number | null => {
      const match = text.match(/(\d+(?:\.\d+)?)\s*%?/);
      if (!match) return null;
      const val = parseFloat(match[1]);
      return isNaN(val) ? null : val;
    };

    expect(extractPercentage("23.45%")).toBe(23.45);
    expect(extractPercentage("10")).toBe(10);
    expect(extractPercentage("0.50%")).toBe(0.5);
    expect(extractPercentage("abc")).toBeNull();
  });

  it("validates percentage range", () => {
    const isValidPct = (pct: number) => pct >= 0 && pct <= 100;
    expect(isValidPct(23.45)).toBe(true);
    expect(isValidPct(0)).toBe(true);
    expect(isValidPct(100)).toBe(true);
    expect(isValidPct(-1)).toBe(false);
    expect(isValidPct(101)).toBe(false);
  });

  it("known sector names are present", () => {
    const KNOWN_SECTORS = [
      "Financial Services",
      "IT",
      "Healthcare",
      "Consumer Goods",
      "Automobile",
      "Energy",
    ];
    expect(KNOWN_SECTORS).toContain("Financial Services");
    expect(KNOWN_SECTORS).toContain("IT");
    expect(KNOWN_SECTORS.length).toBeGreaterThan(5);
  });

  it("limits detected schemes and allocations to the selected factsheet text", () => {
    const text = [
      "Alpha Growth Fund",
      "Industry Allocation",
      "Financial Services 31.50%",
      "Healthcare 12.25%",
      "Market Cap Allocation",
      "Large Cap 70.00%",
      "Mid Cap 20.00%",
      "Beta Value Fund",
      "Industry Allocation",
      "Information Technology 44.00%",
      "Energy 11.00%",
      "Market Cap Allocation",
      "Large Cap 25.00%",
      "Small Cap 60.00%",
    ].join("\n");

    const schemes = extractSchemeNames(text);
    expect(schemes).toEqual(["Alpha Growth Fund", "Beta Value Fund"]);
    const alpha = extractSchemeAllocations(text, "Alpha Growth Fund", schemes);
    expect(alpha.industryAllocations).toEqual(expect.arrayContaining([{ label: "Financial Services", percentage: 31.5 }]));
    expect(alpha.marketCapAllocations).toEqual(expect.arrayContaining([{ label: "Large Cap", percentage: 70 }]));
    expect(alpha.marketCapAllocations).not.toEqual(expect.arrayContaining([{ label: "Small Cap", percentage: 60 }]));
  });

  it("extracts a selected scheme's row from a consolidated market-cap table", () => {
    const text = [
      "Alpha Growth Fund",
      "Beta Value Fund",
      "SEGMENT-WISE BREAK-UP OF EQUITY HOLDING",
      "SCHEME Large Cap MidCap SmallCap",
      "Alpha Growth Fund 70.94% 14.42% 11.00%",
      "Beta Value Fund 44.00% 28.44% 26.96%",
      "This breakup pertains only to equity exposure.",
    ].join("\n");

    const alpha = extractSchemeAllocations(text, "Alpha Growth Fund", ["Alpha Growth Fund", "Beta Value Fund"]);
    expect(alpha.marketCapAllocations).toEqual([
      { label: "Large Cap", percentage: 70.94 },
      { label: "Mid Cap", percentage: 14.42 },
      { label: "Small Cap", percentage: 11 },
    ]);
  });

  it("finds a market-cap table near a later scheme occurrence after a table of contents", () => {
    const text = [
      "Alpha Growth Fund 7-8",
      "Beta Value Fund 9-10",
      "Alpha Growth Fund",
      "Portfolio details",
      "Market Cap Allocation",
      "LargeCap 62.00%",
      "MidCap 24.00%",
      "SmallCap 10.00%",
      "Beta Value Fund",
    ].join("\n");

    const alpha = extractSchemeAllocations(text, "Alpha Growth Fund", ["Alpha Growth Fund", "Beta Value Fund"]);
    expect(alpha.marketCapAllocations).toEqual(expect.arrayContaining([
      { label: "LargeCap", percentage: 62 },
      { label: "MidCap", percentage: 24 },
      { label: "SmallCap", percentage: 10 },
    ]));
  });

  it("does not borrow market-cap values from a later non-heading mention of Abakkus Flexi Cap Fund", () => {
    const text = [
      "Abakkus Flexi Cap Fund",
      "MARKET CAP ALLOCATION %",
      "Financial Services Capital Goods Consumer Services",
      "Abakkus Flexi Cap Fund",
      "29.81% 13.63% 7.72%",
      "Abakkus Flexi Cap Fund - Managed by the investment team",
      "MARKET CAP ALLOCATION",
      "Large Cap 5.84",
      "Mid Cap 3.25",
      "Small Cap 78.90",
      "Abakkus Small Cap Fund",
    ].join("\n");

    const result = extractSchemeAllocations(text, "Abakkus Flexi Cap Fund", ["Abakkus Flexi Cap Fund", "Abakkus Small Cap Fund"]);
    expect(result.marketCapAllocations).toEqual([]);
  });

  it("excludes generic headings and wrapped name fragments from scheme options", () => {
    const text = [
      "Nature of Scheme",
      "Equity Fund",
      "Exchange Traded Fund",
      "Maturity Index Fund",
      "Volatility 30 Index Fund",
      "Dynamic Debt Scheme",
      "250 Index Fund",
      "Franklin India Multi-Factor Fund",
      "Multi-Factor Fund",
      "Franklin India Large Cap Fund",
      "Large Cap Fund",
      "Franklin India Small Cap Fund",
      "Cap Fund",
      "Banking & PSU Fund",
      "Franklin India Banking & PSU Debt Fund",
      "Franklin India Banking and PSU Debt Fund",
      "HDFC Flexi Cap Fund",
      "Large Cap Fund Flexi Cap Fund",
      "Focused Fund Large & Mid Cap Fund",
      "An Open-End Equity Linked Savings Scheme",
      "An Open Ended Equity Scheme",
    ].join("\n");

    expect(extractSchemeNames(text, "Franklin Templeton India")).toEqual([
      "Franklin India Multi-Factor Fund",
      "Franklin India Large Cap Fund",
      "Franklin India Small Cap Fund",
      "Franklin India Banking & PSU Debt Fund",
    ]);
  });

  it("preserves meaningful uppercase AMC and index prefixes while removing document codes", () => {
    const text = [
      "FIMAAF Franklin India Multi-Asset Fund",
      "HDFC Nifty 250 Index Fund",
      "ICICI Prudential Bluechip Fund",
    ].join("\n");

    expect(extractSchemeNames(text, "HDFC Mutual Fund")).toContain("HDFC Nifty 250 Index Fund");
    expect(extractSchemeNames(text, "ICICI Prudential Mutual Fund")).toContain("ICICI Prudential Bluechip Fund");
    expect(extractSchemeNames(text, "Franklin Templeton India")).toContain("Franklin India Multi-Asset Fund");
  });

  it("removes serial prefixes while preserving the legitimate 360 ONE AMC brand", () => {
    const miraeText = [
      "25 MIRAE ASSET LARGE CAP FUND",
      "Investment Objective",
      "Fund Manager",
    ].join("\n");
    const threeSixtyText = [
      "360 ONE FlexiCap Fund",
      "Investment Objective",
      "Fund Manager",
    ].join("\n");

    expect(extractSchemeNames(miraeText, "Mirae Asset Mutual Fund")).toEqual(["MIRAE ASSET LARGE CAP FUND"]);
    expect(extractSchemeNames(threeSixtyText, "360 ONE Asset")).toEqual(["360 ONE FlexiCap Fund"]);
  });

  it("rejects narrative names and accepts a specific unbranded legacy name only with scheme-page evidence", () => {
    const text = [
      "IMF International Monetary Fund",
      "Returns of HDFC Nifty Private Bank Index Fund",
      "HDFC Flexi Cap Fund",
      "Investment Objective",
      "Fund Manager",
      "Legacy Strategic Value Fund",
      "Portfolio Holdings",
      "Market Cap Allocation",
    ].join("\n");

    expect(extractSchemeNames(text, "HDFC Mutual Fund")).toEqual([
      "HDFC Flexi Cap Fund",
      "Legacy Strategic Value Fund",
    ]);
  });

  it("extracts company holdings only from the selected scheme's portfolio section", () => {
    const text = [
      "Alpha Growth Fund 7-8",
      "Beta Value Fund 9-10",
      "Alpha Growth Fund",
      "Investment Objective",
      "EQUITY HOLDINGS",
      "Infosys Ltd 2799468 31636.79 4.22",
      "Reliance Industries Ltd 3348382 43790.14 5.85",
      "Total Equity Holdings 734464.11 98.08",
      "Beta Value Fund",
      "EQUITY HOLDINGS",
      "Tata Motors Ltd 1687518 7371.08 2.06",
    ].join("\n");

    const alpha = extractSchemeAllocations(text, "Alpha Growth Fund", ["Alpha Growth Fund", "Beta Value Fund"]);
    expect(alpha.portfolioHoldings).toEqual([
      { companyName: "Reliance Industries Ltd", percentage: 5.85 },
      { companyName: "Infosys Ltd", percentage: 4.22 },
    ]);
  });

  it("extracts holdings when an industry column appears between company and weight", () => {
    const text = [
      "Alpha Growth Fund",
      "PORTFOLIO",
      "• ICICI Bank Ltd. Banks 9.21",
      "• Reliance Industries Ltd. Petroleum Products 1.56",
      "Beta Value Fund",
    ].join("\n");

    const alpha = extractSchemeAllocations(text, "Alpha Growth Fund", ["Alpha Growth Fund", "Beta Value Fund"]);
    expect(alpha.portfolioHoldings).toEqual([
      { companyName: "ICICI Bank", percentage: 9.21 },
      { companyName: "Reliance Industries Ltd", percentage: 1.56 },
    ]);
  });

  it("does not use a fund-manager table reference as a selected-scheme portfolio boundary", () => {
    const text = [
      "Alpha Growth Fund 7-8",
      "Fund Manager Funds Managed Page",
      "Mr. Sample Alpha Growth Fund 7-8",
      "Alpha Growth Fund",
      "Investment Objective",
      "PORTFOLIO",
      "ICICI Bank Ltd 1000 12000 9.21",
      "Reliance Industries Ltd 2000 15000 5.85",
      "Beta Value Fund",
      "PORTFOLIO",
      "Tata Motors Ltd 1000 5000 2.06",
    ].join("\n");

    const alpha = extractSchemeAllocations(text, "Alpha Growth Fund", ["Alpha Growth Fund", "Beta Value Fund"]);
    expect(alpha.portfolioHoldings).toEqual([
      { companyName: "ICICI Bank", percentage: 9.21 },
      { companyName: "Reliance Industries Ltd", percentage: 5.85 },
    ]);
  });

  it("preserves selected-scheme FoF portfolio categories, instruments, subtotals, cash, and grand total", () => {
    const text = [
      "DSP Global Innovation Overseas Equity Omni FoF",
      "Portfolio",
      "Name of Instrument % to Net Assets",
      "MONEY MARKET INSTRUMENTS",
      "TREPS / Reverse Repo Investments 3.86",
      "Total 3.86",
      "OTHERS",
      "Overseas Mutual Fund",
      "Bluebox Global Technology Fund 39.46",
      "iShares NASDAQ 100 UCITS ETF 27.91",
      "Invesco NASDAQ-100 Equal Weight UCITS ETF 12.45",
      "KraneShares CSI China Internet ETF 10.51",
      "Fidelity Select Medical Technology and Devices Portfolio 3.60",
      "Bluebox Precision Medicine Fund 2.44",
      "Total 96.37",
      "Cash & Cash Equivalent",
      "Net Receivables/Payables -0.24",
      "Total -0.24",
      "GRAND TOTAL 100.00",
      "DSP Flexi Cap Fund",
      "PORTFOLIO",
      "Reliance Industries Ltd 5.85",
    ].join("\n");

    const portfolio = extractSchemeAllocations(text, "DSP Global Innovation Overseas Equity Omni FoF", ["DSP Global Innovation Overseas Equity Omni FoF", "DSP Flexi Cap Fund"]);

    expect(portfolio.portfolioHoldings).toEqual(expect.arrayContaining([
      { companyName: "TREPS / Reverse Repo Investments", percentage: 3.86, category: "MONEY MARKET INSTRUMENTS", rowType: "instrument" },
      { companyName: "Bluebox Global Technology Fund", percentage: 39.46, category: "OTHERS / Overseas Mutual Fund", rowType: "instrument" },
      { companyName: "Net Receivables/Payables", percentage: -0.24, category: "Cash & Cash Equivalent", rowType: "instrument" },
      { companyName: "Total", percentage: 96.37, category: "OTHERS / Overseas Mutual Fund", rowType: "subtotal" },
      { companyName: "GRAND TOTAL", percentage: 100, category: "GRAND TOTAL", rowType: "grand_total" },
    ]));
    expect(portfolio.portfolioHoldings).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ companyName: "Reliance Industries Ltd" }),
    ]));
  });

  it("uses the deterministic fast path for wrapped equity rows and full portfolio totals", () => {
    const text = [
      "HDFC Flexi Cap Fund",
      "PORTFOLIO",
      "Company/ Instrument Industry % to NAV",
      "EQUITY & EQUITY RELATED",
      "ICICI Bank Ltd. Banks 9.21",
      "SBI Life Insurance Company",
      "Ltd. Insurance 3.56",
      "Sub Total 12.77",
      "DEBT & DEBT RELATED",
      "7.38 GOI 2027 Sovereign 0.27",
      "Sub Total 0.27",
      "Cash,Cash Equivalents and Net Current Assets 86.96",
      "Grand Total 100.00",
    ].join("\n");

    const portfolio = extractSchemeAllocations(text, "HDFC Flexi Cap Fund", ["HDFC Flexi Cap Fund"]);

    expect(portfolio.portfolioHoldings).toEqual(expect.arrayContaining([
      { companyName: "SBI Life Insurance Company Ltd. Insurance", percentage: 3.56, category: "EQUITY & EQUITY RELATED", rowType: "instrument" },
      { companyName: "Grand Total", percentage: 100, category: "GRAND TOTAL", rowType: "grand_total" },
    ]));
  });
});
