import { PDFParse } from "pdf-parse";
import { ENV } from "./_core/env";

export type PdfTextPage = { num: number; text: string };

type CachedPages = { expiresAt: number; promise: Promise<PdfTextPage[]> };

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHED_DOCUMENTS = 12;
const pageCache = new Map<string, CachedPages>();

export function isReadablePdfUrl(url: string | null | undefined) {
  if (!url) return false;
  if (url.startsWith("https://")) return true;
  if (!ENV.localMode) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function stableCacheKey(value: string) {
  try {
    const parsed = new URL(value);
    // Signed URLs rotate their query parameters even when they reference the
    // same immutable stored PDF. Cache by object path, not by the token.
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return value;
  }
}

function setCache(key: string, promise: Promise<PdfTextPage[]>) {
  pageCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  while (pageCache.size > MAX_CACHED_DOCUMENTS) pageCache.delete(pageCache.keys().next().value!);
}

/** Seed the page cache with pages already extracted during the download/upload parse. */
export function primeCachedPdfTextPages(cacheKey: string, pages: PdfTextPage[]) {
  setCache(stableCacheKey(cacheKey), Promise.resolve(pages));
}

export async function getCachedPdfTextPages(pdfUrl: string, cacheKey = pdfUrl): Promise<PdfTextPage[]> {
  const key = stableCacheKey(cacheKey);
  const cached = pageCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = (async () => {
    const response = await fetch(pdfUrl);
    if (!response.ok) throw new Error(`PDF request failed with ${response.status}`);
    const parser = new PDFParse({ data: new Uint8Array(await response.arrayBuffer()) });
    try {
      const text = await parser.getText();
      return text.pages.map((page) => ({ num: page.num, text: page.text }));
    } finally {
      await parser.destroy();
    }
  })().catch((error) => {
    pageCache.delete(key);
    throw error;
  });

  setCache(key, promise);
  return promise;
}
