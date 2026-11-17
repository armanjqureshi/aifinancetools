/**
 * Run Pipeline Service
 *
 * Orchestrates the full download → parse → excel → DB pipeline
 * for all active mutual funds in a single run job.
 */

import { storagePut } from "./storage";
import {
  createFundRunResult,
  createFactsheetDocument,
  createRunJob,
  getFundRunResultsByJobId,
  insertFundAllocations,
  listAmcSources,
  listMutualFunds,
  updateFundRunResult,
  updateRunJob,
} from "./db";
import { downloadFactsheet } from "./pdfDownloader";
import { parseFactsheet } from "./pdfParser";
import { generateExcel } from "./excelGenerator";
import type { FundHouse } from "./fundHouseDetector";

export async function runPipeline(triggeredBy: "manual" | "cron" = "manual"): Promise<number> {
  const funds = await listMutualFunds();
  if (funds.length === 0) {
    throw new Error("No active funds in the list. Please add funds first.");
  }

  // Create the run job record
  const runJobId = await createRunJob({
    triggeredBy,
    status: "running",
    totalFunds: funds.length,
    successCount: 0,
    failedCount: 0,
    startedAt: new Date(),
  });

  let successCount = 0;
  let failedCount = 0;

  // Process each fund
  for (const fund of funds) {
    const resultId = await createFundRunResult({
      runJobId,
      fundId: fund.id,
      status: "downloading",
    });

    try {
      // Step 1: Download the factsheet
      await updateFundRunResult(resultId, { status: "downloading" });
      const downloadResult = await downloadFactsheet(fund.fundHouse as FundHouse);

      if (!downloadResult.success || !downloadResult.buffer) {
        throw new Error(downloadResult.error ?? "Download failed");
      }

      // Step 2: Upload PDF to S3
      const pdfKey = `factsheets/${runJobId}/${fund.id}_${fund.fundHouse.replace(/\s+/g, "_")}.pdf`;
      const { url: pdfUrl } = await storagePut(pdfKey, downloadResult.buffer, "application/pdf");

      await updateFundRunResult(resultId, {
        status: "parsing",
        pdfFileKey: pdfKey,
        pdfFileUrl: pdfUrl,
      });

      // Step 3: Parse the PDF
      const parsed = await parseFactsheet(downloadResult.buffer);

      // Step 3a: Persist the complete source document for grounded chat and
      // link the run result to it when the fund is mapped to an AMC registry entry.
      let factsheetDocumentId: number | undefined;
      if (fund.amcId) {
        const source = (await listAmcSources()).find((item) => item.amcId === fund.amcId);
        factsheetDocumentId = await createFactsheetDocument({
          amcId: fund.amcId,
          sourceId: source?.id ?? null,
          schemeId: fund.schemeCatalogId ?? null,
          documentScope: source?.documentScope === "scheme" ? "scheme" : "amc",
          sourceUrl: source?.sourceUrl ?? downloadResult.url ?? "",
          resolvedPdfUrl: downloadResult.url ?? null,
          asOfLabel: new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
          fileKey: pdfKey,
          fileUrl: pdfUrl,
          extractedText: parsed.rawText,
          status: "parsed",
          downloadedAt: new Date(),
        });
      }

      // Step 4: Store allocations in DB
      const allocations = [
        ...parsed.sectorAllocations.map((a) => ({
          fundRunResultId: resultId,
          fundId: fund.id,
          runJobId,
          factsheetDocumentId: factsheetDocumentId ?? null,
          allocationType: "sector" as const,
          label: a.label,
          percentage: String(a.percentage),
        })),
        ...parsed.assetAllocations.map((a) => ({
          fundRunResultId: resultId,
          fundId: fund.id,
          runJobId,
          factsheetDocumentId: factsheetDocumentId ?? null,
          allocationType: "asset" as const,
          label: a.label,
          percentage: String(a.percentage),
        })),
        ...parsed.marketCapAllocations.map((a) => ({
          fundRunResultId: resultId,
          fundId: fund.id,
          runJobId,
          factsheetDocumentId: factsheetDocumentId ?? null,
          allocationType: "market_cap" as const,
          label: a.label,
          percentage: String(a.percentage),
        })),
      ];

      if (allocations.length > 0) {
        await insertFundAllocations(allocations);
      }

      await updateFundRunResult(resultId, {
        status: "completed",
        extractedAt: new Date(),
        factsheetDocumentId: factsheetDocumentId ?? null,
      });

      successCount++;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await updateFundRunResult(resultId, {
        status: "failed",
        errorMessage,
      });
      failedCount++;
    }
  }

  // Step 5: Generate Excel report
  let excelUrl: string | undefined;
  let excelKey: string | undefined;

  try {
    const results = await getFundRunResultsByJobId(runJobId);
    const { getFundAllocationsByFundAndRun } = await import("./db");
    const { getMutualFundById } = await import("./db");

    const fundDataList = await Promise.all(
      results
        .filter((r) => r.status === "completed")
        .map(async (r) => {
          const fund = await getMutualFundById(r.fundId);
          const allocs = await getFundAllocationsByFundAndRun(r.fundId, runJobId);
          return {
            fundName: fund?.name ?? `Fund ${r.fundId}`,
            fundHouse: fund?.fundHouse ?? "Unknown",
            sectorAllocations: allocs
              .filter((a) => a.allocationType === "sector")
              .map((a) => ({ label: a.label, percentage: parseFloat(String(a.percentage ?? 0)) })),
            assetAllocations: allocs
              .filter((a) => a.allocationType === "asset")
              .map((a) => ({ label: a.label, percentage: parseFloat(String(a.percentage ?? 0)) })),
            marketCapAllocations: allocs
              .filter((a) => a.allocationType === "market_cap")
              .map((a) => ({ label: a.label, percentage: parseFloat(String(a.percentage ?? 0)) })),
          };
        })
    );

    const excelBuffer = await generateExcel(fundDataList, new Date());
    excelKey = `reports/${runJobId}/MF_Factsheet_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const uploaded = await storagePut(
      excelKey,
      excelBuffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    excelUrl = uploaded.url;
  } catch (err) {
    console.error("[Pipeline] Excel generation failed:", err);
  }

  // Update run job as completed
  await updateRunJob(runJobId, {
    status: failedCount === funds.length ? "failed" : "completed",
    successCount,
    failedCount,
    completedAt: new Date(),
    excelFileKey: excelKey,
    excelFileUrl: excelUrl,
  });

  return runJobId;
}
