import { describe, expect, it } from "vitest";
import { failedRetryState, nextRetryDate, successfulRetryState } from "./retryProcessor";
import { isDailyRetryEligible } from "./retryPolicy";

describe("daily AMC retry backoff", () => {
  it("backs off from daily to a capped weekly retry interval", () => {
    const start = new Date("2026-08-12T00:00:00.000Z");
    expect(nextRetryDate(1, start).toISOString()).toBe("2026-08-13T00:00:00.000Z");
    expect(nextRetryDate(2, start).toISOString()).toBe("2026-08-14T00:00:00.000Z");
    expect(nextRetryDate(5, start).toISOString()).toBe("2026-08-19T00:00:00.000Z");
  });

  it("enrolls only sources classified as temporarily unavailable or timed out", () => {
    expect(isDailyRetryEligible("sbi")).toBe(true);
    expect(isDailyRetryEligible("quant")).toBe(true);
    expect(isDailyRetryEligible("hdfc")).toBe(false);
    expect(isDailyRetryEligible("kotak")).toBe(false);
  });

  it("disables a retry after recovery and advances retry state after another temporary failure", () => {
    const attemptedAt = new Date("2026-08-12T00:00:00.000Z");
    expect(successfulRetryState(attemptedAt)).toMatchObject({ isEnabled: 0, lastSuccessAt: attemptedAt, lastError: null });
    expect(failedRetryState(2, "Request failed with status code 502", attemptedAt)).toMatchObject({
      attemptCount: 3,
      status: "unavailable",
      isEnabled: 1,
      nextRetryAt: new Date("2026-08-16T00:00:00.000Z"),
    });
  });
});
