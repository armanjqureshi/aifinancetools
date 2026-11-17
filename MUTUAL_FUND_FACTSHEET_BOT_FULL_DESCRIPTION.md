# 1 Finance Mutual Fund Factsheet Reader — Full Product Description

## Executive summary

The **1 Finance Mutual Fund Factsheet Reader** is a web application for retrieving official Indian mutual-fund factsheets, storing them for reuse, and answering questions using evidence from the selected AMC document. It is designed around a strict principle: **correctly showing that information is unavailable is better than presenting an unsupported value**.

A user selects an Asset Management Company (AMC), retrieves its latest available factsheet or chooses a previously stored one, selects a scheme found in that exact PDF, and reviews evidence-backed Industry/Sector allocation, portfolio composition, market-cap allocation, charts, comparisons, and—when AI is enabled—document-grounded answers.

This package is the Mutual Fund product. It is not yet a SIF reader, and SIF-specific strategy parsing or regulatory workflows are not claimed as features.

## What the application does

### Official factsheet retrieval

The application maintains a registry for approximately 50 Indian mutual-fund AMCs. Provider-specific retrieval adapters attempt to discover official factsheet PDFs from registered AMC pages and feeds. The latest-download path validates the period printed inside the PDF, rather than trusting the URL or filename alone. “Latest” means the most recent available PDF whose contents pass validation; it does not assume that every AMC has published a document for the current calendar month.

Retrieval includes bounded retries and clear source-failure reporting for timeouts, upstream server errors, bot restrictions, or pages that do not expose a downloadable PDF. Where available, users can also provide an official direct PDF link, upload an official PDF, retry one AMC manually, or explicitly run bulk retrieval/refresh.

Latest documents are revalidated after a 12-hour freshness interval when a latest/bulk refresh is requested. The workspace displays the last verification time and whether the cached document is current or stale. **Download all latest factsheets** remains available, alongside a separate **Refresh all stale factsheets** action. There is no automatic daily retry job.

The source registry contains provider-specific adapters, including public-feed routes for HDFC, ICICI Prudential, and Nippon India, in addition to generic and other registered strategies. Provider access can change; a successful route at one point does not guarantee future availability.

### Document caching and reuse

After acquisition, the original PDF and extracted text/metadata are stored. A cached-factsheet selector lets users open an already downloaded AMC document without downloading it again. Successful downloads, direct links, uploads, selected-source retries, and bulk refreshes trigger selector refresh so new documents appear immediately.

Each factsheet is associated with its AMC, source, reporting period, stored file reference, parse status, and evidence. Historical documents remain selectable; a new release does not turn an older factsheet into a current one.

### Scheme selection scoped to the PDF

The scheme selector is populated from scheme names detected and validated in the selected AMC factsheet. It does not mix schemes from other AMCs or unrelated documents. All scheme-specific readers, comparisons, and chatbot requests are scoped to the selected document and scheme.

The parser filters out headings, table-of-contents fragments, manager names, and other text that is not a valid scheme name. If a scheme or table cannot be verified reliably, the application withholds the result instead of substituting a nearby scheme’s data.

### Evidence-backed scheme information

For a selected scheme, the application can present:

- **Industry/Sector allocation** when a page-verified table or chart is available.
- **Portfolio composition** in the structure actually used by the factsheet, including companies, debt instruments, overseas funds, ETFs, money-market instruments, cash and receivables/payables, subtotals, and grand totals.
- **Market-cap allocation** when disclosed in the factsheet, or a carefully qualified calculated result under the fallback policy below.
- Charts and tables for supported allocations, with evidence controls linking to the relevant PDF page.

Portfolio is not assumed to mean only listed companies or sectors. For example, a fund-of-funds portfolio may include other funds, ETFs, money-market instruments, and cash. Printed category rows, negative cash/receivable values, subtotals, and grand totals are preserved where supported; totals are not treated as holdings.

### Market-cap disclosure and calculation policy

The factsheet is the primary source. If a selected scheme’s market-cap allocation is verified on the appropriate PDF page, that allocation is shown as **factsheet-disclosed**. The system does not replace it with a separate calculated number.

A dated AMFI/SEBI holdings-based calculation is used only if there is no verified factsheet-disclosed market-cap allocation and the evidence is sufficient. The calculation requires a complete, page-verified portfolio for the selected scheme, at least 80% extracted portfolio weight, and an AMFI classification snapshot effective on or before the factsheet reporting date. Security mapping is deterministic: ISIN first, NSE symbol second, and normalized exact name last. Fuzzy matching is not used.

Cash, debt, ETFs, REITs/InvITs, derivatives, and other non-equity exposures are kept separate as appropriate. Partial or ambiguous mapping is disclosed as partial/unavailable with unresolved holdings retained for audit; a calculated result is not presented as if it were printed in the factsheet.

### Comparison

The **Compare schemes** workspace lets users add multiple selected schemes and compare available market-cap information. Comparison items retain their source factsheet and evidence state. It distinguishes factsheet-disclosed results, calculated fallbacks, and unavailable data; it does not invent values to fill gaps.

### Document-grounded chat

When AI is enabled, the chatbot answers using the active downloaded factsheet, not general investment knowledge. It should clearly say when the selected document does not disclose or support an answer and should cite the factsheet. It must not answer from another AMC’s PDF or silently blend different schemes.

The default local configuration disables AI. In that mode, deterministic retrieval, caching, parsing, evidence, charts, comparison, and supported allocation output remain usable; chatbot and visual-PDF/model fallbacks are unavailable. This reduces cost and avoids requiring credentials. If an authorized OpenAI-compatible API is configured, AI can be enabled for chat and controlled visual-layout fallbacks without weakening evidence safeguards.

## How a user works with it

1. Select an AMC and choose the latest factsheet or a specific historical month.
2. The downloader discovers an official PDF, downloads it, and checks its printed reporting period.
3. The PDF and parsed content are cached. Users can also open an already stored factsheet directly.
4. Select a scheme listed in that document.
5. Review available Industry/Sector, portfolio, and market-cap sections. Use evidence links to inspect relevant PDF pages.
6. Ask document-scoped questions if AI is enabled, or add the scheme to comparison.
7. Use manual source retry or explicit bulk refresh as needed. The app displays source state and verification time.

## Evidence and correctness safeguards

The system accepts an allocation only when the selected scheme and the relevant table/chart are linked by reliable page-local evidence, or a narrow documented exception applies (such as an explicit former scheme name on the same page or an exact scheme row in a consolidated market-cap table).

It must not:

- Borrow values from another scheme, AMC, document, or adjacent page.
- Treat a contents page, manager table, top-10 list, or partial portfolio as a complete allocation.
- Guess missing percentages, identifiers, sectors, or market-cap buckets.
- Use fuzzy security matching in the AMFI/SEBI calculation.
- Present calculated market-cap as a factsheet disclosure.
- Convert “not disclosed” into zero or a fabricated estimate.

The user-facing manual review queue is intentionally removed. Low-confidence, unsupported, or structurally ambiguous information should be withheld with an explicit unavailable state rather than sent to a user queue.

## Technical architecture

- **Frontend:** React 19, Vite, Tailwind CSS 4, Radix UI, and Recharts.
- **Backend/API:** Express 4, tRPC 11, and Zod.
- **Database:** Drizzle ORM with MySQL/TiDB schema and migrations.
- **PDF processing:** `pdf-parse`, page-aware extraction, deterministic readers, a shared parsed-page cache, and guarded optional visual fallback.
- **Storage:** Hosted object storage in the original hosted configuration; local filesystem storage in local mode.
- **Authentication:** Hosted OAuth/JWT in hosted mode; local administrator behavior in local mode.
- **AI:** Optional OpenAI-compatible adapter; disabled by default in the local deployment.

Important modules include `server/routers/factsheets.ts` for retrieval and factsheet APIs, `server/registryDownloader.ts` and `server/officialPublicFeeds.ts` for AMC document discovery, `server/pdfParser.ts` and `server/schemePageAllocationReader.ts` for deterministic extraction, `server/pdfPageCache.ts` for reusable page text, `server/visualMarketCapExtractor.ts` and `server/visualPortfolioExtractor.ts` for controlled visual fallback, and `server/sebiMarketCapCalculation.ts` / `server/amfiClassificationService.ts` for the dated AMFI/SEBI market-cap calculation.

## Local deployment included in the ZIP

The package includes a Docker Compose setup with MySQL 8.4 and a Node 22 app container. The local startup flow runs migrations, seeds the registered AMC list and local administrator, provisions local PDF storage, and attempts to retrieve/import the official AMFI workbook. The default app URL is `http://localhost:3000`.

Start it from the project folder with:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=120 app
```

Docker must be installed and running on the computer where the ZIP is used. No hosted database, OAuth, object-storage account, or AI credential is required for default no-AI local mode. Optional AI requires a private OpenAI-compatible API URL, key, and model setting; never place credentials in the archive or source control.

## What the ZIP contains and does not contain

The ZIP is a source-code and deployment handover. It contains the application code, tests, database schema/migrations, official-source registry/adapters, local Docker setup, and project/deployment documentation. It does **not** contain `node_modules`, secrets, production database rows, cached factsheet PDFs, or hosted storage contents. The local bootstrap repopulates the AMC source registry and tries to import the dated AMFI snapshot; it does not migrate private/hosted user data.

## Known limitations and intended use

- AMC websites may block automated requests, change URL patterns, or temporarily fail. The app can report an upstream limitation and may require an official direct link or upload for a particular source.
- A downloadable PDF can still have a layout that cannot be safely parsed. In that case, the correct output is unavailable rather than an unsupported value.
- Current-month factsheets are not guaranteed to exist for every AMC. The downloader aims for the latest content-valid document actually available.
- Optional AI features require a compatible external model service. Default local operation is no-AI and does not offer chatbot or visual-model extraction.
- This is a document retrieval and analysis tool, not personalized investment advice or a source of live market prices.

## Product identity

The application is the **1 Finance Mutual Fund Factsheet Reader**. Its brand-guideline UI uses Fira Sans, a light neutral canvas, purple primary emphasis, and an editorial, evidence-first layout. The project should be described as a mutual-fund factsheet reader/finder; SIF-specific functionality would need separate domain modeling and parsing work.
