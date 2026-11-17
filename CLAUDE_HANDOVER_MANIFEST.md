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
| `compose.yaml`, `Dockerfile`, `scripts/localBootstrap.mjs`, `scripts/create-user.mjs` | Self-contained MySQL, application, source-registry, storage, first account, and AMFI bootstrap path. |
| `drizzle/` | MySQL/TiDB schema migrations through `0009_even_inertia.sql`. |
| `server/` and `client/` | Application implementation and tests. |
| `portfolio_composition_notes.md` | Recent DSP portfolio composition and performance validation. |
| `sebi_amfi_market_cap_calculation_notes.md` | Official AMFI snapshot/mapping audit notes. |

## Deliberately Excluded

| Excluded item | Reason |
|---|---|
| `.env`, API keys, JWT secrets, passwords | Must never be transferred in source control or a ZIP. |
| `node_modules`, `dist`, caches, development logs | Reproducible build artefacts, not source. |
| Cached PDFs and object-storage content | Potentially large/user-owned data; move separately through an approved storage export. |
| Production database rows | User-owned data; export/restore separately and securely. |
| Original hosting platform | Fully removed in November 2026. The app no longer calls it for login, storage, AI or scheduling. |

## Verification Recorded Before Packaging

```text
pnpm test              # 141 passed, 1 skipped
pnpm exec tsc --noEmit # passed
```

## Independence from the original hosting platform (November 2026)
- [x] Login replaced with self-hosted auth (`server/_core/auth.ts`): `AUTH_MODE=none` for a laptop, `AUTH_MODE=password` for a team server (scrypt hashes, signed session cookie, sign-in throttling, `/login` screen, `pnpm user:create`)
- [x] Storage replaced: local disk or any S3-compatible bucket; stored PDFs served only to signed-in users at `/files/<key>`
- [x] AI: no built-in fallback endpoint; any OpenAI-compatible provider via `LLM_*`; PDFs sent as standard base64 `file` parts
- [x] Removed the platform's job scheduler, the unauthenticated `/api/scheduled/*` endpoints, owner notifications, maps, image, voice and data APIs, build plugins, analytics script and nine unrouted template pages
- [x] Migration `0010_local_password_auth.sql` adds `users.passwordHash`
- [x] Fixed: start-up bootstrap never exited (open DB pool), so the Docker app never started; AMFI download now time-limited
- [x] Verified: 148 tests pass against a live database, typecheck and build pass, sign-in and file access checked in a browser
