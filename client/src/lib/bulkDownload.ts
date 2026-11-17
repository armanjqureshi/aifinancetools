export type BulkDownloadSource = {
  slug: string;
  amcName: string;
};

export type BulkDownloadResult<TDocument> = BulkDownloadSource & {
  status: "queued" | "downloading" | "success" | "failed";
  document?: TDocument;
  error?: string;
  failureKind?: "blocked" | "unavailable" | "timed_out" | "no_pdf";
};

export const FACTSHEET_REVALIDATION_INTERVAL_MS = 12 * 60 * 60 * 1000;

export function isFactsheetStale(source: {
  latestDocument?: { fileUrl?: string | null } | null;
  revalidation?: { checkedAt?: Date | string | null } | null;
}, now = Date.now()) {
  if (!source.latestDocument?.fileUrl) return false;
  const checkedAt = source.revalidation?.checkedAt;
  if (!checkedAt) return true;
  const checkedAtMs = checkedAt instanceof Date ? checkedAt.getTime() : new Date(checkedAt).getTime();
  return !Number.isFinite(checkedAtMs) || now - checkedAtMs >= FACTSHEET_REVALIDATION_INTERVAL_MS;
}

export function splitBulkSourcesByCache<TDocument>(
  sources: Array<BulkDownloadSource & { cachedDocument?: TDocument | null }>,
) {
  const cached = sources
    .filter((source) => source.cachedDocument)
    .map((source) => ({ ...source, status: "success" as const, document: source.cachedDocument as TDocument }));
  const pending = sources
    .filter((source) => !source.cachedDocument)
    .map(({ cachedDocument: _cachedDocument, ...source }) => source);
  return { cached, pending };
}

export function mergeBulkDownloadResults<TDocument>(
  cached: BulkDownloadResult<TDocument>[],
  networkResults: BulkDownloadResult<TDocument>[],
) {
  return [...cached, ...networkResults];
}

export function classifyBulkFailure(error: string) {
  const message = error.toLowerCase();
  if (message.includes("declined automated access") || message.includes("403") || message.includes("406")) return "blocked" as const;
  if (message.includes("timed out") || message.includes("timeout") || message.includes("could not be reached")) return "timed_out" as const;
  if (message.includes("temporarily unavailable") || message.includes("502") || message.includes("503") || message.includes("504")) return "unavailable" as const;
  return "no_pdf" as const;
}

export async function runBulkDownload<TDocument>(
  sources: BulkDownloadSource[],
  download: (source: BulkDownloadSource) => Promise<TDocument>,
  onUpdate: (results: BulkDownloadResult<TDocument>[]) => void,
  concurrency = 4,
) {
  const results: BulkDownloadResult<TDocument>[] = sources.map((source) => ({ ...source, status: "queued" }));
  const publish = () => onUpdate([...results]);
  let cursor = 0;

  const worker = async () => {
    while (cursor < sources.length) {
      const index = cursor++;
      const source = sources[index];
      const result = results[index];
      if (!source || !result) return;

      result.status = "downloading";
      publish();
      try {
        result.document = await download(source);
        result.status = "success";
      } catch (error) {
        result.status = "failed";
        result.error = error instanceof Error ? error.message : "Download failed.";
        result.failureKind = classifyBulkFailure(result.error);
      }
      publish();
    }
  };

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), sources.length) }, worker));
  return results;
}
