# 1 Finance MF Factsheet Bot

Reads official Indian mutual fund factsheets: downloads them from each AMC, saves them, and shows sector, portfolio and market cap allocation for one scheme at a time, each linked to the PDF page it came from. If the factsheet does not support a number, the app says so instead of guessing.

This is 1 Finance's own copy. It does not depend on any outside platform. Login, file storage and scheduling all run inside this app. AI is optional and works with any OpenAI-compatible provider you choose.

## Run it on your computer

You need Docker Desktop.

```bash
docker compose up -d --build
```

Open http://localhost:3000. There is no sign-in in this mode. The first start takes a few minutes: it builds the app, creates the database, loads the 50 AMC sources and imports AMFI's market cap list.

PDFs and the database are kept in the `local-data` folder next to this file. Back that folder up if you want to keep downloaded factsheets.

To stop it: `docker compose down`.

## Run it on a server for the team

1. Copy `.env.example` to `.env`.
2. Set:
   - `LOCAL_MODE=false` and `AUTH_MODE=password`
   - `JWT_SECRET` to a random value (`openssl rand -hex 32`)
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first administrator
   - `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD`
   - `PUBLIC_URL` to the address people will use
3. Put HTTPS in front of port 3000 (Caddy, Nginx or a cloud load balancer) and set `TRUST_PROXY=true`.
4. `docker compose up -d --build`

Add more people:

```bash
docker compose exec app corepack pnpm user:create --email name@1finance.co.in --name "Name"
docker compose exec app corepack pnpm user:create --email lead@1finance.co.in --admin
```

Running the same command again for an existing email resets that person's password.

To keep PDFs in a bucket instead of on the server's disk, set `STORAGE_DRIVER=s3` and the `S3_*` values in `.env`.

## Turn on AI (optional)

Chat and the backup chart reader need a model that accepts PDF input. In `.env`:

```
DISABLE_AI=false
LLM_API_URL=https://api.openai.com
LLM_API_KEY=your-key
LLM_DEFAULT_MODEL=a-model-that-reads-pdfs
```

Without these, everything else still works and those two features show as unavailable.

## For developers

```bash
pnpm install
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Local dev without Docker needs a MySQL database: set `DATABASE_URL`, then `pnpm db:migrate && pnpm bootstrap && pnpm dev`.

Read `ARCHITECTURE_AND_SAFEGUARDS.md` before changing any parser. The evidence rules there are not optional.
