import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  seedAmcRegistry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => ({
  getAmcBySlug: vi.fn(),
  listAmcSources: vi.fn(),
  normalizeSchemeName: vi.fn((value: string) => value.toLowerCase()),
  searchAmcDirectory: vi.fn(),
  searchSchemeCatalog: vi.fn(),
  seedAmcRegistry: mocks.seedAmcRegistry,
  updateAmcSource: vi.fn(),
  upsertSchemeCatalogEntry: vi.fn(),
}));
vi.mock("./amcSourceDiscovery", () => ({ discoverAllAmcSchemes: vi.fn() }));

import { amcsRouter } from "./routers/amcs";

describe("AMC Registry seed mutation", () => {
  it("returns structured tRPC data for an authenticated caller instead of an HTML fallback", async () => {
    const now = new Date();
    const caller = amcsRouter.createCaller({
      user: {
        id: 1,
        openId: "amc-mutation-test-user",
        name: "AMC Mutation Test User",
        email: "test@example.com",
        loginMethod: "test",
        role: "admin",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      },
      req: { protocol: "https", headers: {} },
      res: {},
    } as never);

    await expect(caller.seedProvidedSources()).resolves.toEqual({ success: true, count: 50 });
    expect(mocks.seedAmcRegistry).toHaveBeenCalledTimes(1);
  });
});
