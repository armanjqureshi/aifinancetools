import { describe, expect, it } from "vitest";
import { factsheetsRouter } from "./routers/factsheets";

const now = new Date("2026-08-13T00:00:00.000Z");
const ctx = {
  user: { id: 1, openId: "benchmark-owner", name: "Benchmark Owner", email: null, loginMethod: "test", role: "admin" as const, createdAt: now, updatedAt: now, lastSignedIn: now },
  req: { protocol: "https", headers: {} },
  res: {},
};

describe("factsheets.listAmcs API", () => {
  it("publishes the durable selected-period coverage summary", async () => {
    const coverage = await factsheetsRouter.createCaller(ctx as never).archiveCoverage();
    expect(coverage).toMatchObject({ auditedPeriod: "July 2026", totalSources: 50, verifiedCount: 43 });
    expect(coverage.verifiedSources).toContain("Axis");
    expect(coverage.verifiedSources).toContain("HDFC");
    expect(coverage.verifiedSources).toContain("Mahindra Manulife");
    expect(coverage.verifiedSources).toContain("JioBlackRock");
    expect(coverage.verifiedSources).toContain("Motilal Oswal");
    expect(coverage.verifiedSources).toContain("Union");
    expect(coverage.verifiedSources).toContain("Bank of India");
    expect(coverage.verifiedSources).toContain("Aditya Birla Sun Life");
    expect(coverage.verifiedSources).toContain("Kotak");
    expect(coverage.verifiedSources).toContain("Franklin Templeton");
    expect(coverage.verifiedSources).toContain("Sundaram");
    expect(coverage.verifiedSources).toContain("Bandhan");
    expect(coverage.verifiedSources).toContain("JM Financial");
    expect(coverage.verifiedSources).toContain("Baroda BNP Paribas");
    expect(coverage.verifiedSources).toContain("Edelweiss");
    expect(coverage.verifiedSources).toContain("WhiteOak");
    expect(coverage.verifiedSources).toContain("SBI");
    expect(coverage.verifiedSources).toContain("Choice");
    expect(coverage.verifiedSources).toContain("PGIM India");
    expect(coverage.verifiedSources).toContain("Taurus");
    expect(coverage.verifiedSources).toContain("Trust");
    expect(coverage.verifiedSources).toContain("The Wealth Company");
    expect(coverage.blockedReferenceSources).not.toContain("HDFC");
  });

  it("returns cached-document and retained preload outcome metadata", async () => {
    const sources = await factsheetsRouter.createCaller(ctx as never).listAmcs();
    const current = sources.find((source) => source.latestDocument?.fileUrl);
    const hdfc = sources.find((source) => source.slug === "hdfc");
    expect(current?.latestDocument?.fileUrl).toBeTruthy();
    expect(current?.revalidation.status).toMatch(/^(current|stale)$/);
    expect(hdfc?.latestDocument?.asOfLabel).toMatch(/^[A-Za-z]+ 20\d{2}$/);
    expect(hdfc?.latestOutcome).toMatchObject({ status: "parsed" });
    expect(hdfc?.revalidation.status).toMatch(/^(current|stale)$/);
  });
});
