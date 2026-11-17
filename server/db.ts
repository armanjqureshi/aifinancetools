import { and, asc, desc, eq, like, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  amcs,
  amcDownloadRetries,
  amcSources,
  chatContexts,
  factsheetDocuments,
  fundAllocations,
  fundRunResults,
  mutualFunds,
  runJobs,
  schemeCatalog,
  users,
  visualAllocationEvidence,
  type InsertAmc,
  type InsertAmcDownloadRetry,
  type InsertAmcSource,
  type InsertChatContext,
  type InsertFactsheetDocument,
  type InsertFundAllocation,
  type InsertFundRunResult,
  type InsertMutualFund,
  type InsertRunJob,
  type InsertSchemeCatalogEntry,
  type InsertUser,
  type InsertVisualAllocationEvidence,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? "user";
  if (user.role !== undefined) updateSet.role = user.role;
  updateSet.lastSignedIn = values.lastSignedIn;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.email, email)).orderBy(asc(users.id)).limit(1))[0];
}

export async function setUserPasswordHash(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(users).set({ passwordHash }).where(eq(users.openId, openId));
}

export async function listUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, email: users.email, name: users.name, role: users.role, loginMethod: users.loginMethod, lastSignedIn: users.lastSignedIn }).from(users).orderBy(asc(users.id));
}

// ── Mutual Funds ─────────────────────────────────────────────────────────────

export async function listMutualFunds() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(mutualFunds).where(eq(mutualFunds.isActive, 1)).orderBy(asc(mutualFunds.name));
}

export async function getMutualFundById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(mutualFunds).where(eq(mutualFunds.id, id)).limit(1))[0];
}

export async function insertMutualFund(fund: InsertMutualFund) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return (await db.insert(mutualFunds).values(fund))[0].insertId as number;
}

export async function updateMutualFund(id: number, data: Partial<InsertMutualFund>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(mutualFunds).set(data).where(eq(mutualFunds.id, id));
}

export async function deleteMutualFund(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(mutualFunds).set({ isActive: 0 }).where(eq(mutualFunds.id, id));
}

// ── AMC Registry & Scheme Catalog ────────────────────────────────────────────

export async function listAmcs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(amcs).where(eq(amcs.isActive, 1)).orderBy(asc(amcs.name));
}

export async function listAmcSources() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: amcSources.id,
      amcId: amcSources.amcId,
      amcName: amcs.name,
      amcSlug: amcs.slug,
      sourceUrl: amcSources.sourceUrl,
      sourceKind: amcSources.sourceKind,
      documentScope: amcSources.documentScope,
      discoveryMode: amcSources.discoveryMode,
      notes: amcSources.notes,
      priority: amcSources.priority,
      isActive: amcSources.isActive,
      lastCheckedAt: amcSources.lastCheckedAt,
    })
    .from(amcSources)
    .innerJoin(amcs, eq(amcSources.amcId, amcs.id))
    .orderBy(asc(amcs.name));
}

const PERIOD_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Sort standard factsheet labels by the actual reporting period, never insertion time. */
export function reportingPeriodSortValue(label: string | null | undefined) {
  const match = label?.trim().toLowerCase().match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/);
  if (!match) return Number.NEGATIVE_INFINITY;
  return Number(match[2]) * 12 + PERIOD_MONTHS.indexOf(match[1]);
}

export async function listAmcSourcesWithLatestDocuments() {
  const sources = await listAmcSources();
  const db = await getDb();
  if (!db) return sources.map((source) => ({ ...source, latestDocument: null, latestOutcome: null }));

  const documents = await db
    .select({
      id: factsheetDocuments.id,
      amcId: factsheetDocuments.amcId,
      asOfLabel: factsheetDocuments.asOfLabel,
      fileUrl: factsheetDocuments.fileUrl,
      downloadedAt: factsheetDocuments.downloadedAt,
    })
    .from(factsheetDocuments)
    .where(eq(factsheetDocuments.status, "parsed"))
    .orderBy(desc(factsheetDocuments.downloadedAt));

  const outcomes = await db
    .select({
      amcId: factsheetDocuments.amcId,
      status: factsheetDocuments.status,
      asOfLabel: factsheetDocuments.asOfLabel,
      errorMessage: factsheetDocuments.errorMessage,
      createdAt: factsheetDocuments.createdAt,
    })
    .from(factsheetDocuments)
    .orderBy(desc(factsheetDocuments.createdAt));

  const latestByAmc = new Map<number, (typeof documents)[number]>();
  for (const document of documents) {
    const current = latestByAmc.get(document.amcId);
    const documentPeriod = reportingPeriodSortValue(document.asOfLabel);
    const currentPeriod = reportingPeriodSortValue(current?.asOfLabel);
    if (!current || documentPeriod > currentPeriod || (documentPeriod === currentPeriod && (document.downloadedAt?.getTime() ?? 0) > (current.downloadedAt?.getTime() ?? 0))) {
      latestByAmc.set(document.amcId, document);
    }
  }
  const latestOutcomeByAmc = new Map<number, (typeof outcomes)[number]>();
  for (const outcome of outcomes) {
    if (!latestOutcomeByAmc.has(outcome.amcId)) latestOutcomeByAmc.set(outcome.amcId, outcome);
  }

  return sources.map((source) => {
    const document = latestByAmc.get(source.amcId);
    return {
      ...source,
      latestDocument: document
        ? { id: document.id, asOfLabel: document.asOfLabel, fileUrl: document.fileUrl, downloadedAt: document.downloadedAt }
        : null,
      latestOutcome: latestOutcomeByAmc.get(source.amcId) ?? null,
    };
  });
}

export async function getAmcBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(amcs).where(eq(amcs.slug, slug)).limit(1))[0];
}

export async function upsertAmcDownloadRetry(data: InsertAmcDownloadRetry) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(amcDownloadRetries).values(data).onDuplicateKeyUpdate({
    set: {
      sourceId: data.sourceId,
      status: data.status,
      attemptCount: data.attemptCount,
      nextRetryAt: data.nextRetryAt,
      lastAttemptAt: data.lastAttemptAt ?? null,
      lastError: data.lastError ?? null,
      isEnabled: data.isEnabled ?? 1,
    },
  });
  return (await db.select().from(amcDownloadRetries).where(eq(amcDownloadRetries.amcId, data.amcId)).limit(1))[0];
}

export async function listAmcDownloadRetries() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: amcDownloadRetries.id,
      amcId: amcDownloadRetries.amcId,
      sourceId: amcDownloadRetries.sourceId,
      amcName: amcs.name,
      amcSlug: amcs.slug,
      sourceUrl: amcSources.sourceUrl,
      status: amcDownloadRetries.status,
      attemptCount: amcDownloadRetries.attemptCount,
      nextRetryAt: amcDownloadRetries.nextRetryAt,
      lastAttemptAt: amcDownloadRetries.lastAttemptAt,
      lastSuccessAt: amcDownloadRetries.lastSuccessAt,
      lastError: amcDownloadRetries.lastError,
      isEnabled: amcDownloadRetries.isEnabled,
    })
    .from(amcDownloadRetries)
    .innerJoin(amcs, eq(amcDownloadRetries.amcId, amcs.id))
    .innerJoin(amcSources, eq(amcDownloadRetries.sourceId, amcSources.id))
    .orderBy(asc(amcs.name));
}

export async function updateAmcDownloadRetry(id: number, data: Partial<InsertAmcDownloadRetry>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(amcDownloadRetries).set(data).where(eq(amcDownloadRetries.id, id));
}

export async function upsertAmc(amc: InsertAmc) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(amcs).values(amc).onDuplicateKeyUpdate({
    set: { name: amc.name, isActive: amc.isActive ?? 1 },
  });
  const saved = await getAmcBySlug(amc.slug);
  if (!saved) throw new Error(`AMC ${amc.slug} could not be retrieved after upsert`);
  return saved;
}

export async function upsertAmcSource(source: InsertAmcSource) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(amcSources).values(source).onDuplicateKeyUpdate({
    set: {
      amcId: source.amcId,
      sourceKind: source.sourceKind,
      documentScope: source.documentScope,
      discoveryMode: source.discoveryMode,
      notes: source.notes ?? null,
      priority: source.priority ?? 1,
      isActive: source.isActive ?? 1,
    },
  });
}

export async function updateAmcSource(
  id: number,
  data: Partial<Pick<InsertAmcSource, "sourceUrl" | "sourceKind" | "documentScope" | "discoveryMode" | "notes" | "priority" | "isActive">>
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(amcSources).set(data).where(eq(amcSources.id, id));
}

export async function seedAmcRegistry(
  entries: Array<{
    name: string;
    slug: string;
    sourceUrl: string;
    sourceKind: "page" | "direct_pdf";
    documentScope: "unknown" | "amc" | "scheme" | "both";
    discoveryMode: "html" | "dynamic" | "selector" | "direct" | "manual";
    notes?: string;
  }>
) {
  for (const entry of entries) {
    const amc = await upsertAmc({ name: entry.name, slug: entry.slug, isActive: 1 });
    await upsertAmcSource({
      amcId: amc.id,
      sourceUrl: entry.sourceUrl,
      sourceKind: entry.sourceKind,
      documentScope: entry.documentScope,
      discoveryMode: entry.discoveryMode,
      notes: entry.notes ?? null,
      priority: 1,
      isActive: 1,
    });
  }
}

export function normalizeSchemeName(name: string) {
  return name
    .toLowerCase()
    .replace(/\b(direct|regular|growth|idcw|dividend|plan|option)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function upsertSchemeCatalogEntry(entry: InsertSchemeCatalogEntry) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await db
    .select()
    .from(schemeCatalog)
    .where(and(eq(schemeCatalog.amcId, entry.amcId), eq(schemeCatalog.normalizedName, entry.normalizedName)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(schemeCatalog)
      .set({ ...entry, lastSeenAt: new Date(), isActive: entry.isActive ?? 1 })
      .where(eq(schemeCatalog.id, existing[0].id));
    return existing[0].id;
  }
  return (await db.insert(schemeCatalog).values({ ...entry, lastSeenAt: new Date() }))[0].insertId as number;
}

export async function createFactsheetDocument(document: InsertFactsheetDocument) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return (await db.insert(factsheetDocuments).values(document))[0].insertId as number;
}

export async function getFactsheetDocumentForPeriod(amcId: number, sourceId: number, asOfLabel: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db
    .select()
    .from(factsheetDocuments)
    .where(and(
      eq(factsheetDocuments.amcId, amcId),
      eq(factsheetDocuments.sourceId, sourceId),
      eq(factsheetDocuments.asOfLabel, asOfLabel),
      eq(factsheetDocuments.status, "parsed")
    ))
    .orderBy(desc(factsheetDocuments.downloadedAt))
    .limit(1))[0];
}

export async function getLatestFactsheetDocumentForScheme(schemeId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db
    .select()
    .from(factsheetDocuments)
    .where(eq(factsheetDocuments.schemeId, schemeId))
    .orderBy(desc(factsheetDocuments.downloadedAt))
    .limit(1))[0];
}

export async function getFactsheetDocumentWithAmc(documentId: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db
    .select({
      id: factsheetDocuments.id,
      amcId: factsheetDocuments.amcId,
      amcName: amcs.name,
      amcSlug: amcs.slug,
      sourceId: factsheetDocuments.sourceId,
      sourceUrl: factsheetDocuments.sourceUrl,
      resolvedPdfUrl: factsheetDocuments.resolvedPdfUrl,
      asOfLabel: factsheetDocuments.asOfLabel,
      fileKey: factsheetDocuments.fileKey,
      fileUrl: factsheetDocuments.fileUrl,
      extractedText: factsheetDocuments.extractedText,
      status: factsheetDocuments.status,
      errorMessage: factsheetDocuments.errorMessage,
      downloadedAt: factsheetDocuments.downloadedAt,
    })
    .from(factsheetDocuments)
    .innerJoin(amcs, eq(factsheetDocuments.amcId, amcs.id))
    .where(eq(factsheetDocuments.id, documentId))
    .limit(1))[0];
}

export async function listRecentFactsheetDocuments(limit = 12) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: factsheetDocuments.id,
      amcName: amcs.name,
      amcSlug: amcs.slug,
      asOfLabel: factsheetDocuments.asOfLabel,
      fileUrl: factsheetDocuments.fileUrl,
      status: factsheetDocuments.status,
      downloadedAt: factsheetDocuments.downloadedAt,
    })
    .from(factsheetDocuments)
    .innerJoin(amcs, eq(factsheetDocuments.amcId, amcs.id))
    .where(eq(factsheetDocuments.status, "parsed"))
    .orderBy(desc(factsheetDocuments.downloadedAt))
    .limit(limit);
}

export async function createChatContext(context: InsertChatContext) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return (await db.insert(chatContexts).values(context))[0].insertId as number;
}

export async function searchSchemeCatalog(query: string, limit = 25) {
  const db = await getDb();
  if (!db) return [];
  const normalized = normalizeSchemeName(query);
  if (!normalized) return [];
  return db
    .select({
      id: schemeCatalog.id,
      name: schemeCatalog.name,
      normalizedName: schemeCatalog.normalizedName,
      schemeCode: schemeCatalog.schemeCode,
      isin: schemeCatalog.isin,
      factsheetUrl: schemeCatalog.factsheetUrl,
      amcId: amcs.id,
      amcName: amcs.name,
      amcSlug: amcs.slug,
    })
    .from(schemeCatalog)
    .innerJoin(amcs, eq(schemeCatalog.amcId, amcs.id))
    .where(and(eq(schemeCatalog.isActive, 1), like(schemeCatalog.normalizedName, `%${normalized}%`)))
    .orderBy(asc(amcs.name), asc(schemeCatalog.name))
    .limit(limit);
}

export async function searchAmcDirectory(query: string, limit = 25) {
  const db = await getDb();
  if (!db) return [];
  const normalized = normalizeSchemeName(query);
  if (!normalized) return [];
  return db
    .select({ id: amcs.id, name: amcs.name, slug: amcs.slug })
    .from(amcs)
    .where(and(eq(amcs.isActive, 1), like(sql`lower(${amcs.name})`, `%${normalized}%`)))
    .orderBy(asc(amcs.name))
    .limit(limit);
}

// ── Run Jobs ─────────────────────────────────────────────────────────────────

export async function createRunJob(data: InsertRunJob) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return (await db.insert(runJobs).values(data))[0].insertId as number;
}

export async function updateRunJob(id: number, data: Partial<InsertRunJob>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(runJobs).set(data).where(eq(runJobs.id, id));
}

export async function getRunJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(runJobs).where(eq(runJobs.id, id)).limit(1))[0];
}

export async function listRunJobs(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(runJobs).orderBy(desc(runJobs.startedAt)).limit(limit);
}

export async function getLatestRunJob() {
  const db = await getDb();
  if (!db) return null;
  return (await db.select().from(runJobs).orderBy(desc(runJobs.startedAt)).limit(1))[0] ?? null;
}

// ── Fund Run Results ─────────────────────────────────────────────────────────

export async function createFundRunResult(data: InsertFundRunResult) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return (await db.insert(fundRunResults).values(data))[0].insertId as number;
}

export async function updateFundRunResult(id: number, data: Partial<InsertFundRunResult>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(fundRunResults).set(data).where(eq(fundRunResults.id, id));
}

export async function getFundRunResultsByJobId(runJobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fundRunResults).where(eq(fundRunResults.runJobId, runJobId));
}

// ── Fund Allocations ─────────────────────────────────────────────────────────

export async function insertFundAllocations(data: InsertFundAllocation[]) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (data.length) await db.insert(fundAllocations).values(data);
}

export async function getFundAllocationsByRunJob(runJobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fundAllocations).where(eq(fundAllocations.runJobId, runJobId));
}

export async function getFundAllocationsByFundAndRun(fundId: number, runJobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fundAllocations).where(and(eq(fundAllocations.fundId, fundId), eq(fundAllocations.runJobId, runJobId)));
}

// ── Visual Allocation Evidence ───────────────────────────────────────────────
export async function getVisualAllocationEvidence(documentId: number, normalizedSchemeName: string, allocationType: "market_cap" | "industry" | "portfolio") {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(visualAllocationEvidence).where(and(
    eq(visualAllocationEvidence.documentId, documentId),
    eq(visualAllocationEvidence.normalizedSchemeName, normalizedSchemeName),
    eq(visualAllocationEvidence.allocationType, allocationType),
  )).limit(1))[0];
}

export async function upsertVisualAllocationEvidence(data: InsertVisualAllocationEvidence) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getVisualAllocationEvidence(data.documentId, data.normalizedSchemeName, data.allocationType);
  if (existing) {
    await db.update(visualAllocationEvidence).set({
      allocationsJson: data.allocationsJson,
      evidence: data.evidence,
      sourcePage: data.sourcePage ?? null,
      confidence: data.confidence,
      extractionModel: data.extractionModel ?? null,
      failureClass: data.failureClass,
      reviewStatus: "unreviewed",
      reviewerNote: null,
      reviewedBy: null,
      reviewedAt: null,
    }).where(eq(visualAllocationEvidence.id, existing.id));
    return existing.id;
  }
  return (await db.insert(visualAllocationEvidence).values(data))[0].insertId as number;
}

export async function listLowConfidenceVisualAllocationEvidence() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: visualAllocationEvidence.id,
      documentId: visualAllocationEvidence.documentId,
      schemeName: visualAllocationEvidence.normalizedSchemeName,
      allocationType: visualAllocationEvidence.allocationType,
      allocationsJson: visualAllocationEvidence.allocationsJson,
      evidence: visualAllocationEvidence.evidence,
      sourcePage: visualAllocationEvidence.sourcePage,
      confidence: visualAllocationEvidence.confidence,
      failureClass: visualAllocationEvidence.failureClass,
      reviewStatus: visualAllocationEvidence.reviewStatus,
      reviewerNote: visualAllocationEvidence.reviewerNote,
      fileUrl: factsheetDocuments.fileUrl,
      resolvedPdfUrl: factsheetDocuments.resolvedPdfUrl,
      amcName: amcs.name,
      asOfLabel: factsheetDocuments.asOfLabel,
    })
    .from(visualAllocationEvidence)
    .innerJoin(factsheetDocuments, eq(factsheetDocuments.id, visualAllocationEvidence.documentId))
    .innerJoin(amcs, eq(amcs.id, factsheetDocuments.amcId))
    .where(and(eq(visualAllocationEvidence.reviewStatus, "unreviewed"), lt(visualAllocationEvidence.confidence, "90")))
    .orderBy(asc(visualAllocationEvidence.confidence), desc(visualAllocationEvidence.updatedAt));
}

export async function saveVisualAllocationReview(input: {
  id: number;
  reviewStatus: "verified" | "corrected" | "rejected";
  reviewerNote?: string | null;
  allocationsJson?: string;
  reviewedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(visualAllocationEvidence).set({
    ...(input.allocationsJson ? { allocationsJson: input.allocationsJson } : {}),
    reviewStatus: input.reviewStatus,
    reviewerNote: input.reviewerNote?.trim() || null,
    reviewedBy: input.reviewedBy,
    reviewedAt: new Date(),
  }).where(eq(visualAllocationEvidence.id, input.id));
}
