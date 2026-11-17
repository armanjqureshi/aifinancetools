import { downloadFromRegistry } from "../server/registryDownloader.ts";
import { downloadFactsheet } from "../server/pdfDownloader.ts";
import { parseFactsheet } from "../server/pdfParser.ts";

const amcSlug = "hdfc";
let result = await downloadFromRegistry(amcSlug);
if (!result?.success || !result.buffer) {
  const fallback = await downloadFactsheet("HDFC");
  result = {
    success: fallback.success,
    buffer: fallback.buffer,
    resolvedUrl: fallback.url,
    error: fallback.error,
  };
}

if (!result.success || !result.buffer) {
  throw new Error(result.error ?? "HDFC factsheet download failed");
}

const parsed = await parseFactsheet(result.buffer);
console.log(JSON.stringify({
  amcSlug,
  downloaded: true,
  bytes: result.buffer.length,
  sourceUrl: result.resolvedUrl ?? null,
  extractedCharacters: parsed.rawText.length,
  sectorEntries: parsed.sectorAllocations.length,
  assetEntries: parsed.assetAllocations.length,
  marketCapEntries: parsed.marketCapAllocations.length,
}));
