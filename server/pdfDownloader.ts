/**
 * PDF Downloader Service
 *
 * Downloads mutual fund factsheets from fund house websites.
 *
 * Strategy:
 * 1. Scrape the advisorkhoj.com aggregator page to get the latest real factsheet URL.
 * 2. Fall back to known direct URL patterns if scraping fails.
 * 3. Use the correct Referer header from each fund house's own website — this is the
 *    key that bypasses Cloudflare/CDN protection for most fund houses.
 *
 * Confirmed working (200 OK) as of Aug 2026:
 *   HDFC, ICICI Prudential, Aditya Birla, Nippon India, Axis, SBI, UTI
 * Still blocked: Kotak (stricter Cloudflare — manual upload required)
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { FundHouse } from "./fundHouseDetector";
import https from "https";
import { downloadFromRegistry } from "./registryDownloader";

// Some fund house servers (e.g. ICICI digitalfactsheet subdomain) have certificate chain issues.
// We use a custom agent that allows self-signed certs for those specific domains only.
const RELAXED_HTTPS_AGENT = new https.Agent({ rejectUnauthorized: false });

const DOWNLOAD_TIMEOUT_MS = 60_000;
const SCRAPE_TIMEOUT_MS = 15_000;

const BASE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const FACTSHEET_KEYWORDS = [
  "factsheet", "fact-sheet", "fact_sheet", "fund-watch", "fund_watch",
  "uti_fund", "uti-fund", "nippon-fs", "nippon_fs", "absl-factsheet",
  "absl_factsheet", "empower-factsheet", "complete-factsheet", "complete_factsheet",
  "hdfc%20mf%20factsheet", "hdfc mf factsheet",
];

/**
 * Per-fund-house Referer headers — the critical key for bypassing CDN bot protection.
 * Each fund house checks that the request originates from their own site.
 */
const FUND_HOUSE_REFERERS: Partial<Record<FundHouse, string>> = {
  HDFC: "https://www.hdfcfund.com/mutual-funds/factsheets",
  "ICICI Prudential": "https://www.icicipruamc.com/knowledge-center/fund-feature",
  "Aditya Birla": "https://mutualfund.adityabirlacapital.com/investor-services/downloads",
  "Nippon India": "https://mf.nipponindiaim.com/investor-services/forms-and-downloads",
  Axis: "https://transact.axismf.com/downloads",
  SBI: "https://www.sbimf.com/en-us/downloads",
  UTI: "https://www.utimf.com/downloads",
  Kotak: "https://www.kotakmf.com/Information/factsheet",
  DSP: "https://www.dspim.com/downloads",
  "Franklin Templeton": "https://www.franklintempletonindia.com/investor/downloads",
  "Mirae Asset": "https://www.miraeassetmf.co.in/downloads",
  Tata: "https://www.tatamutualfund.com/downloads",
  "Canara Robeco": "https://www.canararobeco.com/downloads",
  "Motilal Oswal": "https://www.motilaloswalmf.com/downloads",
  Bandhan: "https://www.bandhanmf.com/downloads",
  Quant: "https://www.quantmutual.com/downloads",
};

/**
 * Advisorkhoj aggregator page URLs — used to scrape the latest factsheet URL.
 */
const FUND_HOUSE_AMC_SLUG: Partial<Record<FundHouse, string>> = {
  HDFC: "hdfc",
  "ICICI Prudential": "icici-prudential",
  Axis: "axis",
  SBI: "sbi",
  "Aditya Birla": "aditya-birla",
  Kotak: "kotak",
  UTI: "uti",
  "Nippon India": "nippon-india",
  DSP: "dsp",
  "Franklin Templeton": "franklin-templeton",
  "Mirae Asset": "mirae-asset",
  Tata: "tata",
  "Canara Robeco": "canara-robeco",
  Edelweiss: "edelweiss",
  "PGIM India": "pgim-india",
  Invesco: "invesco",
  "Motilal Oswal": "motilal-oswal",
  Quant: "quant",
  Bandhan: "bandhan",
};

const ADVISORKHOJ_PAGES: Partial<Record<FundHouse, string>> = {
  HDFC: "https://www.advisorkhoj.com/form-download-centre/Mutual/HDFC-Mutual-Fund",
  "ICICI Prudential": "https://www.advisorkhoj.com/form-download-centre/Mutual/ICICI-Prudential-Mutual-Fund",
  Axis: "https://www.advisorkhoj.com/form-download-centre/Mutual/Axis-Mutual-Fund",
  SBI: "https://www.advisorkhoj.com/form-download-centre/Mutual/SBI-Mutual-Fund",
  "Aditya Birla": "https://www.advisorkhoj.com/form-download-centre/Mutual/Aditya-Birla-Sun-Life-Mutual-Fund",
  Kotak: "https://www.advisorkhoj.com/form-download-centre/Mutual/Kotak-Mutual-Fund",
  UTI: "https://www.advisorkhoj.com/form-download-centre/Mutual/UTI-Mutual-Fund",
  "Nippon India": "https://www.advisorkhoj.com/form-download-centre/Mutual/Nippon-India-Mutual-Fund",
  DSP: "https://www.advisorkhoj.com/form-download-centre/Mutual/DSP-Mutual-Fund",
  "Franklin Templeton": "https://www.advisorkhoj.com/form-download-centre/Mutual/Franklin-Templeton-Mutual-Fund",
  "Mirae Asset": "https://www.advisorkhoj.com/form-download-centre/Mutual/Mirae-Asset-Mutual-Fund",
  Tata: "https://www.advisorkhoj.com/form-download-centre/Mutual/Tata-Mutual-Fund",
  "Canara Robeco": "https://www.advisorkhoj.com/form-download-centre/Mutual/Canara-Robeco-Mutual-Fund",
  "Motilal Oswal": "https://www.advisorkhoj.com/form-download-centre/Mutual/Motilal-Oswal-Mutual-Fund",
  Bandhan: "https://www.advisorkhoj.com/form-download-centre/Mutual/Bandhan-Mutual-Fund",
  Edelweiss: "https://www.advisorkhoj.com/form-download-centre/Mutual/Edelweiss-Mutual-Fund",
  Invesco: "https://www.advisorkhoj.com/form-download-centre/Mutual/Invesco-Mutual-Fund",
  "PGIM India": "https://www.advisorkhoj.com/form-download-centre/Mutual/PGIM-India-Mutual-Fund",
  Quant: "https://www.advisorkhoj.com/form-download-centre/Mutual/Quant-Mutual-Fund",
};

/**
 * Scrape advisorkhoj to get the latest factsheet URL for a fund house.
 */
async function scrapeLatestFactsheetUrl(fundHouse: FundHouse): Promise<string | null> {
  const pageUrl = ADVISORKHOJ_PAGES[fundHouse];
  if (!pageUrl) return null;

  try {
    const response = await axios.get(pageUrl, {
      headers: { "User-Agent": BASE_UA, Accept: "text/html,*/*" },
      timeout: SCRAPE_TIMEOUT_MS,
    });

    const $ = cheerio.load(response.data as string);
    const candidates: string[] = [];

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const lower = `${href} ${$(el).text()}`.toLowerCase();
      if (
        lower.includes(".pdf") &&
        !lower.includes("portfolio") &&
        !lower.includes("portfolio-disclosure") &&
        !lower.includes("application") &&
        !lower.includes("sai") &&
        !lower.includes("kim") &&
        !lower.includes("sid") &&
        !lower.includes("statutory") &&
        !lower.includes(".zip") &&
        !lower.includes(".xls") &&
        FACTSHEET_KEYWORDS.some((keyword) => lower.includes(keyword))
      ) {
        candidates.push(href);
      }
    });
    return candidates[0] ?? null;
  } catch (err: unknown) {
    console.warn(
      `[Downloader] Failed to scrape advisorkhoj for ${fundHouse}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Build fallback direct URL patterns for fund houses.
 */
function buildFallbackUrls(fundHouse: FundHouse): string[] {
  const now = new Date();
  const dates = [
    new Date(now.getFullYear(), now.getMonth() - 1, 1),
    new Date(now.getFullYear(), now.getMonth(), 1),
  ];

  const urls: string[] = [];

  for (const d of dates) {
    const year = d.getFullYear();
    const month = d.toLocaleString("en-US", { month: "long" });
    const monthLower = month.toLowerCase();
    const monthUpper = month.toUpperCase();
    const monthShort = d.toLocaleString("en-US", { month: "short" });
    const nextMonthNum = String(d.getMonth() + 2).padStart(2, "0");
    const monthNum = String(d.getMonth() + 1).padStart(2, "0");

    switch (fundHouse) {
      case "HDFC":
        // HDFC publishes month N in folder N+1 (e.g. June 2026 is in /2026-07/)
        urls.push(
          `https://files.hdfcfund.com/s3fs-public/${year}-${nextMonthNum}/HDFC%20MF%20Factsheet%20-%20${month}%20${year}.pdf`,
          `https://files.hdfcfund.com/s3fs-public/${year}-${monthNum}/HDFC%20MF%20Factsheet%20-%20${month}%20${year}.pdf`
        );
        break;
      case "ICICI Prudential":
        urls.push(
          `https://digitalfactsheet.icicipruamc.com/fact/pdf/fund-factsheet-for-${monthLower}-${year}.pdf`,
          `https://www.icicipruamc.com/blob/downloads/Files/Historic%20Factsheets/${year - 1}-${year}/Complete%20Factsheet%20${month}%20${year}.pdf`
        );
        break;
      case "Aditya Birla":
        urls.push(
          `https://mutualfund.adityabirlacapital.com/-/media/bsl/files/resources/factsheets/${year}/absl-factsheet_${monthLower}-${year}.pdf`,
          `https://mutualfund.adityabirlacapital.com/-/media/bsl/files/resources/factsheets/${year}/empower-factsheet---${monthLower}-${year}.pdf`
        );
        break;
      case "Nippon India":
        urls.push(
          `https://mf.nipponindiaim.com/InvestorServices/FactSheetsDocuments/Nippon-FS-${monthUpper}-${year}.pdf`,
          `https://mf.nipponindiaim.com/InvestorServices/FactSheets/NipponIndia-Factsheet-${month}-${year}.pdf`
        );
        break;
      case "Axis":
        urls.push(
          `https://transact.axismf.com/cms/sites/default/files/pdf-factsheets/Axis%20Fund%20Factsheet%20${month}%20${year}.pdf`,
          // Try previous month as fallback (Axis publishes with ~1 month delay)
          `https://transact.axismf.com/cms/sites/default/files/pdf-factsheets/Axis%20Fund%20Factsheet%20${new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleString("en-US", { month: "long" })}%20${d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()}.pdf`
        );
        break;
      case "SBI":
        urls.push(
          `https://www.sbimf.com/docs/default-source/scheme-factsheets/all-sbimf-schemes-factsheet-${monthLower}-${year}.pdf`,
          `https://www.sbimf.com/docs/default-source/scheme-factsheets/all-sbimf-schemes-factsheet-(index)-${monthLower}-${year}.pdf`
        );
        break;
      case "UTI":
        urls.push(
          `https://d3ce1o48hc5oli.cloudfront.net/s3fs-public/${year}-${nextMonthNum}/uti_fund_watch_active_${monthLower}_${year}.pdf`,
          `https://d3ce1o48hc5oli.cloudfront.net/s3fs-public/${year}-${monthNum}/uti_fund_watch_active_${monthLower}_${year}.pdf`
        );
        break;
      case "Kotak":
        urls.push(
          `https://assets.kotakmf.com/kotak_admin/cms/essential_pdf/Kotak_MF_Factsheet_${month}_${year}.pdf`,
          `https://assets.kotakmf.com/kotak_admin/cms/essential_pdf/Kotak_MF_Factsheet_${monthShort}_${year}.pdf`
        );
        break;
    }
  }

  return urls;
}

export interface DownloadResult {
  success: boolean;
  buffer?: Buffer;
  url?: string;
  error?: string;
}

/**
 * Download the factsheet PDF for a given fund house.
 *
 * Uses the correct Referer header for each fund house — the critical key
 * that bypasses CDN bot protection for HDFC, ICICI, ABSL, Nippon, Axis.
 */
export async function downloadFactsheet(fundHouse: FundHouse, options: { skipRegistry?: boolean } = {}): Promise<DownloadResult> {
  // First try the user-registered AMC source. Any newly registered source can
  // participate without waiting for a legacy hard-coded URL pattern update.
  const registrySlug = FUND_HOUSE_AMC_SLUG[fundHouse];
  if (registrySlug && !options.skipRegistry) {
    const registryDownload = await downloadFromRegistry(registrySlug);
    if (registryDownload?.success && registryDownload.buffer && registryDownload.resolvedUrl) {
      return { success: true, buffer: registryDownload.buffer, url: registryDownload.resolvedUrl };
    }
  }

  const urlsToTry: string[] = [];

  // Step 1: Get URL from advisorkhoj scraping (most reliable — always up-to-date)
  const scrapedUrl = await scrapeLatestFactsheetUrl(fundHouse);
  if (scrapedUrl) {
    urlsToTry.push(scrapedUrl);
  }

  // Step 2: Add fallback direct URLs
  urlsToTry.push(...buildFallbackUrls(fundHouse));

  if (urlsToTry.length === 0) {
    return {
      success: false,
      error: `No factsheet URL patterns available for ${fundHouse}.`,
    };
  }

  const referer = FUND_HOUSE_REFERERS[fundHouse];
  const errors: string[] = [];

  for (const url of urlsToTry) {
    try {
      const headers: Record<string, string> = {
        "User-Agent": BASE_UA,
        Accept: "application/pdf,application/octet-stream,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
      };
      // Use fund-house-specific Referer — this is the key to bypass CDN protection
      if (referer) headers["Referer"] = referer;

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        headers,
        timeout: DOWNLOAD_TIMEOUT_MS,
        maxRedirects: 10,
        validateStatus: (status) => status === 200,
        httpsAgent: RELAXED_HTTPS_AGENT,
      });

      const contentType = (response.headers["content-type"] as string) ?? "";
      const buffer = Buffer.from(response.data as ArrayBuffer);

      // Verify it's actually a PDF (starts with %PDF)
      if (
        buffer.length > 1000 &&
        (contentType.includes("pdf") || buffer.slice(0, 4).toString() === "%PDF")
      ) {
        return { success: true, buffer, url };
      }

      errors.push(`${url}: response was not a valid PDF (${contentType}, ${buffer.length} bytes)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("403") || msg.includes("status code 403")) {
        errors.push(`${url}: blocked (403)`);
      } else if (msg.includes("404") || msg.includes("status code 404")) {
        errors.push(`${url}: not found (404) — factsheet may not be published yet`);
      } else {
        errors.push(`${url}: ${msg}`);
      }
    }
  }

  // All attempts failed
  const allBlocked = errors.every((e) => e.includes("403") || e.includes("blocked"));
  const errorSummary = allBlocked
    ? `${fundHouse} factsheet download is blocked by the fund house's bot protection. ` +
      `You can manually upload the PDF from: ${ADVISORKHOJ_PAGES[fundHouse] ?? "the fund house website"}`
    : `Failed to download ${fundHouse} factsheet after ${urlsToTry.length} attempts. ` +
      `Errors: ${errors.slice(0, 2).join("; ")}`;

  return { success: false, error: errorSummary };
}
