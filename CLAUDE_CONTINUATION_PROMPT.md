# Claude Continuation Prompt — Mutual Fund Factsheet Bot

You are continuing work on the **Mutual Fund Factsheet Bot**. This is a React 19 + Express 4 + tRPC 11 + Drizzle + MySQL/TiDB application that retrieves official Indian AMC factsheets, caches PDFs, extracts selected-scheme evidence, and presents factsheet-grounded portfolio and allocation data.

For a first-time local run, obey `CLAUDE_AUTORUN_PROMPT.md` instead. It is the one-file autonomous setup instruction for Claude.

Read these files before editing:

1. `ARCHITECTURE_AND_SAFEGUARDS.md`
2. `DEPLOYMENT_RUNBOOK.md`
3. `drizzle/schema.ts` and every migration under `drizzle/`
4. `server/schemePageAllocationReader.ts`, `server/visualMarketCapExtractor.ts`, `server/visualPortfolioExtractor.ts`, `server/pdfParser.ts`, and `server/sebiMarketCapCalculation.ts`
5. `portfolio_composition_notes.md` and `sebi_amfi_market_cap_calculation_notes.md`

## Current Product State

The current repository state was validated with **133 passing tests and 1 skipped test**, followed by `tsc --noEmit` without errors.

The user’s non-negotiable requirement is correctness over coverage. Never invent values, fill gaps, borrow allocations across schemes, or present calculated values as factsheet disclosures.

### Current User-Facing Features

| Capability | Current behavior |
|---|---|
| Factsheet retrieval | Latest official source retrieval, direct official PDF URL, official PDF upload, historical month/year request, bulk download, and manual retry. Daily automatic retry UI is disabled. |
| Cached factsheets | PDFs and parsed text are stored. A successful acquisition refreshes the **Use a downloaded factsheet** selector immediately. |
| Scheme selector | Restricted to validated schemes extracted from the active AMC factsheet only. |
| Industry/Sector | Displayed only with page-verified explicit selected-scheme evidence. |
| Portfolio | Displayed as page-verified **portfolio composition**: category blocks, instruments, underlying funds/ETFs, money market, cash/receivables, subtotals, grand total, and weights. |
| Market cap | Factsheet-disclosed, page-verified allocation is always primary. AMFI/SEBI holdings calculation is only a fallback when no verified factsheet market-cap allocation exists. |
| Multi-scheme comparison | Users can add current schemes and compare market-cap results. Factsheet disclosure takes precedence over calculated fallback. |
| Chatbot | Answers are grounded in the selected downloaded factsheet. This requires an LLM provider if retained. |

## Non-Negotiable Extraction Rules

1. A value requires an exact selected scheme and page-level evidence.
2. A manager table, table of contents, performance table, adjacent scheme page, or a partial scheme-name mention is never valid allocation evidence.
3. A renamed scheme is accepted only where the same page explicitly confirms the former name.
4. For market-cap disclosure, accept only a same-page selected-scheme chart/table or an AMC-wide table with the exact selected-scheme row and named cap columns.
5. Where a factsheet discloses verified market-cap allocation, show that result only. Do not show AMFI calculation beside it.
6. Holdings calculation may run only from a page-verified **full portfolio** table, not Top 10 holdings or an incomplete table. It needs at least 80% extracted portfolio weight.
7. Map holdings in order: ISIN, NSE symbol, then deterministic normalized exact name. Do not use fuzzy matching without a separate audited mapping workflow.
8. Withhold unavailable data plainly. No estimates, extrapolation, or cross-scheme reuse.

## Recent Verified Example

`DSP Global Innovation Overseas Equity Omni FoF` in the stored July 2026 DSP factsheet has a full portfolio table on PDF page 23. The reader must preserve: Money Market Instruments; Overseas Mutual Fund / ETF instruments; Cash & Cash Equivalent; subtotals; grand total; and the printed weights. It is **not** an Industry/Sector table.

The reader was optimized to share parsed PDF pages between allocation readers and to skip market-cap visual reading where the exact standalone scheme page has no market-cap signal. This reduced the measured selected-scheme flow from about 33.4 seconds to 5.6 seconds for this example.

## Required Engineering Process

Before parser changes, add a regression test that reproduces the observed issue. Then run:

```bash
pnpm test
pnpm exec tsc --noEmit
```

For UI changes, check desktop and mobile rendering. Do not remove evidence links or replace verified/withheld states with optimistic language.

## First Claude Task

The app is already portable and self-hosted. Follow `README.md` to run it. Never copy secrets between environments.
