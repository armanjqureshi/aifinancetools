import { createTRPCClient } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";
import type { AppRouter } from "./routers";
import { createTrpcTransportLinks, shouldBatchTrpcOperation } from "../client/src/lib/trpcTransport";

describe("tRPC transport selection", () => {
  it("keeps factsheet mutations independent instead of batching them into one gateway request", () => {
    expect(shouldBatchTrpcOperation("query")).toBe(true);
    expect(shouldBatchTrpcOperation("mutation")).toBe(false);
  });

  it("sends an individual factsheet mutation to its tRPC route and parses a JSON response", async () => {
    const requestUrls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      requestUrls.push(String(input));
      return new Response(JSON.stringify({
        result: {
          data: {
            json: {
              success: false,
              amcName: "Mock AMC",
              sourceUrl: "https://mock.example/factsheets",
              error: "The AMC website is temporarily unavailable. Try again later.",
            },
          },
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const client = createTRPCClient<AppRouter>({
      links: createTrpcTransportLinks({
        url: "https://example.test/api/trpc",
        headers: () => ({}),
        fetchImpl: fetchImpl as typeof globalThis.fetch,
      }),
    });

    const result = await client.factsheets.downloadLatest.mutate({ amcSlug: "mock-amc" });

    expect(requestUrls).toHaveLength(1);
    expect(requestUrls[0]).toContain("/api/trpc/factsheets.downloadLatest");
    expect(requestUrls[0]).not.toContain(",");
    expect(result).toMatchObject({ success: false, amcName: "Mock AMC" });
  });
});
