import { downloadFromRegistry } from "../server/registryDownloader.ts";
import { downloadFactsheet } from "../server/pdfDownloader.ts";
import { parseFactsheet } from "../server/pdfParser.ts";
import { extractFactsheetPeriod, isFreshFactsheetPeriod, minimumAcceptedFactsheetPeriod } from "../server/factsheetPeriod.ts";

async function inspect(label, operation) {
  const result = await operation();
  if (!result?.success || !result.buffer) return { label, success: false, error: result?.error ?? "No PDF" };
  const parsed = await parseFactsheet(result.buffer);
  const period = extractFactsheetPeriod(parsed.rawText, result.resolvedUrl ?? result.url ?? "");
  return { label, success: true, resolvedUrl: result.resolvedUrl ?? result.url, period: period?.label ?? null, fresh: period ? isFreshFactsheetPeriod(period) : false };
}

const output = {
  minimumAcceptedPeriod: minimumAcceptedFactsheetPeriod().label,
  abakkus: await inspect("Abakkus", () => downloadFromRegistry("abakkus")),
  adityaBirlaRegistry: await inspect("Aditya Birla registry", () => downloadFromRegistry("aditya-birla")),
  adityaBirlaFallback: await inspect("Aditya Birla fallback", () => downloadFactsheet("Aditya Birla", { skipRegistry: true })),
  hdfcFallback: await inspect("HDFC fallback", () => downloadFactsheet("HDFC", { skipRegistry: true })),
};
console.log(JSON.stringify(output, null, 2));
