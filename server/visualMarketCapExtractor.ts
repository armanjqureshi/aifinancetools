import { getVisualAllocationEvidence, upsertVisualAllocationEvidence } from "./db";
import { invokeLLM } from "./_core/llm";
import { getCachedPdfTextPages, isReadablePdfUrl } from "./pdfPageCache";
import { ENV } from "./_core/env";

export type MarketCapAllocation = { label: string; percentage: number };
export type MarketCapEvidence = {
  method: "vision" | "text" | "not_found";
  confidence: number;
  sourcePage: number | null;
  evidence: string;
  failureClass?: "verified" | "no_scheme_page" | "no_table_on_page" | "provider_unavailable" | "invalid_response";
};

type VisionResult = {
  found: boolean;
  page: number | null;
  schemePageVerified?: boolean;
  schemeHeading?: string;
  schemeAliasVerified?: boolean;
  aliasStatement?: string;
  schemeRowVerified?: boolean;
  schemeRow?: string;
  marketCapOnSamePage?: boolean;
  evidence: string;
  allocations: MarketCapAllocation[];
};

function normaliseSchemeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

const ALLOWED_LABELS = new Set(["large cap", "mid cap", "small cap", "cash & cash equivalents", "cash", "debt", "other"]);
const MARKET_CAP_READER_MODEL = "gemini-3-flash-preview-evidence-v2";
const NEGATIVE_EVIDENCE_TTL_MS = 5 * 60 * 1000;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reads a page-level consolidated table only when the page contains the exact
 * selected-scheme row and explicit Large/Mid/Small-cap columns. This avoids
 * relying on an LLM to infer visual column relationships from a long PDF.
 */
export function extractConsolidatedMarketCapFromPageText(pageText: string, schemeName: string): MarketCapAllocation[] {
  const hasHeader = /scheme[\s\S]{0,600}?(?:large\s*cap|largecap)[\s\S]{0,160}?(?:mid\s*cap|midcap)[\s\S]{0,160}?(?:small\s*cap|smallcap)/i.test(pageText);
  if (!hasHeader) return [];
  const rowPattern = new RegExp(
    `(?:^|\\n)\\s*(?:[•●▪◆]\\s*)?${escapeRegExp(schemeName).replace(/\\s+/g, "\\\\s+")}\\s+` +
      `(\\d{1,3}(?:\\.\\d+)?)%?\\s+(\\d{1,3}(?:\\.\\d+)?)%?\\s+(\\d{1,3}(?:\\.\\d+)?)%?\\s*(?:$|\\n)`,
    "im",
  );
  const match = pageText.match(rowPattern);
  if (!match) return [];
  const [largeCap, midCap, smallCap] = match.slice(1, 4).map(Number);
  if ([largeCap, midCap, smallCap].some((value) => !Number.isFinite(value) || value < 0 || value > 100)) return [];
  return [
    { label: "Large Cap", percentage: largeCap },
    { label: "Mid Cap", percentage: midCap },
    { label: "Small Cap", percentage: smallCap },
  ];
}

async function extractConsolidatedMarketCapFromPdf(pdfUrl: string, schemeName: string, cacheKey?: string) {
  try {
    const pages = await getCachedPdfTextPages(pdfUrl, cacheKey);
    for (const page of pages) {
      const allocations = extractConsolidatedMarketCapFromPageText(page.text, schemeName);
      if (allocations.length) {
        return { allocations, sourcePage: page.num, evidence: `Verified selected-scheme row “${schemeName}” in a consolidated Large Cap / Mid Cap / Small Cap table on PDF page ${page.num}.` };
      }
    }
  } catch {
    // The visual reader will safely attempt its strict page-aware path next.
  }
  return undefined;
}

export function hasSelectedSchemeMarketCapSignal(pages: Array<{ text: string }>, schemeName: string) {
  const selected = normaliseSchemeName(schemeName);
  return pages.some((page) => {
    const hasStandaloneHeading = page.text.split(/\r?\n/).some((line) => normaliseSchemeName(line) === selected);
    return hasStandaloneHeading
      && /(?:market\s*cap|large\s*cap|mid\s*cap|small\s*cap)/i.test(page.text);
  });
}

export function parseVisualMarketCapResponse(raw: string, selectedSchemeName?: string): VisionResult | undefined {
  try {
    const value = JSON.parse(raw) as VisionResult;
    if (typeof value.found !== "boolean" || typeof value.evidence !== "string" || !Array.isArray(value.allocations)) return undefined;
    if (value.page !== null && (!Number.isInteger(value.page) || value.page < 1)) return undefined;
    const allocations = value.allocations
      .filter((item) => typeof item?.label === "string" && typeof item?.percentage === "number")
      .map((item) => ({ label: item.label.trim(), percentage: Number(item.percentage) }))
      .filter((item) => ALLOWED_LABELS.has(item.label.toLowerCase()) && item.percentage > 0 && item.percentage <= 100);
    if (value.found && (allocations.length < 2 || !value.page)) return undefined;
    if (selectedSchemeName && value.found) {
      const heading = normaliseSchemeName(value.schemeHeading ?? "");
      const selected = normaliseSchemeName(selectedSchemeName);
      const directHeadingMatch = heading.includes(selected) || selected.includes(heading);
      const alias = normaliseSchemeName(value.aliasStatement ?? "");
      const explicitRename = value.schemeAliasVerified === true
        && alias.includes(selected)
        && /(formerly known as|previously known as|renamed from)/.test(alias);
      const row = normaliseSchemeName(value.schemeRow ?? "");
      const explicitSelectedRow = value.schemeRowVerified === true && (row.includes(selected) || selected.includes(row));
      if (!value.marketCapOnSamePage || (!directHeadingMatch && !explicitRename && !explicitSelectedRow)) return undefined;
      if (!value.schemePageVerified && !explicitSelectedRow) return undefined;
    }
    return { ...value, allocations };
  } catch {
    return undefined;
  }
}

export async function resolveVisualMarketCapAllocation(input: {
  documentId: number;
  schemeName: string;
  pdfUrl: string | null | undefined;
  cacheKey?: string;
}): Promise<{ allocations: MarketCapAllocation[]; evidence: MarketCapEvidence } | undefined> {
  const normalizedSchemeName = normaliseSchemeName(input.schemeName);
  const cached = await getVisualAllocationEvidence(input.documentId, normalizedSchemeName, "market_cap");
  const cachedTimestamp = cached?.updatedAt instanceof Date ? cached.updatedAt.getTime() : cached?.updatedAt ? new Date(cached.updatedAt).getTime() : NaN;
  const reusableNegative = cached
    && cached.reviewStatus === "unreviewed"
    && cached.failureClass !== "verified"
    && cached.extractionModel === MARKET_CAP_READER_MODEL
    && Number.isFinite(cachedTimestamp)
    && Date.now() - cachedTimestamp < NEGATIVE_EVIDENCE_TTL_MS;
  if (cached && (cached.reviewStatus === "verified" || cached.reviewStatus === "corrected" || cached.failureClass === "verified" || reusableNegative)) {
    try {
      const allocations = JSON.parse(cached.allocationsJson) as MarketCapAllocation[];
      return {
        allocations,
        evidence: {
          method: allocations.length ? "vision" : "not_found",
          confidence: Number(cached.confidence),
          sourcePage: cached.sourcePage ?? null,
          evidence: cached.evidence,
          failureClass: cached.failureClass,
        },
      };
    } catch {
      // Re-extract an invalid legacy cache record rather than trusting it.
    }
  }

  if (!isReadablePdfUrl(input.pdfUrl)) return undefined;
  const pdfUrl = input.pdfUrl as string;

  const pageTable = await extractConsolidatedMarketCapFromPdf(pdfUrl, input.schemeName, input.cacheKey);
  if (pageTable) {
    await upsertVisualAllocationEvidence({
      documentId: input.documentId,
      normalizedSchemeName,
      allocationType: "market_cap",
      allocationsJson: JSON.stringify(pageTable.allocations),
      evidence: pageTable.evidence,
      sourcePage: pageTable.sourcePage,
      confidence: "99.00",
      extractionModel: "pdf-page-consolidated-table-v1",
      failureClass: "verified",
    });
    return {
      allocations: pageTable.allocations,
      evidence: { method: "text", confidence: 99, sourcePage: pageTable.sourcePage, evidence: pageTable.evidence, failureClass: "verified" },
    };
  }

  const pages = await getCachedPdfTextPages(pdfUrl, input.cacheKey).catch(() => []);
  if (!hasSelectedSchemeMarketCapSignal(pages, input.schemeName)) {
    const evidence = "No selected-scheme market-cap chart or table signal was found in the cached factsheet; visual reading was skipped.";
    await upsertVisualAllocationEvidence({
      documentId: input.documentId,
      normalizedSchemeName,
      allocationType: "market_cap",
      allocationsJson: "[]",
      evidence,
      sourcePage: null,
      confidence: "0.00",
      extractionModel: MARKET_CAP_READER_MODEL,
      failureClass: "no_table_on_page",
    });
    return { allocations: [], evidence: { method: "not_found", confidence: 0, sourcePage: null, evidence, failureClass: "no_table_on_page" } };
  }

  if (!ENV.aiEnabled) {
    return {
      allocations: [],
      evidence: {
        method: "not_found",
        confidence: 0,
        sourcePage: null,
        evidence: "Visual market-cap verification is disabled in local no-AI mode; no allocation is shown without deterministic page evidence.",
        failureClass: "provider_unavailable",
      },
    };
  }

  const cacheFailure = async (failureClass: "provider_unavailable" | "invalid_response", evidence: string) => {
    await upsertVisualAllocationEvidence({
      documentId: input.documentId,
      normalizedSchemeName,
      allocationType: "market_cap",
      allocationsJson: "[]",
      evidence,
      sourcePage: null,
      confidence: "0.00",
      extractionModel: MARKET_CAP_READER_MODEL,
      failureClass,
    });
    return { allocations: [], evidence: { method: "not_found" as const, confidence: 0, sourcePage: null, evidence, failureClass } };
  };

  let response;
  try {
    response = await invokeLLM({
    model: "gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content: "You are a strict mutual-fund factsheet page reader. Never extract an allocation from an index, table of contents, summary, or another scheme. Accept values only when either: (1) the PDF page has the exact selected scheme's standalone heading and a same-page market-cap table/chart; (2) the same page explicitly identifies a renamed scheme as formerly/previously known as the selected scheme; or (3) a clearly labelled AMC-wide consolidated market-cap table contains the selected scheme as its own full row with matching allocation columns. For case 3, set schemeRowVerified=true and return the exact schemeRow. Otherwise return found=false with an empty allocation list.",
      },
      {
        role: "user",
        content: [
          { type: "file_url", file_url: { url: pdfUrl, mime_type: "application/pdf" } },
          { type: "text", text: `Selected scheme: ${input.schemeName}. Return the exact standalone scheme heading, same-page chart/table confirmation, any explicit former-name statement, and—only for a labelled consolidated market-cap table—the exact full selected-scheme row. Return the one-indexed PDF page and only values visibly associated with that heading or row.` },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "market_cap_chart",
        strict: true,
        schema: {
          type: "object",
          properties: {
            found: { type: "boolean" },
            page: { type: ["integer", "null"] },
            schemePageVerified: { type: "boolean" },
            schemeHeading: { type: "string" },
            schemeAliasVerified: { type: "boolean" },
            aliasStatement: { type: "string" },
            schemeRowVerified: { type: "boolean" },
            schemeRow: { type: "string" },
            marketCapOnSamePage: { type: "boolean" },
            evidence: { type: "string" },
            allocations: {
              type: "array",
              items: {
                type: "object",
                properties: { label: { type: "string" }, percentage: { type: "number" } },
                required: ["label", "percentage"],
                additionalProperties: false,
              },
            },
          },
          required: ["found", "page", "schemePageVerified", "schemeHeading", "schemeAliasVerified", "aliasStatement", "schemeRowVerified", "schemeRow", "marketCapOnSamePage", "evidence", "allocations"],
          additionalProperties: false,
        },
      },
    },
    });
  } catch {
    return cacheFailure("provider_unavailable", "The visual verifier was unavailable; no market-cap allocation is shown until the selected scheme page can be checked.");
  }

  const extracted = parseVisualMarketCapResponse((response?.choices?.[0]?.message?.content as string) ?? "", input.schemeName);
  if (!extracted) return cacheFailure("invalid_response", "The visual verifier did not return an exact scheme-page match; no market-cap allocation is shown.");
  const allocations = extracted.found ? extracted.allocations : [];
  const failureClass = allocations.length ? "verified" : extracted.schemePageVerified ? "no_table_on_page" : "no_scheme_page";
  const confidence = allocations.length >= 3 ? "95.00" : allocations.length >= 2 ? "85.00" : "0.00";
  const evidence = extracted.evidence || (allocations.length ? `Verified on the page headed “${extracted.schemeHeading}”.` : "No reliable scheme-specific market-cap chart found.");
  await upsertVisualAllocationEvidence({
    documentId: input.documentId,
    normalizedSchemeName,
    allocationType: "market_cap",
    allocationsJson: JSON.stringify(allocations),
    evidence,
    sourcePage: extracted.page,
    confidence,
    extractionModel: MARKET_CAP_READER_MODEL,
    failureClass,
  });
  return {
    allocations,
    evidence: { method: allocations.length ? "vision" : "not_found", confidence: Number(confidence), sourcePage: extracted.page, evidence, failureClass },
  };
}
