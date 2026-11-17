# Mutual Fund Factsheet Bot — Complete Project Brief for Claude

## Instruction to Claude

You are taking over a production-oriented application called **Mutual Fund Factsheet Bot**. Read this brief, then read `ARCHITECTURE_AND_SAFEGUARDS.md` and `CLAUDE_AUTORUN_PROMPT.md` before changing code. Treat the evidence and data-integrity rules below as **non-negotiable requirements**. The product values correct withholding over apparent extraction coverage: when the factsheet does not support a value, show that it is unavailable—never estimate, infer, fabricate, or borrow data from another scheme or page.

Your first task is to start the local version autonomously by following `CLAUDE_AUTORUN_PROMPT.md`. Do not ask the user to configure databases, sources, login, storage, or migrations.

---

## 1. What This Product Does

This is a web application for reading official Indian mutual-fund factsheets. It maintains a registry of approximately 50 Asset Management Companies (AMCs), retrieves the latest official factsheet PDF from the relevant AMC source, stores the PDF and its extracted text, identifies the schemes inside that exact document, and presents information for the **selected scheme only**.

The core user outcome is simple: a user selects an AMC, downloads its latest factsheet, selects one scheme from that downloaded document, and then sees evidence-backed Industry/Sector allocation, Portfolio composition, Market-cap allocation, charts, and comparison information. If the PDF itself does not contain reliable data, the application explains why rather than returning a plausible but unsupported number.

| Capability | What the user receives |
|---|---|
| Official retrieval | Latest available official AMC factsheet, or a clear upstream source failure state |
| Cached documents | Stored PDFs are reused; selecting an existing document does not re-download it |
| Freshness status | Last-verified time, current/stale state, 12-hour revalidation window, and a separate refresh-all-stale action |
| Scheme selection | Only validated full scheme names found in the active downloaded AMC document |
| Industry/Sector | Page-verified table/chart values for the exact selected scheme only |
| Portfolio | Actual portfolio composition, including categories, instruments, ETFs/funds, money-market, cash, subtotals, and net-asset weights |
| Market cap | Factsheet-disclosed allocation first; dated AMFI/SEBI calculation only when disclosure is absent and portfolio evidence is sufficient |
| Comparison | User can add multiple selected schemes and compare their market-cap allocation sources and values |
| Chat | Optional factsheet-grounded answers, strictly from the selected downloaded document |

---

## 2. Primary User Workflows

### A. Get the latest AMC factsheet

1. The user chooses an AMC from the registered source list.
2. The server uses the AMC’s official source strategy to discover and download the newest available PDF.
3. The downloaded PDF is checked against the reporting month/year printed in its content. The bot must not accept a wrong-month PDF merely because the URL looks current.
4. The original PDF is cached in storage; metadata, extracted text, reporting period, and parse status are recorded in the database.
5. The **Use a downloaded factsheet** dropdown refreshes after every successful acquisition route: standard latest download, direct official URL, upload, selected-AMC retry, and bulk refresh.

The system supports three user-controlled acquisition choices in addition to the registered-source path: a direct official PDF URL, upload of an official PDF, and bulk download/refresh. Latest retrieval is revalidated after 12 hours; the workspace identifies stale cached sources and offers a separate bulk stale-refresh action. Daily retry is deliberately disabled. Only explicit manual retry is exposed.

### B. Use a stored factsheet

The user can choose an already downloaded AMC/document from the cached-factsheet dropdown. This must immediately use the stored PDF/text and must not trigger another retrieval attempt. The dropdown is sorted around the newest reporting period available for each AMC.

### C. Select a scheme and read it

The scheme dropdown is scoped to the **active document and active AMC only**. It must reject table headings, manager names, incomplete text fragments, wrapped rows, generic labels, and names from unrelated AMCs or PDFs. After selection, all readers and chat requests remain scoped to the selected document plus selected scheme.

### D. Compare multiple schemes

At the end of the workspace there is a **Compare schemes** tab. Users add the current selected scheme, switch to other cached factsheets/schemes, and add further entries. Comparison uses the same disclosure-first market-cap rule as the selected-scheme view. It never turns an unavailable result into an estimate.

---

## 3. The Central Evidence-First Rule

Every extracted allocation is only acceptable when it is linked to the exact selected scheme and an exact PDF page. The application uses an evidence hierarchy:

1. **Preferred:** a page that has the full standalone scheme heading and an explicit same-page Industry/Sector, Portfolio, or Market-cap table/chart.
2. **Permitted special case:** a renamed scheme, but only when the same page expressly establishes its former name.
3. **Permitted market-cap special case:** an explicit AMC-wide consolidated market-cap table containing the exact selected-scheme row and explicit cap-bucket columns on that same page.
4. **Otherwise:** withhold the result.

These are prohibited:

| Prohibited behavior | Reason |
|---|---|
| Borrowing a nearby table or next-page table | It can belong to another scheme |
| Treating a table-of-contents mention as a scheme page | It is not allocation evidence |
| Using a manager/analyst table as holdings | It is not portfolio composition |
| Fuzzy-matching scheme names across documents | It permits cross-scheme contamination |
| Treating top-10 holdings as the full portfolio | It makes cap calculations misleading |
| Guessing missing industry, market-cap, security identifier, or weight values | The bot is not a market-data estimator |

The relevant evidence records are persisted in `visual_allocation_evidence`. The interface shows source-page/evidence controls for verified data. A legacy reviewer data structure remains in the database for audit continuity, but the user-facing manual review queue has intentionally been removed.

---

## 4. What “Portfolio” Means in This Product

Do not assume a portfolio is always a table of Indian listed companies grouped by industry. The reader must preserve the table structure that the factsheet actually prints.

For example, an overseas fund-of-funds can contain a table like this:

| Printed grouping | Example content | Expected display treatment |
|---|---|---|
| Money Market Instruments | TREPS / Reverse Repo Investments | Display category and instrument weight |
| Others / Overseas Mutual Fund | Bluebox Global Technology Fund, UCITS ETFs, other overseas funds | Display category and all printed fund/ETF instrument rows |
| Cash & Cash Equivalent | Net Receivables/Payables | Display the printed amount, including a negative value |
| Total | Category subtotal | Display for readability; do not calculate it twice |
| Grand Total | 100% | Display; never treat as an instrument |

The UI must show headings, instruments, subtotals, grand total, and `% to Net Assets` rather than forcing these rows into a “company holdings” or “industry allocation” view. This was verified against the DSP Global Innovation Overseas Equity Omni FoF factsheet portfolio page. Subtotals and grand totals must not be fed into the AMFI calculation engine.

---

## 5. Market-Cap Allocation Policy

### Disclosure first

If the selected scheme’s factsheet contains a page-verified Large/Mid/Small-cap allocation, that is the value shown. It is labelled as **factsheet-disclosed** and has page evidence. The bot must not show a competing calculated number simply because calculations are possible.

### Calculation only as a fallback

The AMFI/SEBI calculation is considered only when the factsheet has **no page-verified market-cap allocation**. It requires all of the following:

1. A page-verified full portfolio table for the exact selected scheme.
2. At least 80% of the portfolio’s total weight extracted from that table.
3. An official AMFI classification snapshot effective on or before the factsheet reporting date.
4. Deterministic security mapping: ISIN first, NSE symbol second, normalized exact company/security name third.

The calculation must never use fuzzy security matching. Cash, debt, ETFs, REITs, InvITs, derivatives, and other non-standard exposures are kept separate. Missing or ambiguous security classifications are retained as unresolved, with original name, weight, mapping method, snapshot, and status available for audit.

| Result type | Meaning |
|---|---|
| `verified` | Full portfolio table and sufficient mapping support a complete result |
| `partial` | Full portfolio table is verified, but some security classification/mapping weight remains unresolved |
| `insufficient_portfolio_data` | Holdings are top-N, incomplete, below the coverage threshold, or otherwise unsafe for calculation |

The calculated result is visibly separate from a factsheet disclosure and includes the official AMFI workbook source, snapshot effective date, coverage, mapped holdings, unresolved holdings, and the selected factsheet portfolio page. It is persisted in `calculated_market_cap_evidence`.

The current seeded official classification source is AMFI’s **Average Market Capitalization as of 30 June 2026**, effective 1 July 2026. Future owners must import subsequent official snapshots as AMFI publishes them; never roll an old snapshot forward without labelling it.

---

## 6. Parsing and Performance Design

The parser uses a layered approach:

1. Download the PDF only when required and cache it.
2. Extract page text using `pdf-parse`.
3. Reuse parsed PDF pages across Industry/Sector, Portfolio, and Market-cap readers through `server/pdfPageCache.ts` for five minutes.
4. Use deterministic text/table readers first.
5. Invoke visual document reading only when the deterministic page layout loses a relationship that can be safely recovered—and only when the exact selected scheme page is already known.
6. Cache page-level evidence so revisiting the same scheme/document does not repeat expensive verification.

The current performance design specifically avoids visual market-cap fallback if the selected scheme page does not contain a market-cap signal. It also promotes complete deterministic portfolio composition tables to a fast path, instead of sending them to visual reading. On a DSP representative case, selected-scheme parsing was reduced from roughly 33 seconds to roughly 6 seconds by these protections.

Do not “speed up” the parser by weakening selected-scheme boundaries, allowing adjacent pages, or accepting incomplete tables. Optimize caching, targeting, and duplicate work instead.

---

## 7. Application Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Client | React 19, Vite, Tailwind 4, Radix UI | Dashboard/workspace, selectors, evidence views, charts, comparison |
| API | Express 4, tRPC 11, Zod | Typed procedures for AMC registry, retrieval, factsheets, allocations, and chat |
| Database | Drizzle ORM with MySQL/TiDB | Application records, documents, evidence, AMFI snapshots, and audit data |
| PDF handling | `pdf-parse` plus controlled visual fallback | Page text, scheme boundaries, structural table extraction |
| Storage | Local disk (`STORAGE_DRIVER=local`) or any S3-compatible bucket (`STORAGE_DRIVER=s3`), served through the signed-in `/files/` route | Original cached PDFs |
| Authentication | Self-hosted: `AUTH_MODE=none` (single local administrator) or `AUTH_MODE=password` (email + scrypt-hashed password, JWT session cookie) | User/session identity |
| AI | OpenAI-compatible model interface | Optional factsheet chat and visual-layout fallback only |

### Key files

| File | Responsibility |
|---|---|
| `server/routers/factsheets.ts` | Retrieval, factsheet selection, selected-scheme allocation API, grounded chat |
| `server/amcRegistrySeed.ts` | Registered AMC official source list |
| `server/pdfParser.ts` | Deterministic parsing of text, scheme names, allocations, and category-aware portfolios |
| `server/schemePageAllocationReader.ts` | Strict page-local Industry/Sector and Portfolio reader |
| `server/visualMarketCapExtractor.ts` | Strict disclosed market-cap reader and controlled visual fallback |
| `server/visualPortfolioExtractor.ts` | Controlled page-local portfolio visual fallback |
| `server/pdfPageCache.ts` | Shared parsed-page cache and local PDF URL validation |
| `server/sebiMarketCapCalculation.ts` | Pure deterministic mapping/aggregation engine |
| `server/amfiClassificationService.ts` | Official AMFI workbook import and calculation-evidence persistence |
| `server/marketCapFallbackPolicy.ts` | Enforces factsheet-disclosed allocation precedence |
| `client/src/pages/FactsheetWorkspacePage.tsx` | Main user workspace and multi-scheme comparison UI |
| `drizzle/schema.ts` and `drizzle/0000...0010` | Database schema and required migrations |

---

## 8. Important Data Tables

| Table | Purpose |
|---|---|
| `amcs` | Fund-house identities |
| `amc_sources` | Official source URL, source/document type, discovery strategy, source notes |
| `scheme_catalog` | Discovered/validated scheme names per AMC |
| `factsheet_documents` | Document URL, reporting period, cache/storage reference, extracted text, status/error |
| `visual_allocation_evidence` | Page-local factsheet evidence, confidence/state, evidence text, review metadata |
| `amfi_classification_snapshots` | Dated official source/snapshot metadata |
| `amfi_security_classifications` | Classification records with rank, ISIN, NSE/BSE symbol, normalized name, cap bucket |
| `calculated_market_cap_evidence` | Calculation result, coverage, mapping/unresolved JSON, snapshot reference, status |
| `chat_contexts` | Saved factsheet-grounded chat questions/answers and source snapshot |

Apply every migration up to and including `drizzle/0010_local_password_auth.sql`. Migration `0009` is mandatory for AMFI and calculated-market-cap support; `0010` adds password sign-in.

---

## 9. Local, Self-Contained Claude Deployment

The app is fully self-hosted. It has no dependency on the platform it was first built on: login, storage, AI and scheduling are all implemented in this codebase or configured through environment variables (see `README.md`).

1. Claude should follow `CLAUDE_AUTORUN_PROMPT.md`.
2. `docker compose up -d --build` launches MySQL and the application.
3. Startup applies migrations, seeds the AMC source registry, creates a local administrator, creates local PDF storage under `local-data/storage`, and tries to import the current official AMFI workbook.
4. The local app is available at `http://localhost:3000` after startup.

The default local configuration sets `DISABLE_AI=true`. It is functional for retrieval, caching, deterministic parsing, portfolio display, disclosure-backed allocation, comparison, and exports. It intentionally disables chat and visual-PDF fallbacks because those require a model API credential. In local no-AI mode, unsupported layouts must be reported as unavailable, never guessed.

If an OpenAI-compatible API is already available, the app can use private environment variables `LLM_API_URL`, `LLM_API_KEY`, and `LLM_DEFAULT_MODEL`, then set `DISABLE_AI=false`. Never commit or print such credentials. The provider must be capable of PDF/file input for visual fallbacks.

---

## 10. Explicit Product Constraints

1. Factsheets are official documents, but some AMC sites use dynamic pages, CDNs, sessions, bot protection, or upstream restrictions. Failures must be reported as source-access limitations, not hidden.
2. “Latest” means the latest available factsheet whose period matches the PDF content—not necessarily the current calendar month.
3. Cached documents must remain reusable, and downloaded-selector data must refresh after a successful update.
4. The portfolio reader must support domestic equity, debt, cash, foreign funds, ETFs, fund-of-funds structures, receivables/payables, and category totals.
5. The user-facing manual review queue is removed. Do not restore it unless specifically requested.
6. Scheduled/daily retry is disabled. Keep manual retry and explicit bulk refresh.
7. Do not create fake customer reviews, ratings, testimonials, sample performance, allocation values, PDFs, or portfolio evidence.
8. A potential future **Performance snapshot** feature has been discussed but is not implemented. If added, it should show only page-verified return/benchmark periods printed in the selected scheme’s factsheet; never calculate or normalize returns without an explicit approved method.

---

## 11. Definition of Done for Future Changes

Before considering a parsing feature complete:

1. Test it against a real stored official PDF page, not only synthetic fixtures.
2. Verify that the page contains the selected scheme and exact underlying table/chart.
3. Add regression coverage that rejects the corresponding unsafe/adjacent/fragmented pattern.
4. Run the Vitest suite and TypeScript typecheck.
5. Confirm both desktop and mobile workspace rendering where user-facing UI changes.
6. Keep output state explicit: factsheet-disclosed, calculated fallback, unavailable, or withheld.

The correct answer is often **“unavailable in this factsheet”**. That outcome is a successful safeguard, not a parser failure.
