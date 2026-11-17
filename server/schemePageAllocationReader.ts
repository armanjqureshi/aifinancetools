import { getVisualAllocationEvidence, upsertVisualAllocationEvidence } from "./db";
import { extractSchemeAllocations } from "./pdfParser";
import { getCachedPdfTextPages, isReadablePdfUrl } from "./pdfPageCache";
import { extractVisualPortfolioFromVerifiedPages, type PortfolioTableScope } from "./visualPortfolioExtractor";

export type PageAllocation = { label: string; percentage: number; isin?: string; nseSymbol?: string; securityType?: string; category?: string; rowType?: "instrument" | "subtotal" | "grand_total" };

export type PageAllocationEvidence = {
  allocations: PageAllocation[];
  sourcePage: number | null;
  evidence: string;
  confidence: number;
  failureClass: "verified" | "no_scheme_page" | "no_table_on_page" | "provider_unavailable" | "invalid_response";
  portfolioScope?: PortfolioTableScope;
};

function normalise(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isStandaloneSchemeHeading(pageText: string, schemeName: string) {
  const expected = normalise(schemeName);
  return pageText.split(/\r?\n/).some((line) => normalise(line) === expected);
}

function allocationLabel(type: "industry" | "portfolio") {
  return type === "industry" ? "Industry/Sector" : "Portfolio";
}

// Bump whenever structural acceptance changes so previously trusted page-text
// output is revalidated instead of being silently reused.
const PAGE_READER_MODEL = "pdf-page-selected-scheme-v5";
const NEGATIVE_EVIDENCE_TTL_MS = 5 * 60 * 1000;

function isRecentEvidence(updatedAt: Date | string | null | undefined) {
  if (!updatedAt) return false;
  const timestamp = updatedAt instanceof Date ? updatedAt.getTime() : new Date(updatedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp < NEGATIVE_EVIDENCE_TTL_MS;
}

function portfolioScopeFromEvidence(evidence: string): PortfolioTableScope | undefined {
  const match = evidence.match(/Portfolio table scope:\s*(full_portfolio|top_holdings|unknown)/i);
  return match?.[1]?.toLowerCase() as PortfolioTableScope | undefined;
}

export function hasExplicitAllocationTable(pageText: string, type: "industry" | "portfolio") {
  if (type === "industry") {
    return /(?:industry|sector)\s*(?:allocation|exposure)|top\s+\d+\s+sectors/i.test(pageText);
  }
  return /(?:portfolio\s+holdings|top\s+(?:10|ten)\s+holdings|company\s+name|company\s*\/\s*instrument|name\s+of\s+(?:the\s+)?(?:company|instrument|security))/i.test(pageText)
    || /\bportfolio\b[\s\S]{0,420}?(?:company\s*\/\s*instrument|name\s+of\s+(?:the\s+)?(?:company|instrument|security)|%\s*(?:to\s*)?nav|weight\s*(?:to\s*)?net\s+assets)/i.test(pageText);
}

export function hasReliablePortfolioLabels(allocations: PageAllocation[]) {
  if (!allocations.length) return false;
  const fragmented = allocations.filter(({ label }) => {
    const normalized = label.replace(/\s+/g, " ").trim();
    const wordCount = normalized.split(" ").filter(Boolean).length;
    return wordCount < 2
      || /^(?:ltd\.?|limited|international|services|management|industry|retailing|capital\s+markets|leisure\s+services|oil|power)$/i.test(normalized)
      || /^(?:ltd\.?|limited)\b/i.test(normalized)
      || /\b(?:ltd\.?|limited)\s+(?:healthcare|retailing|capital\s+markets|leisure\s+services|oil|services)$/i.test(normalized);
  });
  return fragmented.length === 0;
}

export function hasReliableIndustryLabels(allocations: PageAllocation[]) {
  if (allocations.length < 2) return false;
  const nonSectorMetric = /(?:risk.?free|standard deviation|sharpe|sortino|alpha|beta|return(?:s)?|benchmark|expense|turnover|duration|yield|ratio|riskometer)/i;
  return allocations.every(({ label }) => {
    const normalized = label.replace(/\s+/g, " ").trim();
    return normalized.length >= 3 && normalized.length <= 80 && !nonSectorMetric.test(normalized);
  });
}

export function determinePortfolioTableScope(pageText: string, allocations: PageAllocation[]): PortfolioTableScope {
  if (/\btop\s+(?:\d+|ten)\s+holdings?\b/i.test(pageText)) return "top_holdings";
  const instruments = allocations.filter((allocation) => allocation.rowType !== "subtotal" && allocation.rowType !== "grand_total");
  const grandTotal = allocations.find((allocation) => allocation.rowType === "grand_total" || /^grand\s+total$/i.test(allocation.label));
  return instruments.length >= 2 && grandTotal && Math.abs(grandTotal.percentage - 100) <= 0.05
    ? "full_portfolio"
    : "unknown";
}

function selectAllocations(pageText: string, schemeName: string, type: "industry" | "portfolio") {
  if (!hasExplicitAllocationTable(pageText, type)) return [];
  const parsed = extractSchemeAllocations(pageText, schemeName, [schemeName]);
  if (type === "industry") return hasReliableIndustryLabels(parsed.industryAllocations) ? parsed.industryAllocations : [];
  const allocations = parsed.portfolioHoldings.map((holding) => ({ label: holding.companyName, percentage: holding.percentage, category: holding.category, rowType: holding.rowType }));
  const instrumentRows = allocations.filter((allocation) => allocation.rowType !== "subtotal" && allocation.rowType !== "grand_total");
  return hasReliablePortfolioLabels(instrumentRows) ? allocations : [];
}

export async function resolveSchemePageAllocation(input: {
  documentId: number;
  schemeName: string;
  pdfUrl: string | null | undefined;
  cacheKey?: string;
  allocationType: "industry" | "portfolio";
}): Promise<PageAllocationEvidence> {
  const normalizedSchemeName = normalise(input.schemeName);
  const cached = await getVisualAllocationEvidence(input.documentId, normalizedSchemeName, input.allocationType);
  const reusableNegative = cached
    && cached.reviewStatus === "unreviewed"
    && cached.failureClass !== "verified"
    && cached.extractionModel === PAGE_READER_MODEL
    && isRecentEvidence(cached.updatedAt);
  if (cached && (cached.reviewStatus === "verified" || cached.reviewStatus === "corrected" || (cached.failureClass === "verified" && cached.extractionModel === PAGE_READER_MODEL) || reusableNegative)) {
    try {
      return {
        allocations: JSON.parse(cached.allocationsJson) as PageAllocation[],
        sourcePage: cached.sourcePage ?? null,
        evidence: cached.evidence,
        confidence: Number(cached.confidence),
        failureClass: cached.failureClass as PageAllocationEvidence["failureClass"],
        ...(input.allocationType === "portfolio" ? { portfolioScope: portfolioScopeFromEvidence(cached.evidence) ?? "unknown" } : {}),
      };
    } catch {
      // Re-read malformed legacy evidence rather than trusting it.
    }
  }

  const cacheFailure = async (failureClass: PageAllocationEvidence["failureClass"], evidence: string): Promise<PageAllocationEvidence> => {
    await upsertVisualAllocationEvidence({
      documentId: input.documentId,
      normalizedSchemeName,
      allocationType: input.allocationType,
      allocationsJson: "[]",
      evidence,
      sourcePage: null,
      confidence: "0.00",
      extractionModel: PAGE_READER_MODEL,
      failureClass,
    });
    return { allocations: [], sourcePage: null, evidence, confidence: 0, failureClass, ...(input.allocationType === "portfolio" ? { portfolioScope: "unknown" as const } : {}) };
  };

  if (!isReadablePdfUrl(input.pdfUrl)) {
    return cacheFailure("provider_unavailable", `No cached PDF URL is available to verify ${allocationLabel(input.allocationType)} data.`);
  }
  const pdfUrl = input.pdfUrl as string;

  try {
    const pdfPages = await getCachedPdfTextPages(pdfUrl, input.cacheKey);
    const matchingPages = pdfPages.filter((page) => isStandaloneSchemeHeading(page.text, input.schemeName));
    if (!matchingPages.length) {
      return cacheFailure("no_scheme_page", `No standalone “${input.schemeName}” page was found; ${allocationLabel(input.allocationType)} values are withheld.`);
    }
    let textPortfolioCandidate: PageAllocationEvidence | undefined;
    for (const page of matchingPages) {
      const allocations = selectAllocations(page.text, input.schemeName, input.allocationType);
      if (!allocations.length) continue;
      const portfolioScope: PortfolioTableScope | undefined = input.allocationType === "portfolio"
        ? determinePortfolioTableScope(page.text, allocations)
        : undefined;
      const evidence = `Verified ${allocationLabel(input.allocationType)} values on PDF page ${page.num}, which has the standalone selected-scheme heading “${input.schemeName}”.${portfolioScope ? ` Portfolio table scope: ${portfolioScope}.` : ""}`;
      const candidate = { allocations, sourcePage: page.num, evidence, confidence: 98, failureClass: "verified" as const, ...(portfolioScope ? { portfolioScope } : {}) };
      if (input.allocationType === "portfolio") {
        if (portfolioScope === "full_portfolio") {
          await upsertVisualAllocationEvidence({
            documentId: input.documentId,
            normalizedSchemeName,
            allocationType: "portfolio",
            allocationsJson: JSON.stringify(allocations),
            evidence,
            sourcePage: page.num,
            confidence: "98.00",
            extractionModel: PAGE_READER_MODEL,
            failureClass: "verified",
          });
          return candidate;
        }
        textPortfolioCandidate ??= candidate;
        continue;
      }
      await upsertVisualAllocationEvidence({
        documentId: input.documentId,
        normalizedSchemeName,
        allocationType: input.allocationType,
        allocationsJson: JSON.stringify(allocations),
        evidence,
        sourcePage: page.num,
        confidence: "98.00",
        extractionModel: PAGE_READER_MODEL,
        failureClass: "verified",
      });
      return candidate;
    }
    if (input.allocationType === "portfolio") {
      const visual = await extractVisualPortfolioFromVerifiedPages({
        pdfUrl,
        selectedSchemeName: input.schemeName,
        allowedPages: matchingPages.map((page) => page.num),
      });
      if (visual?.found) {
        const evidence = `${visual.evidence} Portfolio table scope: full_portfolio.`;
        await upsertVisualAllocationEvidence({
          documentId: input.documentId,
          normalizedSchemeName,
          allocationType: "portfolio",
          allocationsJson: JSON.stringify(visual.holdings),
          evidence,
          sourcePage: visual.page,
          confidence: "94.00",
          extractionModel: "gemini-3-flash-preview-portfolio-evidence-v1",
          failureClass: "verified",
        });
        return { allocations: visual.holdings, sourcePage: visual.page, evidence, confidence: 94, failureClass: "verified", portfolioScope: "full_portfolio" };
      }
    }
    if (textPortfolioCandidate) {
      await upsertVisualAllocationEvidence({
        documentId: input.documentId,
        normalizedSchemeName,
        allocationType: "portfolio",
        allocationsJson: JSON.stringify(textPortfolioCandidate.allocations),
        evidence: textPortfolioCandidate.evidence,
        sourcePage: textPortfolioCandidate.sourcePage,
        confidence: String(textPortfolioCandidate.confidence),
        extractionModel: PAGE_READER_MODEL,
        failureClass: "verified",
      });
      return textPortfolioCandidate;
    }
    return cacheFailure("no_table_on_page", `The verified “${input.schemeName}” page did not expose a reliable ${allocationLabel(input.allocationType)} table.`);
  } catch {
    return cacheFailure("provider_unavailable", `The cached PDF could not be read for ${allocationLabel(input.allocationType)} verification.`);
  }
}
