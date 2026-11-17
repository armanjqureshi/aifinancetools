import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createFundRunResult,
  getCronConfig,
  getDb,
  getFundAllocationsByRunJob,
  getFundRunResultsByJobId,
  getLatestRunJob,
  getMutualFundById,
  getRunJobById,
  insertFundAllocations,
  listRunJobs,
  updateFundRunResult,
  upsertCronConfig,
} from "../db";
import { runPipeline } from "../runPipeline";
import { storageGet, storagePut } from "../storage";
import { fundRunResults, type FundAllocation } from "../../drizzle/schema";
import { parseFactsheet } from "../pdfParser";

export const runsRouter = router({
  trigger: protectedProcedure.mutation(async () => {
    try {
      return { runJobId: await runPipeline("manual") };
    } catch (err: unknown) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err instanceof Error ? err.message : "Pipeline failed" });
    }
  }),

  list: protectedProcedure.input(z.object({ limit: z.number().optional() }).optional()).query(({ input }) => listRunJobs(input?.limit ?? 10)),
  latest: protectedProcedure.query(async () => (await getLatestRunJob()) ?? null),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const job = await getRunJobById(input.id);
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return job;
  }),

  getFundResults: protectedProcedure.input(z.object({ runJobId: z.number() })).query(async ({ input }) => {
    const results = await getFundRunResultsByJobId(input.runJobId);
    return Promise.all(results.map(async (result) => {
      const fund = await getMutualFundById(result.fundId);
      return { ...result, fundName: fund?.name ?? "Unknown", fundHouse: fund?.fundHouse ?? "Unknown" };
    }));
  }),

  getAllocations: protectedProcedure.input(z.object({ runJobId: z.number() })).query(async ({ input }) => {
    const allocs = await getFundAllocationsByRunJob(input.runJobId);
    const byFund = new Map<number, { sector: FundAllocation[]; asset: FundAllocation[]; marketCap: FundAllocation[] }>();
    for (const allocation of allocs) {
      if (!byFund.has(allocation.fundId)) byFund.set(allocation.fundId, { sector: [], asset: [], marketCap: [] });
      const entry = byFund.get(allocation.fundId)!;
      if (allocation.allocationType === "sector") entry.sector.push(allocation);
      else if (allocation.allocationType === "market_cap") entry.marketCap.push(allocation);
      else entry.asset.push(allocation);
    }
    return Promise.all(Array.from(byFund.entries()).map(async ([fundId, allocation]) => {
      const fund = await getMutualFundById(fundId);
      const toPreview = (items: FundAllocation[]) => items.map((item) => ({ label: item.label, percentage: item.percentage }));
      return {
        fundId,
        fundName: fund?.name ?? "Unknown",
        fundHouse: fund?.fundHouse ?? "Unknown",
        sectorAllocations: toPreview(allocation.sector),
        assetAllocations: toPreview(allocation.asset),
        marketCapAllocations: toPreview(allocation.marketCap),
      };
    }));
  }),

  getExcelUrl: protectedProcedure.input(z.object({ runJobId: z.number() })).query(async ({ input }) => {
    const job = await getRunJobById(input.runJobId);
    if (!job?.excelFileKey) return { url: null };
    return { url: (await storageGet(job.excelFileKey)).url };
  }),

  getPdfUrl: protectedProcedure.input(z.object({ fundRunResultId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { url: null };
    const result = (await db.select().from(fundRunResults).where(eq(fundRunResults.id, input.fundRunResultId)).limit(1))[0];
    if (!result?.pdfFileKey) return { url: null };
    return { url: (await storageGet(result.pdfFileKey)).url };
  }),

  uploadManualPdf: protectedProcedure
    .input(z.object({ runJobId: z.number(), fundId: z.number(), pdfBase64: z.string(), fileName: z.string().optional() }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.pdfBase64, "base64");
      if (buffer.length < 1000 || buffer.subarray(0, 4).toString() !== "%PDF") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid PDF file" });
      }

      const priorResults = await getFundRunResultsByJobId(input.runJobId);
      let existing = priorResults.find((result) => result.fundId === input.fundId);
      if (!existing) {
        const id = await createFundRunResult({ runJobId: input.runJobId, fundId: input.fundId, status: "parsing" });
        existing = {
          id,
          runJobId: input.runJobId,
          fundId: input.fundId,
          factsheetDocumentId: null,
          status: "parsing",
          pdfFileKey: null,
          pdfFileUrl: null,
          errorMessage: null,
          extractedAt: null,
          createdAt: new Date(),
        };
      }
      const result = existing;
      const pdfKey = `factsheets/${input.runJobId}/${input.fundId}_manual.pdf`;
      const { url: pdfFileUrl } = await storagePut(pdfKey, buffer, "application/pdf");
      await updateFundRunResult(result.id, { status: "parsing", pdfFileKey: pdfKey, pdfFileUrl });

      try {
        const parsed = await parseFactsheet(buffer);
        await insertFundAllocations([
          ...parsed.sectorAllocations.map((item) => ({ fundRunResultId: result.id, fundId: input.fundId, runJobId: input.runJobId, allocationType: "sector" as const, label: item.label, percentage: String(item.percentage) })),
          ...parsed.assetAllocations.map((item) => ({ fundRunResultId: result.id, fundId: input.fundId, runJobId: input.runJobId, allocationType: "asset" as const, label: item.label, percentage: String(item.percentage) })),
        ]);
        await updateFundRunResult(result.id, { status: "completed", extractedAt: new Date() });
        return { success: true, sectorCount: parsed.sectorAllocations.length, assetCount: parsed.assetAllocations.length };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await updateFundRunResult(result.id, { status: "failed", errorMessage: message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `PDF parsing failed: ${message}` });
      }
    }),

  getCronConfig: protectedProcedure.query(() => getCronConfig()),
  updateCronConfig: protectedProcedure.input(z.object({ isEnabled: z.number().optional(), cronExpression: z.string().optional() })).mutation(async ({ input }) => {
    await upsertCronConfig(input);
    return { success: true };
  }),
});
