import { describe, expect, it, vi } from "vitest";
import { FACTSHEET_REVALIDATION_INTERVAL_MS, isFactsheetStale, mergeBulkDownloadResults, runBulkDownload, splitBulkSourcesByCache } from "../client/src/lib/bulkDownload";

describe("runBulkDownload", () => {
  it("classifies cached sources by last verification time", () => {
    const now = Date.parse("2026-09-28T12:00:00Z");
    expect(isFactsheetStale({ latestDocument: { fileUrl: "/fresh.pdf" }, revalidation: { checkedAt: new Date(now - FACTSHEET_REVALIDATION_INTERVAL_MS + 1) } }, now)).toBe(false);
    expect(isFactsheetStale({ latestDocument: { fileUrl: "/stale.pdf" }, revalidation: { checkedAt: new Date(now - FACTSHEET_REVALIDATION_INTERVAL_MS - 1) } }, now)).toBe(true);
    expect(isFactsheetStale({ latestDocument: null, revalidation: null }, now)).toBe(false);
  });

  it("limits active requests and reports both successful and failed AMC downloads", async () => {
    let active = 0;
    let maximumActive = 0;
    const updates = vi.fn();
    const download = vi.fn(async ({ slug }: { slug: string }) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (slug === "failed-amc") throw new Error("Source unavailable");
      return { id: slug };
    });

    const results = await runBulkDownload(
      [
        { slug: "hdfc", amcName: "HDFC Mutual Fund" },
        { slug: "failed-amc", amcName: "Failed AMC" },
        { slug: "uti", amcName: "UTI Mutual Fund" },
      ],
      download,
      updates,
      2,
    );

    expect(maximumActive).toBeLessThanOrEqual(2);
    expect(results).toEqual([
      expect.objectContaining({ slug: "hdfc", status: "success", document: { id: "hdfc" } }),
      expect.objectContaining({ slug: "failed-amc", status: "failed", error: "Source unavailable", failureKind: "no_pdf" }),
      expect.objectContaining({ slug: "uti", status: "success", document: { id: "uti" } }),
    ]);
    expect(updates).toHaveBeenCalled();
  });

  it("reuses only verified cached documents and sends stale or missing AMC sources to the remediation queue", () => {
    const { cached, pending } = splitBulkSourcesByCache([
      { slug: "hdfc", amcName: "HDFC Mutual Fund", cachedDocument: { id: 1 } },
      // The API flags a stale document as needing remediation and exposes no
      // verified cache, so Download All refetches it.
      { slug: "sbi", amcName: "SBI Mutual Fund", cachedDocument: null },
    ]);

    expect(cached).toEqual([expect.objectContaining({ slug: "hdfc", status: "success", document: { id: 1 } })]);
    expect(pending).toEqual([{ slug: "sbi", amcName: "SBI Mutual Fund" }]);
    expect(mergeBulkDownloadResults(cached, [{ slug: "sbi", amcName: "SBI Mutual Fund", status: "queued" }])).toEqual([
      expect.objectContaining({ slug: "hdfc", status: "success", document: { id: 1 } }),
      expect.objectContaining({ slug: "sbi", status: "queued" }),
    ]);
  });

  it("preserves a stale reporting-period rejection message in the bulk result", async () => {
    const results = await runBulkDownload(
      [{ slug: "hdfc", amcName: "HDFC Mutual Fund" }],
      async () => { throw new Error("The downloaded PDF is for June 2026, not a current factsheet. The downloader accepts July 2026 or newer."); },
      () => undefined,
      1,
    );
    expect(results[0]).toMatchObject({
      status: "failed",
      error: expect.stringContaining("June 2026"),
      failureKind: "no_pdf",
    });
  });
});
