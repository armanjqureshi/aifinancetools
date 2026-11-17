import { invokeLLM } from "./_core/llm";
import { ENV } from "./_core/env";

export type VerifiedPortfolioHolding = {
  label: string;
  percentage: number;
  isin?: string;
  nseSymbol?: string;
  securityType?: string;
  category?: string;
  rowType?: "instrument" | "subtotal" | "grand_total";
};

export type PortfolioTableScope = "full_portfolio" | "top_holdings" | "unknown";

type VisualPortfolioResult = {
  found: boolean;
  page: number | null;
  schemePageVerified: boolean;
  schemeHeading: string;
  portfolioTableOnSamePage: boolean;
  tableHeader: string;
  tableScope: PortfolioTableScope;
  tableIsComplete: boolean;
  evidence: string;
  holdings: Array<{
    companyName: string;
    percentage: number;
    isin: string;
    nseSymbol: string;
    securityType: string;
    category?: string;
    rowType?: "instrument" | "subtotal" | "grand_total";
  }>;
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function hasFullSchemeHeading(heading: string, selectedSchemeName: string) {
  const headingValue = normalize(heading);
  const selected = normalize(selectedSchemeName);
  return headingValue === selected || headingValue.includes(selected) || selected.includes(headingValue);
}

function isSafeHolding(value: VisualPortfolioResult["holdings"][number]): value is VisualPortfolioResult["holdings"][number] {
  const label = value?.companyName?.replace(/\s+/g, " ").trim() ?? "";
  const rowType = value?.rowType ?? "instrument";
  return label.length >= 3
    && label.length <= 160
    && Number.isFinite(value?.percentage)
    && value.percentage >= -100
    && value.percentage <= 100;
}

export function parseVisualPortfolioResponse(raw: string, selectedSchemeName: string, allowedPages: number[]) {
  try {
    const value = JSON.parse(raw) as VisualPortfolioResult;
    if (typeof value.found !== "boolean"
      || (value.page !== null && (!Number.isInteger(value.page) || value.page < 1))
      || typeof value.schemePageVerified !== "boolean"
      || typeof value.schemeHeading !== "string"
      || typeof value.portfolioTableOnSamePage !== "boolean"
      || typeof value.tableHeader !== "string"
      || !["full_portfolio", "top_holdings", "unknown"].includes(value.tableScope)
      || typeof value.tableIsComplete !== "boolean"
      || typeof value.evidence !== "string"
      || !Array.isArray(value.holdings)) return undefined;

    const holdings = value.holdings
      .filter(isSafeHolding)
      .map((holding) => ({
        label: holding.companyName.replace(/\s+/g, " ").trim(),
        percentage: Number(holding.percentage),
        ...(holding.isin.trim() ? { isin: holding.isin.trim().toUpperCase() } : {}),
        ...(holding.nseSymbol.trim() ? { nseSymbol: holding.nseSymbol.trim().toUpperCase() } : {}),
        ...(holding.securityType.trim() ? { securityType: holding.securityType.trim() } : {}),
        ...(holding.category?.trim() ? { category: holding.category.trim() } : {}),
        ...(holding.rowType ? { rowType: holding.rowType } : { rowType: "instrument" as const }),
      }));
    const uniqueHoldings = new Map<string, VerifiedPortfolioHolding>();
    for (const holding of holdings) {
      const key = `${normalize(holding.label)}|${holding.category ?? ""}|${holding.rowType ?? "instrument"}|${holding.isin ?? ""}|${holding.nseSymbol ?? ""}`;
      if (!uniqueHoldings.has(key)) uniqueHoldings.set(key, holding);
    }
    const instruments = Array.from(uniqueHoldings.values()).filter((holding) => holding.rowType !== "subtotal" && holding.rowType !== "grand_total");
    const totalWeight = instruments.reduce((sum, holding) => sum + holding.percentage, 0);

    if (!value.found) return { found: false as const, holdings: [] as VerifiedPortfolioHolding[], tableScope: value.tableScope, evidence: value.evidence };
    if (!value.page || !allowedPages.includes(value.page)
      || !value.schemePageVerified
      || !hasFullSchemeHeading(value.schemeHeading, selectedSchemeName)
      || !value.portfolioTableOnSamePage
      || !/(?:portfolio|holding|security|company|issuer)/i.test(value.tableHeader)
      || value.tableScope !== "full_portfolio"
      || !value.tableIsComplete
      || instruments.length < 2
      || totalWeight < 80
      || totalWeight > 105) return undefined;

    return {
      found: true as const,
      page: value.page,
      holdings: Array.from(uniqueHoldings.values()),
      tableScope: "full_portfolio" as const,
      evidence: value.evidence,
    };
  } catch {
    return undefined;
  }
}

export async function extractVisualPortfolioFromVerifiedPages(input: {
  pdfUrl: string;
  selectedSchemeName: string;
  allowedPages: number[];
}) {
  if (!ENV.aiEnabled) return undefined;
  try {
    const response = await invokeLLM({
      model: "gemini-3-flash-preview",
      maxTokens: 16000,
      messages: [
        {
          role: "system",
          content: "You are a strict mutual-fund factsheet portfolio-table reader. Work only from a page that visibly contains the exact selected scheme's standalone heading and an explicit same-page portfolio holdings table. Never use a manager table, performance table, table of contents, a table for another scheme, an adjacent page, or a table whose actual header says Top 10/Top holdings. A full table headed PORTFOLIO or Portfolio Holdings remains full_portfolio when it lists many rows, subtotals, and portfolio totals even if a separate footnote says ‘Top Ten Holdings’ to flag individual rows; that footnote does not make the whole table a top-holdings list. Preserve portfolio section names in category (for example MONEY MARKET INSTRUMENTS or OTHERS / Overseas Mutual Fund), preserve every visible instrument row including cash or negative receivable/payable rows, and preserve Total or GRAND TOTAL rows with rowType subtotal or grand_total. Use rowType instrument for actual instruments. Set found=true only when the source visibly presents a complete portfolio table, not a selected subset, and the instrument rows total at least 80% but no more than 105%. Preserve ISIN, NSE symbol, and security type only when printed in the same instrument row. Do not guess identifiers or names. Return found=false if these conditions are not all met.",
        },
        {
          role: "user",
          content: [
            { type: "file_url", file_url: { url: input.pdfUrl, mime_type: "application/pdf" } },
            { type: "text", text: `Selected scheme: ${input.selectedSchemeName}. Only PDF pages ${input.allowedPages.join(", ")} have been pre-verified as exact standalone selected-scheme pages. Identify a same-page holdings table only on one of those pages. Explicitly classify its scope as full_portfolio, top_holdings, or unknown. For a full table, include each visible holding and its allocation weight; use an empty string for unavailable ISIN, NSE symbol, or security type.` },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "verified_portfolio_table",
          strict: true,
          schema: {
            type: "object",
            properties: {
              found: { type: "boolean" },
              page: { type: ["integer", "null"] },
              schemePageVerified: { type: "boolean" },
              schemeHeading: { type: "string" },
              portfolioTableOnSamePage: { type: "boolean" },
              tableHeader: { type: "string" },
              tableScope: { type: "string", enum: ["full_portfolio", "top_holdings", "unknown"] },
              tableIsComplete: { type: "boolean" },
              evidence: { type: "string" },
              holdings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    companyName: { type: "string" },
                    percentage: { type: "number" },
                    isin: { type: "string" },
                    nseSymbol: { type: "string" },
                    securityType: { type: "string" },
                    category: { type: "string" },
                    rowType: { type: "string", enum: ["instrument", "subtotal", "grand_total"] },
                  },
                  required: ["companyName", "percentage", "isin", "nseSymbol", "securityType", "category", "rowType"],
                  additionalProperties: false,
                },
              },
            },
            required: ["found", "page", "schemePageVerified", "schemeHeading", "portfolioTableOnSamePage", "tableHeader", "tableScope", "tableIsComplete", "evidence", "holdings"],
            additionalProperties: false,
          },
        },
      },
    });
    return parseVisualPortfolioResponse((response?.choices?.[0]?.message?.content as string) ?? "", input.selectedSchemeName, input.allowedPages);
  } catch {
    return undefined;
  }
}
