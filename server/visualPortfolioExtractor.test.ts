import { describe, expect, it } from "vitest";
import { parseVisualPortfolioResponse } from "./visualPortfolioExtractor";

const completePortfolioResponse = {
  found: true,
  page: 7,
  schemePageVerified: true,
  schemeHeading: "Example Flexi Cap Fund",
  portfolioTableOnSamePage: true,
  tableHeader: "Portfolio Holdings — % of Net Assets",
  tableScope: "full_portfolio",
  tableIsComplete: true,
  evidence: "Page heading and full portfolio table are visibly together.",
  holdings: Array.from({ length: 8 }, (_, index) => ({
    companyName: `Example Company ${index + 1} Limited`,
    percentage: 10,
    isin: index === 0 ? "INE000A01001" : "",
    nseSymbol: index === 0 ? "EXAMPLE" : "",
    securityType: "Equity",
  })),
};

describe("visual portfolio-table response validation", () => {
  it("accepts a complete selected-scheme page table and preserves printed identifiers", () => {
    const result = parseVisualPortfolioResponse(JSON.stringify(completePortfolioResponse), "Example Flexi Cap Fund", [7]);

    expect(result).toMatchObject({ found: true, page: 7, tableScope: "full_portfolio" });
    expect(result?.holdings).toHaveLength(8);
    expect(result?.holdings[0]).toMatchObject({ isin: "INE000A01001", nseSymbol: "EXAMPLE", securityType: "Equity" });
  });

  it("withholds a top-holdings table even when its visible rows add to more than 80 percent", () => {
    const result = parseVisualPortfolioResponse(JSON.stringify({
      ...completePortfolioResponse,
      tableHeader: "Top 10 Holdings — % of Net Assets",
      tableScope: "top_holdings",
      tableIsComplete: false,
    }), "Example Flexi Cap Fund", [7]);

    expect(result).toBeUndefined();
  });

  it("withholds a response that claims a different page than the pre-verified selected-scheme page", () => {
    const result = parseVisualPortfolioResponse(JSON.stringify({ ...completePortfolioResponse, page: 8 }), "Example Flexi Cap Fund", [7]);

    expect(result).toBeUndefined();
  });

  it("preserves FoF categories, subtotals, and negative cash rows without counting totals as holdings", () => {
    const result = parseVisualPortfolioResponse(JSON.stringify({
      ...completePortfolioResponse,
      holdings: [
        { companyName: "TREPS / Reverse Repo Investments", percentage: 3.86, isin: "", nseSymbol: "", securityType: "Money Market", category: "MONEY MARKET INSTRUMENTS", rowType: "instrument" },
        { companyName: "Total", percentage: 3.86, isin: "", nseSymbol: "", securityType: "", category: "MONEY MARKET INSTRUMENTS", rowType: "subtotal" },
        { companyName: "Bluebox Global Technology Fund", percentage: 96.38, isin: "", nseSymbol: "", securityType: "Overseas Mutual Fund", category: "OTHERS / Overseas Mutual Fund", rowType: "instrument" },
        { companyName: "Net Receivables/Payables", percentage: -0.24, isin: "", nseSymbol: "", securityType: "Cash", category: "Cash & Cash Equivalent", rowType: "instrument" },
        { companyName: "GRAND TOTAL", percentage: 100, isin: "", nseSymbol: "", securityType: "", category: "GRAND TOTAL", rowType: "grand_total" },
      ],
    }), "Example Flexi Cap Fund", [7]);

    expect(result?.holdings).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Bluebox Global Technology Fund", category: "OTHERS / Overseas Mutual Fund", rowType: "instrument" }),
      expect.objectContaining({ label: "Total", rowType: "subtotal" }),
      expect.objectContaining({ label: "Net Receivables/Payables", percentage: -0.24 }),
    ]));
  });
});
