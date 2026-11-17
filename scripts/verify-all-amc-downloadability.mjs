import { listAmcSources } from "../server/db.ts";
import { downloadFromRegistry } from "../server/registryDownloader.ts";
import { downloadFactsheet } from "../server/pdfDownloader.ts";
import { detectFundHouse } from "../server/fundHouseDetector.ts";
import { SourceDownloadDeadlineError, withSourceDownloadDeadline } from "../server/downloadDeadline.ts";
import { storagePut } from "../server/storage.ts";

const sources = (await listAmcSources()).filter((source) => source.isActive === 1);
const results = [];
let cursor = 0;
const concurrency = 3;
const deadlineMs = 90_000;

function classifyFailure(error) {
  const message = String(error ?? "").toLowerCase();
  if (message.includes("403") || message.includes("406") || message.includes("declined")) return "blocked";
  if (message.includes("timeout") || message.includes("timed out") || message.includes("socket") || message.includes("tls")) return "timed_out";
  if (message.includes("502") || message.includes("503") || message.includes("504") || message.includes("temporarily unavailable")) return "unavailable";
  return "no_pdf";
}

async function verify(source) {
  let result;
  let timedOut = false;
  try {
    result = await withSourceDownloadDeadline(() => downloadFromRegistry(source.amcSlug), deadlineMs);
  } catch (error) {
    timedOut = error instanceof SourceDownloadDeadlineError;
    result = { success: false, error: timedOut ? error.message : String(error) };
  }

  const legacyHouse = detectFundHouse(source.amcName);
  if ((!result?.success || !result.buffer) && !timedOut && legacyHouse !== "Unknown") {
    try {
      const fallback = await withSourceDownloadDeadline(() => downloadFactsheet(legacyHouse, { skipRegistry: true }), deadlineMs);
      if (fallback.success && fallback.buffer) result = { success: true, buffer: fallback.buffer, resolvedUrl: fallback.url };
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (result?.success && result.buffer) {
    return { slug: source.amcSlug, amcName: source.amcName, status: "downloadable", bytes: result.buffer.length, resolvedUrl: result.resolvedUrl ?? null };
  }
  return { slug: source.amcSlug, amcName: source.amcName, status: classifyFailure(result?.error), error: result?.error ?? "No factsheet PDF was retrieved." };
}

async function worker() {
  while (cursor < sources.length) {
    const source = sources[cursor++];
    if (!source) return;
    const outcome = await verify(source);
    results.push(outcome);
    console.log(JSON.stringify(outcome));
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
const summary = results.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] ?? 0) + 1 }), { total: results.length });
const report = { generatedAt: new Date().toISOString(), summary, results };
const stored = await storagePut(
  `factsheets/downloadability-reports/verification_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  Buffer.from(JSON.stringify(report, null, 2)),
  "application/json"
);
console.log(JSON.stringify({ summary, reportUrl: stored.url }));
