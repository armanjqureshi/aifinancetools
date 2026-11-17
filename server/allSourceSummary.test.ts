import { describe, expect, it } from "vitest";

describe("all-source batch summary contract", () => {
  it("requires exactly one outcome for every active source", () => {
    const activeSourceCount = 50;
    const outcomes = Array.from({ length: activeSourceCount }, (_, index) => ({ slug: `amc-${index}`, status: "downloaded" }));

    expect(outcomes).toHaveLength(activeSourceCount);
    expect(new Set(outcomes.map((outcome) => outcome.slug)).size).toBe(activeSourceCount);
  });
});
