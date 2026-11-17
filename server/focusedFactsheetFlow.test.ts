import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createChatContext: vi.fn(),
  createFactsheetDocument: vi.fn(),
  getAmcBySlug: vi.fn(),
  getFactsheetDocumentForPeriod: vi.fn(),
  getFactsheetDocumentWithAmc: vi.fn(),
  listAmcSources: vi.fn(),
  listAmcSourcesWithLatestDocuments: vi.fn(),
  listLowConfidenceVisualAllocationEvidence: vi.fn(),
  listRecentFactsheetDocuments: vi.fn(),
  saveVisualAllocationReview: vi.fn(),
  downloadFromRegistry: vi.fn(),
  downloadFactsheet: vi.fn(),
  extractSchemeAllocations: vi.fn(),
  extractSchemeNames: vi.fn(),
  parseFactsheet: vi.fn(),
  resolveVisualMarketCapAllocation: vi.fn(),
  resolveSchemePageAllocation: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  storagePut: vi.fn(),
  invokeLLM: vi.fn(),
  axiosGet: vi.fn(),
}));

vi.mock("./db", () => ({
  createChatContext: mocks.createChatContext,
  createFactsheetDocument: mocks.createFactsheetDocument,
  getAmcBySlug: mocks.getAmcBySlug,
  getFactsheetDocumentForPeriod: mocks.getFactsheetDocumentForPeriod,
  getFactsheetDocumentWithAmc: mocks.getFactsheetDocumentWithAmc,
  listAmcSources: mocks.listAmcSources,
  listAmcSourcesWithLatestDocuments: mocks.listAmcSourcesWithLatestDocuments,
  listLowConfidenceVisualAllocationEvidence: mocks.listLowConfidenceVisualAllocationEvidence,
  listRecentFactsheetDocuments: mocks.listRecentFactsheetDocuments,
  reportingPeriodSortValue: (label: string | null | undefined) => label ? new Date(`1 ${label}`).getTime() : Number.NEGATIVE_INFINITY,
  saveVisualAllocationReview: mocks.saveVisualAllocationReview,
}));
vi.mock("./registryDownloader", () => ({ downloadFromRegistry: mocks.downloadFromRegistry }));
vi.mock("./pdfDownloader", () => ({ downloadFactsheet: mocks.downloadFactsheet }));
vi.mock("./pdfParser", () => ({
  parseFactsheet: mocks.parseFactsheet,
  extractSchemeNames: mocks.extractSchemeNames,
  extractSchemeAllocations: mocks.extractSchemeAllocations,
}));
vi.mock("./storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl, storagePut: mocks.storagePut }));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM, isLLMConfigured: () => process.env.DISABLE_AI !== "true" }));
vi.mock("./visualMarketCapExtractor", () => ({ resolveVisualMarketCapAllocation: mocks.resolveVisualMarketCapAllocation }));
vi.mock("./schemePageAllocationReader", () => ({ resolveSchemePageAllocation: mocks.resolveSchemePageAllocation }));
vi.mock("axios", () => ({ default: { get: mocks.axiosGet } }));

import { factsheetsRouter } from "./routers/factsheets";

const now = new Date("2026-08-11T00:00:00.000Z");
const ctx = {
  user: {
    id: 1,
    openId: "test-user",
    name: "Test User",
    email: "test@example.com",
    loginMethod: "test",
    role: "admin" as const,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  },
  req: { protocol: "https", headers: {} },
  res: {},
};

describe("focused factsheet download-to-answer flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAmcBySlug.mockResolvedValue({ id: 10, name: "HDFC Mutual Fund", slug: "hdfc" });
    mocks.listAmcSources.mockResolvedValue([{
      id: 20,
      amcId: 10,
      amcName: "HDFC Mutual Fund",
      amcSlug: "hdfc",
      sourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets",
      sourceKind: "page",
      documentScope: "amc",
      discoveryMode: "html",
      isActive: 1,
    }]);
    mocks.listAmcSourcesWithLatestDocuments.mockResolvedValue([]);
    mocks.listLowConfidenceVisualAllocationEvidence.mockResolvedValue([]);
    mocks.resolveVisualMarketCapAllocation.mockResolvedValue(undefined);
    mocks.resolveSchemePageAllocation.mockResolvedValue({
      allocations: [],
      sourcePage: null,
      evidence: "No page-verified selected-scheme table is available.",
      confidence: 0,
      failureClass: "no_table_on_page",
    });
    mocks.getFactsheetDocumentForPeriod.mockResolvedValue(undefined);
    mocks.downloadFromRegistry.mockResolvedValue({
      success: true,
      buffer: Buffer.from("%PDF-1.7 HDFC factsheet"),
      resolvedUrl: "https://files.hdfcfund.com/factsheet.pdf",
    });
    mocks.parseFactsheet.mockResolvedValue({
      rawText: "HDFC Mutual Fund Factsheet — July 2026. Investment objective: long-term capital appreciation.",
      sectorAllocations: [],
      assetAllocations: [],
      marketCapAllocations: [],
    });
    mocks.extractSchemeNames.mockReturnValue(["HDFC Flexi Cap Fund"]);
    mocks.extractSchemeAllocations.mockReturnValue({
      industryAllocations: [{ label: "Financial Services", percentage: 31.5 }],
      marketCapAllocations: [{ label: "Large Cap", percentage: 68.2 }],
      assetAllocations: [{ label: "Equity", percentage: 95.4 }],
    });
    mocks.storageGetSignedUrl.mockResolvedValue("https://signed-storage.example/factsheets/hdfc.pdf");
    mocks.storagePut.mockResolvedValue({ key: "factsheets/hdfc.pdf", url: "/files/factsheets/hdfc.pdf" });
    mocks.axiosGet.mockResolvedValue({ data: Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(1200)]) });
    mocks.createFactsheetDocument.mockResolvedValue(101);
    mocks.getFactsheetDocumentWithAmc.mockResolvedValue({
      id: 101,
      amcName: "HDFC Mutual Fund",
      asOfLabel: "July 2026",
      fileKey: "factsheets/hdfc.pdf",
      fileUrl: "/files/factsheets/hdfc.pdf",
      resolvedPdfUrl: "https://files.hdfcfund.com/factsheet.pdf",
      extractedText: "HDFC Mutual Fund Factsheet — July 2026. Investment objective: long-term capital appreciation.",
      status: "parsed",
    });
    mocks.invokeLLM.mockResolvedValue({
      choices: [{ message: { content: "The objective is long-term capital appreciation. [Factsheet: HDFC Mutual Fund]" } }],
    });
  });

  it("downloads HDFC, stores the PDF and text, then returns a grounded answer from that document", async () => {
    const caller = factsheetsRouter.createCaller(ctx as never);

    const document = await caller.downloadLatest({ amcSlug: "hdfc" });
    if (!document.success) throw new Error(document.error);
    expect(document).toMatchObject({ id: 101, amcName: "HDFC Mutual Fund", fileUrl: "/files/factsheets/hdfc.pdf" });
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringContaining("factsheets/direct/hdfc/"), expect.any(Buffer), "application/pdf");
    expect(mocks.createFactsheetDocument).toHaveBeenCalledWith(expect.objectContaining({
      amcId: 10,
      sourceId: 20,
      extractedText: expect.stringContaining("Investment objective"),
      fileUrl: "/files/factsheets/hdfc.pdf",
    }));

    const answer = await caller.ask({ documentId: document.id, question: "What is the investment objective?" });
    expect(answer.answer).toContain("[Factsheet: HDFC Mutual Fund]");
    expect(answer.source).toMatchObject({ documentId: 101, name: "HDFC Mutual Fund" });
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("Investment objective") })]),
    }));
    expect(mocks.createChatContext).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      question: "What is the investment objective?",
    }));
  });

  it("returns schemes and allocations only from the selected downloaded factsheet", async () => {
    const caller = factsheetsRouter.createCaller(ctx as never);
    const schemes = await caller.documentSchemes({ documentId: 101 });
    expect(schemes).toEqual({ documentId: 101, amcName: "HDFC Mutual Fund", schemes: ["HDFC Flexi Cap Fund"] });

    const allocations = await caller.schemeAllocations({ documentId: 101, schemeName: "HDFC Flexi Cap Fund" });
    expect(allocations).toMatchObject({
      documentId: 101,
      amcName: "HDFC Mutual Fund",
      schemeName: "HDFC Flexi Cap Fund",
      industryAllocations: [],
      portfolioHoldings: [],
      marketCapAllocations: [],
      marketCapEvidence: expect.objectContaining({ method: "not_found", confidence: 0 }),
    });
    expect(mocks.extractSchemeAllocations).toHaveBeenCalledWith(expect.any(String), "HDFC Flexi Cap Fund", ["HDFC Flexi Cap Fund"]);
  });

  it("uses only page-verified visual market-cap values for a selected scheme", async () => {
    mocks.resolveVisualMarketCapAllocation.mockResolvedValueOnce({
      allocations: [{ label: "Large Cap", percentage: 44.79 }, { label: "Small Cap", percentage: 29.2 }],
      evidence: { method: "vision", confidence: 95, sourcePage: 9, evidence: "Exact scheme heading and chart share page 9." },
    });
    const caller = factsheetsRouter.createCaller(ctx as never);
    await expect(caller.schemeAllocations({ documentId: 101, schemeName: "HDFC Flexi Cap Fund" })).resolves.toMatchObject({
      marketCapAllocations: [{ label: "Large Cap", percentage: 44.79 }, { label: "Small Cap", percentage: 29.2 }],
      marketCapEvidence: { method: "vision", sourcePage: 9 },
    });
    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("factsheets/hdfc.pdf");
    expect(mocks.resolveVisualMarketCapAllocation).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 101,
      schemeName: "HDFC Flexi Cap Fund",
      pdfUrl: "https://signed-storage.example/factsheets/hdfc.pdf",
    }));
    expect(mocks.resolveSchemePageAllocation).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 101,
      schemeName: "HDFC Flexi Cap Fund",
      pdfUrl: "https://signed-storage.example/factsheets/hdfc.pdf",
    }));
  });

  it("grounds a scheme-specific chat question in the selected scheme context", async () => {
    const caller = factsheetsRouter.createCaller(ctx as never);
    await caller.ask({ documentId: 101, schemeName: "HDFC Flexi Cap Fund", question: "What is the industry allocation?" });
    expect(mocks.invokeLLM).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("Selected scheme: HDFC Flexi Cap Fund") }),
      ]),
    }));
  });

  it("returns a verified cached document without initiating network discovery", async () => {
    mocks.listAmcSourcesWithLatestDocuments.mockResolvedValueOnce([{
      id: 20, amcId: 10, amcName: "HDFC Mutual Fund", amcSlug: "hdfc",
      sourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets", sourceKind: "page", documentScope: "amc", discoveryMode: "html", isActive: 1,
      latestDocument: { id: 77, asOfLabel: "July 2026", fileUrl: "/files/factsheets/hdfc-current.pdf", downloadedAt: now },
      latestOutcome: { status: "parsed", createdAt: new Date() },
    }]);
    const caller = factsheetsRouter.createCaller(ctx as never);
    const document = await caller.downloadLatest({ amcSlug: "hdfc" });
    expect(document).toMatchObject({ success: true, id: 77, asOfLabel: "July 2026" });
    expect(mocks.downloadFromRegistry).not.toHaveBeenCalled();
  });

  it("revalidates an old latest cache instead of silently returning last month's PDF", async () => {
    mocks.listAmcSourcesWithLatestDocuments.mockResolvedValueOnce([{
      id: 20, amcId: 10, amcName: "HDFC Mutual Fund", amcSlug: "hdfc",
      sourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets", sourceKind: "page", documentScope: "amc", discoveryMode: "html", isActive: 1,
      latestDocument: { id: 77, asOfLabel: "July 2026", fileUrl: "/files/factsheets/hdfc-current.pdf", downloadedAt: new Date("2026-08-11T00:00:00.000Z") },
      latestOutcome: { status: "parsed", createdAt: new Date("2026-08-11T00:00:00.000Z") },
    }]);
    const caller = factsheetsRouter.createCaller(ctx as never);
    await caller.downloadLatest({ amcSlug: "hdfc" });
    expect(mocks.downloadFromRegistry).toHaveBeenCalledWith("hdfc", undefined);
  });

  it("supports a manual force-refresh while retaining the cache when the verified period is unchanged", async () => {
    mocks.listAmcSourcesWithLatestDocuments.mockResolvedValueOnce([{
      id: 20, amcId: 10, amcName: "HDFC Mutual Fund", amcSlug: "hdfc",
      sourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets", sourceKind: "page", documentScope: "amc", discoveryMode: "html", isActive: 1,
      latestDocument: { id: 77, asOfLabel: "July 2026", fileUrl: "/files/factsheets/hdfc-current.pdf", downloadedAt: now },
    }]);
    const caller = factsheetsRouter.createCaller(ctx as never);
    const document = await caller.downloadLatest({ amcSlug: "hdfc", forceRefresh: true });
    expect(document).toMatchObject({ success: true, id: 77, revalidationStatus: "unchanged" });
    expect(mocks.downloadFromRegistry).toHaveBeenCalledWith("hdfc", undefined);
    expect(mocks.createFactsheetDocument).not.toHaveBeenCalled();
  });

  it("stores a newly discovered official period during force refresh", async () => {
    mocks.listAmcSourcesWithLatestDocuments.mockResolvedValueOnce([{
      id: 20, amcId: 10, amcName: "HDFC Mutual Fund", amcSlug: "hdfc",
      sourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets", sourceKind: "page", documentScope: "amc", discoveryMode: "html", isActive: 1,
      latestDocument: { id: 77, asOfLabel: "July 2026", fileUrl: "/files/factsheets/hdfc-current.pdf", downloadedAt: now },
    }]);
    mocks.parseFactsheet.mockResolvedValueOnce({ rawText: "HDFC Mutual Fund Factsheet — August 2026.", sectorAllocations: [], assetAllocations: [], marketCapAllocations: [] });
    const caller = factsheetsRouter.createCaller(ctx as never);
    const document = await caller.downloadLatest({ amcSlug: "hdfc", forceRefresh: true });
    expect(document).toMatchObject({ success: true, asOfLabel: "August 2026", revalidationStatus: "refreshed" });
    expect(mocks.createFactsheetDocument).toHaveBeenCalledWith(expect.objectContaining({ asOfLabel: "August 2026" }));
  });

  it("rejects a future-dated force-refresh candidate and retains the last valid cache", async () => {
    mocks.listAmcSourcesWithLatestDocuments.mockResolvedValueOnce([{
      id: 20, amcId: 10, amcName: "HDFC Mutual Fund", amcSlug: "hdfc",
      sourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets", sourceKind: "page", documentScope: "amc", discoveryMode: "html", isActive: 1,
      latestDocument: { id: 77, asOfLabel: "July 2026", fileUrl: "/files/factsheets/hdfc-current.pdf", downloadedAt: now },
    }]);
    mocks.parseFactsheet.mockResolvedValueOnce({ rawText: "HDFC Mutual Fund Factsheet — April 2028.", sectorAllocations: [], assetAllocations: [], marketCapAllocations: [] });
    const caller = factsheetsRouter.createCaller(ctx as never);
    const document = await caller.downloadLatest({ amcSlug: "hdfc", forceRefresh: true });
    expect(document).toMatchObject({ success: true, id: 77, revalidationStatus: "candidate_rejected" });
    expect(mocks.createFactsheetDocument).not.toHaveBeenCalled();
  });

  it("reuses only an exact selected-period cache entry and passes the requested month to registry discovery", async () => {
    mocks.getFactsheetDocumentForPeriod.mockResolvedValueOnce({ id: 78, asOfLabel: "July 2026", fileUrl: "/files/factsheets/hdfc-july.pdf" });
    const caller = factsheetsRouter.createCaller(ctx as never);
    const cached = await caller.downloadLatest({ amcSlug: "hdfc", requestedPeriod: { year: 2026, month: 6 } });
    expect(cached).toMatchObject({ success: true, id: 78, asOfLabel: "July 2026" });
    expect(mocks.getFactsheetDocumentForPeriod).toHaveBeenCalledWith(10, 20, "July 2026");
    expect(mocks.downloadFromRegistry).not.toHaveBeenCalled();

    mocks.getFactsheetDocumentForPeriod.mockResolvedValueOnce(undefined);
    const fresh = await caller.downloadLatest({ amcSlug: "hdfc", requestedPeriod: { year: 2026, month: 6 } });
    expect(fresh).toMatchObject({ success: true, asOfLabel: "July 2026" });
    expect(mocks.downloadFromRegistry).toHaveBeenLastCalledWith("hdfc", { year: 2026, month: 6, label: "July 2026" });
  });

  it("rejects a PDF whose verified reporting month differs from the selected month", async () => {
    mocks.parseFactsheet.mockResolvedValue({ rawText: "HDFC Mutual Fund Factsheet — June 2026.", sectorAllocations: [], assetAllocations: [], marketCapAllocations: [] });
    const caller = factsheetsRouter.createCaller(ctx as never);
    const outcome = await caller.downloadLatest({ amcSlug: "hdfc", requestedPeriod: { year: 2026, month: 6 } });
    expect(outcome).toMatchObject({ success: false, error: expect.stringContaining("selected July 2026") });
    expect(mocks.createFactsheetDocument).not.toHaveBeenCalled();
  });

  it("stores the newest available verified PDF under its actual reporting month when no historical period is requested", async () => {
    mocks.parseFactsheet.mockResolvedValue({
      rawText: "HDFC Mutual Fund Factsheet — June 2026. Investment objective: long-term capital appreciation.",
      sectorAllocations: [], assetAllocations: [], marketCapAllocations: [],
    });
    const caller = factsheetsRouter.createCaller(ctx as never);
    const outcome = await caller.downloadLatest({ amcSlug: "hdfc" });
    expect(outcome).toMatchObject({ success: true, asOfLabel: "June 2026" });
    expect(mocks.createFactsheetDocument).toHaveBeenCalledWith(expect.objectContaining({ asOfLabel: "June 2026" }));
  });

  it("validates a user-provided official PDF link against the selected reporting month", async () => {
    const caller = factsheetsRouter.createCaller(ctx as never);
    const outcome = await caller.downloadFromSourceLink({ amcSlug: "hdfc", url: "https://files.hdfcfund.com/hdfc-july-2026.pdf", requestedPeriod: { year: 2026, month: 6 } });
    expect(outcome).toMatchObject({ success: true, asOfLabel: "July 2026" });
    expect(mocks.axiosGet).toHaveBeenCalledWith("https://files.hdfcfund.com/hdfc-july-2026.pdf", expect.objectContaining({ responseType: "arraybuffer" }));
  });

  it("rejects private direct-link destinations before making any request", async () => {
    const caller = factsheetsRouter.createCaller(ctx as never);
    await expect(caller.downloadFromSourceLink({ amcSlug: "hdfc", url: "http://127.0.0.1/private.pdf", requestedPeriod: { year: 2026, month: 6 } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.axiosGet).not.toHaveBeenCalled();
  });

  it("validates and stores a user-uploaded official PDF only for the selected reporting month", async () => {
    const caller = factsheetsRouter.createCaller(ctx as never);
    const pdfBase64 = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(1_200)]).toString("base64");
    const outcome = await caller.uploadOfficialPdf({
      amcSlug: "hdfc",
      fileName: "HDFC-MF-Factsheet-July-2026.pdf",
      pdfBase64,
      requestedPeriod: { year: 2026, month: 6 },
      confirmedOfficialSource: true,
      originalSourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets",
    });
    expect(outcome).toMatchObject({ success: true, asOfLabel: "July 2026", id: 101 });
    expect(mocks.storagePut).toHaveBeenCalledWith(expect.stringContaining("factsheets/uploaded/hdfc/July-2026_"), expect.any(Buffer), "application/pdf");
    expect(mocks.createFactsheetDocument).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets",
      asOfLabel: "July 2026",
    }));
  });

  it("rejects a user-uploaded official PDF when its parsed month does not match the selected period", async () => {
    mocks.parseFactsheet.mockResolvedValueOnce({ rawText: "HDFC Mutual Fund Factsheet — June 2026.", sectorAllocations: [], assetAllocations: [], marketCapAllocations: [] });
    const caller = factsheetsRouter.createCaller(ctx as never);
    const pdfBase64 = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(1_200)]).toString("base64");
    const outcome = await caller.uploadOfficialPdf({
      amcSlug: "hdfc",
      fileName: "HDFC-MF-Factsheet.pdf",
      pdfBase64,
      requestedPeriod: { year: 2026, month: 6 },
      confirmedOfficialSource: true,
    });
    expect(outcome).toMatchObject({ success: false, error: expect.stringContaining("June 2026, not the selected July 2026") });
    expect(mocks.createFactsheetDocument).not.toHaveBeenCalled();
  });

  it("does not fall through to an Unknown legacy adapter when a registered source cannot expose a PDF", async () => {
    mocks.getAmcBySlug.mockResolvedValue({ id: 30, name: "360 ONE Asset", slug: "360-one-asset" });
    mocks.listAmcSources.mockResolvedValue([{
      id: 40,
      amcId: 30,
      amcName: "360 ONE Asset",
      amcSlug: "360-one-asset",
      sourceUrl: "https://www.360.one/asset/mutual-funds/downloads/",
      sourceKind: "page",
      documentScope: "unknown",
      discoveryMode: "dynamic",
      isActive: 1,
    }]);
    mocks.downloadFromRegistry.mockResolvedValue({ success: false, error: "No factsheet PDF link found on the registered source." });
    const caller = factsheetsRouter.createCaller(ctx as never);

    await expect(caller.downloadLatest({ amcSlug: "360-one-asset" })).resolves.toEqual(expect.objectContaining({
      success: false,
      amcName: "360 ONE Asset",
      error: "The AMC page did not expose a downloadable factsheet PDF.",
    }));
    expect(mocks.downloadFactsheet).not.toHaveBeenCalled();
  });

  it.each([
    ["bandhan", "Bandhan Mutual Fund"],
    ["axis", "Axis Mutual Fund"],
    ["aditya-birla", "Aditya Birla Sun Life Mutual Fund"],
  ])("reports a registered-source failure for %s rather than legacy bot-protection text", async (slug, name) => {
    mocks.getAmcBySlug.mockResolvedValue({ id: 50, name, slug });
    mocks.listAmcSources.mockResolvedValue([{
      id: 60,
      amcId: 50,
      amcName: name,
      amcSlug: slug,
      sourceUrl: `https://${slug}.example/factsheets`,
      sourceKind: "page",
      documentScope: "unknown",
      discoveryMode: "dynamic",
      isActive: 1,
    }]);
    mocks.downloadFromRegistry.mockResolvedValue({ success: false, error: "No factsheet PDF link found on the registered source." });
    mocks.downloadFactsheet.mockResolvedValue({ success: false, error: "Legacy adapter blocked" });
    const caller = factsheetsRouter.createCaller(ctx as never);

    await expect(caller.downloadLatest({ amcSlug: slug })).resolves.toEqual(expect.objectContaining({
      success: false,
      amcName: name,
      error: "The AMC page did not expose a downloadable factsheet PDF.",
    }));
  });

  it.each([
    ["whiteoak-capital", "WhiteOak Capital Mutual Fund", "HTML scrape failed: Request failed with status code 403", "The AMC website declined automated access to its factsheet page. Try again later or use the AMC source page directly."],
    ["trust", "Trust Mutual Fund", "HTML scrape failed: Request failed with status code 406", "The AMC website declined automated access to its factsheet page. Try again later or use the AMC source page directly."],
    ["sbi", "SBI Mutual Fund", "HTML scrape failed: Request failed with status code 502", "The AMC website is temporarily unavailable. Try again later."],
    ["taurus", "Taurus Mutual Fund", "HTML scrape failed: Client network socket disconnected before secure TLS connection was established", "The AMC website could not be reached from the downloader. Try again later."],
  ])("returns a structured expected failure for %s source access problems", async (slug, name, sourceError, expectedError) => {
    mocks.getAmcBySlug.mockResolvedValue({ id: 70, name, slug });
    mocks.listAmcSources.mockResolvedValue([{
      id: 80,
      amcId: 70,
      amcName: name,
      amcSlug: slug,
      sourceUrl: `https://${slug}.example/factsheets`,
      sourceKind: "page",
      documentScope: "unknown",
      discoveryMode: "dynamic",
      isActive: 1,
    }]);
    mocks.downloadFromRegistry.mockResolvedValue({ success: false, error: sourceError });
    const caller = factsheetsRouter.createCaller(ctx as never);

    await expect(caller.downloadLatest({ amcSlug: slug })).resolves.toEqual(expect.objectContaining({
      success: false,
      amcName: name,
      error: expectedError,
    }));
  });

  it("returns a structured timeout outcome when a registered AMC source stalls", async () => {
    vi.useFakeTimers();
    mocks.downloadFromRegistry.mockImplementation(() => new Promise(() => undefined));
    const caller = factsheetsRouter.createCaller(ctx as never);
    const outcome = caller.downloadLatest({ amcSlug: "hdfc" });

    await vi.advanceTimersByTimeAsync(240_000);
    await expect(outcome).resolves.toEqual(expect.objectContaining({
      success: false,
      amcName: "HDFC Mutual Fund",
      error: "The AMC website could not be reached from the downloader. Try again later.",
    }));
    expect(mocks.downloadFactsheet).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("lists low-confidence visual allocations with parsed values for manual review", async () => {
    mocks.listLowConfidenceVisualAllocationEvidence.mockResolvedValue([{
      id: 71,
      documentId: 1080002,
      schemeName: "abakkus flexi cap fund",
      allocationType: "market_cap",
      allocationsJson: '[{"label":"Large Cap","percentage":44.79}]',
      evidence: "Visual chart on page 9.",
      sourcePage: 9,
      confidence: "85.00",
      reviewStatus: "unreviewed",
      reviewerNote: null,
      fileUrl: "https://example.com/abakkus.pdf",
      resolvedPdfUrl: null,
      amcName: "Abakkus Mutual Fund",
      asOfLabel: "July 2026",
    }]);
    const caller = factsheetsRouter.createCaller(ctx as never);
    await expect(caller.reviewQueue()).resolves.toEqual([expect.objectContaining({
      id: 71,
      confidence: 85,
      pdfUrl: "https://example.com/abakkus.pdf",
      allocations: [{ label: "Large Cap", percentage: 44.79 }],
    })]);
  });

  it("persists an administrator's corrected allocation review", async () => {
    const caller = factsheetsRouter.createCaller(ctx as never);
    await expect(caller.reviewAllocation({
      id: 71,
      reviewStatus: "corrected",
      reviewerNote: "Verified on page 9.",
      allocations: [{ label: "Large Cap", percentage: 44.79 }],
    })).resolves.toEqual({ success: true });
    expect(mocks.saveVisualAllocationReview).toHaveBeenCalledWith(expect.objectContaining({
      id: 71,
      reviewStatus: "corrected",
      reviewedBy: 1,
      allocationsJson: '[{"label":"Large Cap","percentage":44.79}]',
    }));
  });
});
