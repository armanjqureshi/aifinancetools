import { describe, expect, it } from "vitest";
import { SourceDownloadDeadlineError, withSourceDownloadDeadline } from "./downloadDeadline";

describe("withSourceDownloadDeadline", () => {
  it("returns a deadline error before a stalled source can reach the gateway timeout", async () => {
    await expect(withSourceDownloadDeadline(
      () => new Promise<never>(() => undefined),
      5
    )).rejects.toBeInstanceOf(SourceDownloadDeadlineError);
  });

  it("returns a completed download result before its deadline", async () => {
    await expect(withSourceDownloadDeadline(async () => "downloaded", 50)).resolves.toBe("downloaded");
  });
});
