import { describe, expect, it, vi } from "vitest";
import { runBulkDownload } from "./bulkDownload";

describe("runBulkDownload", () => {
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
      expect.objectContaining({ slug: "failed-amc", status: "failed", error: "Source unavailable" }),
      expect.objectContaining({ slug: "uti", status: "success", document: { id: "uti" } }),
    ]);
    expect(updates).toHaveBeenCalled();
  });
});
