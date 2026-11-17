# Claude Handover Manifest

## Included

This handover contains the application source, lockfile, Drizzle schema and migrations, automated tests, and deployment/continuation documentation.

| Item | Purpose |
|---|---|
| `CLAUDE_CONTINUATION_PROMPT.md` | Start here when continuing with Claude. |
| `CLAUDE_AUTORUN_PROMPT.md` | Give this single file to Claude for an autonomous first-time local start. |
| `MUTUAL_FUND_FACTSHEET_BOT_FULL_DESCRIPTION.md` | Shareable full description of the product, workflows, architecture, safeguards, deployment, and limitations. |
| `ARCHITECTURE_AND_SAFEGUARDS.md` | System design and non-negotiable evidence rules. |
| `DEPLOYMENT_RUNBOOK.md` | Portable production and no-AI/local deployment steps. |
| `compose.yaml`, `Dockerfile.local`, `scripts/localBootstrap.mjs` | Self-contained local MySQL, application, source-registry, local-storage, administrator, and AMFI bootstrap path. |
| `drizzle/` | MySQL/TiDB schema migrations through `0009_even_inertia.sql`. |
| `server/` and `client/` | Application implementation and tests. |
| `portfolio_composition_notes.md` | Recent DSP portfolio composition and performance validation. |
| `sebi_amfi_market_cap_calculation_notes.md` | Official AMFI snapshot/mapping audit notes. |

## Deliberately Excluded

| Excluded item | Reason |
|---|---|
| `.env`, API keys, JWT secrets, OAuth tokens | Must never be transferred in source control or a ZIP. |
| `node_modules`, `dist`, caches, development logs | Reproducible build artefacts, not source. |
| Cached PDFs and object-storage content | Potentially large/user-owned data; move separately through an approved storage export. |
| Production database rows | User-owned data; export/restore separately and securely. |
| Hosted platform configuration | Proprietary credentials/integration must be replaced in a portable deployment. |

## Verification Recorded Before Packaging

```text
pnpm test              # 141 passed, 1 skipped
pnpm exec tsc --noEmit # passed
```
