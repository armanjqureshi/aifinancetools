/**
 * Registry-Driven Factsheet Downloader
 *
 * Uses the database-backed AMC registry as the first strategy for discovering
 * and downloading factsheets. For AMC page sources, it scrapes the registered
 * source URL directly to find the latest PDF link.
 * For "direct_pdf" sources, it downloads the registered URL immediately.
 * For other modes (dynamic, selector, manual), it falls back to the
 * advisorkhoj-based downloader.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";
import { listAmcSources } from "./db";
import { sourcePeriodScore } from "./factsheetPeriod";
import { parseFactsheet } from "./pdfParser";
import { extractFactsheetPeriod, matchesRequestedPeriod, type RequestedFactsheetPeriod } from "./factsheetPeriod";
import { officialReferenceCandidates } from "./officialReferenceCandidates";
import { getHybridAdapterProfile } from "./hybridAdapterRegistry";
import { discoverOfficialLatestPublicFeedCandidates, discoverOfficialPublicFeedCandidates } from "./officialPublicFeeds";

const DOWNLOAD_TIMEOUT_MS = 15_000;
const SCRAPE_TIMEOUT_MS = 8_000;
const BASE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const RELAXED_HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });
const MAX_TRANSIENT_ATTEMPTS = 1;
const MAX_PDF_CANDIDATES_TO_VERIFY = 3;

function pdfRequestHeaders(referer: string) {
  return {
    "User-Agent": BASE_UA,
    Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    Referer: referer,
  };
}

const FACTSHEET_KEYWORDS = [
  "factsheet", "fact-sheet", "fact_sheet",
  "fund-watch", "fund_watch",
  "uti_fund", "uti-fund",
  "nippon-fs", "nippon_fs",
  "absl-factsheet", "absl_factsheet",
  "empower-factsheet",
  "complete-factsheet", "complete_factsheet",
  "hdfc%20mf%20factsheet", "hdfc mf factsheet",
  "canara-robeco-factsheet",
  "edelweiss_factsheet",
  "bbnpp_mf_fund_facts",
  "abakkus_mutual_fund_factsheet",
];

function isFactsheetUrl(url: string) {
  const lower = url.toLowerCase();
  return FACTSHEET_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isRetryableSourceError(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status !== undefined) return status === 408 || status === 429 || status >= 500;
  return ["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND"].includes(error.code ?? "");
}

async function getWithTransientRetry(url: string, config: Parameters<typeof axios.get>[1]) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt += 1) {
    try {
      return await axios.get(url, config);
    } catch (error) {
      lastError = error;
      if (!isRetryableSourceError(error) || attempt === MAX_TRANSIENT_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 400));
    }
  }
  throw lastError;
}

function isExcludedDocument(value: string) {
  const lower = value.toLowerCase();
  return ["portfolio", "application", "sai", "kim", "sid", "charter", "statutory", "investor-charter", ".zip", ".xls"].some((term) => lower.includes(term));
}

function resolveCandidateUrl(candidate: string, sourceUrl: string) {
  const normalized = candidate.replace(/\\\//g, "/").replace(/^['"]|['"]$/g, "");
  return normalized.startsWith("http") ? normalized : new URL(normalized, new URL(sourceUrl)).toString();
}

export function extractFactsheetCandidates(html: string, sourceUrl: string) {
  const $ = cheerio.load(html);
  const candidates = new Map<string, number>();
  const addCandidate = (rawUrl: string, label = "") => {
    if (!rawUrl || !/\.pdf(?:[?#]|$)/i.test(rawUrl)) return;
    const combined = `${rawUrl} ${label}`;
    if (isExcludedDocument(combined)) return;
    const resolved = resolveCandidateUrl(rawUrl, sourceUrl);
    // Date score dominates so every discovered candidate is compared by its
    // stated filename period before a PDF is fetched. Keyword score breaks ties.
    const score = (isFactsheetUrl(combined) ? 100 : 0)
      + (/fact\s*sheet/i.test(label) ? 50 : 0)
      // Many AMC pages use opaque download IDs while the archive card carries
      // the month/year in its visible label. Score both surfaces before the
      // bounded PDF verification loop chooses the winner by printed period.
      + sourcePeriodScore(`${resolved} ${label}`) * 1_000;
    if (score > 0 && score > (candidates.get(resolved) ?? -1)) candidates.set(resolved, score);
  };

  $("a[href], iframe[src], embed[src], object[data], [data-pdf], [data-url]").each((_, element) => {
    const node = $(element);
    addCandidate(
      node.attr("href") ?? node.attr("src") ?? node.attr("data") ?? node.attr("data-pdf") ?? node.attr("data-url") ?? "",
      node.text()
    );
  });
  for (const match of Array.from(html.matchAll(/(?:https?:)?\\?\/\\?\/[^\s"'<>]+?\.pdf(?:[?#][^\s"'<>]*)?/gi))) {
    addCandidate(match[0] ?? "");
  }

  return Array.from(candidates.entries())
    .sort(([, left], [, right]) => right - left)
    .map(([url]) => url);
}

export interface RegistryDownloadResult {
  success: boolean;
  buffer?: Buffer;
  resolvedUrl?: string;
  amcName?: string;
  discoveryMode?: string;
  reportingPeriod?: string;
  archivePeriodLabel?: string;
  error?: string;
}

/**
 * Attempt to download the latest factsheet for an AMC identified by its slug.
 * Returns null only when the AMC is absent from the registry.
 */
export async function downloadFromRegistry(amcSlug: string, requestedPeriod?: RequestedFactsheetPeriod): Promise<RegistryDownloadResult | null> {
  const sources = await listAmcSources();
  const source = sources.find((src) => src.amcSlug === amcSlug && src.isActive === 1);
  if (!source) return null;

  const { sourceUrl, sourceKind, discoveryMode, amcName } = source;
  const referer = sourceUrl;
  const adapter = getHybridAdapterProfile(amcSlug);

  if (!requestedPeriod) {
    try {
      const feedCandidates = await discoverOfficialLatestPublicFeedCandidates(amcSlug);
      if (feedCandidates.length > 0) {
        const errors: string[] = [];
        let newestCandidate: { buffer: Buffer; resolvedUrl: string; reportingPeriod: string; periodValue: number } | null = null;
        for (const reference of feedCandidates.slice(0, MAX_PDF_CANDIDATES_TO_VERIFY)) {
          try {
            const response = await getWithTransientRetry(reference.url, {
              responseType: "arraybuffer",
              headers: pdfRequestHeaders(sourceUrl),
              timeout: amcSlug === "dsp" ? 120_000 : DOWNLOAD_TIMEOUT_MS,
              validateStatus: (status) => status === 200,
              httpsAgent: RELAXED_HTTPS_AGENT,
            });
            const buffer = Buffer.from(response.data as ArrayBuffer);
            if (buffer.length <= 1000 || buffer.subarray(0, 4).toString() !== "%PDF") {
              errors.push(`${reference.label}: not a valid PDF`);
              continue;
            }
            const parsed = await parseFactsheet(buffer);
            const period = extractFactsheetPeriod(parsed.rawText, reference.url);
            if (!period) {
              errors.push(`${reference.label}: no verifiable reporting period`);
              continue;
            }
            const candidate = { buffer, resolvedUrl: reference.url, reportingPeriod: period.label, periodValue: period.year * 12 + period.month };
            if (!newestCandidate || candidate.periodValue > newestCandidate.periodValue) newestCandidate = candidate;
          } catch (error) {
            errors.push(`${reference.label}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (newestCandidate) {
          return { success: true, buffer: newestCandidate.buffer, resolvedUrl: newestCandidate.resolvedUrl, amcName, discoveryMode: "official_public_feed_latest", reportingPeriod: newestCandidate.reportingPeriod };
        }
        if (!adapter.allowGenericFallback) {
          return { success: false, amcName, discoveryMode: "official_public_feed_latest", error: `The official public feed did not yield a valid latest factsheet. ${errors.slice(0, 2).join("; ")}` };
        }
      }
    } catch {
      // A feed outage never authorizes a guessed URL; eligible AMC sources can still use their registered page route.
    }
  }

  if (requestedPeriod) {
    let references = officialReferenceCandidates(amcSlug, requestedPeriod);
    let referenceDiscoveryMode = "official_reference";
    if (references.length === 0) {
      try {
        const feedCandidates = await discoverOfficialPublicFeedCandidates(amcSlug, requestedPeriod);
        if (feedCandidates.length > 0) {
          references = feedCandidates;
          referenceDiscoveryMode = "official_public_feed";
        }
      } catch {
        // A public feed failure never authorizes an alternate or guessed URL;
        // the registry may still attempt the separately registered page source.
      }
    }
    if (references.length > 0) {
      const errors: string[] = [];
      for (const reference of references) {
        try {
          const response = await getWithTransientRetry(reference.url, {
            responseType: "arraybuffer",
            headers: pdfRequestHeaders(sourceUrl),
            timeout: reference.downloadTimeoutMs ?? DOWNLOAD_TIMEOUT_MS,
            validateStatus: (status) => status === 200,
            httpsAgent: RELAXED_HTTPS_AGENT,
          });
          const buffer = Buffer.from(response.data as ArrayBuffer);
          if (buffer.length <= 1000 || buffer.subarray(0, 4).toString() !== "%PDF") {
            errors.push(`${reference.label}: not a valid PDF`);
            continue;
          }
          const parsed = await parseFactsheet(buffer);
          const period = extractFactsheetPeriod(parsed.rawText, reference.url);
          if (!period || (!matchesRequestedPeriod(period, requestedPeriod) && reference.archivePeriodLabel !== requestedPeriod.label)) {
            errors.push(`${reference.label}: reports ${period?.label ?? "no verifiable month"}`);
            continue;
          }
          return { success: true, buffer, resolvedUrl: reference.url, amcName, discoveryMode: referenceDiscoveryMode, reportingPeriod: period.label, archivePeriodLabel: reference.archivePeriodLabel };
        } catch (error) {
          errors.push(`${reference.label}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return { success: false, amcName, discoveryMode: referenceDiscoveryMode, error: `No verified ${requestedPeriod.label} PDF could be retrieved from the official ${referenceDiscoveryMode === "official_public_feed" ? "public feed" : "reference"}. ${errors.join("; ")}` };
    }
    if (!adapter.allowGenericFallback) {
      return {
        success: false,
        amcName,
        discoveryMode: adapter.method,
        error: `${adapter.label}: ${adapter.guidance}`,
      };
    }
  }

  // ── Direct PDF source ────────────────────────────────────────────────────
  if (sourceKind === "direct_pdf") {
    try {
      const response = await getWithTransientRetry(sourceUrl, {
        responseType: "arraybuffer",
        headers: pdfRequestHeaders(referer),
        timeout: DOWNLOAD_TIMEOUT_MS,
        validateStatus: (status) => status === 200,
        httpsAgent: RELAXED_HTTPS_AGENT,
      });
      const buffer = Buffer.from(response.data as ArrayBuffer);
      if (buffer.length > 1000 && buffer.subarray(0, 4).toString() === "%PDF") {
        if (requestedPeriod) {
          const parsed = await parseFactsheet(buffer);
          const period = extractFactsheetPeriod(parsed.rawText, sourceUrl);
          if (!period || !matchesRequestedPeriod(period, requestedPeriod)) {
            return { success: false, amcName, discoveryMode, error: `The registered direct PDF reports ${period?.label ?? "no verifiable month"}, not the requested ${requestedPeriod.label}.` };
          }
          return { success: true, buffer, resolvedUrl: sourceUrl, amcName, discoveryMode, reportingPeriod: period.label };
        }
        return { success: true, buffer, resolvedUrl: sourceUrl, amcName, discoveryMode };
      }
      return { success: false, amcName, discoveryMode, error: `Direct PDF at ${sourceUrl} is not a valid PDF.` };
    } catch (err: unknown) {
      return { success: false, amcName, discoveryMode, error: `Direct PDF download failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // ── Page scraping ────────────────────────────────────────────────────────
  if (sourceKind === "page") {
    try {
      const pageResponse = await getWithTransientRetry(sourceUrl, {
        headers: { "User-Agent": BASE_UA, Accept: "text/html,*/*", "Accept-Language": "en-IN,en;q=0.9", Referer: referer },
        timeout: SCRAPE_TIMEOUT_MS,
        httpsAgent: RELAXED_HTTPS_AGENT,
      });
      const candidates = extractFactsheetCandidates(String(pageResponse.data), sourceUrl);
      if (candidates.length === 0) {
        return { success: false, amcName, discoveryMode, error: `No factsheet PDF link found on ${sourceUrl}.` };
      }
      const candidatesForPeriod = requestedPeriod
        ? candidates.filter((candidate) => {
          const period = extractFactsheetPeriod("", candidate);
          return period ? matchesRequestedPeriod(period, requestedPeriod) : false;
        })
        : candidates;
      if (requestedPeriod && candidatesForPeriod.length === 0) {
        return { success: false, amcName, discoveryMode, error: `No ${requestedPeriod.label} factsheet link was exposed by ${sourceUrl}.` };
      }
      const errors: string[] = [];
      let newestCandidate: { buffer: Buffer; resolvedUrl: string; periodValue: number; reportingPeriod: string } | null = null;
      // Every discovered candidate is downloaded and compared using the
      // reporting period extracted from its PDF text, not filename hints alone.
      for (const resolvedUrl of candidatesForPeriod.slice(0, MAX_PDF_CANDIDATES_TO_VERIFY)) {
        try {
          const pdfResponse = await getWithTransientRetry(resolvedUrl, {
            responseType: "arraybuffer",
            headers: pdfRequestHeaders(referer),
            timeout: DOWNLOAD_TIMEOUT_MS,
            validateStatus: (status) => status === 200,
            httpsAgent: RELAXED_HTTPS_AGENT,
          });
          const buffer = Buffer.from(pdfResponse.data as ArrayBuffer);
          if (buffer.length > 1000 && buffer.subarray(0, 4).toString() === "%PDF") {
            const parsed = await parseFactsheet(buffer);
            const period = extractFactsheetPeriod(parsed.rawText, resolvedUrl);
            if (!period) {
              errors.push(`${resolvedUrl}: no verifiable reporting period`);
              continue;
            }
            if (requestedPeriod && !matchesRequestedPeriod(period, requestedPeriod)) {
              errors.push(`${resolvedUrl}: states ${period.label}, not requested ${requestedPeriod.label}`);
              continue;
            }
            const candidate = { buffer, resolvedUrl, reportingPeriod: period.label, periodValue: period.year * 12 + period.month };
            if (!newestCandidate || candidate.periodValue > newestCandidate.periodValue) newestCandidate = candidate;
            continue;
          }
          errors.push(`${resolvedUrl}: not a valid PDF`);
        } catch (error) {
          errors.push(`${resolvedUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (newestCandidate) return { success: true, buffer: newestCandidate.buffer, resolvedUrl: newestCandidate.resolvedUrl, amcName, discoveryMode, reportingPeriod: newestCandidate.reportingPeriod };
      return { success: false, amcName, discoveryMode, error: `Factsheet PDF candidates could not be downloaded. ${errors.slice(0, 2).join("; ")}` };
    } catch (err: unknown) {
      return { success: false, amcName, discoveryMode, error: `HTML scrape failed for ${sourceUrl}: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // No fetchable source is available.
  return null;
}
