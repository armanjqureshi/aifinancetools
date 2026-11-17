import { describe, expect, it } from "vitest";
import { extractSchemeAllocations } from "./pdfParser";
import { determinePortfolioTableScope, hasExplicitAllocationTable, hasReliableIndustryLabels, hasReliablePortfolioLabels } from "./schemePageAllocationReader";

describe("selected-scheme page allocation rules", () => {
  it("uses only the standalone scheme page instead of a manager-table mention", () => {
    const managerPage = [
      "Fund Manager Funds Managed Page",
      "Mr. Sample Alpha Growth Fund 7-8",
      "Industry Financial Services 31.00",
    ].join("\n");
    const schemePage = [
      "Alpha Growth Fund",
      "Investment Objective",
      "PORTFOLIO",
      "ICICI Bank Ltd 1000 12000 9.21",
    ].join("\n");

    expect(extractSchemeAllocations(managerPage, "Alpha Growth Fund", ["Alpha Growth Fund"]).portfolioHoldings).toEqual([]);
    expect(extractSchemeAllocations(schemePage, "Alpha Growth Fund", ["Alpha Growth Fund"]).portfolioHoldings).toEqual([
      { companyName: "ICICI Bank", percentage: 9.21 },
    ]);
  });

  it("requires an explicit allocation table and rejects fragmented company labels", () => {
    expect(hasExplicitAllocationTable("Industry Financial Services 31.00", "industry")).toBe(false);
    expect(hasExplicitAllocationTable("TOP 10 SECTORS\nFinancial Services 31.00", "industry")).toBe(true);
    expect(hasExplicitAllocationTable("PORTFOLIO HOLDINGS\nCompany Name Weight", "portfolio")).toBe(true);
    expect(hasExplicitAllocationTable("PORTFOLIO\nCompany/ Instrument Industry % to NAV", "portfolio")).toBe(true);
    expect(hasReliablePortfolioLabels([{ label: "ICICI Bank", percentage: 9.21 }])).toBe(true);
    expect(hasReliablePortfolioLabels([{ label: "Ltd. Healthcare Services", percentage: 0.59 }])).toBe(false);
  });

  it("rejects risk and return metrics that are not Industry/Sector allocation rows", () => {
    expect(hasReliableIndustryLabels([{ label: "Risk Free Rate assumed to be", percentage: 6.14 }])).toBe(false);
    expect(hasReliableIndustryLabels([
      { label: "Financial Services", percentage: 31 },
      { label: "Healthcare", percentage: 12.5 },
    ])).toBe(true);
  });

  it("recognizes a complete instrument portfolio with a grand total as a full portfolio", () => {
    expect(determinePortfolioTableScope("Portfolio\nName of Instrument % to Net Assets\nGRAND TOTAL 100.00", [
      { label: "TREPS / Reverse Repo Investments", percentage: 3.86, rowType: "instrument" },
      { label: "Bluebox Global Technology Fund", percentage: 96.14, rowType: "instrument" },
      { label: "GRAND TOTAL", percentage: 100, rowType: "grand_total" },
    ])).toBe("full_portfolio");
  });
});
