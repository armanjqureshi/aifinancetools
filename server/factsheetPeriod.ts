const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export type FactsheetPeriod = { year: number; month: number; label: string };
export type RequestedFactsheetPeriod = FactsheetPeriod;

export function matchesRequestedPeriod(period: FactsheetPeriod, requested: RequestedFactsheetPeriod) {
  return period.year === requested.year && period.month === requested.month;
}

function fromMatch(monthName: string, yearText: string): FactsheetPeriod | null {
  const month = MONTHS.findIndex((value) => value.startsWith(monthName.toLowerCase().slice(0, 3)));
  const year = Number(yearText);
  if (month < 0 || year < 2020 || year > 2100) return null;
  return { year, month, label: `${MONTHS[month][0].toUpperCase()}${MONTHS[month].slice(1)} ${year}` };
}

export function extractFactsheetPeriod(text: string, sourceUrl = ""): FactsheetPeriod | null {
  const monthAlternation = MONTHS.flatMap((month) => [month, month.slice(0, 3)]).join("|");
  const frontMatter = text.slice(0, 8_000);
  const frontMatterPattern = new RegExp(`(?:^|\\n)\\s*(${monthAlternation})\\s*(?:\\n|\\s)+(20\\d{2})\\b`, "im");
  const frontMatterMatch = frontMatterPattern.exec(frontMatter);
  if (frontMatterMatch?.[1] && frontMatterMatch?.[2]) return fromMatch(frontMatterMatch[1], frontMatterMatch[2]);

  const sources = [text.slice(0, 40_000), decodeURIComponent(sourceUrl.replace(/%20/gi, " "))];
  const patterns = [
    new RegExp(`(?:factsheet|fact[ -]?sheet|portfolio as on|as on|for the month of)[\\s\\S]{0,100}?(${monthAlternation})(?:\\s+\\d{1,2},?)?[\\s,_-]+(20\\d{2})`, "i"),
    new RegExp(`(${monthAlternation})(?:\\s+\\d{1,2},?)?[\\s,_-]+(20\\d{2})\\b`, "i"),
  ];
  for (const source of sources) {
    for (const pattern of patterns) {
      const match = pattern.exec(source);
      if (match?.[1] && match?.[2]) return fromMatch(match[1], match[2]);
    }
  }
  return null;
}

/** Factsheets are monthly. On any day, accept the current or immediately preceding month only. */
export function minimumAcceptedFactsheetPeriod(reference = new Date()): FactsheetPeriod {
  const date = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return { year: date.getFullYear(), month: date.getMonth(), label: `${MONTHS[date.getMonth()][0].toUpperCase()}${MONTHS[date.getMonth()].slice(1)} ${date.getFullYear()}` };
}

export function isFreshFactsheetPeriod(period: FactsheetPeriod, reference = new Date()) {
  const minimum = minimumAcceptedFactsheetPeriod(reference);
  const periodValue = period.year * 12 + period.month;
  const minimumValue = minimum.year * 12 + minimum.month;
  const maximumValue = reference.getFullYear() * 12 + reference.getMonth();
  return periodValue >= minimumValue && periodValue <= maximumValue;
}

export function sourcePeriodScore(url: string) {
  const period = extractFactsheetPeriod("", url);
  return period ? period.year * 12 + period.month : 0;
}
