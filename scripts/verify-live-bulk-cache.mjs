import { splitBulkSourcesByCache } from "../client/src/lib/bulkDownload.ts";

const baseUrl = process.env.PREVIEW_URL;
const token = process.env.PREVIEW_AUTH_TOKEN;
if (!baseUrl || !token) throw new Error("PREVIEW_URL and PREVIEW_AUTH_TOKEN are required.");

const input = encodeURIComponent(JSON.stringify({ json: null, meta: { values: ["undefined"] } }));
const response = await fetch(`${baseUrl}/api/trpc/factsheets.listAmcs?batch=1&input=${input}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
});
const payload = await response.json();
const sources = payload?.[0]?.result?.data?.json;
if (!response.ok || !Array.isArray(sources)) throw new Error("The live listAmcs request did not return its JSON source list.");

const { cached, pending } = splitBulkSourcesByCache(
  sources.map((source) => ({
    slug: source.slug,
    amcName: source.name,
    cachedDocument: source.latestDocument?.fileUrl
      ? { id: source.latestDocument.id, fileUrl: source.latestDocument.fileUrl }
      : null,
  })),
);

if (cached.length + pending.length !== sources.length) throw new Error("Cached and pending source counts do not cover the live source list.");
console.log(JSON.stringify({ status: response.status, totalSources: sources.length, cachedSources: cached.length, pendingSources: pending.length }));
