import { appRouter } from "../server/routers.ts";

const now = new Date();
const ctx = {
  user: {
    id: 1,
    openId: "focused-flow-verification",
    name: "Focused Flow Verification",
    email: "verification@example.com",
    loginMethod: "test",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  },
  req: { protocol: "https", headers: {} },
  res: {},
};

const caller = appRouter.createCaller(ctx);
const downloaded = await caller.factsheets.downloadLatest({ amcSlug: "hdfc" });
if (!downloaded.fileUrl || !downloaded.id) throw new Error("Download did not create a stored factsheet document");

const response = await caller.factsheets.ask({
  documentId: downloaded.id,
  question: "What is the title or purpose of this factsheet?",
});
if (!response.answer || response.source.documentId !== downloaded.id) {
  throw new Error("Factsheet question-answering did not return a grounded document response");
}

console.log(JSON.stringify({
  documentId: downloaded.id,
  amcName: downloaded.amcName,
  storedPdfUrl: downloaded.fileUrl,
  extractedCharacters: downloaded.textLength,
  answerPreview: response.answer.slice(0, 240),
}));
