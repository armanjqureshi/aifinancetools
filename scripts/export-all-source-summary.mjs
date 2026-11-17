import { desc, eq } from "drizzle-orm";
import { amcs, amcSources, factsheetDocuments } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { storagePut } from "../server/storage.ts";

const db = await getDb();
if (!db) throw new Error("Database is unavailable.");

const activeSources = await db
  .select({
    amcId: amcs.id,
    amcName: amcs.name,
    slug: amcs.slug,
    sourceUrl: amcSources.sourceUrl,
  })
  .from(amcSources)
  .innerJoin(amcs, eq(amcs.id, amcSources.amcId))
  .where(eq(amcSources.isActive, 1));

const latestDocuments = await db
  .select({ amcId: factsheetDocuments.amcId, documentId: factsheetDocuments.id, downloadedAt: factsheetDocuments.downloadedAt, fileUrl: factsheetDocuments.fileUrl })
  .from(factsheetDocuments)
  .orderBy(desc(factsheetDocuments.downloadedAt));

const documentByAmc = new Map();
for (const document of latestDocuments) {
  if (!documentByAmc.has(document.amcId)) documentByAmc.set(document.amcId, document);
}

const outcomes = activeSources.map((source) => {
  const document = documentByAmc.get(source.amcId);
  return document
    ? { ...source, status: "downloaded", documentId: document.documentId, downloadedAt: document.downloadedAt, fileUrl: document.fileUrl }
    : { ...source, status: "unavailable", documentId: null, downloadedAt: null, fileUrl: null };
});

if (outcomes.length !== activeSources.length) {
  throw new Error(`Outcome mismatch: ${outcomes.length} outcomes for ${activeSources.length} active sources.`);
}

const summary = {
  generatedAt: new Date().toISOString(),
  activeSourceCount: activeSources.length,
  outcomeCount: outcomes.length,
  downloadedCount: outcomes.filter((item) => item.status === "downloaded").length,
  unavailableCount: outcomes.filter((item) => item.status === "unavailable").length,
  outcomes,
};

const stored = await storagePut(
  `factsheets/batch-summaries/all_sources_${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  Buffer.from(JSON.stringify(summary, null, 2)),
  "application/json"
);

console.log(JSON.stringify({ ...summary, outcomes: undefined, summaryUrl: stored.url }));
