import { createFactsheetDocument, updateAmcDownloadRetry } from "./db";
import { downloadFromRegistry } from "./registryDownloader";
import { downloadFactsheet } from "./pdfDownloader";
import { detectFundHouse } from "./fundHouseDetector";
import { parseFactsheet } from "./pdfParser";
import { storagePut } from "./storage";
import { SourceDownloadDeadlineError, withSourceDownloadDeadline } from "./downloadDeadline";
import { extractFactsheetPeriod, isFreshFactsheetPeriod, minimumAcceptedFactsheetPeriod } from "./factsheetPeriod";

const RETRY_DOWNLOAD_DEADLINE_MS = 75_000;

export function nextRetryDate(attemptCount: number, from = new Date()) {
  const days = Math.min(7, 2 ** Math.max(0, attemptCount - 1));
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

function retryStatus(error: string) {
  const message = error.toLowerCase();
  return message.includes("502") || message.includes("503") || message.includes("temporarily unavailable") ? "unavailable" as const : "timed_out" as const;
}

export function failedRetryState(attemptCount: number, error: string, attemptedAt = new Date()) {
  const nextAttempt = attemptCount + 1;
  return {
    attemptCount: nextAttempt,
    status: retryStatus(error),
    lastAttemptAt: attemptedAt,
    lastError: error,
    nextRetryAt: nextRetryDate(nextAttempt, attemptedAt),
    isEnabled: 1 as const,
  };
}

export function successfulRetryState(attemptedAt = new Date()) {
  return { isEnabled: 0 as const, lastSuccessAt: attemptedAt, lastAttemptAt: attemptedAt, lastError: null };
}

export async function processAmcDownloadRetry(retry: {
  id: number;
  amcId: number;
  sourceId: number;
  amcName: string;
  amcSlug: string;
  sourceUrl: string;
  documentScope: "unknown" | "amc" | "scheme" | "both";
  attemptCount: number;
}) {
  const attemptedAt = new Date();
  let result: { success: boolean; buffer?: Buffer; resolvedUrl?: string; error?: string };
  let timedOut = false;
  try {
    result = (await withSourceDownloadDeadline(() => downloadFromRegistry(retry.amcSlug), RETRY_DOWNLOAD_DEADLINE_MS))
      ?? { success: false, error: "The AMC source did not return a download result." };
  } catch (error) {
    timedOut = error instanceof SourceDownloadDeadlineError;
    result = { success: false, error: error instanceof Error ? error.message : String(error) };
  }

  const legacyHouse = detectFundHouse(retry.amcName);
  if ((!result.success || !result.buffer) && !timedOut && legacyHouse !== "Unknown") {
    try {
      const fallback = await withSourceDownloadDeadline(() => downloadFactsheet(legacyHouse, { skipRegistry: true }), RETRY_DOWNLOAD_DEADLINE_MS);
      if (fallback.success && fallback.buffer) result = { success: true, buffer: fallback.buffer, resolvedUrl: fallback.url };
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (result.success && result.buffer) {
    const parsed = await parseFactsheet(result.buffer);
    const reportingPeriod = extractFactsheetPeriod(parsed.rawText, result.resolvedUrl ?? retry.sourceUrl);
    if (!reportingPeriod || !isFreshFactsheetPeriod(reportingPeriod)) {
      const actual = reportingPeriod?.label ?? "an unverified reporting period";
      const expected = minimumAcceptedFactsheetPeriod().label;
      const nextState = failedRetryState(retry.attemptCount, `Rejected stale factsheet: ${actual}; expected ${expected} or newer.`, attemptedAt);
      await updateAmcDownloadRetry(retry.id, nextState);
      return { success: false as const, error: nextState.lastError, nextRetryAt: nextState.nextRetryAt };
    }
    const stored = await storagePut(
      `factsheets/retries/${retry.amcSlug}/factsheet_${attemptedAt.toISOString().slice(0, 10)}.pdf`,
      result.buffer,
      "application/pdf"
    );
    const documentId = await createFactsheetDocument({
      amcId: retry.amcId,
      sourceId: retry.sourceId,
      documentScope: retry.documentScope === "scheme" ? "scheme" : "amc",
      sourceUrl: retry.sourceUrl,
      resolvedPdfUrl: result.resolvedUrl ?? null,
      asOfLabel: reportingPeriod.label,
      fileKey: stored.key,
      fileUrl: stored.url,
      extractedText: parsed.rawText,
      status: "parsed",
      downloadedAt: attemptedAt,
    });
    await updateAmcDownloadRetry(retry.id, successfulRetryState(attemptedAt));
    return { success: true as const, documentId };
  }

  const error = result.error ?? "No factsheet PDF was retrieved.";
  const nextState = failedRetryState(retry.attemptCount, error, attemptedAt);
  await updateAmcDownloadRetry(retry.id, nextState);
  return { success: false as const, error, nextRetryAt: nextState.nextRetryAt };
}
