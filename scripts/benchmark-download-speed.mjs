import { performance } from "node:perf_hooks";
import { writeFile } from "node:fs/promises";
import { listAmcSourcesWithLatestDocuments } from "../server/db.ts";
import { downloadFromRegistry } from "../server/registryDownloader.ts";

const started = performance.now();
const sources = await listAmcSourcesWithLatestDocuments();
const listMs = Math.round(performance.now() - started);
const cached = sources.filter((source) => source.latestDocument?.fileUrl);
const missing = sources.filter((source) => !source.latestDocument?.fileUrl);

const lookupStarted = performance.now();
const cachedSample = cached[0];
const cachedDocument = cachedSample?.latestDocument ?? null;
const cachedLookupMs = Math.round(performance.now() - lookupStarted);

const missingSample = missing.find((source) => source.amcSlug === "bandhan") ?? missing[0];
const networkStarted = performance.now();
const missingOutcome = missingSample ? await downloadFromRegistry(missingSample.amcSlug) : null;
const missingDiscoveryMs = Math.round(performance.now() - networkStarted);

const report = {
  sourceListMs: listMs,
  cachedBulkCount: cached.length,
  missingBulkCount: missing.length,
  cachedSingleLookupMs: cachedLookupMs,
  cachedSample: cachedSample?.amcName ?? null,
  cachedDocumentId: cachedDocument?.id ?? null,
  missingSample: missingSample?.amcName ?? null,
  missingDiscoveryMs,
  missingOutcome: missingOutcome?.success ? "downloaded" : "not_downloaded",
};
await writeFile(new URL("../download_speed_benchmark.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
