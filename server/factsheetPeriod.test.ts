import { describe, expect, it } from "vitest";
import { extractFactsheetPeriod, isFreshFactsheetPeriod, minimumAcceptedFactsheetPeriod, sourcePeriodScore } from "./factsheetPeriod";

describe("factsheet reporting periods", () => {
  it("extracts the actual reporting month from a PDF header or filename", () => {
    expect(extractFactsheetPeriod("Monthly Fact Sheet\nAs on July 31, 2026")?.label).toBe("July 2026");
    expect(extractFactsheetPeriod("", "https://example.com/absl-factsheet_aug-2026.pdf")?.label).toBe("August 2026");
  });

  it("prioritizes a standalone front-matter period over an unrelated later date mention", () => {
    const whiteOakLikeText = "MF Reg No. - MF/074/18/02\nJULY\n2026\n\fIndex\nHow to read factsheet: registration closes in September 2026.";
    expect(extractFactsheetPeriod(whiteOakLikeText)?.label).toBe("July 2026");
  });

  it("rejects older reporting periods instead of relabelling them with the download month", () => {
    const reference = new Date("2026-08-13T00:00:00.000Z");
    expect(minimumAcceptedFactsheetPeriod(reference).label).toBe("July 2026");
    expect(isFreshFactsheetPeriod({ year: 2024, month: 10, label: "November 2024" }, reference)).toBe(false);
    expect(isFreshFactsheetPeriod({ year: 2026, month: 6, label: "July 2026" }, reference)).toBe(true);
    expect(isFreshFactsheetPeriod({ year: 2028, month: 3, label: "April 2028" }, reference)).toBe(false);
    expect(sourcePeriodScore("https://example.com/factsheet_August_2026.pdf")).toBeGreaterThan(sourcePeriodScore("https://example.com/factsheet_November_2024.pdf"));
  });
});
