import { readFile } from "node:fs/promises";
import { createFactsheetDocument, listAmcSourcesWithLatestDocuments } from "../server/db.ts";

const lines = (await readFile(new URL("../isolated_preload_outcomes.jsonl", import.meta.url), "utf8"))
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const sources = await listAmcSourcesWithLatestDocuments();
const sourceBySlug = new Map(sources.map((source) => [source.amcSlug, source]));
let persisted = 0;
for (const outcome of lines) {
  if (outcome.status === "stored" || outcome.status === "already_current") continue;
  const source = sourceBySlug.get(outcome.slug);
  if (!source) continue;
  await createFactsheetDocument({
    amcId: source.amcId, sourceId: source.id,
    documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
    sourceUrl: source.sourceUrl, status: "failed",
    errorMessage: outcome.detail ?? outcome.status, downloadedAt: new Date(),
  });
  persisted += 1;
}
console.log(JSON.stringify({ sourceOutcomes: lines.length, persisted }));
