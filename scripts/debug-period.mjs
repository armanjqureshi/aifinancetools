import { extractFactsheetPeriod } from "../server/factsheetPeriod.ts";
const value = "https://example.com/absl-factsheet_August_2026.pdf";
console.log(JSON.stringify({ value, period: extractFactsheetPeriod("", value) }));
