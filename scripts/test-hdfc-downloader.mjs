import { downloadFactsheet } from "../server/pdfDownloader.ts";

const result = await downloadFactsheet("HDFC");
console.log(JSON.stringify({
  success: result.success,
  bytes: result.buffer?.length ?? 0,
  sourceUrl: result.url ?? null,
  error: result.error ?? null,
}));
