import {
  decimal,
  index,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  /** scrypt hash for AUTH_MODE=password accounts; null for the local administrator. */
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Registered asset management companies. */
export const amcs = mysqlTable(
  "amcs",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 96 }).notNull(),
    isActive: int("is_active").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [uniqueIndex("amcs_slug_unique").on(table.slug)]
);

export type Amc = typeof amcs.$inferSelect;
export type InsertAmc = typeof amcs.$inferInsert;

/** One or more source URLs per AMC. The current user-provided list seeds this table. */
export const amcSources = mysqlTable(
  "amc_sources",
  {
    id: int("id").autoincrement().primaryKey(),
    amcId: int("amc_id").notNull(),
    sourceUrl: varchar("source_url", { length: 1024 }).notNull(),
    sourceKind: mysqlEnum("source_kind", ["page", "direct_pdf"]).default("page").notNull(),
    documentScope: mysqlEnum("document_scope", ["unknown", "amc", "scheme", "both"]).default("unknown").notNull(),
    discoveryMode: mysqlEnum("discovery_mode", ["html", "dynamic", "selector", "direct", "manual"]).default("html").notNull(),
    notes: text("notes"),
    priority: int("priority").default(1).notNull(),
    isActive: int("is_active").default(1).notNull(),
    lastCheckedAt: timestamp("last_checked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("amc_sources_url_unique").on(table.sourceUrl),
    index("amc_sources_amc_id_idx").on(table.amcId),
  ]
);

export type AmcSource = typeof amcSources.$inferSelect;
export type InsertAmcSource = typeof amcSources.$inferInsert;

/** Retry state for AMC sources that are temporarily unreachable. A successful retry disables its daily job. */
export const amcDownloadRetries = mysqlTable(
  "amc_download_retries",
  {
    id: int("id").autoincrement().primaryKey(),
    amcId: int("amc_id").notNull(),
    sourceId: int("source_id").notNull(),
    status: mysqlEnum("status", ["timed_out", "unavailable"]).notNull(),
    attemptCount: int("attempt_count").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at").notNull(),
    lastAttemptAt: timestamp("last_attempt_at"),
    lastSuccessAt: timestamp("last_success_at"),
    lastError: text("last_error"),
    isEnabled: int("is_enabled").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("amc_download_retries_amc_unique").on(table.amcId),
    index("amc_download_retries_due_idx").on(table.isEnabled, table.nextRetryAt),
  ]
);

export type AmcDownloadRetry = typeof amcDownloadRetries.$inferSelect;
export type InsertAmcDownloadRetry = typeof amcDownloadRetries.$inferInsert;

/** Schemes discovered from AMC sources or added through the fund-list workflow. */
export const schemeCatalog = mysqlTable(
  "scheme_catalog",
  {
    id: int("id").autoincrement().primaryKey(),
    amcId: int("amc_id").notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 256 }).notNull(),
    schemeCode: varchar("scheme_code", { length: 64 }),
    isin: varchar("isin", { length: 20 }),
    factsheetUrl: text("factsheet_url"),
    sourceType: mysqlEnum("source_type", ["discovered", "manual", "fund_list"]).default("discovered").notNull(),
    isActive: int("is_active").default(1).notNull(),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("scheme_catalog_amc_id_idx").on(table.amcId),
    index("scheme_catalog_normalized_name_idx").on(table.normalizedName),
  ]
);

export type SchemeCatalogEntry = typeof schemeCatalog.$inferSelect;
export type InsertSchemeCatalogEntry = typeof schemeCatalog.$inferInsert;

/** Downloaded factsheets and their extracted source text for factsheet-aware chat. */
export const factsheetDocuments = mysqlTable(
  "factsheet_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    amcId: int("amc_id").notNull(),
    sourceId: int("source_id"),
    schemeId: int("scheme_id"),
    documentScope: mysqlEnum("document_scope", ["amc", "scheme"]).default("amc").notNull(),
    sourceUrl: varchar("source_url", { length: 1024 }).notNull(),
    resolvedPdfUrl: varchar("resolved_pdf_url", { length: 1024 }),
    asOfLabel: varchar("as_of_label", { length: 64 }),
    fileKey: varchar("file_key", { length: 512 }),
    fileUrl: text("file_url"),
    extractedText: mediumtext("extracted_text"),
    status: mysqlEnum("status", ["discovered", "downloading", "parsed", "failed"]).default("discovered").notNull(),
    errorMessage: text("error_message"),
    downloadedAt: timestamp("downloaded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("factsheet_documents_amc_id_idx").on(table.amcId),
    index("factsheet_documents_scheme_id_idx").on(table.schemeId),
    index("factsheet_documents_source_id_idx").on(table.sourceId),
  ]
);

export type FactsheetDocument = typeof factsheetDocuments.$inferSelect;
export type InsertFactsheetDocument = typeof factsheetDocuments.$inferInsert;

/** Cached, evidence-backed allocations recovered from visual PDF charts or image-based tables. */
export const visualAllocationEvidence = mysqlTable(
  "visual_allocation_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("document_id").notNull(),
    normalizedSchemeName: varchar("normalized_scheme_name", { length: 256 }).notNull(),
    allocationType: mysqlEnum("allocation_type", ["market_cap", "industry", "portfolio"]).notNull(),
    allocationsJson: mediumtext("allocations_json").notNull(),
    evidence: text("evidence").notNull(),
    sourcePage: int("source_page"),
    confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
    extractionModel: varchar("extraction_model", { length: 128 }),
    failureClass: mysqlEnum("failure_class", ["verified", "no_scheme_page", "no_table_on_page", "provider_unavailable", "invalid_response"]).default("invalid_response").notNull(),
    reviewStatus: mysqlEnum("review_status", ["unreviewed", "verified", "corrected", "rejected"]).default("unreviewed").notNull(),
    reviewerNote: text("reviewer_note"),
    reviewedBy: int("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    index("visual_allocation_evidence_document_idx").on(table.documentId),
    uniqueIndex("visual_allocation_evidence_document_scheme_type_uq").on(table.documentId, table.normalizedSchemeName, table.allocationType),
  ]
);

export type VisualAllocationEvidence = typeof visualAllocationEvidence.$inferSelect;
export type InsertVisualAllocationEvidence = typeof visualAllocationEvidence.$inferInsert;

/** Official AMFI market-cap categorisation file applicable to a defined effective period. */
export const amfiClassificationSnapshots = mysqlTable(
  "amfi_classification_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveTo: timestamp("effective_to"),
    sourceUrl: varchar("source_url", { length: 1024 }).notNull(),
    sourceLabel: varchar("source_label", { length: 256 }).notNull(),
    sourceChecksum: varchar("source_checksum", { length: 128 }),
    importedAt: timestamp("imported_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("amfi_classification_snapshot_effective_unique").on(table.effectiveFrom)]
);

export type AmfiClassificationSnapshot = typeof amfiClassificationSnapshots.$inferSelect;
export type InsertAmfiClassificationSnapshot = typeof amfiClassificationSnapshots.$inferInsert;

/** A security's official category in one dated AMFI classification snapshot. */
export const amfiSecurityClassifications = mysqlTable(
  "amfi_security_classifications",
  {
    id: int("id").autoincrement().primaryKey(),
    snapshotId: int("snapshot_id").notNull(),
    rank: int("rank").notNull(),
    companyName: varchar("company_name", { length: 512 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 512 }).notNull(),
    isin: varchar("isin", { length: 20 }),
    nseSymbol: varchar("nse_symbol", { length: 64 }),
    bseSymbol: varchar("bse_symbol", { length: 64 }),
    category: mysqlEnum("category", ["large_cap", "mid_cap", "small_cap"]).notNull(),
    averageMarketCapCr: decimal("average_market_cap_cr", { precision: 18, scale: 4 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("amfi_security_snapshot_isin_unique").on(table.snapshotId, table.isin),
    index("amfi_security_snapshot_name_idx").on(table.snapshotId, table.normalizedName),
  ]
);

export type AmfiSecurityClassification = typeof amfiSecurityClassifications.$inferSelect;
export type InsertAmfiSecurityClassification = typeof amfiSecurityClassifications.$inferInsert;

/** Auditable calculated allocation based on factsheet holdings and a dated official AMFI snapshot. */
export const calculatedMarketCapEvidence = mysqlTable(
  "calculated_market_cap_evidence",
  {
    id: int("id").autoincrement().primaryKey(),
    documentId: int("document_id").notNull(),
    normalizedSchemeName: varchar("normalized_scheme_name", { length: 256 }).notNull(),
    snapshotId: int("snapshot_id").notNull(),
    allocationsJson: mediumtext("allocations_json").notNull(),
    mappedHoldingsJson: mediumtext("mapped_holdings_json").notNull(),
    unresolvedHoldingsJson: mediumtext("unresolved_holdings_json").notNull(),
    coveragePercent: decimal("coverage_percent", { precision: 6, scale: 2 }).notNull(),
    calculationStatus: mysqlEnum("calculation_status", ["verified", "partial", "insufficient_portfolio_data"]).notNull(),
    reviewerNote: text("reviewer_note"),
    reviewedBy: int("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    uniqueIndex("calculated_market_cap_document_scheme_snapshot_unique").on(table.documentId, table.normalizedSchemeName, table.snapshotId),
    index("calculated_market_cap_snapshot_idx").on(table.snapshotId),
  ]
);

export type CalculatedMarketCapEvidence = typeof calculatedMarketCapEvidence.$inferSelect;
export type InsertCalculatedMarketCapEvidence = typeof calculatedMarketCapEvidence.$inferInsert;

/** Persisted chatbot turns with their factsheet source references. */
export const chatContexts = mysqlTable(
  "chat_contexts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").notNull(),
    fundIds: text("fund_ids").notNull(),
    question: text("question").notNull(),
    answer: mediumtext("answer").notNull(),
    sourceSnapshot: mediumtext("source_snapshot").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_contexts_user_id_idx").on(table.userId)]
);

export type ChatContext = typeof chatContexts.$inferSelect;
export type InsertChatContext = typeof chatContexts.$inferInsert;

export const mutualFunds = mysqlTable("mutual_funds", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  fundHouse: varchar("fund_house", { length: 64 }).notNull(),
  amcId: int("amc_id"),
  schemeCatalogId: int("scheme_catalog_id"),
  isin: varchar("isin", { length: 20 }),
  factsheetUrl: text("factsheet_url"),
  isActive: int("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type MutualFund = typeof mutualFunds.$inferSelect;
export type InsertMutualFund = typeof mutualFunds.$inferInsert;

export const runJobs = mysqlTable("run_jobs", {
  id: int("id").autoincrement().primaryKey(),
  triggeredBy: mysqlEnum("triggered_by", ["manual", "cron"]).default("manual").notNull(),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed"]).default("pending").notNull(),
  totalFunds: int("total_funds").default(0),
  successCount: int("success_count").default(0),
  failedCount: int("failed_count").default(0),
  excelFileKey: varchar("excel_file_key", { length: 512 }),
  excelFileUrl: text("excel_file_url"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export type RunJob = typeof runJobs.$inferSelect;
export type InsertRunJob = typeof runJobs.$inferInsert;

export const fundRunResults = mysqlTable("fund_run_results", {
  id: int("id").autoincrement().primaryKey(),
  runJobId: int("run_job_id").notNull(),
  fundId: int("fund_id").notNull(),
  factsheetDocumentId: int("factsheet_document_id"),
  status: mysqlEnum("status", ["pending", "downloading", "parsing", "completed", "failed"]).default("pending").notNull(),
  pdfFileKey: varchar("pdf_file_key", { length: 512 }),
  pdfFileUrl: text("pdf_file_url"),
  errorMessage: text("error_message"),
  extractedAt: timestamp("extracted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FundRunResult = typeof fundRunResults.$inferSelect;
export type InsertFundRunResult = typeof fundRunResults.$inferInsert;

export const fundAllocations = mysqlTable("fund_allocations", {
  id: int("id").autoincrement().primaryKey(),
  fundRunResultId: int("fund_run_result_id").notNull(),
  fundId: int("fund_id").notNull(),
  runJobId: int("run_job_id").notNull(),
  factsheetDocumentId: int("factsheet_document_id"),
  allocationType: mysqlEnum("allocation_type", ["sector", "asset", "market_cap"]).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  percentage: decimal("percentage", { precision: 6, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type FundAllocation = typeof fundAllocations.$inferSelect;
export type InsertFundAllocation = typeof fundAllocations.$inferInsert;

