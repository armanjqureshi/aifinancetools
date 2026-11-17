export type HybridAdapterMethod =
  | "verified_snapshot"
  | "official_archive"
  | "official_static_candidate"
  | "official_public_feed"
  | "dynamic_metadata"
  | "approved_access_required"
  | "generic_registry";

export type HybridAdapterProfile = {
  method: HybridAdapterMethod;
  label: string;
  guidance: string;
  officialSourceUrl?: string;
  allowGenericFallback: boolean;
};

const PROFILES: Record<string, HybridAdapterProfile> = {
  "360-one-asset": { method: "verified_snapshot", label: "Official archive-card snapshot", guidance: "Uses the exact official archive-card document URL; the archive month and PDF-printed month are preserved separately.", officialSourceUrl: "https://www.360.one/asset/mutual-funds/downloads/", allowGenericFallback: true },
  "aditya-birla": { method: "verified_snapshot", label: "Verified official archive snapshot", guidance: "Uses the exact official August 2026 archive PDF and validates the reporting period before storage; earlier months continue through the official archive or direct-link fallback.", officialSourceUrl: "https://mutualfund.adityabirlacapital.com/forms-and-downloads/factsheets", allowGenericFallback: true },
  "bajaj-finserv": { method: "dynamic_metadata", label: "Dynamic official archive", guidance: "The official download centre is retried through the registry; use an exact official PDF if the source times out.", allowGenericFallback: true },
  bandhan: { method: "verified_snapshot", label: "Verified public latest-page snapshot", guidance: "Uses the exact public Bandhan all-schemes page record for July 2026. The page displays it in the August 2026 release list; the PDF's printed July 2026 period is validated before storage.", officialSourceUrl: "https://bandhanmutual.com/downloads/factsheet/all-schemes", allowGenericFallback: true },
  "bank-of-india": { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses the exact official July document URL and validates the PDF reporting period before storage.", allowGenericFallback: true },
  "baroda-bnp-paribas": { method: "dynamic_metadata", label: "Dynamic official archive", guidance: "The monthly factsheet page is searched first; use an official direct PDF if the selected month is not exposed.", allowGenericFallback: true },
  choice: { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses an exact official document snapshot for its verified month; opaque IDs are never extrapolated.", allowGenericFallback: true },
  dsp: { method: "official_public_feed", label: "Official public download feed", guidance: "Finds exact records through DSP's first-party JSON feed. The current official PDF host may time out during delivery; the app reports that access outcome rather than storing an incomplete PDF.", officialSourceUrl: "https://www.dspim.com/downloads.json?page=1&per_page=100&category=Information%20Documents&sub_category=Factsheets&sort=latest-insight", allowGenericFallback: true },
  edelweiss: { method: "approved_access_required", label: "Official access required", guidance: "The official document host rejects server access. Use an approved document feed, allowlisting, or an official direct PDF link.", officialSourceUrl: "https://www.edelweissmf.com/downloads/factsheets", allowGenericFallback: false },
  "franklin-templeton": { method: "official_public_feed", label: "Official public literature feed", guidance: "Queries Franklin Templeton's public literature feed, selects the requested factsheet record, and verifies the PDF reporting period before storage.", officialSourceUrl: "https://www.franklintempletonindia.com/api/literature/v1/responseLitJson?type=download", allowGenericFallback: true },
  groww: { method: "verified_snapshot", label: "Verified official document-library snapshot", guidance: "Uses the exact July factsheet document published in Groww's official 2026-2027 library and validates the printed reporting period before storage.", officialSourceUrl: "https://www.growwmf.in/downloads/fact-sheet", allowGenericFallback: true },
  hdfc: { method: "official_public_feed", label: "Official date-folder document feed", guidance: "Checks HDFC's current and prior official date-labelled document paths, then verifies the PDF's printed reporting period.", officialSourceUrl: "https://www.hdfcfund.com/mutual-funds/factsheets", allowGenericFallback: true },
  helios: { method: "verified_snapshot", label: "Verified official monthly-archive snapshot", guidance: "Uses the exact July factsheet from Helios's official monthly archive and validates the PDF data-as-of date before storage.", officialSourceUrl: "https://www.heliosmf.in/downloads", allowGenericFallback: true },
  hsbc: { method: "verified_snapshot", label: "Verified official document-library snapshot", guidance: "Uses the exact July fund-factsheet record published in HSBC's official document library. The August release date and the PDF's July data-as-of period are retained separately.", officialSourceUrl: "https://www.assetmanagement.hsbc.co.in/en/mutual-funds/investor-resources?Date=&Cap=&Doc=fund-factsheets#&module-17=1&module-21=1", allowGenericFallback: true },
  "icici-prudential": { method: "official_public_feed", label: "Official complete factsheet feed", guidance: "Uses ICICI Prudential's current complete factsheet PDF and validates the printed reporting period before storage.", officialSourceUrl: "https://www.icicipruamc.com/knowledge-center", allowGenericFallback: true },
  invesco: { method: "verified_snapshot", label: "Verified official document-library snapshot", guidance: "Uses the exact July factsheet record emitted by Invesco's official 2026 library and validates the printed reporting period before storage.", officialSourceUrl: "https://www.invescomutualfund.com/literature-forms/factsheets", allowGenericFallback: true },
  iti: { method: "verified_snapshot", label: "Verified official factsheet snapshot", guidance: "Uses the official July document reference matched to ITI's live July listing and validates the printed reporting period before storage.", officialSourceUrl: "https://www.itiamc.com/downloads", allowGenericFallback: true },
  "jio-blackrock": { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses the exact official July document URL and an extended bounded download window for the public CDN.", allowGenericFallback: true },
  "jm-financial": { method: "dynamic_metadata", label: "Dynamic official archive", guidance: "The official factsheet page is searched first; use an official direct PDF when document metadata is not exposed.", allowGenericFallback: true },
  kotak: { method: "verified_snapshot", label: "Verified public month-page snapshot", guidance: "Uses the official public July month-page PDF. The page period and the PDF title are preserved separately; the PDF data is as of 31 July 2026.", officialSourceUrl: "https://www.kotakmf.com/factsheet/July_2026/", allowGenericFallback: true },
  lic: { method: "verified_snapshot", label: "Verified official current-page snapshot", guidance: "Uses the July document emitted by LIC's official current monthly-factsheet page and validates the PDF reporting period before storage.", officialSourceUrl: "https://www.licmf.com/downloads/factsheet", allowGenericFallback: true },
  "mahindra-manulife": { method: "verified_snapshot", label: "Verified official current-page snapshot", guidance: "Uses the exact July document emitted by the user-authorized official downloads archive and validates the printed reporting period before storage.", officialSourceUrl: "https://www.mahindramanulife.com/downloads#investor", allowGenericFallback: true },
  "mirae-asset": { method: "official_public_feed", label: "Official public document feed", guidance: "Queries Mirae's official factsheet feed, selects the requested month, and verifies the PDF content before storage.", officialSourceUrl: "https://www.miraeassetmf.co.in/AjaxService/GetDownloadsData", allowGenericFallback: true },
  "motilal-oswal": { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses the exact official July document URL and validates the PDF reporting period before storage.", allowGenericFallback: true },
  "nippon-india": { method: "official_public_feed", label: "Official HTML factsheet archive", guidance: "Reads Nippon India's first-party archive, ranks the newest Fundamentals/E-Factsheet PDF, and validates the printed reporting period before storage.", officialSourceUrl: "https://mf.nipponindiaim.com/investor-service/downloads/factsheet-portfolio-and-other-disclosures", allowGenericFallback: true },
  "old-bridge": { method: "official_archive", label: "Official archive page", guidance: "Uses the official factsheet archive and accepts only links that match the requested period.", officialSourceUrl: "https://oldbridgemf.com/factsheet.html", allowGenericFallback: true },
  "pgim-india": { method: "verified_snapshot", label: "Verified official current-page snapshot", guidance: "Uses the exact July document emitted by PGIM India's official fund-factsheet page and validates the PDF reporting period before storage.", officialSourceUrl: "https://www.pgimindia.com/mutual-funds/forms-and-product-updates/Fund-Factsheet", allowGenericFallback: true },
  quant: { method: "dynamic_metadata", label: "Dynamic official archive", guidance: "Searches the official factsheet archive; use an official direct PDF if the page times out.", allowGenericFallback: true },
  quantum: { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses the exact official July document URL and validates the PDF reporting period before storage.", allowGenericFallback: true },
  samco: { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses the exact official July document URL and validates the PDF reporting period before storage.", allowGenericFallback: true },
  sbi: { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses the official July all-schemes record emitted by SBI's live factsheet page and validates the PDF reporting period before storage.", officialSourceUrl: "https://www.sbimf.com/factsheets", allowGenericFallback: true },
  sundaram: { method: "official_public_feed", label: "Official public archive endpoint", guidance: "Submits the selected month through Sundaram's public fundwise archive endpoint and verifies the PDF reporting period before storage.", officialSourceUrl: "https://www.sundarammutual.com/ajax/Modules_Forms_Downloads_Fundwise_Factsheet,App_Web_v2aypqkp.ashx?_method=DownloadArchive&_session=no", allowGenericFallback: true },
  taurus: { method: "verified_snapshot", label: "Verified official monthly-archive snapshot", guidance: "Uses the exact July factsheet emitted by Taurus's official 2026 archive and validates the PDF reporting period before storage.", officialSourceUrl: "https://www.taurusmutualfund.com/factsheet", allowGenericFallback: true },
  trust: { method: "verified_snapshot", label: "Verified official current-page snapshot", guidance: "Uses the exact July factsheet emitted by Trust's official current downloads page and validates the PDF reporting period before storage.", officialSourceUrl: "https://www.trustmf.com/downloads?activeTab=factsheets", allowGenericFallback: true },
  union: { method: "verified_snapshot", label: "Verified official snapshot", guidance: "Uses the exact official July document URL and validates the PDF reporting period before storage.", allowGenericFallback: true },
  "wealth-company": { method: "verified_snapshot", label: "Verified official current-page snapshot", guidance: "Uses the exact July factsheet emitted by The Wealth Company's official literature page and validates the PDF reporting period before storage.", officialSourceUrl: "https://www.wealthcompanyamc.in/literature-forms/scheme-documents/factsheets/", allowGenericFallback: true },
  "whiteoak-capital": { method: "dynamic_metadata", label: "Dynamic official archive", guidance: "The official page exposes the current July document. Its direct host is region-blocked to the server, so the verified cached copy is reused and future new periods may need browser-assisted capture before strict period validation.", allowGenericFallback: true },
  zerodha: { method: "dynamic_metadata", label: "Dynamic official archive", guidance: "Searches the official fund-document listing; use an official direct PDF when the selected month is not exposed.", allowGenericFallback: true },
};

const GENERIC_PROFILE: HybridAdapterProfile = {
  method: "generic_registry",
  label: "Registered official source",
  guidance: "Searches the registered official source and verifies the reporting period before storage.",
  allowGenericFallback: true,
};

export function getHybridAdapterProfile(amcSlug: string): HybridAdapterProfile {
  return PROFILES[amcSlug] ?? GENERIC_PROFILE;
}
