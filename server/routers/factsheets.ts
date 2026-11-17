import { z } from "zod";
import { TRPCError } from "@trpc/server";
import axios from "axios";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createChatContext,
  createFactsheetDocument,
  getAmcBySlug,
  getFactsheetDocumentForPeriod,
  getFactsheetDocumentWithAmc,
  listAmcDownloadRetries,
  listAmcSources,
  listAmcSourcesWithLatestDocuments,
  listRecentFactsheetDocuments,
  listLowConfidenceVisualAllocationEvidence,
  normalizeSchemeName,
  reportingPeriodSortValue,
  saveVisualAllocationReview,
  updateAmcDownloadRetry,
  upsertAmcDownloadRetry,
} from "../db";
import { downloadFromRegistry } from "../registryDownloader";
import { downloadFactsheet } from "../pdfDownloader";
import { detectFundHouse } from "../fundHouseDetector";
import { extractSchemeAllocations, extractSchemeNames, parseFactsheet } from "../pdfParser";
import { storageGetSignedUrl, storagePut } from "../storage";
import { invokeLLM } from "../_core/llm";
import { resolveVisualMarketCapAllocation } from "../visualMarketCapExtractor";
import { resolveSchemePageAllocation } from "../schemePageAllocationReader";
import { SourceDownloadDeadlineError, withSourceDownloadDeadline } from "../downloadDeadline";
import { createHeartbeatJob } from "../_core/heartbeat";
import { DAILY_RETRY_SOURCES } from "../retryPolicy";
import { extractFactsheetPeriod, matchesRequestedPeriod } from "../factsheetPeriod";
import { SELECTED_PERIOD_COVERAGE } from "../archiveCoverage";
import { getHybridAdapterProfile } from "../hybridAdapterRegistry";
import { calculateMarketCapFromHoldings } from "../amfiClassificationService";
import { shouldUseHoldingsMarketCapFallback } from "../marketCapFallbackPolicy";
import { ENV } from "../_core/env";
import { primeCachedPdfTextPages } from "../pdfPageCache";

const CHAT_SYSTEM_PROMPT = `You are a careful mutual fund factsheet assistant. Answer only from the selected downloaded factsheet supplied in the context. Never invent data, performance, holdings, allocations, or dates. If the answer is absent or unclear in the factsheet, say that plainly. Cite facts you use as [Factsheet: AMC Name]. Keep answers clear and concise.`;
const INDIVIDUAL_DOWNLOAD_DEADLINE_MS = 240_000;
// Latest mode must revalidate older documents or it can silently keep serving
// last month's factsheet forever. Cached PDFs remain an instant-open shortcut.
export const LATEST_REVALIDATION_INTERVAL_MS = 12 * 60 * 60 * 1000;
const MAX_OFFICIAL_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_OFFICIAL_UPLOAD_BASE64_LENGTH = Math.ceil(MAX_OFFICIAL_UPLOAD_BYTES * 4 / 3) + 4;

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function reportingPeriodEnd(label?: string | null): Date | undefined {
  if (!label) return undefined;
  const parsed = new Date(`${label} 01T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0));
}

function describeSourceFailure(error?: string) {
  const message = (error ?? "").toLowerCase();
  if (message.includes("status code 403") || message.includes("status code 406")) {
    return "The AMC website declined automated access to its factsheet page. Try again later or use the AMC source page directly.";
  }
  if (message.includes("status code 5")) {
    return "The AMC website is temporarily unavailable. Try again later.";
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("socket") || message.includes("tls")) {
    return "The AMC website could not be reached from the downloader. Try again later.";
  }
  if (message.includes("no factsheet pdf link")) {
    return "The AMC page did not expose a downloadable factsheet PDF.";
  }
  return "The registered AMC source did not provide a downloadable factsheet PDF.";
}

type AmcSourceWithLatest = Awaited<ReturnType<typeof listAmcSourcesWithLatestDocuments>>[number];

function isRecentlyRevalidated(source: AmcSourceWithLatest, cachedDocument: { downloadedAt?: Date | null } | null | undefined) {
  const timestamps = [source.latestOutcome?.createdAt, cachedDocument?.downloadedAt]
    .map((value) => value instanceof Date ? value.getTime() : value ? new Date(value).getTime() : NaN)
    .filter((value) => Number.isFinite(value));
  if (timestamps.length === 0) return false;
  return Date.now() - Math.max(...timestamps) < LATEST_REVALIDATION_INTERVAL_MS;
}

function isSafePublicPdfUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false;
    const privateRange = host.match(/^172\.(\d+)\./);
    return !(privateRange && Number(privateRange[1]) >= 16 && Number(privateRange[1]) <= 31);
  } catch {
    return false;
  }
}

function selectRelevantFactsheetText(text: string, question: string) {
  const maxCharacters = 90_000;
  if (text.length <= maxCharacters) return text;

  const terms = question.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
  const chunks = text.match(/[\s\S]{1,6000}/g) ?? [];
  const scored = chunks
    .map((chunk, index) => ({
      chunk,
      index,
      score: terms.reduce((score, term) => score + (chunk.toLowerCase().split(term).length - 1), 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = scored
    .slice(0, 14)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.chunk)
    .join("\n\n");

  return `${text.slice(0, 8_000)}\n\n[Relevant sections selected from the full stored factsheet]\n\n${selected}`.slice(0, maxCharacters);
}

export const factsheetsRouter = router({
  archiveCoverage: protectedProcedure.query(() => SELECTED_PERIOD_COVERAGE),

  listAmcs: protectedProcedure.query(async () => {
    const sources = await listAmcSourcesWithLatestDocuments();
    return sources
      .filter((source) => source.isActive === 1)
      .map((source) => ({
        id: source.id,
        amcId: source.amcId,
        name: source.amcName,
        slug: source.amcSlug,
        sourceUrl: source.sourceUrl,
        adapter: getHybridAdapterProfile(source.amcSlug),
        latestDocument: source.latestDocument,
        needsRemediation: !source.latestDocument?.fileUrl,
        latestOutcome: source.latestOutcome,
        revalidation: {
          status: source.latestDocument?.fileUrl
            ? isRecentlyRevalidated(source, source.latestDocument) ? "current" : "stale"
            : source.latestOutcome?.status === "failed" ? "unresolved" : "unavailable",
          checkedAt: source.latestOutcome?.createdAt ?? source.latestDocument?.downloadedAt ?? null,
          reason: source.latestOutcome?.errorMessage ?? null,
        },
      }));
  }),

  recent: protectedProcedure.query(() => listRecentFactsheetDocuments()),

  retryStatus: protectedProcedure.query(() => listAmcDownloadRetries()),

  enableDailyRetries: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    const sources = await listAmcSources();
    const existing = await listAmcDownloadRetries();
    const existingByAmcId = new Map(existing.map((retry) => [retry.amcId, retry]));
    const now = new Date();

    for (const source of sources) {
      const status = DAILY_RETRY_SOURCES[source.amcSlug];
      if (!status || existingByAmcId.has(source.amcId)) continue;
      await upsertAmcDownloadRetry({
        amcId: source.amcId,
        sourceId: source.id,
        status,
        attemptCount: 0,
        nextRetryAt: now,
        isEnabled: 1,
      });
    }

    const retries = await listAmcDownloadRetries();
    for (const retry of retries) {
      if (retry.scheduleCronTaskUid) continue;
      const minute = 5 + (retry.id % 50);
      const job = await createHeartbeatJob({
        name: `factsheet-retry-${retry.id}`,
        cron: `0 ${minute} 6 * * *`,
        path: "/api/scheduled/factsheet-retry",
        payload: {},
        description: `Daily retry for ${retry.amcName} factsheet source`,
      }, sessionToken);
      await updateAmcDownloadRetry(retry.id, { scheduleCronTaskUid: job.taskUid, isEnabled: 1 });
    }
    return { enabled: true, retries: await listAmcDownloadRetries() };
  }),

  downloadLatest: protectedProcedure
    .input(z.object({
      amcSlug: z.string().min(1),
      requestedPeriod: z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(0).max(11) }).optional(),
      forceRefresh: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const amc = await getAmcBySlug(input.amcSlug);
      const source = (await listAmcSources()).find((item) => item.amcSlug === input.amcSlug && item.isActive === 1);
      if (!amc || !source) throw new TRPCError({ code: "NOT_FOUND", message: "This AMC source is not registered." });

      const requestedLabel = input.requestedPeriod
        ? new Date(input.requestedPeriod.year, input.requestedPeriod.month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
        : null;
      const cachedSource = (await listAmcSourcesWithLatestDocuments()).find((item) => item.amcSlug === input.amcSlug);
      const cachedDocument = requestedLabel
        ? await getFactsheetDocumentForPeriod(amc.id, source.id, requestedLabel)
        : cachedSource?.latestDocument;
      const canUseLatestCache = Boolean(cachedDocument?.fileUrl && cachedSource && isRecentlyRevalidated(cachedSource, cachedDocument));
      if (cachedDocument?.fileUrl && !input.forceRefresh && (Boolean(requestedLabel) || canUseLatestCache)) {
        return {
          success: true as const,
          id: cachedDocument.id,
          amcName: amc.name,
          asOfLabel: cachedDocument.asOfLabel ?? requestedLabel ?? "Verified current factsheet",
          fileUrl: cachedDocument.fileUrl,
          resolvedPdfUrl: source.sourceUrl,
          textLength: 0,
        };
      }

      // The registered AMC source is always tried first. A legacy adapter is
      // attempted only for recognised fund houses; any failure is reported in
      // terms of the registered source rather than leaking an unsupported
      // legacy URL-pattern error into bulk-download results.
      let result;
      let registryTimedOut = false;
      try {
        result = await withSourceDownloadDeadline(
          () => downloadFromRegistry(input.amcSlug, input.requestedPeriod && { ...input.requestedPeriod, label: requestedLabel! }),
          INDIVIDUAL_DOWNLOAD_DEADLINE_MS
        );
      } catch (error) {
        registryTimedOut = error instanceof SourceDownloadDeadlineError;
        result = {
          success: false,
          error: registryTimedOut
            ? (error as SourceDownloadDeadlineError).message
            : `The registered AMC source could not be contacted: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      const legacyFundHouse = detectFundHouse(amc.name);
      if ((!result?.success || !result.buffer) && !input.requestedPeriod && !registryTimedOut && legacyFundHouse !== "Unknown") {
        let fallback;
        try {
          fallback = await withSourceDownloadDeadline(
            () => downloadFactsheet(legacyFundHouse, { skipRegistry: true }),
            INDIVIDUAL_DOWNLOAD_DEADLINE_MS
          );
        } catch (error) {
          fallback = {
            success: false,
            error: error instanceof SourceDownloadDeadlineError
              ? error.message
              : `The fallback factsheet source could not be contacted: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
        if (fallback.success && fallback.buffer) {
          result = {
            success: true,
            buffer: fallback.buffer,
            resolvedUrl: fallback.url,
            amcName: amc.name,
            discoveryMode: "fallback",
          };
        } else {
          result = {
            success: false,
            error: `The registered ${amc.name} factsheet source did not provide a downloadable PDF. ${result?.error ?? "The source may require an interactive browser download."}`,
          };
        }
      }

      if ((!result?.success || !result.buffer) && (legacyFundHouse === "Unknown" || Boolean(input.requestedPeriod))) {
        result = {
          success: false,
          error: `The registered ${amc.name} factsheet source did not provide a downloadable PDF. ${result?.error ?? "The source may require an interactive browser download."}`,
        };
      }

      if (!result?.success || !result.buffer) {
        if (!input.requestedPeriod && cachedDocument?.fileUrl) {
          return {
            success: true as const,
            id: cachedDocument.id,
            amcName: amc.name,
            asOfLabel: cachedDocument.asOfLabel ?? "Verified current factsheet",
            fileUrl: cachedDocument.fileUrl,
            resolvedPdfUrl: source.sourceUrl,
            textLength: 0,
            revalidationStatus: "source_unavailable" as const,
            revalidationError: describeSourceFailure(result?.error),
          };
        }
        return {
          success: false as const,
          amcName: amc.name,
          sourceUrl: source.sourceUrl,
          error: describeSourceFailure(result?.error),
        };
      }

      const parsed = await parseFactsheet(result.buffer);
      const reportingPeriod = extractFactsheetPeriod(parsed.rawText, result.resolvedUrl ?? source.sourceUrl);
      if (!reportingPeriod) {
        return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: "The downloaded PDF does not state a verifiable reporting month, so it was rejected rather than being treated as the latest factsheet." };
      }
      const currentDate = new Date();
      const currentMonthValue = currentDate.getFullYear() * 12 + currentDate.getMonth();
      if (!input.requestedPeriod && reportingPeriod.year * 12 + reportingPeriod.month > currentMonthValue) {
        const error = `The downloaded PDF reports the future period ${reportingPeriod.label}, so it was rejected.`;
        if (!input.requestedPeriod && cachedDocument?.fileUrl) {
          return {
            success: true as const,
            id: cachedDocument.id,
            amcName: amc.name,
            asOfLabel: cachedDocument.asOfLabel ?? "Verified current factsheet",
            fileUrl: cachedDocument.fileUrl,
            resolvedPdfUrl: source.sourceUrl,
            textLength: 0,
            revalidationStatus: "candidate_rejected" as const,
            revalidationError: error,
          };
        }
        return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error };
      }
      if (input.requestedPeriod && !matchesRequestedPeriod(reportingPeriod, { ...input.requestedPeriod, label: requestedLabel! }) && result.archivePeriodLabel !== requestedLabel) {
        return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: `The selected ${requestedLabel} archive request returned a PDF for ${reportingPeriod.label}, so it was rejected.` };
      }
      if (!input.requestedPeriod && cachedDocument?.fileUrl && reportingPeriodSortValue(reportingPeriod.label) <= reportingPeriodSortValue(cachedDocument.asOfLabel)) {
        return {
          success: true as const,
          id: cachedDocument.id,
          amcName: amc.name,
          asOfLabel: cachedDocument.asOfLabel ?? reportingPeriod.label,
          fileUrl: cachedDocument.fileUrl,
          resolvedPdfUrl: source.sourceUrl,
          textLength: 0,
          revalidationStatus: "unchanged" as const,
          discoveredReportingPeriod: reportingPeriod.label,
        };
      }
      const timestamp = new Date();
      const stored = await storagePut(
        `factsheets/direct/${input.amcSlug}/factsheet_${(requestedLabel ?? reportingPeriod.label).replace(/\s+/g, "-")}.pdf`,
        result.buffer,
        "application/pdf"
      );
      primeCachedPdfTextPages(`file:${stored.key}`, parsed.pages);
      const documentId = await createFactsheetDocument({
        amcId: amc.id,
        sourceId: source.id,
        documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
        sourceUrl: source.sourceUrl,
        resolvedPdfUrl: result.resolvedUrl ?? null,
        asOfLabel: requestedLabel ?? reportingPeriod.label,
        fileKey: stored.key,
        fileUrl: stored.url,
        extractedText: parsed.rawText,
        status: "parsed",
        downloadedAt: timestamp,
      });

      return {
        success: true as const,
        id: documentId,
        amcName: amc.name,
        asOfLabel: requestedLabel ?? reportingPeriod.label,
        pdfReportingPeriodLabel: result.archivePeriodLabel ? reportingPeriod.label : undefined,
        fileUrl: stored.url,
        resolvedPdfUrl: result.resolvedUrl ?? null,
        textLength: parsed.rawText.length,
        revalidationStatus: input.forceRefresh ? "refreshed" as const : undefined,
      };
    }),

  downloadFromSourceLink: protectedProcedure
    .input(z.object({ amcSlug: z.string().min(1), url: z.string().url(), requestedPeriod: z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(0).max(11) }).optional() }))
    .mutation(async ({ input }) => {
      if (!isSafePublicPdfUrl(input.url)) throw new TRPCError({ code: "BAD_REQUEST", message: "Use a public http(s) PDF URL; local and private network addresses are not allowed." });
      const amc = await getAmcBySlug(input.amcSlug);
      const source = (await listAmcSources()).find((item) => item.amcSlug === input.amcSlug && item.isActive === 1);
      if (!amc || !source) throw new TRPCError({ code: "NOT_FOUND", message: "This AMC source is not registered." });
      const requestedLabel = input.requestedPeriod ? new Date(input.requestedPeriod.year, input.requestedPeriod.month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : null;
      try {
        const response = await axios.get(input.url, { responseType: "arraybuffer", timeout: INDIVIDUAL_DOWNLOAD_DEADLINE_MS, headers: { "User-Agent": "Mozilla/5.0", Accept: "application/pdf,*/*", Referer: source.sourceUrl }, validateStatus: (status) => status === 200 });
        const buffer = Buffer.from(response.data as ArrayBuffer);
        if (buffer.length <= 1000 || buffer.subarray(0, 4).toString() !== "%PDF") return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: "The supplied URL did not return a valid PDF." };
        const parsed = await parseFactsheet(buffer);
        const reportingPeriod = extractFactsheetPeriod(parsed.rawText, input.url);
        if (!reportingPeriod) return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: "The supplied PDF does not state a verifiable reporting month." };
        if (input.requestedPeriod && !matchesRequestedPeriod(reportingPeriod, { ...input.requestedPeriod, label: requestedLabel! })) return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: `The supplied PDF reports ${reportingPeriod.label}, not the selected ${requestedLabel}.` };
        const timestamp = new Date();
        const stored = await storagePut(`factsheets/direct/${input.amcSlug}/source-link_${(requestedLabel ?? reportingPeriod.label).replace(/\s+/g, "-")}.pdf`, buffer, "application/pdf");
        primeCachedPdfTextPages(`file:${stored.key}`, parsed.pages);
        const documentId = await createFactsheetDocument({ amcId: amc.id, sourceId: source.id, documentScope: source.documentScope === "scheme" ? "scheme" : "amc", sourceUrl: input.url, resolvedPdfUrl: input.url, asOfLabel: requestedLabel ?? reportingPeriod.label, fileKey: stored.key, fileUrl: stored.url, extractedText: parsed.rawText, status: "parsed", downloadedAt: timestamp });
        return { success: true as const, id: documentId, amcName: amc.name, asOfLabel: requestedLabel ?? reportingPeriod.label, fileUrl: stored.url, resolvedPdfUrl: input.url, textLength: parsed.rawText.length };
      } catch (error) {
        return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: `The supplied official PDF link could not be downloaded: ${error instanceof Error ? error.message : String(error)}` };
      }
    }),

  uploadOfficialPdf: protectedProcedure
    .input(z.object({
      amcSlug: z.string().min(1),
      fileName: z.string().trim().min(1).max(255),
      pdfBase64: z.string().min(4).max(MAX_OFFICIAL_UPLOAD_BASE64_LENGTH),
      requestedPeriod: z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(0).max(11) }).optional(),
      confirmedOfficialSource: z.literal(true),
      originalSourceUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      const amc = await getAmcBySlug(input.amcSlug);
      const source = (await listAmcSources()).find((item) => item.amcSlug === input.amcSlug && item.isActive === 1);
      if (!amc || !source) throw new TRPCError({ code: "NOT_FOUND", message: "This AMC source is not registered." });
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.pdfBase64)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "The upload is not valid base64 PDF data." });
      }

      const buffer = Buffer.from(input.pdfBase64, "base64");
      if (buffer.length < 1_000 || buffer.length > MAX_OFFICIAL_UPLOAD_BYTES || buffer.subarray(0, 4).toString() !== "%PDF") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Upload an official PDF under 15 MB." });
      }

      const requestedLabel = input.requestedPeriod
        ? new Date(input.requestedPeriod.year, input.requestedPeriod.month, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
        : null;
      const parsed = await parseFactsheet(buffer);
      const reportingPeriod = extractFactsheetPeriod(parsed.rawText, input.fileName);
      if (!reportingPeriod) {
        return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: "The uploaded PDF does not state a verifiable reporting month." };
      }
      if (input.requestedPeriod && !matchesRequestedPeriod(reportingPeriod, { ...input.requestedPeriod, label: requestedLabel! })) {
        return { success: false as const, amcName: amc.name, sourceUrl: source.sourceUrl, error: `The uploaded PDF reports ${reportingPeriod.label}, not the selected ${requestedLabel}.` };
      }

      const uploadedAt = new Date();
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
      const stored = await storagePut(
        `factsheets/uploaded/${input.amcSlug}/${(requestedLabel ?? reportingPeriod.label).replace(/\s+/g, "-")}_${safeName}`,
        buffer,
        "application/pdf"
      );
      primeCachedPdfTextPages(`file:${stored.key}`, parsed.pages);
      const documentId = await createFactsheetDocument({
        amcId: amc.id,
        sourceId: source.id,
        documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
        sourceUrl: input.originalSourceUrl && isSafePublicPdfUrl(input.originalSourceUrl) ? input.originalSourceUrl : source.sourceUrl,
        resolvedPdfUrl: null,
        asOfLabel: requestedLabel ?? reportingPeriod.label,
        fileKey: stored.key,
        fileUrl: stored.url,
        extractedText: parsed.rawText,
        status: "parsed",
        downloadedAt: uploadedAt,
      });
      return {
        success: true as const,
        id: documentId,
        amcName: amc.name,
        asOfLabel: requestedLabel ?? reportingPeriod.label,
        fileUrl: stored.url,
        resolvedPdfUrl: null,
        textLength: parsed.rawText.length,
        sourceMethod: "official_upload" as const,
      };
    }),

  documentSchemes: protectedProcedure
    .input(z.object({ documentId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const document = await getFactsheetDocumentWithAmc(input.documentId);
      if (!document || document.status !== "parsed" || !document.extractedText) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That downloaded factsheet is unavailable for scheme selection." });
      }
      return {
        documentId: document.id,
        amcName: document.amcName,
        schemes: extractSchemeNames(document.extractedText, document.amcName),
      };
    }),

  schemeAllocations: protectedProcedure
    .input(z.object({ documentId: z.number().int().positive(), schemeName: z.string().trim().min(3).max(256) }))
    .query(async ({ input }) => {
      const document = await getFactsheetDocumentWithAmc(input.documentId);
      if (!document || document.status !== "parsed" || !document.extractedText) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That downloaded factsheet is unavailable for allocation analysis." });
      }
      const schemes = extractSchemeNames(document.extractedText, document.amcName);
      const selectedScheme = schemes.find((scheme) => scheme.toLowerCase() === input.schemeName.toLowerCase());
      if (!selectedScheme) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a scheme listed in this downloaded factsheet." });
      }
      const parsedAllocations = extractSchemeAllocations(document.extractedText, selectedScheme, schemes);
      const visualPdfUrl = document.fileKey
        ? await storageGetSignedUrl(document.fileKey).catch(() => document.resolvedPdfUrl ?? document.sourceUrl)
        : document.resolvedPdfUrl ?? document.sourceUrl;
      const pdfCacheKey = document.fileKey ? `file:${document.fileKey}` : `document:${document.id}`;
      const visualMarketCap = await resolveVisualMarketCapAllocation({
        documentId: document.id,
        schemeName: selectedScheme,
        pdfUrl: visualPdfUrl,
        cacheKey: pdfCacheKey,
      });
      const [industryPageData, portfolioPageData] = await Promise.all([
        resolveSchemePageAllocation({ documentId: document.id, schemeName: selectedScheme, pdfUrl: visualPdfUrl, cacheKey: pdfCacheKey, allocationType: "industry" }),
        resolveSchemePageAllocation({ documentId: document.id, schemeName: selectedScheme, pdfUrl: visualPdfUrl, cacheKey: pdfCacheKey, allocationType: "portfolio" }),
      ]);
      const factsheetDate = reportingPeriodEnd(document.asOfLabel);
      const disclosedMarketCapAllocations = visualMarketCap?.allocations ?? [];
      const calculatedMarketCap = factsheetDate && portfolioPageData.allocations.length > 0 && shouldUseHoldingsMarketCapFallback(disclosedMarketCapAllocations)
        ? await calculateMarketCapFromHoldings({
            documentId: document.id,
            normalizedSchemeName: normalizeSchemeName(selectedScheme),
            factsheetDate,
            holdings: portfolioPageData.allocations.filter((allocation) => allocation.rowType !== "subtotal" && allocation.rowType !== "grand_total").map((allocation) => ({
              companyName: allocation.label,
              percentage: allocation.percentage,
              isin: allocation.isin,
              nseSymbol: allocation.nseSymbol,
            })),
            portfolioTableScope: portfolioPageData.portfolioScope,
          })
        : undefined;
      return {
        documentId: document.id,
        amcName: document.amcName,
        schemeName: selectedScheme,
        ...parsedAllocations,
        industryAllocations: industryPageData.allocations,
        portfolioHoldings: portfolioPageData.allocations.map((allocation) => ({
          companyName: allocation.label,
          percentage: allocation.percentage,
          isin: allocation.isin,
          nseSymbol: allocation.nseSymbol,
          securityType: allocation.securityType,
          category: allocation.category,
          rowType: allocation.rowType,
        })),
        industryEvidence: industryPageData,
        portfolioEvidence: portfolioPageData,
        marketCapAllocations: disclosedMarketCapAllocations,
        marketCapEvidence: visualMarketCap?.evidence ?? {
          method: "not_found",
          confidence: 0,
          sourcePage: null,
          evidence: "No market-cap allocation is shown until a page-verified scheme match is available.",
        },
        calculatedMarketCap: calculatedMarketCap
          ? {
              method: "sebi_amfi_holdings_calculation" as const,
              allocations: calculatedMarketCap.allocations,
              coveragePercent: calculatedMarketCap.coveragePercent,
              calculationStatus: calculatedMarketCap.calculationStatus,
              mappedHoldings: calculatedMarketCap.mappedHoldings,
              unresolvedHoldings: calculatedMarketCap.unresolvedHoldings,
              snapshot: calculatedMarketCap.snapshot,
              portfolioTableScope: portfolioPageData.portfolioScope ?? "unknown",
            }
          : null,
        evidencePdfUrl: document.fileUrl ?? document.resolvedPdfUrl ?? document.sourceUrl,
      };
    }),

  reviewQueue: adminProcedure.query(async () => {
    const records = await listLowConfidenceVisualAllocationEvidence();
    return records.map((record) => ({
      ...record,
      confidence: Number(record.confidence),
      failureClass: record.failureClass,
      allocations: (() => {
        try {
          return JSON.parse(record.allocationsJson) as Array<{ label: string; percentage: number }>;
        } catch {
          return [];
        }
      })(),
      pdfUrl: record.fileUrl ?? record.resolvedPdfUrl,
    }));
  }),

  reviewAllocation: adminProcedure
    .input(z.object({
      id: z.number().int().positive(),
      reviewStatus: z.enum(["verified", "corrected", "rejected"]),
      reviewerNote: z.string().trim().max(2000).optional(),
      allocations: z.array(z.object({ label: z.string().trim().min(1).max(80), percentage: z.number().positive().max(100) })).max(12).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.reviewStatus === "corrected" && (!input.allocations || input.allocations.length === 0)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter at least one corrected allocation before saving a correction." });
      }
      await saveVisualAllocationReview({
        id: input.id,
        reviewStatus: input.reviewStatus,
        reviewerNote: input.reviewerNote,
        allocationsJson: input.allocations ? JSON.stringify(input.allocations) : undefined,
        reviewedBy: ctx.user.id,
      });
      return { success: true as const };
    }),

  ask: protectedProcedure
    .input(z.object({ documentId: z.number().int().positive(), question: z.string().trim().min(3).max(2000), schemeName: z.string().trim().min(3).max(256).optional() }))
    .mutation(async ({ input, ctx }) => {
      const document = await getFactsheetDocumentWithAmc(input.documentId);
      if (!document || document.status !== "parsed" || !document.extractedText) {
        throw new TRPCError({ code: "NOT_FOUND", message: "That downloaded factsheet is unavailable for questions." });
      }
      const selectedScheme = input.schemeName
        ? extractSchemeNames(document.extractedText, document.amcName).find((scheme) => scheme.toLowerCase() === input.schemeName!.toLowerCase())
        : undefined;
      if (input.schemeName && !selectedScheme) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a scheme listed in this downloaded factsheet before asking scheme-specific questions." });
      }
      if (!ENV.aiEnabled) {
        return {
          answer: "Factsheet chat is disabled in local no-AI mode. You can still use the downloaded PDF, validated scheme list, page evidence, portfolio composition, and deterministic allocation tables.",
          source: { name: document.amcName, documentId: document.id, fileUrl: document.fileUrl },
        };
      }

      const response = await invokeLLM({
        messages: [
          { role: "system", content: CHAT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Selected AMC: ${document.amcName}\nFactsheet period: ${document.asOfLabel ?? "not stated"}${selectedScheme ? `\nSelected scheme: ${selectedScheme}` : ""}\n\nFACTSHEET TEXT:\n${selectRelevantFactsheetText(document.extractedText, `${selectedScheme ?? ""} ${input.question}`)}\n\nQUESTION:\n${input.question}`,
          },
        ],
      });
      const answer = (response.choices?.[0]?.message?.content as string) ?? "I could not generate an answer from this factsheet.";
      const sourceFunds = [{ name: document.amcName, documentId: document.id, fileUrl: document.fileUrl }];
      await createChatContext({
        userId: ctx.user.id,
        fundIds: JSON.stringify([]),
        question: input.question,
        answer,
        sourceSnapshot: JSON.stringify(sourceFunds),
      });
      return { answer, source: sourceFunds[0] };
    }),
});
