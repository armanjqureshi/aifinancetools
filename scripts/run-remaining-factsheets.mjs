import { appRouter } from "../server/routers.ts";
import { listAmcSources } from "../server/db.ts";

const activeSources = await listAmcSources();
const remainingSources = activeSources
  .filter((source) => source.isActive === 1)
  .map((source) => source.amcSlug);

const now = new Date();
const caller = appRouter.createCaller({
  user: {
    id: 1,
    openId: "controlled-downloader-run",
    name: "Controlled Downloader Run",
    email: "downloader@local.test",
    loginMethod: "system",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  },
  req: { protocol: "https", headers: {} },
  res: {},
});

const results = [];
let cursor = 0;
const concurrency = 2;

async function worker() {
  while (cursor < remainingSources.length) {
    const slug = remainingSources[cursor++];
    if (!slug) return;
    const startedAt = Date.now();
    try {
      const outcome = await caller.factsheets.downloadLatest({ amcSlug: slug });
      results.push({
        slug,
        success: outcome.success,
        amcName: outcome.amcName,
        seconds: Math.round((Date.now() - startedAt) / 1000),
        error: outcome.success ? undefined : outcome.error,
      });
      console.log(JSON.stringify(results.at(-1)));
    } catch (error) {
      const result = {
        slug,
        success: false,
        seconds: Math.round((Date.now() - startedAt) / 1000),
        error: error instanceof Error ? error.message : String(error),
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
const successful = results.filter((item) => item.success).length;
console.log(JSON.stringify({ summary: { total: results.length, successful, unsuccessful: results.length - successful }, results }));
