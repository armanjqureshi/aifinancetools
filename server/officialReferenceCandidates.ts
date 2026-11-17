import type { RequestedFactsheetPeriod } from "./factsheetPeriod";

export type OfficialReferenceCandidate = { url: string; label: string; archivePeriodLabel?: string; downloadTimeoutMs?: number };

type ReferenceSnapshot = OfficialReferenceCandidate & { year: number; month: number };

// First-party links supplied by the user. A snapshot is used only for its
// exact month; opaque hashes/timestamps are never extrapolated into guesses.
const SNAPSHOTS: Record<string, ReferenceSnapshot[]> = {
  "360-one-asset": [{ year: 2026, month: 6, url: "https://s3.ap-south-1.amazonaws.com/x-web-s3.360.one/360_ONE_MF_July_2026_32e39d7e7c.pdf", label: "360 ONE Fund Factsheet July 2026", archivePeriodLabel: "July 2026" }],
  "aditya-birla": [
    { year: 2026, month: 7, url: "https://mutualfund.adityabirlacapital.com/-/media/bsl/files/resources/factsheets/2026/absl-factsheet_aug-2026.pdf", label: "Aditya Birla Sun Life Factsheet August 2026", downloadTimeoutMs: 60_000 },
    { year: 2026, month: 6, url: "https://mutualfund.adityabirlacapital.com/-/media/bsl/files/resources/factsheets/2026/absl-factsheet_july-2026.pdf", label: "Aditya Birla Sun Life Factsheet July 2026", downloadTimeoutMs: 60_000 },
  ],
  "bank-of-india": [{ year: 2026, month: 6, url: "https://www.boimf.in/docs/default-source/investorcorner/factsheets/factsheet-july-2026.pdf?sfvrsn=ecfba920_3", label: "Bank of India Factsheet July 2026", downloadTimeoutMs: 60_000 }],
  bandhan: [{ year: 2026, month: 6, url: "https://storage.googleapis.com/nonprod-static-assets-121to59kaawfgfi7bol/2026/08/6f1518f8-bandhan-factsheet-july-2026.pdf", label: "Bandhan Mutual Fund Factsheet July 2026", archivePeriodLabel: "August 2026", downloadTimeoutMs: 60_000 }],
  choice: [{ year: 2026, month: 6, url: "https://doc.choicemf.com/document-master/1786519812-choice_mutual_fund_factsheet_full_july_2026.pdf", label: "Choice Mutual Fund Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  groww: [{ year: 2026, month: 6, url: "https://assets-netstorage.growwmf.in/compliance_docs/Downloads/Fact%20Sheet/2026%20-%202027/Monthly%20Factsheet%20July%202026.pdf", label: "Groww Mutual Fund Monthly Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  hdfc: [{ year: 2026, month: 6, url: "https://files.hdfcfund.com/s3fs-public/2026-08/HDFC%20MF%20Factsheet%20-%20July%202026.pdf", label: "HDFC MF Factsheet July 2026" }],
  helios: [{ year: 2026, month: 6, url: "https://www.heliosmf.in/wp-content/uploads/2026/08/helios-mutual-fund-factsheet-jul26.pdf", label: "Helios Mutual Fund Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  edelweiss: [{ year: 2026, month: 6, url: "https://www.edelweissmf.com/Files/MF/Downloads/FACTSHEETS/FACTSHEETS/Edelweiss_Factsheet_August__2026_10082026160011.pdf", label: "Edelweiss archive card for July 2026" }],
  hsbc: [{ year: 2026, month: 6, url: "https://www.assetmanagement.hsbc.co.in/assets/documents/mutual-funds/en/baebe6b0-a743-464f-a639-5069594ff653/the-asset-july-2026.pdf", label: "HSBC The Asset Factsheet July 2026", archivePeriodLabel: "August 2026", downloadTimeoutMs: 90_000 }],
  invesco: [{ year: 2026, month: 6, url: "https://www.invescomutualfund.com/docs/default-source/factsheet/invesco-mf-factsheet-july-2026.pdf?sfvrsn=25cb9fc2_2", label: "Invesco MF Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  "icici-prudential": [{ year: 2026, month: 6, url: "https://www.icicipruamc.com/blob/knowledgecentre/factsheet-complete/Complete.pdf", label: "ICICI Prudential Complete Factsheet July 2026" }],
  iti: [{ year: 2026, month: 6, url: "https://itiamc.com/admin/pdf/1786700653-ITI_Factsheet-July.pdf", label: "ITI Factsheet July 2026" }],
  "jio-blackrock": [{ year: 2026, month: 6, url: "https://cdnstorage-ddh3hqhvg3gyedd9.a02.azurefd.net/brcms/factsheetj-msr48uoz-461483.pdf", label: "JioBlackRock Factsheet July 2026", downloadTimeoutMs: 60_000 }],
  kotak: [{ year: 2026, month: 6, url: "https://www.kotakmf.com/factsheet/July_2026/Kotak%20MF%20Factsheet%20August%202026.pdf", label: "Kotak Mutual Fund Factsheet August 2026", archivePeriodLabel: "July 2026", downloadTimeoutMs: 90_000 }],
  lic: [{ year: 2026, month: 6, url: "https://www.licmf.com/assets/downloads/monthly_fact_sheet/2026-2027/08/lic-mf-factsheet-31st-july-2026.pdf", label: "LIC Mutual Fund Factsheet 31 July 2026", downloadTimeoutMs: 90_000 }],
  "mahindra-manulife": [{ year: 2026, month: 6, url: "https://cms.mahindramanulife.com/storage/mmimplweb/uploads/download/ada39b25-9f6e-435f-bcc2-7ede65e51f80.pdf", label: "Mahindra Manulife Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  "motilal-oswal": [{ year: 2026, month: 6, url: "https://www.motilaloswalmf.com/content/dam/motilal-mf/downloads/mf/factsheet/2026/aug/Factsheet%20July%202026%20Active%20Funds.pdf", label: "Motilal Oswal Active Funds Factsheet July 2026", downloadTimeoutMs: 60_000 }],
  "pgim-india": [{ year: 2026, month: 6, url: "https://www.pgimindia.com/api/v1/brochure/about-us/image/Factsheet%20-%20July%202026.pdf", label: "PGIM India Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  navi: [{ year: 2026, month: 6, url: "https://public-assets.prod.navi-tech.in/navi-website-assests/documents/NaviActiveFundJuly_26_20260813132532.pdf", label: "Navi Active Fund Factsheet July 2026" }],
  quantum: [{ year: 2026, month: 6, url: "https://www.quantumamc.com/FileCDN/FactSheet/5d2d6fde-bc37-4ce2-9318-73b6756d9652.pdf", label: "Quantum Mutual Fund All Funds Factsheet July 2026", downloadTimeoutMs: 60_000 }],
  samco: [{ year: 2026, month: 6, url: "https://media1.samco.in/scomamc/amc_documents/Factsheet-July2026_1785606935.pdf", label: "Samco Factsheet July 2026", downloadTimeoutMs: 60_000 }],
  taurus: [{ year: 2026, month: 6, url: "https://www.taurusmutualfund.com/sites/default/files/downloads/Taurus_Times_July_2026.pdf", label: "Taurus Monthly Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  trust: [{ year: 2026, month: 6, url: "https://www.trustmf.com/Content/2026/8/TRUSTMF%20Fact_20260810124407.pdf", label: "Trust Mutual Fund Factsheet July 2026", archivePeriodLabel: "August 2026", downloadTimeoutMs: 90_000 }],
  "wealth-company": [{ year: 2026, month: 6, url: "https://www.wealthcompanyamc.in/uploads/The_Wealth_Company_Factsheet_July_2026_a58370ee64.pdf", label: "The Wealth Company Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  sbi: [{ year: 2026, month: 6, url: "https://www.sbimf.com/docs/default-source/scheme-factsheets/all-sbimf-schemes-factsheet-july-2026.pdf?sfvrsn=c5ebcccb_4", label: "All SBIMF Schemes Factsheet July 2026", downloadTimeoutMs: 90_000 }],
  union: [{ year: 2026, month: 6, url: "https://www.unionmf.com/docs/default-source/downloads/scheme-disclosures/factsheets/factsheet-july-2026.pdf?sfvrsn=bd0729fd_5", label: "Union Mutual Fund Factsheet July 2026", downloadTimeoutMs: 60_000 }],
  uti: [{ year: 2026, month: 6, url: "https://d3ce1o48hc5oli.cloudfront.net/s3fs-public/2026-08/uti_fund_watch_active_august_2026_rv2.pdf?VersionId=B2XKeBTyWsZMGfHUqI3nbdnzhATN16Ax", label: "UTI Fund Watch Active July 2026" }],
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function officialReferenceCandidates(amcSlug: string, requested: RequestedFactsheetPeriod): OfficialReferenceCandidate[] {
  const snapshot = SNAPSHOTS[amcSlug]?.find((candidate) => candidate.year === requested.year && candidate.month === requested.month);
  if (snapshot) return [{ url: snapshot.url, label: snapshot.label, archivePeriodLabel: snapshot.archivePeriodLabel, downloadTimeoutMs: snapshot.downloadTimeoutMs }];
  const month = MONTHS[requested.month];
  if (amcSlug === "axis") {
    return [{ url: `https://transact.axismf.com/cms/sites/default/files/pdf-factsheets/Axis%20Fund%20Factsheet%20${encodeURIComponent(month)}%20${requested.year}.pdf`, label: `Axis Fund Factsheet ${month} ${requested.year}` }];
  }
  if (amcSlug === "invesco") {
    return [{ url: `https://www.invescomutualfund.com/docs/default-source/factsheet/invesco-mf-factsheet-${month.toLowerCase()}-${requested.year}.pdf`, label: `Invesco MF Factsheet ${month} ${requested.year}` }];
  }
  if (amcSlug === "dsp") {
    return [{ url: `https://www.dspim.com/downloads/dsp-factsheet-${month.toLowerCase()}-${requested.year}.pdf`, label: `DSP Factsheet ${month} ${requested.year}` }];
  }
  return [];
}
