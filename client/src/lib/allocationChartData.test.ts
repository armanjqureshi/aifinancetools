import { describe, expect, it } from "vitest";
import { toAllocationChartRows } from "./allocationChartData";

describe("toAllocationChartRows", () => {
  it("keeps valid allocation values, sorts them descending, and applies the display limit", () => {
    const rows = toAllocationChartRows([
      { label: "Mid Cap", percentage: 21.5 },
      { label: "Large Cap", percentage: 55 },
      { label: "Invalid", percentage: 125 },
      { label: "Cash", percentage: 4.2 },
      { label: "", percentage: 2 },
    ], 2);

    expect(rows).toEqual([
      { label: "Large Cap", percentage: 55, index: 0 },
      { label: "Mid Cap", percentage: 21.5, index: 1 },
    ]);
  });
});
