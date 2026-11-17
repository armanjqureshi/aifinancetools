import { describe, expect, it } from "vitest";
import { extractFactsheetCandidates, isRetryableSourceError } from "./registryDownloader";

describe("registry downloader retries", () => {
  it("retries transient gateway and network failures but not intentional access denials", () => {
    expect(isRetryableSourceError({ isAxiosError: true, response: { status: 502 } })).toBe(true);
    expect(isRetryableSourceError(Object.assign(new Error("blocked"), { isAxiosError: true, response: { status: 403 } }))).toBe(false);
    expect(isRetryableSourceError(Object.assign(new Error("reset"), { isAxiosError: true, code: "ECONNRESET" }))).toBe(true);
  });

  it("ranks all discovered factsheet candidates by the newest reporting period", () => {
    const candidates = extractFactsheetCandidates(`
      <a href="/factsheet/AMC_Factsheet_June_2026.pdf">Factsheet</a>
      <a href="/factsheet/AMC_Factsheet_August_2026.pdf">Factsheet</a>
      <a href="/forms/application.pdf">Application form</a>
    `, "https://example.com/factsheets");
    expect(candidates).toEqual([
      "https://example.com/factsheet/AMC_Factsheet_August_2026.pdf",
      "https://example.com/factsheet/AMC_Factsheet_June_2026.pdf",
    ]);
  });

  it("uses visible archive-card dates when the PDF URL is opaque", () => {
    const candidates = extractFactsheetCandidates(`
      <a href="/download?id=old.pdf">Factsheet July 2026</a>
      <a href="/download?id=new.pdf">Factsheet August 2026</a>
    `, "https://example.com/factsheets");
    expect(candidates[0]).toBe("https://example.com/download?id=new.pdf");
  });
});
