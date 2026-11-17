import axios from "axios";
import * as cheerio from "cheerio";
import type { RequestedFactsheetPeriod } from "./factsheetPeriod";

export type PublicFeedCandidate = {
  url: string;
  label: string;
};

type MiraeRecord = {
  Title?: string;
  URL?: string;
  PublishDate?: string;
};

type DspRecord = {
  title?: string;
  pdf_url?: string;
  is_file?: boolean;
};

type FranklinRecord = {
  dctermsTitle?: string;
  dctermsType?: string;
  literatureHref?: string;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MIRAE_BASE_URL = "https://www.miraeassetmf.co.in";
const FRANKLIN_BASE_URL = "https://www.franklintempletonindia.com";
const SUNDARAM_BASE_URL = "https://www.sundarammutual.com";
const NIPPON_BASE_URL = "https://mf.nipponindiaim.com";
const NIPPON_FACTSHEET_ARCHIVE_URL = `${NIPPON_BASE_URL}/investor-service/downloads/factsheet-portfolio-and-other-disclosures`;

function periodScore(label: string | undefined) {
  const match = label?.toLowerCase().match(/(january|february|march|april|may|june|july|august|september|october|november|december)[\s_-]+(20\d{2})/);
  if (!match) return Number.NEGATIVE_INFINITY;
  return Number(match[2]) * 12 + MONTHS.indexOf(`${match[1][0].toUpperCase()}${match[1].slice(1)}`);
}

function collectFranklinRecords(value: unknown, records: FranklinRecord[] = []): FranklinRecord[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFranklinRecords(item, records));
    return records;
  }
  if (!value || typeof value !== "object") return records;

  const record = value as FranklinRecord;
  if (typeof record.dctermsTitle === "string" && typeof record.literatureHref === "string") {
    records.push(record);
  }
  Object.values(value).forEach((item) => collectFranklinRecords(item, records));
  return records;
}

export function extractMiraeFeedCandidates(payload: unknown, requested: RequestedFactsheetPeriod): PublicFeedCandidate[] {
  const envelope = typeof payload === "object" && payload !== null && "d" in payload
    ? (payload as { d?: unknown }).d
    : payload;
  const records = typeof envelope === "object" && envelope !== null && "Data" in envelope
    ? (envelope as { Data?: unknown }).Data
    : [];
  if (!Array.isArray(records)) return [];

  const needle = `${MONTHS[requested.month]} ${requested.year}`.toLowerCase();
  return (records as MiraeRecord[])
    .filter((record) => typeof record.Title === "string" && typeof record.URL === "string" && record.Title.toLowerCase().includes(needle))
    .sort((left, right) => Number(!left.Title?.toLowerCase().includes("active")) - Number(!right.Title?.toLowerCase().includes("active")))
    .map((record) => ({
      url: new URL(record.URL!, MIRAE_BASE_URL).toString(),
      label: record.Title!,
    }));
}

export function extractDspFeedCandidates(payload: unknown, requested: RequestedFactsheetPeriod): PublicFeedCandidate[] {
  const records = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && "data" in payload && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  const needle = `factsheet ${MONTHS[requested.month]} ${requested.year}`.toLowerCase();
  return (records as DspRecord[])
    .filter((record) => record.is_file !== false && typeof record.title === "string" && typeof record.pdf_url === "string" && record.title.toLowerCase().includes(needle))
    .map((record) => ({ url: record.pdf_url!, label: record.title! }));
}

/** Returns the official public-feed candidates ordered by their stated newest period. */
export function extractLatestMiraeFeedCandidates(payload: unknown): PublicFeedCandidate[] {
  const envelope = typeof payload === "object" && payload !== null && "d" in payload
    ? (payload as { d?: unknown }).d
    : payload;
  const records = typeof envelope === "object" && envelope !== null && "Data" in envelope
    ? (envelope as { Data?: unknown }).Data
    : [];
  if (!Array.isArray(records)) return [];

  return (records as MiraeRecord[])
    .filter((record) => typeof record.Title === "string" && typeof record.URL === "string" && /factsheet/i.test(record.Title))
    .sort((left, right) => periodScore(right.Title) - periodScore(left.Title) || Number(!left.Title?.toLowerCase().includes("active")) - Number(!right.Title?.toLowerCase().includes("active")))
    .map((record) => ({ url: new URL(record.URL!, MIRAE_BASE_URL).toString(), label: record.Title! }));
}

/** Returns the official public-feed candidates ordered by their stated newest period. */
export function extractLatestDspFeedCandidates(payload: unknown): PublicFeedCandidate[] {
  const records = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && "data" in payload && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  return (records as DspRecord[])
    .filter((record) => record.is_file !== false && typeof record.title === "string" && typeof record.pdf_url === "string" && /^factsheet\b/i.test(record.title))
    .sort((left, right) => periodScore(right.title) - periodScore(left.title))
    .map((record) => ({ url: record.pdf_url!, label: record.title! }));
}

/**
 * HDFC's current official page is server-blocked, but its public document host
 * exposes a stable, date-labelled path. Generate only recent structured paths;
 * the downloader still validates bytes and the PDF-printed period.
 */
export function extractLatestHdfcFeedCandidates(reference = new Date()): PublicFeedCandidate[] {
  const candidates: PublicFeedCandidate[] = [];
  const seen = new Set<string>();
  for (let monthOffset = 0; monthOffset <= 2; monthOffset += 1) {
    const target = new Date(reference.getFullYear(), reference.getMonth() - monthOffset, 1);
    const targetLabel = `${MONTHS[target.getMonth()]} ${target.getFullYear()}`;
    for (const folderOffset of [1, 0]) {
      const folder = new Date(target.getFullYear(), target.getMonth() + folderOffset, 1);
      const url = `https://files.hdfcfund.com/s3fs-public/${folder.getFullYear()}-${String(folder.getMonth() + 1).padStart(2, "0")}/HDFC%20MF%20Factsheet%20-%20${encodeURIComponent(targetLabel)}.pdf`;
      if (seen.has(url)) continue;
      seen.add(url);
      candidates.push({ url, label: `HDFC MF Factsheet ${targetLabel}` });
    }
  }
  return candidates;
}

export function extractLatestNipponFeedCandidates(html: string): PublicFeedCandidate[] {
  const $ = cheerio.load(html);
  const candidates = new Map<string, PublicFeedCandidate>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    const label = $(element).text().replace(/\s+/g, " ").trim();
    if (!/\.pdf(?:[?#]|$)/i.test(href) || !/(?:nippon[-_ ]fs|fundamentals[-_ -])/i.test(href)) return;
    const url = new URL(href, NIPPON_BASE_URL).toString();
    candidates.set(url, { url, label: label || href });
  });
  return Array.from(candidates.values()).sort((left, right) => periodScore(right.url) - periodScore(left.url));
}

export function extractFranklinFeedCandidates(payload: unknown, requested: RequestedFactsheetPeriod): PublicFeedCandidate[] {
  const monthNeedle = MONTHS[requested.month].toLowerCase();
  const yearNeedle = String(requested.year);
  const seen = new Set<string>();

  return collectFranklinRecords(payload)
    .filter((record) => {
      const title = record.dctermsTitle?.toLowerCase() ?? "";
      return record.dctermsType?.toLowerCase() === "factsheet" && title.includes(monthNeedle) && title.includes(yearNeedle) && title.includes("factsheet as on");
    })
    .map((record) => {
      const rawPath = record.literatureHref!;
      const downloadPath = rawPath.startsWith("http") || rawPath.startsWith("/download/") ? rawPath : `/download${rawPath}`;
      return { url: new URL(downloadPath, FRANKLIN_BASE_URL).toString(), label: record.dctermsTitle! };
    })
    .filter((candidate) => {
      if (seen.has(candidate.url)) return false;
      seen.add(candidate.url);
      return true;
    });
}

export function extractSundaramArchiveCandidate(payload: unknown, requested: RequestedFactsheetPeriod): PublicFeedCandidate[] {
  if (typeof payload !== "string") return [];
  const url = payload.trim().replace(/^['"]|['"]$/g, "");
  if (!/^https:\/\//i.test(url) || !/\.pdf(?:$|[?#])/i.test(url)) return [];
  return [{ url, label: `Sundaram consolidated factsheet ${MONTHS[requested.month]} ${requested.year}` }];
}

export async function discoverOfficialPublicFeedCandidates(amcSlug: string, requested: RequestedFactsheetPeriod): Promise<PublicFeedCandidate[]> {
  if (amcSlug === "sundaram") {
    const month = String(requested.month + 1).padStart(2, "0");
    const response = await axios.post(
      `${SUNDARAM_BASE_URL}/ajax/Modules_Forms_Downloads_Fundwise_Factsheet,App_Web_v2aypqkp.ashx?_method=DownloadArchive&_session=no`,
      `cat=1\r\nmnth=${month}/${requested.year}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          Accept: "*/*",
          "Accept-Language": "en-IN,en;q=0.9",
          "Content-Type": "text/plain;charset=UTF-8",
          Origin: SUNDARAM_BASE_URL,
          Referer: `${SUNDARAM_BASE_URL}/fundwise-factsheet`,
        },
        timeout: 30_000,
        validateStatus: (status) => status === 200,
        responseType: "text",
      }
    );
    return extractSundaramArchiveCandidate(response.data, requested);
  }
  if (amcSlug === "dsp") {
    const response = await axios.get("https://www.dspim.com/downloads.json", {
      params: { page: 1, per_page: 100, category: "Information Documents", sub_category: "Factsheets", sort: "latest-insight" },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: "https://www.dspim.com/downloads?category=Information%20Documents&sub_category=Factsheets",
      },
      timeout: 20_000,
      validateStatus: (status) => status === 200,
    });
    return extractDspFeedCandidates(response.data, requested);
  }
  if (amcSlug === "franklin-templeton") {
    const response = await axios.get(`${FRANKLIN_BASE_URL}/api/literature/v1/responseLitJson`, {
      params: { type: "download" },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: `${FRANKLIN_BASE_URL}/downloads/fund-literature`,
      },
      timeout: 30_000,
      validateStatus: (status) => status === 200,
    });
    return extractFranklinFeedCandidates(response.data, requested);
  }
  if (amcSlug !== "mirae-asset") return [];

  const response = await axios.post(
    `${MIRAE_BASE_URL}/AjaxService/GetDownloadsData`,
    { request: { modulename: "Factsheet", pgno: 1, pgsize: 100 } },
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/json; charset=utf-8",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: `${MIRAE_BASE_URL}/downloads/factsheet`,
      },
      timeout: 20_000,
      validateStatus: (status) => status === 200,
    }
  );
  return extractMiraeFeedCandidates(response.data, requested);
}

/** Discover the newest document currently published by an official JSON feed. */
export async function discoverOfficialLatestPublicFeedCandidates(amcSlug: string): Promise<PublicFeedCandidate[]> {
  if (amcSlug === "hdfc") return extractLatestHdfcFeedCandidates();
  if (amcSlug === "icici-prudential") {
    return [{ url: "https://www.icicipruamc.com/blob/knowledgecentre/factsheet-complete/Complete.pdf", label: "ICICI Prudential Complete Factsheet" }];
  }
  if (amcSlug === "nippon-india") {
    const response = await axios.get(NIPPON_FACTSHEET_ARCHIVE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: NIPPON_FACTSHEET_ARCHIVE_URL,
      },
      timeout: 30_000,
      validateStatus: (status) => status === 200,
      responseType: "text",
    });
    return extractLatestNipponFeedCandidates(response.data).slice(0, 2);
  }
  if (amcSlug === "dsp") {
    const response = await axios.get("https://www.dspim.com/downloads.json", {
      params: { page: 1, per_page: 100, category: "Information Documents", sub_category: "Factsheets", sort: "latest-insight" },
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: "https://www.dspim.com/downloads?category=Information%20Documents&sub_category=Factsheets",
      },
      timeout: 20_000,
      validateStatus: (status) => status === 200,
    });
    return extractLatestDspFeedCandidates(response.data);
  }
  if (amcSlug !== "mirae-asset") return [];

  const response = await axios.post(
    `${MIRAE_BASE_URL}/AjaxService/GetDownloadsData`,
    { request: { modulename: "Factsheet", pgno: 1, pgsize: 100 } },
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/json; charset=utf-8",
        "Accept-Language": "en-IN,en;q=0.9",
        Referer: `${MIRAE_BASE_URL}/downloads/factsheet`,
      },
      timeout: 20_000,
      validateStatus: (status) => status === 200,
    }
  );
  return extractLatestMiraeFeedCandidates(response.data);
}
