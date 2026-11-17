import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { createChatContext, getDb } from "../db";
import { factsheetDocuments, fundAllocations, fundRunResults, mutualFunds, runJobs } from "../../drizzle/schema";

const SYSTEM_PROMPT = `You are a precise and knowledgeable mutual fund analyst assistant.
You answer questions strictly based on the factsheet content provided.
When the factsheet data is available, cite specific numbers and percentages.
If the data needed to answer is not present in the provided factsheets, say so clearly.
Do not invent or estimate numbers. Cite every factsheet-based statement inline as [Factsheet: Fund Name]. Format allocation tables as clean markdown tables when helpful.`;

/** Retrieve structured allocation records for a fund run result to enrich the chatbot context. */
async function getAllocationSummary(db: Awaited<ReturnType<typeof import("../db").getDb>>, fundRunResultId: number): Promise<string> {
  if (!db) return "";
  const allocs = await db
    .select({ label: fundAllocations.label, percentage: fundAllocations.percentage, allocationType: fundAllocations.allocationType })
    .from(fundAllocations)
    .where(eq(fundAllocations.fundRunResultId, fundRunResultId));

  if (!allocs.length) return "";

  const sector = allocs.filter((a) => a.allocationType === "sector");
  const asset = allocs.filter((a) => a.allocationType === "asset");
  const marketCap = allocs.filter((a) => a.allocationType === "market_cap");

  const formatTable = (label: string, rows: typeof allocs) =>
    rows.length
      ? `**${label}**\n| Category | % |\n|---|---|\n${rows.map((r) => `| ${r.label} | ${r.percentage ?? "—"} |`).join("\n")}`
      : "";

  return [formatTable("Sector Allocation", sector), formatTable("Asset Allocation", asset), formatTable("Market Cap Allocation", marketCap)].filter(Boolean).join("\n\n");
}

/** Retrieve the most recent extracted factsheet text for a set of fund IDs. */
async function getFactsheetTexts(fundIds?: number[]): Promise<{ fundName: string; amcName: string; text: string }[]> {
  const db = await getDb();
  if (!db) return [];

  // Get the latest completed run job
  const latestRun = await db.select().from(runJobs).where(eq(runJobs.status, "completed")).orderBy(desc(runJobs.startedAt)).limit(1);
  if (!latestRun[0]) return [];

  const runJobId = latestRun[0].id;

  // Get fund run results for the latest run, optionally filtered by fund IDs
  const resultsQuery = db
    .select({
      id: fundRunResults.id,
      fundId: fundRunResults.fundId,
      pdfFileUrl: fundRunResults.pdfFileUrl,
      factsheetDocumentId: fundRunResults.factsheetDocumentId,
    })
    .from(fundRunResults)
    .where(and(eq(fundRunResults.runJobId, runJobId), eq(fundRunResults.status, "completed")));

  const results = await resultsQuery;
  const filtered = fundIds?.length ? results.filter((result) => fundIds.includes(result.fundId)) : results;

  const texts: { fundName: string; amcName: string; text: string }[] = [];

  for (const result of filtered.slice(0, 10)) {
    const fund = await db.select().from(mutualFunds).where(eq(mutualFunds.id, result.fundId)).limit(1);
    if (!fund[0]) continue;

    const allocationSummary = await getAllocationSummary(db, result.id);

    // Prefer factsheet_documents extracted text if linked, and always append
    // the structured allocation records parsed from that same run.
    if (result.factsheetDocumentId) {
      const doc = await db.select({ extractedText: factsheetDocuments.extractedText }).from(factsheetDocuments).where(eq(factsheetDocuments.id, result.factsheetDocumentId)).limit(1);
      if (doc[0]?.extractedText) {
        const contextText = `${doc[0].extractedText.substring(0, 40_000)}${allocationSummary ? `\n\n--- Parsed allocation records ---\n${allocationSummary}` : ""}`;
        texts.push({ fundName: fund[0].name, amcName: fund[0].fundHouse, text: contextText });
        continue;
      }
    }

    // Fallback: build context from structured allocation records
    const contextText = allocationSummary
      ? `[Factsheet text not available — structured allocation data follows]\n\n${allocationSummary}`
      : `[No factsheet data available for ${fund[0].name}]`;
    texts.push({ fundName: fund[0].name, amcName: fund[0].fundHouse, text: contextText });
  }

  return texts;
}

export const chatRouter = router({
  ask: protectedProcedure
    .input(z.object({
      question: z.string().min(3).max(2000),
      fundIds: z.array(z.number()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const factsheets = await getFactsheetTexts(input.fundIds);

      if (factsheets.length === 0) {
        return {
          answer: "No factsheet data is available yet. Please run the pipeline first to download and process factsheets.",
          sourceFunds: [],
        };
      }

      const contextBlock = factsheets
        .map((fs) => `=== ${fs.fundName} (${fs.amcName}) ===\n${fs.text}`)
        .join("\n\n---\n\n");

      const userMessage = `Based on the following mutual fund factsheets, please answer this question:\n\n${input.question}\n\n---\nFACTSHEET DATA:\n${contextBlock}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        const answer = (response.choices?.[0]?.message?.content as string) ?? "No response generated.";
        const sourceFunds = factsheets.map((fs) => ({ name: fs.fundName, amc: fs.amcName }));
        await createChatContext({
          userId: ctx.user.id,
          fundIds: JSON.stringify(input.fundIds ?? []),
          question: input.question,
          answer,
          sourceSnapshot: JSON.stringify(sourceFunds),
        });
        return {
          answer,
          sourceFunds,
        };
      } catch (err: unknown) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Chat failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }),

  getAvailableFunds: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const latestRun = await db.select().from(runJobs).where(eq(runJobs.status, "completed")).orderBy(desc(runJobs.startedAt)).limit(1);
    if (!latestRun[0]) return [];
    const results = await db
      .select({ fundId: fundRunResults.fundId })
      .from(fundRunResults)
      .where(and(eq(fundRunResults.runJobId, latestRun[0].id), eq(fundRunResults.status, "completed")));
    return Promise.all(results.map(async (result) => {
      const fund = await db.select({ id: mutualFunds.id, name: mutualFunds.name, fundHouse: mutualFunds.fundHouse }).from(mutualFunds).where(eq(mutualFunds.id, result.fundId)).limit(1);
      return fund[0] ?? null;
    })).then((list) => list.filter(Boolean));
  }),
});
