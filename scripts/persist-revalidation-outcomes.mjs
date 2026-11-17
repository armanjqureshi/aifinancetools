import { readFile } from "node:fs/promises";
import { createFactsheetDocument, listAmcSourcesWithLatestDocuments } from "../server/db.ts";

const outcomes = (await readFile(new URL("../current_revalidation_outcomes.jsonl", import.meta.url), "utf8"))
  .split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
const sources = new Map((await listAmcSourcesWithLatestDocuments()).map((source) => [source.amcSlug, source]));
let persisted = 0;
for (const outcome of outcomes) {
  if (outcome.status !== "worker_timeout_or_error") continue;
  const source = sources.get(outcome.slug);
  if (!source) continue;
  await createFactsheetDocument({
    amcId: source.amcId, sourceId: source.id,
    documentScope: source.documentScope === "scheme" ? "scheme" : "amc",
    sourceUrl: source.sourceUrl,
    status: "failed",
    errorMessage: "Official source revalidation exceeded the 40-second worker limit; retained the existing verified current PDF.",
    downloadedAt: new Date(),
  });
  persisted += 1;
}
console.log(JSON.stringify({ outcomes: outcomes.length, persisted }));
