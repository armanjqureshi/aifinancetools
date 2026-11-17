import { describe, expect, it } from "vitest";
import { extractDspFeedCandidates, extractFranklinFeedCandidates, extractLatestDspFeedCandidates, extractLatestHdfcFeedCandidates, extractLatestMiraeFeedCandidates, extractLatestNipponFeedCandidates, extractMiraeFeedCandidates, extractSundaramArchiveCandidate } from "./officialPublicFeeds";

describe("Mirae official public feed adapter", () => {
  it("selects only the requested month and prioritizes the active fund factsheet", () => {
    const candidates = extractMiraeFeedCandidates({
      d: {
        Data: [
          { Title: "August 2026 - Active Fund Factsheet", URL: "/docs/august.pdf" },
          { Title: "July 2026 - Passive Fund Factsheet", URL: "/docs/july-passive.pdf" },
          { Title: "July 2026 - Active Fund Factsheet", URL: "/docs/july-active.pdf" },
        ],
      },
    }, { year: 2026, month: 6, label: "July 2026" });

    expect(candidates).toEqual([
      { label: "July 2026 - Active Fund Factsheet", url: "https://www.miraeassetmf.co.in/docs/july-active.pdf" },
      { label: "July 2026 - Passive Fund Factsheet", url: "https://www.miraeassetmf.co.in/docs/july-passive.pdf" },
    ]);
  });
});

describe("DSP official public download feed adapter", () => {
  it("selects the exact requested factsheet record and ignores other periods", () => {
    const candidates = extractDspFeedCandidates({
      data: [
        { title: "Factsheet July 2026", pdf_url: "https://www.dspim.com/downloads/dsp-factsheet-july-2026.pdf", is_file: true },
        { title: "Factsheet June 2026 - 16 Jul 2026", pdf_url: "https://www.dspim.com/downloads/dsp-factsheet-june-2026.pdf", is_file: true },
      ],
    }, { year: 2026, month: 5, label: "June 2026" });

    expect(candidates).toEqual([
      { label: "Factsheet June 2026 - 16 Jul 2026", url: "https://www.dspim.com/downloads/dsp-factsheet-june-2026.pdf" },
    ]);
  });

  it("orders latest-mode candidates by the feed's stated reporting period", () => {
    const candidates = extractLatestDspFeedCandidates({
      data: [
        { title: "Factsheet May 2026", pdf_url: "https://www.dspim.com/downloads/may.pdf", is_file: true },
        { title: "Factsheet June 2026", pdf_url: "https://www.dspim.com/downloads/june.pdf", is_file: true },
      ],
    });
    expect(candidates.map((candidate) => candidate.label)).toEqual(["Factsheet June 2026", "Factsheet May 2026"]);
  });
});

describe("Mirae official public feed latest adapter", () => {
  it("orders the current factsheet candidates by stated reporting period", () => {
    const candidates = extractLatestMiraeFeedCandidates({
      d: {
        Data: [
          { Title: "July 2026 - Active Fund Factsheet", URL: "/docs/july.pdf" },
          { Title: "August 2026 - Active Fund Factsheet", URL: "/docs/august.pdf" },
        ],
      },
    });
    expect(candidates.map((candidate) => candidate.label)).toEqual(["August 2026 - Active Fund Factsheet", "July 2026 - Active Fund Factsheet"]);
  });
});

describe("HDFC official latest document adapter", () => {
  it("checks the current and prior month publication folders without guessing opaque IDs", () => {
    const candidates = extractLatestHdfcFeedCandidates(new Date("2026-09-28T00:00:00Z"));
    expect(candidates.slice(0, 3).map((candidate) => candidate.url)).toEqual([
      "https://files.hdfcfund.com/s3fs-public/2026-10/HDFC%20MF%20Factsheet%20-%20September%202026.pdf",
      "https://files.hdfcfund.com/s3fs-public/2026-09/HDFC%20MF%20Factsheet%20-%20September%202026.pdf",
      "https://files.hdfcfund.com/s3fs-public/2026-09/HDFC%20MF%20Factsheet%20-%20August%202026.pdf",
    ]);
  });
});

describe("Nippon official HTML archive adapter", () => {
  it("keeps only factsheet PDFs and orders the newest archive period first", () => {
    const candidates = extractLatestNipponFeedCandidates(`
      <a href="/InvestorServices/FactSheetsDocuments/Nippon-FS-August-2026.pdf">Download</a>
      <a href="/InvestorServices/FactSheetsDocuments/Nippon-FS-September-2026.pdf">Download</a>
      <a href="/InvestorServices/FactsheetsDocuments/NIMF-MONTHLY-PORTFOLIO-31-Aug-26.xls">Download</a>
    `);
    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://mf.nipponindiaim.com/InvestorServices/FactSheetsDocuments/Nippon-FS-September-2026.pdf",
      "https://mf.nipponindiaim.com/InvestorServices/FactSheetsDocuments/Nippon-FS-August-2026.pdf",
    ]);
  });
});

describe("Franklin Templeton official public literature feed adapter", () => {
  it("walks the nested public feed and selects only the exact requested factsheet month", () => {
    const candidates = extractFranklinFeedCandidates({
      PageType: [{
        FirstDropDown: [{
          secondDropDown: [{
            dataRecords: {
              linkdata: [
                { dctermsTitle: "Factsheet as on July 31, 2026", dctermsType: "Factsheet", literatureHref: "/en-in/fund-factsheets/july-id/july.pdf" },
                { dctermsTitle: "Factsheet as on June 30, 2026", dctermsType: "Factsheet", literatureHref: "/en-in/fund-factsheets/june-id/june.pdf" },
                { dctermsTitle: "Fund factsheet brochure July 2026", dctermsType: "Brochure", literatureHref: "/en-in/fund-factsheets/brochure-id/brochure.pdf" },
              ],
            },
          }],
        }],
      }],
    }, { year: 2026, month: 6, label: "July 2026" });

    expect(candidates).toEqual([
      { label: "Factsheet as on July 31, 2026", url: "https://www.franklintempletonindia.com/download/en-in/fund-factsheets/july-id/july.pdf" },
    ]);
  });
});

describe("Sundaram official public archive adapter", () => {
  it("accepts only a quoted public PDF returned for the requested archive month", () => {
    expect(extractSundaramArchiveCandidate("'https://www.sundarammutual.com/uploaddir/consolidated_factsheet/Consolidated_Factsheet_7_2026_140726_121722.pdf'", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      {
        label: "Sundaram consolidated factsheet July 2026",
        url: "https://www.sundarammutual.com/uploaddir/consolidated_factsheet/Consolidated_Factsheet_7_2026_140726_121722.pdf",
      },
    ]);
    expect(extractSundaramArchiveCandidate("Not Available", { year: 2026, month: 6, label: "July 2026" })).toEqual([]);
  });
});
