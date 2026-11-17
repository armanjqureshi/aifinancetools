export type CachedFactsheetSource = {
  name: string;
  slug: string;
  latestDocument?: {
    id: number;
    asOfLabel?: string | null;
    fileUrl?: string | null;
  } | null;
};

/** Returns only AMC sources with a ready-to-open stored factsheet, alphabetically. */
export function getCachedFactsheetSources<T extends CachedFactsheetSource>(sources: T[]): T[] {
  return sources
    .filter((source) => Boolean(source.latestDocument?.id && source.latestDocument.fileUrl))
    .sort((left, right) => left.name.localeCompare(right.name));
}
