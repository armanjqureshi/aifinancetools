import { listAmcSourcesWithLatestDocuments, createFactsheetDocument } from "../server/db.ts";
const slug = process.argv[2];
const source = (await listAmcSourcesWithLatestDocuments()).find((item) => item.amcSlug === slug);
if (!source) throw new Error(`Unknown source ${slug}`);
await createFactsheetDocument({ amcId: source.amcId, sourceId: source.id, documentScope: source.documentScope === "scheme" ? "scheme" : "amc", sourceUrl: source.sourceUrl, status: "failed", errorMessage: `Official recheck for ${source.amcName}: source timed out after the 12-second fast recheck limit; the verified current PDF was retained.`, downloadedAt: new Date() });
console.log(JSON.stringify({ slug, status: "timeout" }));
