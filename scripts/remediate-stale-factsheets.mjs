import { listAmcSourcesWithLatestDocuments, createFactsheetDocument } from "../server/db.ts";
import { downloadFromRegistry } from "../server/registryDownloader.ts";
import { parseFactsheet } from "../server/pdfParser.ts";
import { extractFactsheetPeriod, isFreshFactsheetPeriod, minimumAcceptedFactsheetPeriod } from "../server/factsheetPeriod.ts";
import { storagePut } from "../server/storage.ts";
import { withSourceDownloadDeadline } from "../server/downloadDeadline.ts";

const CONCURRENCY = 1;
const sources = await listAmcSourcesWithLatestDocuments();
const targets = sources.filter((source) => source.isActive === 1 && !source.latestDocument?.fileUrl);
const outcomes = [];

async function remediate(source) {
  let result;
  try {
    result = await withSourceDownloadDeadline(() => downloadFromRegistry(source.amcSlug), 75_000);
  } catch (error) {
    return { amc: source.amcName, status: "unavailable", detail: error instanceof Error ? error.message : String(error) };
  }
  if (!result?.success || !result.buffer) return { amc: source.amcName, status: "unavailable", detail: result?.error ?? "No PDF" };
  const parsed = await parseFactsheet(result.buffer);
  const period = extractFactsheetPeriod(parsed.rawText, result.resolvedUrl ?? source.sourceUrl);
  if (!period || !isFreshFactsheetPeriod(period)) {
    return { amc: source.amcName, status: "stale", detail: period?.label ?? "unverified", minimum: minimumAcceptedFactsheetPeriod().label };
  }
  const stored = await storagePut(`factsheets/remediated/${source.amcSlug}/factsheet_${period.year}-${String(period.month + 1).padStart(2, "0")}.pdf`, result.buffer, "application/pdf");
  const id = await createFactsheetDocument({
    amcId: source.amcId, sourceId: source.id,
    documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
    sourceUrl: source.sourceUrl, resolvedPdfUrl: result.resolvedUrl ?? null,
    asOfLabel: period.label, fileKey: stored.key, fileUrl: stored.url,
    extractedText: parsed.rawText, status: "parsed", downloadedAt: new Date(),
  });
  return { amc: source.amcName, status: "replaced", period: period.label, documentId: id };
}

for (let index = 0; index < targets.length; index += CONCURRENCY) {
  const batch = await Promise.all(targets.slice(index, index + CONCURRENCY).map(remediate));
  outcomes.push(...batch);
  console.log(JSON.stringify({ completed: outcomes.length, total: targets.length, batch }, null, 2));
}
console.log(JSON.stringify({ minimumAcceptedPeriod: minimumAcceptedFactsheetPeriod().label, targets: targets.length, outcomes }, null, 2));
