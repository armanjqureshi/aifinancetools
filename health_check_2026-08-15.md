# End-to-End Health Check — 15 August 2026

## Automated Validation

The complete Vitest suite passed with **63 tests passed and one deliberately skipped live test**. TypeScript completed with `tsc --noEmit` and no errors.

## Confirmed Defect and Correction

The authenticated browser initially reported `No procedure found on path "factsheets.archiveCoverage"`. The source code already registered the procedure, but the live development route table had not reloaded after the prior change. Restarting the development service loaded the current router; no post-restart browser error for that route was recorded.

## Authenticated Workflow Verification

The workspace loaded all 50 registered AMC options, month/year selectors, direct official PDF-link fallback, recent factsheets, retry-status panel, and the July 2026 coverage notice. An existing **Invesco Mutual Fund — July 2026** factsheet opened successfully. The grounded chat returned a cited response to “What is the investment objective?” using only the selected factsheet.

## Expected Remote-Source Limits

The retry panel continues to display prior AMC-source outcomes for 360 ONE, Angel One, HSBC, and Quant. These are expected third-party access or stale-document outcomes; daily retries remain paused as requested.
