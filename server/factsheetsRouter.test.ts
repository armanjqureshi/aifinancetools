import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

describe("focused factsheet router", () => {
  it("registers the AMC list, persisted outcome metadata, document download, recent document, and question procedures", () => {
    const procedures = appRouter._def.procedures;
    expect(procedures["factsheets.listAmcs"]).toBeDefined();
    expect(procedures["factsheets.recent"]).toBeDefined();
    expect(procedures["factsheets.downloadLatest"]).toBeDefined();
    expect(procedures["factsheets.ask"]).toBeDefined();
    expect(procedures["factsheets.listAmcs"]._def.type).toBe("query");
  });
});
