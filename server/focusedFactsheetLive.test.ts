import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ invokeLLM: vi.fn() }));

vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));

import { appRouter } from "./routers";

const now = new Date();
const ctx = {
  user: {
    id: 1,
    openId: "live-factsheet-verification",
    name: "Live Factsheet Verification",
    email: "verification@example.com",
    loginMethod: "test",
    role: "admin" as const,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  },
  req: { protocol: "https", headers: {} },
  res: {},
};

// This is intentionally opt-in because it downloads a live multi-megabyte PDF
// and writes the real document metadata to the configured storage/database.
describe.runIf(process.env.RUN_LIVE_FACTSHEET_TESTS === "true")("live focused factsheet flow", () => {
  beforeEach(() => {
    mocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "The factsheet was downloaded successfully. [Factsheet: HDFC Mutual Fund]" } }],
    });
  });

  it("downloads, parses, stores, and answers against the current HDFC factsheet", async () => {
    const caller = appRouter.createCaller(ctx as never);
    const document = await caller.factsheets.downloadLatest({ amcSlug: "hdfc" });

    expect(document.id).toBeGreaterThan(0);
    expect(document.fileUrl).toContain("/manus-storage/factsheets/direct/hdfc/");
    expect(document.textLength).toBeGreaterThan(100_000);

    const answer = await caller.factsheets.ask({
      documentId: document.id,
      question: "Was this factsheet downloaded successfully?",
    });

    expect(answer.source.documentId).toBe(document.id);
    expect(answer.source.fileUrl).toBe(document.fileUrl);
    expect(answer.answer).toContain("[Factsheet: HDFC Mutual Fund]");
    expect(mocks.invokeLLM).toHaveBeenCalledTimes(1);
  }, 240_000);
});
