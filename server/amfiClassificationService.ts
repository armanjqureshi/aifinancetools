import ExcelJS from "exceljs";
import { desc, eq, lte, sql } from "drizzle-orm";
import {
  amfiClassificationSnapshots,
  amfiSecurityClassifications,
  calculatedMarketCapEvidence,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  calculateSebiMarketCapAllocation,
  normalizeSecurityName,
  type OfficialSecurityClassification,
  type PortfolioHoldingForCalculation,
} from "./sebiMarketCapCalculation";
import type { PortfolioTableScope } from "./visualPortfolioExtractor";

export const AMFI_JULY_2026_SOURCE = "https://portal.amfiindia.com/spages/AverageMarketCapitalization30Jun2026.xlsx";

function cellValue(value: unknown): string | number | undefined {
  if (typeof value === "string" || typeof value === "number") return value;
  if (value && typeof value === "object" && "result" in value) return cellValue((value as { result?: unknown }).result);
  if (value && typeof value === "object" && "text" in value) return String((value as { text?: unknown }).text ?? "");
  return undefined;
}

function categoryFromOfficialLabel(label: string): "large_cap" | "mid_cap" | "small_cap" | undefined {
  const normalized = label.toLowerCase().replace(/\s+/g, " ").trim();
  if (normalized === "large cap") return "large_cap";
  if (normalized === "mid cap") return "mid_cap";
  if (normalized === "small cap") return "small_cap";
  return undefined;
}

/** Imports the official AMFI workbook. Its effective date must reflect the applicable factsheet period. */
export async function importAmfiClassificationWorkbook(input: {
  workbookBuffer: Buffer;
  effectiveFrom: Date;
  effectiveTo?: Date;
  sourceUrl: string;
  sourceLabel: string;
  checksum?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for AMFI classification import.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.workbookBuffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The AMFI workbook contains no worksheet.");

  const snapshotInsert = await db.insert(amfiClassificationSnapshots).values({
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    sourceUrl: input.sourceUrl,
    sourceLabel: input.sourceLabel,
    sourceChecksum: input.checksum ?? null,
  }).onDuplicateKeyUpdate({
    set: { effectiveTo: input.effectiveTo ?? null, sourceUrl: input.sourceUrl, sourceLabel: input.sourceLabel, sourceChecksum: input.checksum ?? null },
  });

  const snapshot = (await db.select().from(amfiClassificationSnapshots).where(eq(amfiClassificationSnapshots.effectiveFrom, input.effectiveFrom)).limit(1))[0];
  if (!snapshot) throw new Error("Unable to resolve imported AMFI classification snapshot.");

  const rows: Array<typeof amfiSecurityClassifications.$inferInsert> = [];
  sheet.eachRow((row, number) => {
    if (number < 3) return;
    const values = row.values as unknown[];
    const rank = Number(cellValue(values[1]));
    const companyName = String(cellValue(values[2]) ?? "").trim();
    const isin = String(cellValue(values[3]) ?? "").trim() || null;
    const bseSymbol = String(cellValue(values[4]) ?? "").trim() || null;
    const nseSymbol = String(cellValue(values[6]) ?? "").trim() || null;
    const averageMarketCapCr = cellValue(values[10]);
    const category = categoryFromOfficialLabel(String(cellValue(values[11]) ?? ""));
    if (!rank || !companyName || !category) return;
    rows.push({
      snapshotId: snapshot.id,
      rank,
      companyName,
      normalizedName: normalizeSecurityName(companyName),
      isin,
      nseSymbol,
      bseSymbol,
      category,
      averageMarketCapCr: typeof averageMarketCapCr === "number" ? String(averageMarketCapCr) : null,
    });
  });

  for (let offset = 0; offset < rows.length; offset += 250) {
    await db.insert(amfiSecurityClassifications).values(rows.slice(offset, offset + 250)).onDuplicateKeyUpdate({
      set: {
        id: sql`${amfiSecurityClassifications.id}`,
      },
    });
  }
  return { snapshotId: snapshot.id, securityCount: rows.length };
}

export async function calculateMarketCapFromHoldings(input: {
  documentId: number;
  normalizedSchemeName: string;
  factsheetDate: Date;
  holdings: PortfolioHoldingForCalculation[];
  portfolioTableScope?: PortfolioTableScope;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable for AMFI market-cap calculation.");
  const snapshot = (await db.select().from(amfiClassificationSnapshots)
    .where(lte(amfiClassificationSnapshots.effectiveFrom, input.factsheetDate))
    .orderBy(desc(amfiClassificationSnapshots.effectiveFrom)).limit(1))[0];
  if (!snapshot) return undefined;

  const classifications = await db.select().from(amfiSecurityClassifications).where(eq(amfiSecurityClassifications.snapshotId, snapshot.id));
  const result = calculateSebiMarketCapAllocation(
    input.holdings,
    classifications.map((row): OfficialSecurityClassification => ({
      companyName: row.companyName,
      normalizedName: row.normalizedName,
      isin: row.isin,
      nseSymbol: row.nseSymbol,
      category: row.category,
      rank: row.rank,
    })),
    { portfolioTableScope: input.portfolioTableScope },
  );
  const allocations = [
    { label: "Large Cap", percentage: result.totals.large_cap },
    { label: "Mid Cap", percentage: result.totals.mid_cap },
    { label: "Small Cap", percentage: result.totals.small_cap },
    { label: "Cash & Cash Equivalents", percentage: result.totals.cash },
    { label: "Debt", percentage: result.totals.debt },
    { label: "Other / ETFs / derivatives", percentage: result.totals.other },
  ].filter((allocation) => allocation.percentage > 0);

  await db.insert(calculatedMarketCapEvidence).values({
    documentId: input.documentId,
    normalizedSchemeName: input.normalizedSchemeName,
    snapshotId: snapshot.id,
    allocationsJson: JSON.stringify(allocations),
    mappedHoldingsJson: JSON.stringify(result.mappedHoldings.filter((holding) => holding.category !== "unresolved")),
    unresolvedHoldingsJson: JSON.stringify(result.unresolvedHoldings),
    coveragePercent: String(result.coveragePercent),
    calculationStatus: result.calculationStatus,
  }).onDuplicateKeyUpdate({
    set: {
      allocationsJson: JSON.stringify(allocations),
      mappedHoldingsJson: JSON.stringify(result.mappedHoldings.filter((holding) => holding.category !== "unresolved")),
      unresolvedHoldingsJson: JSON.stringify(result.unresolvedHoldings),
      coveragePercent: String(result.coveragePercent),
      calculationStatus: result.calculationStatus,
    },
  });

  return { ...result, allocations, snapshot: { id: snapshot.id, effectiveFrom: snapshot.effectiveFrom, sourceUrl: snapshot.sourceUrl, sourceLabel: snapshot.sourceLabel } };
}
