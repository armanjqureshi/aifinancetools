import { eq } from "drizzle-orm";
import { getDb } from "../server/db.ts";
import { factsheetDocuments } from "../drizzle/schema.ts";
import { extractFactsheetPeriod, isFreshFactsheetPeriod, minimumAcceptedFactsheetPeriod } from "../server/factsheetPeriod.ts";

const db = await getDb();
if (!db) throw new Error("Database is unavailable");

const documents = await db
  .select({
    id: factsheetDocuments.id,
    extractedText: factsheetDocuments.extractedText,
    resolvedPdfUrl: factsheetDocuments.resolvedPdfUrl,
    sourceUrl: factsheetDocuments.sourceUrl,
  })
  .from(factsheetDocuments)
  .where(eq(factsheetDocuments.status, "parsed"));

let relabelled = 0;
let rejected = 0;
for (const document of documents) {
  const period = extractFactsheetPeriod(document.extractedText ?? "", document.resolvedPdfUrl ?? document.sourceUrl);
  if (period && isFreshFactsheetPeriod(period)) {
    await db.update(factsheetDocuments).set({ asOfLabel: period.label }).where(eq(factsheetDocuments.id, document.id));
    relabelled += 1;
    continue;
  }
  const reason = period
    ? `Rejected stale factsheet for ${period.label}; expected ${minimumAcceptedFactsheetPeriod().label} or newer.`
    : "Rejected factsheet with no verifiable reporting period.";
  await db.update(factsheetDocuments).set({ status: "failed", errorMessage: reason }).where(eq(factsheetDocuments.id, document.id));
  rejected += 1;
}

console.log(JSON.stringify({ scanned: documents.length, relabelled, rejected, minimumAcceptedPeriod: minimumAcceptedFactsheetPeriod().label }, null, 2));
