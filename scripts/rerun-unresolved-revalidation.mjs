import { readFile } from "node:fs/promises";
import { createFactsheetDocument, listAmcSourcesWithLatestDocuments } from "../server/db.ts";
import { downloadFromRegistry } from "../server/registryDownloader.ts";
import { parseFactsheet } from "../server/pdfParser.ts";
import { extractFactsheetPeriod, isFreshFactsheetPeriod } from "../server/factsheetPeriod.ts";

const previous = (await readFile(new URL("../current_revalidation_outcomes.jsonl", import.meta.url), "utf8"))
  .split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
const slugs = [...new Set(previous.filter((item) => item.status === "worker_timeout_or_error").map((item) => item.slug))];
const sources = new Map((await listAmcSourcesWithLatestDocuments()).map((source) => [source.amcSlug, source]));
const outcomes = [];
for (const slug of slugs) {
  const source = sources.get(slug);
  if (!source) continue;
  const result = await downloadFromRegistry(slug).catch((error) => ({ success: false, error: error instanceof Error ? error.message : String(error) }));
  if (result.success && result.buffer) {
    const parsed = await parseFactsheet(result.buffer);
    const period = extractFactsheetPeriod(parsed.rawText, result.resolvedUrl ?? source.sourceUrl);
    if (period && isFreshFactsheetPeriod(period)) {
      outcomes.push({ slug, status: "revalidated_current", period: period.label });
      continue;
    }
  }
  const detail = result.success ? "Downloaded PDF did not state a current verifiable reporting period." : (result.error ?? "The source did not expose a current PDF.");
  await createFactsheetDocument({
    amcId: source.amcId, sourceId: source.id,
    documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
    sourceUrl: source.sourceUrl, status: "failed",
    errorMessage: `Official revalidation result for ${source.amcName}: ${detail}`,
    downloadedAt: new Date(),
  });
  outcomes.push({ slug, status: "unresolved", detail });
}
console.log(JSON.stringify({ checked: outcomes.length, outcomes }));
