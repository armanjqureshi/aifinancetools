import { describe, expect, it, vi } from "vitest";
import { refreshDownloadedFactsheetSelector } from "../client/src/lib/factsheetSelectorRefresh";

describe("downloaded factsheet selector refresh", () => {
  it("invalidates both recent documents and AMC selector data", async () => {
    const invalidateRecent = vi.fn().mockResolvedValue(undefined);
    const invalidateAmcs = vi.fn().mockResolvedValue(undefined);

    await refreshDownloadedFactsheetSelector({ invalidateRecent, invalidateAmcs });

    expect(invalidateRecent).toHaveBeenCalledOnce();
    expect(invalidateAmcs).toHaveBeenCalledOnce();
  });
});
