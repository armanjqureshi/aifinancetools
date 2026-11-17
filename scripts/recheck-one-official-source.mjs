import { listAmcSourcesWithLatestDocuments, createFactsheetDocument } from "../server/db.ts";
import { downloadFromRegistry } from "../server/registryDownloader.ts";
import { parseFactsheet } from "../server/pdfParser.ts";
import { extractFactsheetPeriod, isFreshFactsheetPeriod } from "../server/factsheetPeriod.ts";

const slug = process.argv[2];
const source = (await listAmcSourcesWithLatestDocuments()).find((item) => item.amcSlug === slug);
if (!source) throw new Error(`Unknown source ${slug}`);
const result = await downloadFromRegistry(slug);
if (result.success && result.buffer) {
  const parsed = await parseFactsheet(result.buffer);
  const period = extractFactsheetPeriod(parsed.rawText, result.resolvedUrl ?? source.sourceUrl);
  if (period && isFreshFactsheetPeriod(period)) {
    console.log(JSON.stringify({ slug, status: "current", period: period.label }));
    process.exit(0);
  }
}
const detail = result.success ? "PDF did not provide a current verifiable reporting period." : (result.error ?? "The official page did not expose a current PDF.");
await createFactsheetDocument({ amcId: source.amcId, sourceId: source.id, documentScope: source.documentScope === "scheme" ? "scheme" : "amc", sourceUrl: source.sourceUrl, status: "failed", errorMessage: `Official recheck for ${source.amcName}: ${detail}`, downloadedAt: new Date() });
console.log(JSON.stringify({ slug, status: "unavailable", detail }));
