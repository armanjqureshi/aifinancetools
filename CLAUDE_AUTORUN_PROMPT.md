# Claude Autorun Prompt — Start Here

You are receiving a complete local copy of the Mutual Fund Factsheet Bot. **Do not ask the user to configure databases, source URLs, login, storage, or migrations. Do those tasks yourself.** Your goal is to start the app locally and report only the ready-to-use local URL.

## Required Actions

First read `ARCHITECTURE_AND_SAFEGUARDS.md`. Preserve all evidence-first rules; correctness takes priority over returning values.

Then perform the following actions autonomously from the project directory:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=120 app
```

The local stack creates its own MySQL database and local PDF folder, applies all migrations, seeds every registered AMC source, creates a local administrator automatically, and attempts to import the dated official AMFI classification workbook. No hosted credential is needed for this default mode.

Wait for the `app` service to report that it is listening, then verify:

```bash
curl -f http://localhost:3000/
```

If the service is not healthy, inspect `docker compose logs app` and `docker compose logs database`, repair the local code/configuration yourself, rebuild, and retry. Do not ask the user to interpret technical errors.

## Default Local Behavior

The default `compose.yaml` runs safely with `DISABLE_AI=true`. It retains official-PDF download, cached PDFs, scheme extraction, deterministic page-verified Industry/Sector, portfolio composition, factsheet-disclosed market-cap, AMFI fallback where dated data/verified holdings exist, charts, comparison, and Excel flows.

The default mode deliberately disables the chatbot and visual PDF fallbacks, because they require an external model API key. It must show unavailable states rather than guess values.

## Optional AI Enablement

Only if an API credential is already available in your environment, add these settings to a private local environment file or the `app` service environment, then set `DISABLE_AI=false`:

```text
LLM_API_URL=https://your-openai-compatible-provider.example
LLM_API_KEY=your-private-key
LLM_DEFAULT_MODEL=your-model-name
```

Never commit or print credentials. The endpoint must support OpenAI-compatible chat completions and PDF/file input for visual fallbacks.

## Completion Standard

When finished, report:

1. `http://localhost:3000` as the local URL.
2. Whether the AMFI snapshot import succeeded.
3. That local no-AI mode is active unless valid model credentials were already provided.
4. Any AMC site that itself blocks public download; such a source is an upstream access limitation, not a reason to fabricate data.

Do not modify the parsing safeguards to improve apparent coverage. Do not seed fake PDFs, returns, allocations, ratings, or reviews.
