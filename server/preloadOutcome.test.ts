import { describe, expect, it } from "vitest";
import { listAmcSourcesWithLatestDocuments } from "./db";

describe("AMC preload outcome source metadata", () => {
  it("returns cached-document and latest-outcome fields for every registered source", async () => {
    const sources = await listAmcSourcesWithLatestDocuments();
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source).toHaveProperty("latestDocument");
      expect(source).toHaveProperty("latestOutcome");
    }

    const hdfc = sources.find((source) => source.amcSlug === "hdfc");
    expect(hdfc?.latestDocument?.asOfLabel).toMatch(/^[A-Za-z]+ 20\d{2}$/);
    expect(hdfc?.latestOutcome).toMatchObject({ status: "parsed" });
  });
});
