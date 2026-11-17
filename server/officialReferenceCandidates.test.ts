import { describe, expect, it } from "vitest";
import { officialReferenceCandidates } from "./officialReferenceCandidates";

describe("user-supplied official factsheet references", () => {
  it("uses a supplied snapshot only for its exact verified reporting period", () => {
    expect(officialReferenceCandidates("hdfc", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("HDFC%20MF%20Factsheet%20-%20July%202026.pdf") }),
    ]);
    expect(officialReferenceCandidates("sbi", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("all-sbimf-schemes-factsheet-july-2026.pdf") }),
    ]);
    expect(officialReferenceCandidates("groww", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("Monthly%20Factsheet%20July%202026.pdf") }),
    ]);
    expect(officialReferenceCandidates("helios", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("helios-mutual-fund-factsheet-jul26.pdf") }),
    ]);
    expect(officialReferenceCandidates("invesco", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("invesco-mf-factsheet-july-2026.pdf?sfvrsn=25cb9fc2_2") }),
    ]);
    expect(officialReferenceCandidates("iti", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("1786700653-ITI_Factsheet-July.pdf") }),
    ]);
    expect(officialReferenceCandidates("lic", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("lic-mf-factsheet-31st-july-2026.pdf") }),
    ]);
    expect(officialReferenceCandidates("mahindra-manulife", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("ada39b25-9f6e-435f-bcc2-7ede65e51f80.pdf") }),
    ]);
    expect(officialReferenceCandidates("pgim-india", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("Factsheet%20-%20July%202026.pdf") }),
    ]);
    expect(officialReferenceCandidates("hsbc", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("the-asset-july-2026.pdf"), archivePeriodLabel: "August 2026" }),
    ]);
    expect(officialReferenceCandidates("hdfc", { year: 2026, month: 5, label: "June 2026" })).toEqual([]);
  });

  it("uses the observed Aditya Birla archive PDF only for its verified August 2026 period", () => {
    expect(officialReferenceCandidates("aditya-birla", { year: 2026, month: 7, label: "August 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("absl-factsheet_aug-2026.pdf"), downloadTimeoutMs: 60_000 }),
    ]);
    expect(officialReferenceCandidates("aditya-birla", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("absl-factsheet_july-2026.pdf"), downloadTimeoutMs: 60_000 }),
    ]);
    expect(officialReferenceCandidates("aditya-birla", { year: 2026, month: 5, label: "June 2026" })).toEqual([]);
  });

  it("uses the PDF-verified July period for the supplied UTI reference despite its August upload path", () => {
    expect(officialReferenceCandidates("uti", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ label: "UTI Fund Watch Active July 2026" }),
    ]);
    expect(officialReferenceCandidates("uti", { year: 2026, month: 7, label: "August 2026" })).toEqual([]);
  });

  it("constructs only the observed Axis static-name pattern for the requested month", () => {
    expect(officialReferenceCandidates("axis", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("Axis%20Fund%20Factsheet%20July%202026.pdf") }),
    ]);
  });

  it("exposes the verified Choice July record and DSP's dated path without guessing opaque tokens", () => {
    expect(officialReferenceCandidates("choice", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: expect.stringContaining("1786519812-choice_mutual_fund_factsheet_full_july_2026.pdf") }),
    ]);
    expect(officialReferenceCandidates("dsp", { year: 2026, month: 6, label: "July 2026" })).toEqual([
      expect.objectContaining({ url: "https://www.dspim.com/downloads/dsp-factsheet-july-2026.pdf" }),
    ]);
  });

  it("uses exact verified snapshots for slow or previously opaque official July document hosts", () => {
    const july = { year: 2026, month: 6, label: "July 2026" };
    expect(officialReferenceCandidates("kotak", july)[0]).toMatchObject({
      url: "https://www.kotakmf.com/factsheet/July_2026/Kotak%20MF%20Factsheet%20August%202026.pdf",
      archivePeriodLabel: "July 2026",
      downloadTimeoutMs: 90_000,
    });
    expect(officialReferenceCandidates("mahindra-manulife", july)[0]).toMatchObject({ url: expect.stringContaining("ada39b25-9f6e-435f-bcc2-7ede65e51f80.pdf"), downloadTimeoutMs: 90_000 });
    expect(officialReferenceCandidates("whiteoak-capital", july)).toEqual([]);
    expect(officialReferenceCandidates("jio-blackrock", july)[0]).toMatchObject({ url: expect.stringContaining("factsheetj-msr48uoz-461483.pdf"), downloadTimeoutMs: 60_000 });
  });

  it("retains newly verified July snapshots instead of deriving opaque identifiers", () => {
    const july = { year: 2026, month: 6, label: "July 2026" };
    expect(officialReferenceCandidates("motilal-oswal", july)[0]?.url).toContain("Factsheet%20July%202026%20Active%20Funds.pdf");
    expect(officialReferenceCandidates("quantum", july)[0]?.url).toContain("5d2d6fde-bc37-4ce2-9318-73b6756d9652.pdf");
    expect(officialReferenceCandidates("samco", july)[0]?.url).toContain("Factsheet-July2026_1785606935.pdf");
    expect(officialReferenceCandidates("taurus", july)[0]?.url).toContain("Taurus_Times_July_2026.pdf");
    expect(officialReferenceCandidates("trust", july)[0]?.url).toContain("TRUSTMF%20Fact_20260810124407.pdf");
    expect(officialReferenceCandidates("wealth-company", july)[0]?.url).toContain("The_Wealth_Company_Factsheet_July_2026_a58370ee64.pdf");
    expect(officialReferenceCandidates("sbi", july)[0]?.url).toContain("all-sbimf-schemes-factsheet-july-2026.pdf");
    expect(officialReferenceCandidates("groww", july)[0]?.url).toContain("Monthly%20Factsheet%20July%202026.pdf");
    expect(officialReferenceCandidates("helios", july)[0]?.url).toContain("helios-mutual-fund-factsheet-jul26.pdf");
    expect(officialReferenceCandidates("invesco", july)[0]?.url).toContain("invesco-mf-factsheet-july-2026.pdf?sfvrsn=25cb9fc2_2");
    expect(officialReferenceCandidates("iti", july)[0]?.url).toContain("1786700653-ITI_Factsheet-July.pdf");
    expect(officialReferenceCandidates("lic", july)[0]?.url).toContain("lic-mf-factsheet-31st-july-2026.pdf");
    expect(officialReferenceCandidates("mahindra-manulife", july)[0]?.url).toContain("ada39b25-9f6e-435f-bcc2-7ede65e51f80.pdf");
    expect(officialReferenceCandidates("pgim-india", july)[0]?.url).toContain("Factsheet%20-%20July%202026.pdf");
    expect(officialReferenceCandidates("hsbc", july)[0]?.url).toContain("the-asset-july-2026.pdf");
    expect(officialReferenceCandidates("union", july)[0]?.url).toContain("factsheet-july-2026.pdf");
    expect(officialReferenceCandidates("bank-of-india", july)[0]?.url).toContain("factsheet-july-2026.pdf");
  });

  it("uses Bandhan's live public latest-page PDF only for its content-verified July period", () => {
    const july = { year: 2026, month: 6, label: "July 2026" };
    expect(officialReferenceCandidates("bandhan", july)[0]).toMatchObject({
      url: "https://storage.googleapis.com/nonprod-static-assets-121to59kaawfgfi7bol/2026/08/6f1518f8-bandhan-factsheet-july-2026.pdf",
      archivePeriodLabel: "August 2026",
      downloadTimeoutMs: 60_000,
    });
    expect(officialReferenceCandidates("bandhan", { year: 2026, month: 7, label: "August 2026" })).toEqual([]);
  });

});
