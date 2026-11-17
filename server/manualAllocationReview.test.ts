import { describe, expect, it } from "vitest";
import { parseManualAllocations } from "../client/src/lib/manualAllocationReview";

describe("manual allocation review input", () => {
  it("parses reviewer corrections in line-based label and percentage form", () => {
    expect(parseManualAllocations("Large Cap: 44.79\nMid Cap: 19.13\nSmall Cap: 29.20")).toEqual([
      { label: "Large Cap", percentage: 44.79 },
      { label: "Mid Cap", percentage: 19.13 },
      { label: "Small Cap", percentage: 29.2 },
    ]);
  });

  it("rejects malformed or out-of-range reviewer corrections", () => {
    expect(() => parseManualAllocations("Large Cap 44.79")).toThrow("Use");
    expect(() => parseManualAllocations("Large Cap: 101")).toThrow("Invalid");
  });
});
