import { listAmcSourcesWithLatestDocuments, createFactsheetDocument } from "../server/db.ts";
import { downloadFromRegistry } from "../server/registryDownloader.ts";
import { parseFactsheet } from "../server/pdfParser.ts";
import { extractFactsheetPeriod, isFreshFactsheetPeriod, minimumAcceptedFactsheetPeriod } from "../server/factsheetPeriod.ts";
import { storagePut } from "../server/storage.ts";
import { withSourceDownloadDeadline } from "../server/downloadDeadline.ts";

const slug = process.argv[2];
if (!slug) throw new Error("Usage: remediate-one-factsheet.mjs <amc-slug>");
const forceRevalidate = process.argv.includes("--force");
const source = (await listAmcSourcesWithLatestDocuments()).find((item) => item.amcSlug === slug && item.isActive === 1);
if (!source) throw new Error(`Active source not found: ${slug}`);
if (source.latestDocument?.fileUrl && !forceRevalidate) {
  console.log(JSON.stringify({ amc: source.amcName, slug, status: "already_current" }));
  process.exit(0);
}

async function recordFailure(detail) {
  return createFactsheetDocument({
    amcId: source.amcId, sourceId: source.id,
    documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
    sourceUrl: source.sourceUrl, status: "failed", errorMessage: detail, downloadedAt: new Date(),
  });
}

let result;
try {
  result = await withSourceDownloadDeadline(() => downloadFromRegistry(slug), 75_000);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify({ amc: source.amcName, slug, status: "unavailable", detail, documentId: await recordFailure(detail) }));
  process.exit(0);
}
if (!result?.success || !result.buffer) {
  const detail = result?.error ?? "No PDF";
  console.log(JSON.stringify({ amc: source.amcName, slug, status: "unavailable", detail, documentId: await recordFailure(detail) }));
  process.exit(0);
}

const parsed = await parseFactsheet(result.buffer);
const period = extractFactsheetPeriod(parsed.rawText, result.resolvedUrl ?? source.sourceUrl);
if (!period || !isFreshFactsheetPeriod(period)) {
  const detail = `Rejected stale factsheet: ${period?.label ?? "unverified"}; expected ${minimumAcceptedFactsheetPeriod().label} or newer.`;
  console.log(JSON.stringify({ amc: source.amcName, slug, status: "stale", detail, minimum: minimumAcceptedFactsheetPeriod().label, documentId: await recordFailure(detail) }));
  process.exit(0);
}
if (source.latestDocument?.fileUrl && source.latestDocument.asOfLabel === period.label) {
  console.log(JSON.stringify({ amc: source.amcName, slug, status: "revalidated_current", period: period.label, documentId: source.latestDocument.id }));
  process.exit(0);
}
const stored = await storagePut(`factsheets/preloaded/${slug}/factsheet_${period.year}-${String(period.month + 1).padStart(2, "0")}.pdf`, result.buffer, "application/pdf");
const documentId = await createFactsheetDocument({
  amcId: source.amcId, sourceId: source.id, documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
  sourceUrl: source.sourceUrl, resolvedPdfUrl: result.resolvedUrl ?? null, asOfLabel: period.label,
  fileKey: stored.key, fileUrl: stored.url, extractedText: parsed.rawText, status: "parsed", downloadedAt: new Date(),
});
console.log(JSON.stringify({ amc: source.amcName, slug, status: "stored", period: period.label, documentId }));
