# Architecture and Safeguards

## System Boundary

The application is a factsheet reader, not a market-data provider. It retrieves official AMC documents, caches original PDFs and extracted text, restricts every view to the active document and selected scheme, and stores evidence for verified results.

```text
AMC source / direct official PDF / upload
             │
             ▼
   Retrieval + reporting-period validation
             │
             ▼
  Object storage (PDF) + MySQL/TiDB (metadata/text)
             │
             ▼
  Scheme-name validation from the selected document
             │
             ▼
  Page-local selected-scheme readers
   ├─ Industry/Sector table
   ├─ Portfolio composition table
   └─ Factsheet-disclosed market-cap table/chart
             │
             ├─ factsheet disclosure shown first
             └─ AMFI calculation only when disclosure is absent
```

## Stack

| Layer | Current implementation | Portable replacement when leaving the current host |
|---|---|---|
| Front end | React 19, Vite, Tailwind 4, Radix UI | Retain unchanged |
| API | Express 4, tRPC 11, Zod | Retain unchanged |
| ORM/database | Drizzle + MySQL/TiDB | Retain MySQL 8-compatible database |
| PDF text | `pdf-parse` | Retain unchanged |
| PDF cache | Host-provided presigned storage helper | Replace `server/storage.ts` and `server/_core/storageProxy.ts` with S3/R2/MinIO/local-disk adapter |
| Authentication | `server/_core/auth.ts` | Self-hosted: `AUTH_MODE=none` or `AUTH_MODE=password` (scrypt hashes, signed session cookie, sign-in throttling) |
| AI chat/visual fallback | Host-provided OpenAI-compatible proxy | Optional; replace with a provider key or disable for no-AI mode |

## Data Model

| Table group | Purpose |
|---|---|
| `amcs`, `amc_sources`, `scheme_catalog` | Registered fund houses, official sources, and discovered scheme names |
| `factsheet_documents` | Source URLs, reporting label, storage key/URL, original extracted text, parse status |
| `visual_allocation_evidence` | Cached selected-scheme page evidence for Industry/Sector, portfolio, and disclosed market-cap results |
| `amfi_classification_snapshots`, `amfi_security_classifications` | Dated official AMFI category snapshots and their large/mid/small-cap security mapping |
| `calculated_market_cap_evidence` | Auditable holdings-calculation output, mapped and unresolved holdings, coverage, status, and snapshot reference |
| `chat_contexts` | Factsheet-grounded chat history/source snapshots |
| Legacy pipeline tables | `mutual_funds`, `run_jobs`, `fund_run_results`, `fund_allocations`, `cron_config` support bulk/export workflows |

The target database must receive all migrations `0000` through `0009`. Migration `0009_even_inertia.sql` adds the AMFI snapshot, official-security classification, and calculated market-cap evidence tables.

## Evidence-First Reader

`server/schemePageAllocationReader.ts` is the strict selected-scheme page reader. It accepts results only when the PDF page contains an exact standalone scheme heading and an explicit same-page table. It writes reusable evidence keyed by document, normalized scheme name, and allocation type.

`server/visualMarketCapExtractor.ts` accepts a market-cap result only from the exact selected-scheme page or an exact scheme row in an explicit consolidated table. It skips visual reading if no standalone selected-scheme market-cap signal exists.

`server/visualPortfolioExtractor.ts` is a controlled fallback for genuine layout loss. It preserves printed identifiers and portfolio categories only when they are visible on a verified complete selected-scheme page.

`server/pdfPageCache.ts` shares parsed PDF pages across the industry, portfolio, and market-cap readers for five minutes in a process. It is a performance cache, not evidence storage.

### Portfolio Composition Rules

Portfolio output is not restricted to listed-company holdings. When the factsheet uses a `Name of Instrument` / `% to Net Assets` structure, retain actual composition rows:

| Row type | Example | Treatment |
|---|---|---|
| Category | Money Market Instruments; Others / Overseas Mutual Fund | Display grouping only |
| Instrument | TREPS; ETF; overseas fund; listed company; net receivable/payable | Display with printed weight; pass to calculation only when applicable |
| Subtotal | Total 96.37% | Display, never pass into AMFI calculation |
| Grand total | GRAND TOTAL 100.00% | Display, never pass into AMFI calculation |

## Market-Cap Policy

Factsheet disclosure is authoritative for this product. The server calls `shouldUseHoldingsMarketCapFallback` before running `calculateMarketCapFromHoldings`.

The calculated fallback requires all of the following:

1. There is no page-verified factsheet market-cap allocation.
2. A page-verified full portfolio table exists.
3. At least 80% total portfolio weight is extracted.
4. The AMFI snapshot effective on or before the reporting period is available.

Calculation status is `verified`, `partial`, or `insufficient_portfolio_data`. Calculated output must remain visibly separate from factsheet disclosure and retain AMFI source/snapshot, mapping method, coverage, and unresolved holdings.

## Current Behavior Deliberately Not Exposed

The database retains reviewer fields and review-related backend structures for audit continuity, but the manual review queue is intentionally removed from the user-facing workspace. Do not reintroduce it without an explicit user requirement.

Daily retry controls are also disabled. The product uses explicit user-triggered retry and bulk refresh flows.
