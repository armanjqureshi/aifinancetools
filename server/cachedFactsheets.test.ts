import { describe, expect, it } from "vitest";
import { getCachedFactsheetSources } from "../client/src/lib/cachedFactsheets";

describe("getCachedFactsheetSources", () => {
  it("returns only ready cached documents in AMC name order", () => {
    const sources = getCachedFactsheetSources([
      { name: "Zeta Mutual Fund", slug: "zeta", latestDocument: { id: 2, fileUrl: "/zeta.pdf", asOfLabel: "July 2026" } },
      { name: "Alpha Mutual Fund", slug: "alpha", latestDocument: { id: 1, fileUrl: "/alpha.pdf", asOfLabel: "August 2026" } },
      { name: "Missing Mutual Fund", slug: "missing", latestDocument: null },
    ]);

    expect(sources.map((source) => source.slug)).toEqual(["alpha", "zeta"]);
  });
});
