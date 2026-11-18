import { describe, expect, it } from "vitest";
import { normalizeSchemeName, reportingPeriodSortValue } from "./db";
import { REGISTERED_AMC_SOURCES } from "./amcRegistrySeed";
import { appRouter } from "./routers";

describe("AMC registry seed", () => {
  it("contains all 50 user-provided AMC source records with normalized URLs", () => {
    expect(REGISTERED_AMC_SOURCES).toHaveLength(50);
    expect(REGISTERED_AMC_SOURCES.every((entry) => entry.sourceUrl.startsWith("http"))).toBe(true);
    expect(new Set(REGISTERED_AMC_SOURCES.map((entry) => entry.slug)).size).toBe(50);
  });

  it("registers direct-PDF sources correctly", () => {
    const directSources = REGISTERED_AMC_SOURCES.filter((entry) => entry.sourceKind === "direct_pdf");
    expect(directSources.map((entry) => entry.slug)).toEqual(["old-bridge"]);
  });

  it("uses Zerodha's live official archive instead of an obsolete fixed PDF", () => {
    expect(REGISTERED_AMC_SOURCES.find((entry) => entry.slug === "zerodha")).toMatchObject({
      sourceUrl: "https://www.zerodhafundhouse.com/resources/fund-documents",
      sourceKind: "page",
      discoveryMode: "dynamic",
    });
  });
});

describe("normalizeSchemeName", () => {
  it("removes plan and option qualifiers while retaining searchable scheme terms", () => {
    expect(normalizeSchemeName("HDFC Flexi Cap Fund - Direct Growth")).toBe("hdfc flexi cap fund");
    expect(normalizeSchemeName("SBI Small Cap Fund (Regular IDCW Option)")).toBe("sbi small cap fund");
  });
});

describe("reportingPeriodSortValue", () => {
  it("orders cached documents by their stated reporting period", () => {
    expect(reportingPeriodSortValue("August 2026")).toBeGreaterThan(reportingPeriodSortValue("July 2026"));
    expect(reportingPeriodSortValue("July 2026")).toBeGreaterThan(reportingPeriodSortValue("February 2026"));
    expect(reportingPeriodSortValue("unverified period")).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("API surface", () => {
  it("exposes only the sign-in, system and factsheet sections", () => {
    const sections = new Set(Object.keys(appRouter._def.procedures).map((name) => name.split(".")[0]));
    expect([...sections].sort()).toEqual(["auth", "factsheets", "system"]);
  });

  it("does not expose the retired run, fund, AMC-admin or chat sections", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    for (const retired of ["amcs.", "funds.", "runs.", "chat."]) {
      expect(procedures.some((name) => name.startsWith(retired))).toBe(false);
    }
  });
});
