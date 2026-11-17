# Claude Deployment Runbook

## Turnkey Claude Local Start

For a handover recipient using Claude, start with `CLAUDE_AUTORUN_PROMPT.md`. The default local stack is intentionally self-contained: `docker compose up -d --build` starts MySQL and the app, migrates the database, seeds the registered AMC source list and a local administrator, provisions local PDF storage, and imports the official AMFI workbook when reachable. No manual hosted OAuth, object-store, or database setup is required.

The local default uses deterministic parsing and has AI features disabled. This is a deliberate zero-credential configuration; it will withhold unsupported visual/table layouts rather than infer values.

## 1. Package and Install

Use Node.js 22 and pnpm. This package intentionally excludes secrets, downloaded PDFs, database data, build output, and `node_modules`.

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

The application starts with:

```bash
NODE_ENV=production pnpm start
```

## 2. Database

Provision a MySQL 8-compatible database or TiDB instance and set `DATABASE_URL`. Do not point production at the current host’s database.

Apply every migration in chronological order, including `drizzle/0009_even_inertia.sql`. Use the Drizzle migration workflow only after confirming that the target schema is empty or appropriately backed up.

```bash
pnpm drizzle-kit migrate
```

After migration, seed or import the following separately:

1. The AMC registry and official source URLs.
2. Any user-approved cached factsheet metadata/PDFs, if historical content is required.
3. The dated AMFI classification workbook snapshot before expecting calculated market-cap output.

Database data and object-store files are not included in this package. A source-code transfer alone does not transfer the existing 50-AMC source registry, cached PDFs, chat history, or AMFI import rows unless they are exported separately by the current data owner.

## 3. Required Runtime Services

### Standard Portable Deployment

| Requirement | Action |
|---|---|
| `DATABASE_URL` | Use a MySQL/TiDB connection string compatible with Drizzle `mysql2`. |
| PDF object storage | Replace the host-specific Forge storage functions in `server/storage.ts` and `server/_core/storageProxy.ts` with an S3-compatible adapter, such as S3, R2, MinIO, or an approved local-disk store. |
| Authentication | Replace the host-specific OAuth code under `server/_core` with a portable authentication/session solution. Keep protected tRPC procedures protected. |
| `JWT_SECRET` | Generate a new long random secret. Never reuse or copy an existing secret. |
| HTTPS / reverse proxy | Configure forwarded protocol headers and secure cookies before exposing authenticated access. |
| Optional AI | Add a server-side model provider only if chatbot and visual fallback are retained. Keep API keys outside Git. |

### Host-Specific Variables to Replace

The following variables are tied to the previous hosting environment and are not portable as-is:

```text
VITE_APP_ID
OAUTH_SERVER_URL
OWNER_OPEN_ID
BUILT_IN_FORGE_API_URL
BUILT_IN_FORGE_API_KEY
VITE_FRONTEND_FORGE_API_URL
VITE_FRONTEND_FORGE_API_KEY
```

`DATABASE_URL` and a newly generated `JWT_SECRET` remain necessary. The host-specific variables must be replaced by equivalent auth/storage/AI integrations or the corresponding feature must be disabled.

## 4. No-AI / Local-Cost Mode

For a local deployment with no external AI calls:

1. Retain official-PDF download, storage, text parsing, scheme selection, deterministic page-table reading, tables, charts, comparison, and Excel export.
2. Disable chatbot procedures/UI or return an explicit unavailable message.
3. Disable visual market-cap and visual portfolio fallbacks. Do not replace them with guesses.
4. Keep the deterministic readers. If the PDF layout cannot be safely parsed, show a page-evidence-based unavailable state.
5. Run storage locally or through an S3-compatible service you control. Do not store unbounded PDFs inside Git.

The existing repository currently targets MySQL/TiDB. Moving to SQLite is a separate migration project: change the Drizzle dialect/schema definitions, replace MySQL-specific SQL/migrations, test all unique/index behavior, and verify concurrent PDF download handling. Do not assume SQLite compatibility without that work.

## 5. AI Mode

If visual fallback and chatbot remain enabled, use a provider that supports PDF/image input and structured JSON output. Preserve the existing guardrails:

| Capability | Mandatory safeguard |
|---|---|
| Market-cap visual reading | Exact same-page scheme evidence or exact consolidated scheme row; otherwise withhold. |
| Portfolio visual reading | Exact selected-scheme page; complete table only; preserve printed categories/rows; no inferred names/identifiers. |
| Chatbot | Ground answers in the active downloaded factsheet, not general market knowledge. |

Do not invoke AI automatically when deterministic page text says the selected scheme has no market-cap signal. This is both a correctness and latency safeguard.

## 6. Production Verification

Before the first production release, complete the following:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Then test with a real official factsheet:

1. Download a PDF and confirm it appears immediately in **Use a downloaded factsheet**.
2. Confirm the scheme selector contains only that document’s validated schemes.
3. Verify one displayed portfolio/market-cap value against its linked source PDF page.
4. Confirm a factsheet-disclosed market-cap allocation suppresses calculated fallback.
5. Confirm an FoF/ETF portfolio preserves categories, instruments, totals, and cash instead of mislabelling them as sector allocation.
6. Confirm missing/partial tables are withheld rather than estimated.

## 7. Operational Notes

There is no user-facing daily retry control. Use manual retry or explicit bulk refresh. Back up the database and PDF object store independently. Keep credentials out of the repository and rotate all newly created secrets before public deployment.
