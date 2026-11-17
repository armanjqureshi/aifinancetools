/**
 * Scheduled Job Handlers
 *
 * Express handlers for Heartbeat cron callbacks.
 * All handlers must be mounted at /api/scheduled/* in server/_core/index.ts
 */

import type { Request, Response } from "express";
import { runPipeline } from "./runPipeline";
import { getAmcDownloadRetryByTaskUid, upsertCronConfig } from "./db";
import { processAmcDownloadRetry } from "./retryProcessor";
import { sdk } from "./_core/sdk";

/**
 * Monthly factsheet download and extraction pipeline.
 * Triggered by the Heartbeat cron on the 1st of every month.
 */
export async function monthlyRunHandler(req: Request, res: Response) {
  try {
    // Update last run time
    await upsertCronConfig({ lastRunAt: new Date() });

    // Run the full pipeline
    const runJobId = await runPipeline("cron");

    // Update next run time (next month's 1st)
    const now = new Date();
    const nextRun = new Date(now.getFullYear(), now.getMonth() + 1, 1, 6, 0, 0);
    await upsertCronConfig({ nextRunAt: nextRun });

    res.json({ ok: true, runJobId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Cron] Monthly run failed:", message);
    res.status(500).json({
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
}

/** Daily Heartbeat handler. Each retry row owns one task UID and is looked up exclusively by that UID. */
export async function factsheetRetryHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const retry = await getAmcDownloadRetryByTaskUid(user.taskUid);
    if (!retry || retry.isEnabled !== 1) return res.json({ ok: true, skipped: "inactive-or-orphan" });
    if (retry.nextRetryAt > new Date()) return res.json({ ok: true, skipped: "backoff", nextRetryAt: retry.nextRetryAt });
    const outcome = await processAmcDownloadRetry(retry);
    return res.json({ ok: true, amc: retry.amcName, outcome });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Factsheet Retry] Daily retry failed:", message);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
