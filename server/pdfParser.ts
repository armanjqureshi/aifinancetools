/**
 * PDF Parser Service
 *
 * Extracts sector allocation and asset allocation data from
 * mutual fund factsheet PDFs using text extraction and pattern matching.
 */

import { PDFParse, type LoadParameters } from "pdf-parse";
import type { PdfTextPage } from "./pdfPageCache";

export interface AllocationEntry {
  label: string;
  percentage: number;
}

export interface PortfolioHolding {
  companyName: string;
  percentage: number;
  category?: string;
  rowType?: "instrument" | "subtotal" | "grand_total";
}

export interface ParsedFactsheet {
  sectorAllocations: AllocationEntry[];
  assetAllocations: AllocationEntry[];
  marketCapAllocations: AllocationEntry[];
  rawText: string;
  pages: PdfTextPage[];
}

// Common sector names found in Indian MF factsheets
const KNOWN_SECTORS = [
  "Financial Services",
  "Banking",
  "Banks",
  "IT",
  "Information Technology",
  "Technology",
  "Healthcare",
  "Pharma",
  "Pharmaceuticals",
  "Consumer Goods",
  "FMCG",
  "Fast Moving Consumer Goods",
  "Automobile",
  "Auto",
  "Automobiles",
  "Energy",
  "Oil & Gas",
  "Petroleum",
  "Capital Goods",
  "Industrial",
  "Industrials",
  "Materials",
  "Metals",
  "Metals & Mining",
  "Construction",
  "Real Estate",
  "Cement",
  "Telecom",
  "Telecommunication",
  "Utilities",
  "Power",
  "Chemicals",
  "Fertilisers",
  "Textiles",
  "Media",
  "Retail",
  "Insurance",
  "NBFCs",
  "Non-Banking Financial",
  "Diversified",
  "Others",
  "Cash & Equivalents",
  "Debt",
];

// Asset allocation labels
const ASSET_LABELS = [
  "Equity",
  "Debt",
  "Cash",
  "Cash & Cash Equivalents",
  "Gold",
  "REITs",
  "InvITs",
  "Overseas",
  "Other",
];

const MARKET_CAP_LABELS = [
  "Large Cap",
  "LargeCap",
  "Mid Cap",
  "MidCap",
  "Small Cap",
  "SmallCap",
  "Micro Cap",
  "Large & Mid Cap",
  "Large and Mid Cap",
  "Mid & Small Cap",
  "Mid and Small Cap",
  "Multi Cap",
  "Other Equity",
  "Cash & Equivalents",
];

/**
 * Parse percentage values from text like "23.45%" or "23.45"
 */
function parsePercentage(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return isNaN(val) ? null : val;
}

/**
 * Extract allocations from a table-like text block.
 * Looks for patterns like "Label   XX.XX%" or "Label XX.XX"
 */
function extractAllocationsFromText(
  text: string,
  knownLabels: string[]
): AllocationEntry[] {
  const results: AllocationEntry[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line contains a known label
    for (const label of knownLabels) {
      const labelRegex = new RegExp(
        `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\t]+([\\d.]+)\\s*%?`,
        "i"
      );
      const match = trimmed.match(labelRegex);
      if (match) {
        const pct = parsePercentage(match[1]);
        if (pct !== null && pct >= 0 && pct <= 100) {
          // Avoid duplicates
          if (!results.find((r) => r.label.toLowerCase() === label.toLowerCase())) {
            results.push({ label, percentage: pct });
          }
        }
        break;
      }
    }
  }

  return results;
}

/**
 * Generic pattern: "Label\n\nXX.XX%" or adjacent columns
 */
function extractGenericAllocations(text: string): AllocationEntry[] {
  const results: AllocationEntry[] = [];
  // Match patterns like "Sector Name 12.34%" or "Sector Name\n12.34%"
  const pattern =
    /([A-Za-z][A-Za-z &\/\-']+?)\s*[\n\t ]+(\d{1,2}(?:\.\d{1,2})?)\s*%/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const label = match[1].trim();
    const pct = parseFloat(match[2]);
    if (
      label.length > 2 &&
      label.length < 60 &&
      pct > 0 &&
      pct <= 100 &&
      !results.find((r) => r.label === label)
    ) {
      results.push({ label, percentage: pct });
    }
  }

  return results;
}

/**
 * Extract sector allocation section from PDF text.
 */
function extractSectorAllocations(text: string): AllocationEntry[] {
  // First try known sectors
  const known = extractAllocationsFromText(text, KNOWN_SECTORS);
  if (known.length >= 3) return known;

  // Try to find a "Sector Allocation" or "Industry Allocation" section
  const sectionPatterns = [
    /sector\s+allocation[^\n]*\n([\s\S]{0,2000}?)(?=\n[A-Z][A-Z\s]+\n|asset\s+allocation|portfolio|$)/i,
    /industry\s+allocation[^\n]*\n([\s\S]{0,2000}?)(?=\n[A-Z][A-Z\s]+\n|asset\s+allocation|portfolio|$)/i,
    /sector\s+wise[^\n]*\n([\s\S]{0,2000}?)(?=\n[A-Z][A-Z\s]+\n|asset\s+allocation|portfolio|$)/i,
  ];

  for (const pattern of sectionPatterns) {
    const sectionMatch = text.match(pattern);
    if (sectionMatch) {
      const sectionText = sectionMatch[1];
      const generic = extractGenericAllocations(sectionText);
      if (generic.length >= 3) return generic;
    }
  }

  // Fallback: generic extraction from full text
  return extractGenericAllocations(text).slice(0, 20);
}

/**
 * Extract asset allocation section from PDF text.
 */
function extractAssetAllocations(text: string): AllocationEntry[] {
  // First try known asset labels
  const known = extractAllocationsFromText(text, ASSET_LABELS);
  if (known.length >= 2) return known;

  // Try to find an "Asset Allocation" section
  const sectionPatterns = [
    /asset\s+allocation[^\n]*\n([\s\S]{0,1000}?)(?=\n[A-Z][A-Z\s]+\n|sector|portfolio|$)/i,
    /asset\s+mix[^\n]*\n([\s\S]{0,1000}?)(?=\n[A-Z][A-Z\s]+\n|sector|portfolio|$)/i,
  ];

  for (const pattern of sectionPatterns) {
    const sectionMatch = text.match(pattern);
    if (sectionMatch) {
      const sectionText = sectionMatch[1];
      const extracted = extractAllocationsFromText(sectionText, ASSET_LABELS);
      if (extracted.length >= 2) return extracted;
    }
  }

  // Fallback: look for equity/debt/cash anywhere in the text
  return extractAllocationsFromText(text, ASSET_LABELS);
}

function extractMarketCapAllocations(text: string): AllocationEntry[] {
  const known = extractAllocationsFromText(text, MARKET_CAP_LABELS);
  if (known.length >= 2) return known;

  const sectionPatterns = [
    /market\s*cap(?:italisation|italization)?\s*(?:allocation|breakup|exposure)?[^\n]*\n([\s\S]{0,1200}?)(?=\n[A-Z][A-Z\s]+\n|sector|asset\s+allocation|portfolio|$)/i,
    /market\s*capitalisation\s*wise[^\n]*\n([\s\S]{0,1200}?)(?=\n[A-Z][A-Z\s]+\n|sector|asset\s+allocation|portfolio|$)/i,
    /capitalisation\s*breakup[^\n]*\n([\s\S]{0,1200}?)(?=\n[A-Z][A-Z\s]+\n|sector|asset\s+allocation|portfolio|$)/i,
  ];

  for (const pattern of sectionPatterns) {
    const sectionMatch = text.match(pattern);
    if (!sectionMatch) continue;
    const extracted = extractAllocationsFromText(sectionMatch[1], MARKET_CAP_LABELS);
    if (extracted.length >= 2) return extracted;
  }

  return extractAllocationsFromText(text, MARKET_CAP_LABELS);
}

/**
 * Some AMC-wide factsheets publish one consolidated segment table rather than
 * repeating a market-cap table inside every scheme page. The table header names
 * the cap buckets, while each following row begins with the scheme name. This
 * reads only a row that matches the selected scheme and only when the nearby
 * table header explicitly identifies the cap buckets.
 */
function extractConsolidatedMarketCapAllocations(text: string, schemeName: string): AllocationEntry[] {
  const rowPattern = new RegExp(
    `^\\s*(?:[•●▪◆]\\s*)?${escapeRegExp(schemeName).replace(/\\s+/g, "\\s+")}\\s+` +
    `(\\d{1,3}(?:\\.\\d+)?)%?\\s+(\\d{1,3}(?:\\.\\d+)?)%?\\s+(\\d{1,3}(?:\\.\\d+)?)%?\\s*$`,
    "gim",
  );
  let match: RegExpExecArray | null;
  while ((match = rowPattern.exec(text)) !== null) {
    const nearbyHeader = text.slice(Math.max(0, match.index - 1800), match.index);
    const hasCapTableHeader = /(?:segment[-\s]*wise|market\s*cap|market\s*capitalisation|capitalisation\s*breakup)[\s\S]{0,600}?(?:large\s*cap|largecap)[\s\S]{0,120}?(?:mid\s*cap|midcap)[\s\S]{0,120}?(?:small\s*cap|smallcap)/i.test(nearbyHeader)
      || /(?:large\s*cap|largecap)\s+(?:mid\s*cap|midcap)\s+(?:small\s*cap|smallcap)/i.test(nearbyHeader);
    if (!hasCapTableHeader) continue;

    const [largeCap, midCap, smallCap] = match.slice(1, 4).map((value) => Number(value));
    if ([largeCap, midCap, smallCap].some((value) => !Number.isFinite(value) || value < 0 || value > 100)) continue;
    return [
      { label: "Large Cap", percentage: largeCap },
      { label: "Mid Cap", percentage: midCap },
      { label: "Small Cap", percentage: smallCap },
    ];
  }
  return [];
}

/**
 * Factsheets often begin with a table of contents, so the first scheme-name
 * occurrence is not necessarily the scheme page. Scan later occurrences for a
 * nearby explicit market-cap heading and return only a multi-bucket table.
 */
function extractMarketCapAllocationsNearScheme(text: string, schemeName: string, availableSchemeNames: string[]): AllocationEntry[] {
  const matcher = new RegExp(escapeRegExp(schemeName).replace(/\s+/g, "\\s+"), "gi");
  const schemePageStart = findBestSchemePosition(text, schemeName);
  if (schemePageStart < 0) return [];
  const otherSchemePattern = availableSchemeNames
    .filter((name) => normaliseSchemeName(name) !== normaliseSchemeName(schemeName))
    .map((name) => escapeRegExp(name).replace(/\s+/g, "\\s+"))
    .join("|");
  const nextSchemeMatcher = otherSchemePattern ? new RegExp(otherSchemePattern, "i") : null;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    const schemePosition = match.index;
    if (schemePosition !== schemePageStart) continue;
    const lineEnd = text.indexOf("\n", schemePosition);
    const schemeLine = text.slice(schemePosition, lineEnd >= 0 ? lineEnd : schemePosition + 180);
    // A scheme name can be mentioned again in performance, manager, or
    // comparative commentary. Only a standalone scheme-page heading is a safe
    // anchor for a scheme-specific market-cap table.
    if (normaliseSchemeName(schemeLine) !== normaliseSchemeName(schemeName)) continue;
    const remainingText = text.slice(schemePosition + schemeName.length);
    const nextMatch = nextSchemeMatcher?.exec(remainingText);
    const nextSchemePosition = nextMatch ? schemePosition + schemeName.length + nextMatch.index : undefined;
    const nearbyText = text.slice(schemePosition, Math.min(schemePosition + 6500, nextSchemePosition ?? text.length));
    const headingMatch = /(?:market\s*cap(?:italisation|italization)?(?:\s*(?:allocation|breakup|exposure))?|capitalisation\s*breakup|segment[-\s]*wise\s*break[-\s]*up)/i.exec(nearbyText);
    if (!headingMatch || headingMatch.index === undefined) continue;
    // Parse only the table immediately following this scheme-page heading. Do
    // not fall through to a later comparative, manager, or adjacent-scheme
    // mention that happens to contain cap labels.
    const textAfterHeading = nearbyText.slice(headingMatch.index);
    const nextStandaloneSelf = new RegExp(`(?:^|\\n)\\s*${escapeRegExp(schemeName).replace(/\s+/g, "\\s+")}\\s*(?=\\n|$)`, "i")
      .exec(textAfterHeading.slice(headingMatch[0].length));
    const tableEnd = nextStandaloneSelf
      ? headingMatch[0].length + nextStandaloneSelf.index
      : 1800;
    const tableText = textAfterHeading.slice(0, Math.min(1800, tableEnd));
    const allocations = extractMarketCapAllocations(tableText);
    if (allocations.length >= 2) return allocations;
  }
  return [];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normaliseSchemeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function normaliseSchemeKey(value: string) {
  return normaliseSchemeName(value).replace(/&/g, " and ").replace(/\s+/g, " ").trim();
}

const GENERIC_SCHEME_HEADINGS = new Set([
  "nature of scheme",
  "type of scheme",
  "equity fund",
  "debt fund",
  "hybrid fund",
  "index fund",
  "fund of fund",
  "mutual fund",
  "scheme",
  "fund",
]);

function isGenericSchemeHeading(candidate: string) {
  const normalised = normaliseSchemeName(candidate).replace(/[–—-]+/g, " ").replace(/\s+/g, " ").trim();
  if (GENERIC_SCHEME_HEADINGS.has(normalised)) return true;
  return /^(?:an?\s+)?(?:open|close)[-\s]*ended\b.*\b(?:fund|scheme)$/.test(normalised)
    || /^(?:equity|debt|hybrid|index|thematic|solution|sectoral|money market|exchange traded|maturity index|volatility\s+\d+\s+index|dynamic debt)\s+(?:fund|scheme|etf)$/.test(normalised);
}

function canonicaliseSchemeOption(candidate: string) {
  return candidate
    // Some AMC contents/index pages prefix a scheme row with a serial or page
    // number (for example, "25 MIRAE ASSET LARGE CAP FUND"). It is not part
    // of the scheme name. Preserve the genuine 360 ONE AMC brand explicitly.
    .replace(/^(?!(?:360\s+ONE)\b)\d{1,3}\s+(?=(?:[A-Za-z0-9]+\s+){2,}(?:fund|scheme|etf|fof)\b)/i, "")
    .replace(/^(?!(?:HDFC|ICICI|NIFTY|SBI|UTI|DSP|ITI|AXIS|LIC|NAVI|PPFAS)\b)[A-Z0-9]{5,10}\s+(?=[A-Z][a-z]+\s+[A-Z][a-z]+)/, "")
    .replace(/\s*[-–—]?\s+(?:direct|regular)(?:\s+plan)?\b[\s\S]*$/i, "")
    .replace(/\s*[-–—]?\s+(?:growth|idcw)(?:\s+option)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDocumentSchemeOption(candidate: string, candidates: string[], amcName?: string) {
  if (isGenericSchemeHeading(candidate)) return false;
  if (/^(?:returns?\s+of|performance\s+of|fund\s+performance|imf\s+international\s+monetary\s+fund)\b/i.test(candidate)) return false;
  if (!amcName) return true;

  const words = candidate.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < 3 || /^(?:of|an?|the|for)$/i.test(words[0] ?? "")) return false;
  const meaningfulWords = words.filter((word) => !["and", "&", "of", "the", "to"].includes(word));
  const schemeMarkers = words.filter((word) => ["fund", "scheme", "etf", "fof"].includes(word));
  if (schemeMarkers.length > 1 && !/fund\s+of\s+fund$/i.test(candidate)) return false;
  const amcTokens = amcName
    .toLowerCase()
    .replace(/mutual\s+fund|asset\s+management|capital/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  const hasAmcToken = words.some((word) => amcTokens.includes(word));
  if (/^\d/.test(candidate) && !hasAmcToken) return false;
  // A legacy/sub-brand name must be sufficiently specific before the later
  // page-evidence check can admit it; short fragments such as “Weight Index
  // Fund” are overwhelmingly wrapped labels, not standalone schemes.
  return hasAmcToken || meaningfulWords.length >= 4;
}

function hasStandaloneSchemePageEvidence(text: string, schemeName: string) {
  const matcher = new RegExp(escapeRegExp(schemeName).replace(/\s+/g, "\\s+"), "gi");
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    const position = match.index;
    const lineEnd = text.indexOf("\n", position);
    const line = text.slice(position, lineEnd >= 0 ? lineEnd : position + 180);
    if (normaliseSchemeName(line) !== normaliseSchemeName(schemeName)) continue;
    if (/\.{4,}|\t\s*\d+\s*$|\bpage\s*\d+\s*$/i.test(line)) continue;
    const followingText = text.slice(position + schemeName.length, position + schemeName.length + 5000);
    if (/(?:investment\s+objective|fund\s+manager|date\s+of\s+allotment|portfolio|nav\b|benchmark|riskometer|market\s*cap|expense\s+ratio|scheme\s+performance)/i.test(followingText)) return true;
  }
  return false;
}

/**
 * Detect scheme headings from one downloaded AMC factsheet. This intentionally
 * works only from that document's text, so consumers cannot mix schemes from
 * other AMCs into the selector.
 */
export function extractSchemeNames(text: string, amcName?: string): string[] {
  const ignored = /(mutual fund investments|mutual fund:\s*sebi|fund manager|scheme riskometer|factsheet|investment objective|benchmark|disclaimer|fund house|asset management|mutual fund association)/i;
  const schemeMarker = /\b(?:fund|scheme|etf|fof)\b/i;
  const terminalMarker = /\b(?:fund|scheme|etf|fof)(?:\s*[-–—]?\s+(?:direct|regular|plan|growth|idcw|option|options))*$/i;
  const lowerCaseConnectors = new Set(["of", "and", "the", "to", "&"]);
  const names = new Map<string, string>();

  for (const line of text.split("\n")) {
    const candidate = line.replace(/[•●▪◆]/g, " ").replace(/\s+/g, " ").trim();
    if (candidate.length < 5 || candidate.length > 100 || ignored.test(candidate)) continue;
    if (!schemeMarker.test(candidate) || !terminalMarker.test(candidate)) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9&(),.'’/\- ]+$/.test(candidate)) continue;
    const words = candidate.replace(/[()]/g, " ").split(/[\s/\-]+/).filter(Boolean);
    if (words.length < 2) continue;
    const isTitleWord = (word: string) => lowerCaseConnectors.has(word.toLowerCase()) || /^\d+(?:\.\d+)?$/.test(word) || /^[A-Z][A-Za-z0-9.'’&]*$/.test(word) || /^[A-Z]{2,}$/.test(word);
    if (!words.every(isTitleWord)) continue;
    const key = normaliseSchemeName(candidate);
    if (!names.has(key)) names.set(key, candidate);
  }

  const canonicalNames = new Map<string, string>();
  for (const candidate of Array.from(names.values())) {
    const canonical = canonicaliseSchemeOption(candidate);
    if (canonical.length < 5) continue;
    const key = normaliseSchemeKey(canonical);
    if (!canonicalNames.has(key)) canonicalNames.set(key, canonical);
  }
  const candidates = Array.from(canonicalNames.values());
  const validated = candidates.filter((candidate) => {
    if (!isDocumentSchemeOption(candidate, candidates, amcName)) return false;
    const amcTokens = amcName
      ?.toLowerCase()
      .replace(/mutual\s+fund|asset\s+management|capital/g, " ")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3) ?? [];
    const candidateTokens = candidate.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const hasAmcToken = candidateTokens.some((token) => amcTokens.includes(token));
    // A legacy or sub-brand name with no AMC token is valid only when the PDF
    // contains a standalone scheme-page heading with actual scheme content.
    if (amcName && !hasAmcToken && !hasStandaloneSchemePageEvidence(text, candidate)) return false;
    const candidateNormalised = normaliseSchemeKey(candidate);
    // PDF line wrapping often emits both a complete branded scheme name and a
    // separate suffix such as “Cap Fund” or “Multi-Factor Fund”. A suffix is
    // not a standalone selectable scheme when its full name is present here.
    return !candidates.some((other) => {
      const otherNormalised = normaliseSchemeKey(other);
      return otherNormalised !== candidateNormalised
        && otherNormalised.endsWith(` ${candidateNormalised}`)
        && otherNormalised.split(" ").length > candidateNormalised.split(" ").length;
    });
  });

  return validated.sort((left, right) => firstSchemePosition(text, left) - firstSchemePosition(text, right));
}

function firstSchemePosition(text: string, schemeName: string) {
  const matcher = new RegExp(escapeRegExp(schemeName).replace(/\s+/g, "\\s+"), "i");
  const match = matcher.exec(text);
  return match?.index ?? -1;
}

function findBestSchemePosition(text: string, schemeName: string) {
  const matcher = new RegExp(escapeRegExp(schemeName).replace(/\s+/g, "\\s+"), "gi");
  let bestPosition = -1;
  let bestScore = Number.NEGATIVE_INFINITY;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    const position = match.index;
    const firstLine = text.slice(position, text.indexOf("\n", position) >= 0 ? text.indexOf("\n", position) : position + 160);
    const context = text.slice(position, position + 7000);
    // Manager tables, portfolio cross-holdings, performance tables, and the
    // contents page can mention a scheme name but are never safe allocation
    // anchors. Only a standalone scheme-page heading can establish the text
    // boundary used for Industry/Sector and portfolio extraction.
    if (normaliseSchemeName(firstLine) !== normaliseSchemeName(schemeName)) continue;
    if (/\.{4,}|\t\s*\d+(?:\s*[-–]\s*\d+)?\s*$|\bpage\s*\d+\s*$/i.test(firstLine)) continue;
    const hasSchemePageContent = /investment\s+objective|fund\s+manager|date\s+of\s+allotment|portfolio|\b(?:equity|debt|portfolio)\s+holdings?\b|nav\b|benchmark|riskometer|market\s*cap|expense\s+ratio|scheme\s+performance/i.test(context);
    if (!hasSchemePageContent) continue;
    let score = 0;
    score += 8;
    if (/investment\s+objective|fund\s+manager|date\s+of\s+allotment|portfolio|nav\b/i.test(context)) score += 4;
    if (/\b(?:equity|debt|portfolio)\s+holdings?\b/i.test(context)) score += 2;
    if (score > bestScore) {
      bestScore = score;
      bestPosition = position;
    }
  }
  return bestPosition;
}

function extractPortfolioHoldings(text: string): PortfolioHolding[] {
  const structuredHoldingPattern = /^(.{3,100}?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s+(\d{1,2}(?:\.\d{1,2})?)$/;
  const simpleHoldingPattern = /^(.{3,100}?)\s+(\d{1,2}(?:\.\d{1,2})?)$/;
  const companyIndicator = /\b(?:ltd\.?|limited|inc\.?|corp(?:oration)?|bank|finance|financial|industries|technology|technologies|motors|power|pharmaceuticals|communications|services|systems|holdings|engineering|energy|cement|metals|retail|airtel|reliance|infosys|wipro|tata)\b/i;
  const excluded = /^(?:sub\s*total|total|grand\s*total|cash|call[,\s]|equity\s+holdings|debt\s+holdings|gilts|portfolio\s+turnover|market\s+value|company\s+name)/i;
  const results = new Map<string, PortfolioHolding>();

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/^[•●▪◆]\s*/, "").replace(/\s+/g, " ").trim();
    const structuredMatch = line.match(structuredHoldingPattern);
    const simpleMatch = structuredMatch ? null : line.match(simpleHoldingPattern);
    if (!structuredMatch && !simpleMatch) continue;
    const rawName = (structuredMatch?.[1] ?? simpleMatch?.[1] ?? "").trim();
    const percentage = Number(structuredMatch?.[4] ?? simpleMatch?.[2]);
    if (!rawName || excluded.test(rawName) || !companyIndicator.test(rawName) || percentage <= 0 || percentage > 100) continue;
    const companyName = (rawName.match(/^(.+?\b(?:ltd\.?|limited|inc\.?|corp(?:oration)?|bank|finance|financial services|technology|technologies|motors|power|pharmaceuticals|communications|services|systems|holdings|engineering|energy|cement|metals|retail|airtel|reliance|infosys|wipro|tata)\b)/i)?.[1] ?? rawName).replace(/\*+$/, "").trim();
    if (companyName.length < 3) continue;
    const key = normaliseSchemeKey(companyName);
    if (!results.has(key)) results.set(key, { companyName, percentage });
  }

  return Array.from(results.values()).sort((left, right) => right.percentage - left.percentage).slice(0, 50);
}

function extractPortfolioComposition(text: string): PortfolioHolding[] {
  const lines = text.split("\n").map((line) => line.replace(/^[•●▪◆]\s*/, "").replace(/\s+/g, " ").trim()).filter(Boolean);
  const hasInstrumentHeader = lines.some((line) => /name\s+of\s+(?:instrument|security)|(?:portfolio|holding)s?\s*(?:details|composition)?/i.test(line));
  if (!hasInstrumentHeader) return [];

  const results: PortfolioHolding[] = [];
  let primaryCategory = "";
  let secondaryCategory = "";
  const categoryHeading = /^(?:money\s+market\s+instruments?|others?|cash\s*(?:,\s*|&\s*|and\s+)cash\s+equivalents?(?:\s+and\s+net\s+current\s+assets)?|equity\s*(?:&|and)\s*equity\s+related|equity\s+(?:holdings?|instruments?)|debt\s*(?:&|and)\s*debt\s+related|debt\s+(?:holdings?|instruments?)|foreign\s+(?:securities|funds?)|overseas\s+(?:securities|funds?)|units\s+issued\s+by\s+reit(?:s)?|government\s+securities(?:\s*\([^)]*\))?)$/i;
  const nestedCategory = /^(?:overseas\s+mutual\s+funds?|mutual\s+funds?|exchange\s+traded\s+funds?|etfs?|reit(?:s)?|invit(?:s)?)$/i;
  const valueRow = /^(.{2,180}?)\s+(-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)%?$/;
  const wrappedContinuation = /^(?:ltd\.?|limited|inc\.?|corp(?:oration)?|healthcare|pharmaceuticals?|biotechnology|products?|services?|technology|technologies|trading|retailing|oil|power|capital\s+markets|leisure\s+services|&)/i;
  let pendingNameLines: string[] = [];

  for (const line of lines) {
    if (categoryHeading.test(line)) {
      primaryCategory = line;
      secondaryCategory = "";
      pendingNameLines = [];
      continue;
    }
    if (primaryCategory && nestedCategory.test(line)) {
      secondaryCategory = line;
      pendingNameLines = [];
      continue;
    }
    if (!primaryCategory) continue;
    const match = line.match(valueRow);
    if (!match) {
      if (line.length <= 100 && !/^(?:name\s+of|company\/?instrument|industry|rating|%\s+to|portfolio|sub\s*total|total|grand\s+total)/i.test(line)) {
        pendingNameLines = [...pendingNameLines.slice(-1), line];
      } else {
        pendingNameLines = [];
      }
      continue;
    }
    const rawCompanyName = match[1].trim();
    const companyName = wrappedContinuation.test(rawCompanyName) && pendingNameLines.length > 0
      ? [...pendingNameLines, rawCompanyName].join(" ")
      : rawCompanyName;
    pendingNameLines = [];
    const percentage = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(percentage) || percentage < -100 || percentage > 100) continue;
    const category = [primaryCategory, secondaryCategory].filter(Boolean).join(" / ");
    if (/^grand\s+total$/i.test(companyName)) {
      results.push({ companyName, percentage, category: "GRAND TOTAL", rowType: "grand_total" });
      continue;
    }
    if (/^(?:sub\s*)?total$/i.test(companyName)) {
      results.push({ companyName, percentage, category, rowType: "subtotal" });
      continue;
    }
    results.push({ companyName, percentage, category, rowType: "instrument" });
  }

  const instrumentCount = results.filter((row) => row.rowType === "instrument").length;
  const hasTotal = results.some((row) => row.rowType === "subtotal" || row.rowType === "grand_total");
  return instrumentCount >= 2 && hasTotal ? results : [];
}

/**
 * Extract allocation tables only from the text section belonging to the
 * selected scheme. The selected scheme must come from extractSchemeNames for
 * this same downloaded document.
 */
export function extractSchemeAllocations(text: string, schemeName: string, availableSchemeNames = extractSchemeNames(text)) {
  const selected = availableSchemeNames.find((name) => normaliseSchemeName(name) === normaliseSchemeName(schemeName));
  if (!selected) return { industryAllocations: [], portfolioHoldings: [], marketCapAllocations: [], assetAllocations: [] };

  // A consolidated AMC-wide table can be evidence for this scheme even when
  // the source document has no standalone scheme page in the extracted text.
  const consolidatedMarketCapAllocations = extractConsolidatedMarketCapAllocations(text, selected);
  const selectedStart = findBestSchemePosition(text, selected);
  if (selectedStart < 0) {
    return { industryAllocations: [], portfolioHoldings: [], marketCapAllocations: consolidatedMarketCapAllocations, assetAllocations: [] };
  }
  const nextSchemeStarts = availableSchemeNames
    .filter((name) => normaliseSchemeName(name) !== normaliseSchemeName(selected))
    .map((name) => findBestSchemePosition(text, name))
    .filter((position) => position > selectedStart);
  const selectedEnd = nextSchemeStarts.length > 0 ? Math.min(...nextSchemeStarts) : text.length;
  const section = text.slice(selectedStart, selectedEnd);
  const nearbyMarketCapAllocations = extractMarketCapAllocationsNearScheme(text, selected, availableSchemeNames);
  const portfolioComposition = extractPortfolioComposition(section);

  return {
    industryAllocations: extractSectorAllocations(section),
    portfolioHoldings: portfolioComposition.length > 0 ? portfolioComposition : extractPortfolioHoldings(section),
    marketCapAllocations: consolidatedMarketCapAllocations.length > 0
      ? consolidatedMarketCapAllocations
      : nearbyMarketCapAllocations.length > 0
        ? nearbyMarketCapAllocations
        : [],
    assetAllocations: extractAssetAllocations(section),
  };
}

/**
 * Parse a PDF buffer and extract sector and asset allocations.
 */
export async function parseFactsheet(pdfBuffer: Buffer): Promise<ParsedFactsheet> {
  try {
    const loadParams: LoadParameters = { data: new Uint8Array(pdfBuffer) };
    const parser = new PDFParse(loadParams);
    try {
      const textResult = await parser.getText();
      const text = textResult.text;

      const sectorAllocations = extractSectorAllocations(text);
      const assetAllocations = extractAssetAllocations(text);

      return {
        sectorAllocations,
        assetAllocations,
        marketCapAllocations: extractMarketCapAllocations(text),
        rawText: text,
        pages: textResult.pages.map((page) => ({ num: page.num, text: page.text })),
      };
    } finally {
      await parser.destroy();
    }
  } catch (err: unknown) {
    throw new Error(
      `PDF parsing failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
