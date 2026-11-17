/**
 * AMC Source Discovery
 *
 * Scrapes registered AMC source pages to extract scheme names and
 * persist them in the scheme_catalog table. This runs after each
 * successful factsheet download so the scheme search catalog grows
 * automatically over time.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { getDb, upsertSchemeCatalogEntry, normalizeSchemeName } from "./db";
import { amcSources, amcs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import https from "https";

const BASE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const RELAXED_AGENT = new https.Agent({ rejectUnauthorized: false });

/** Common scheme-name patterns in Indian mutual fund factsheets. */
const SCHEME_NAME_PATTERNS = [
  /([A-Z][A-Za-z\s&\-]+(?:Fund|Scheme|Plan|ETF|FoF|FOF))/g,
];

/**
 * Discover scheme names from a registered AMC source page and persist them.
 * Returns the number of new or updated scheme records.
 */
export async function discoverSchemesFromSource(amcId: number, sourceUrl: string): Promise<number> {
  try {
    const response = await axios.get(sourceUrl, {
      headers: { "User-Agent": BASE_UA, Accept: "text/html,*/*", Referer: sourceUrl },
      timeout: 20_000,
      httpsAgent: RELAXED_AGENT,
    });

    const $ = cheerio.load(response.data as string);
    const discovered = new Set<string>();

    // Extract scheme names from anchor text and heading elements
    $("a, h2, h3, h4, li, td").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 8 || text.length > 200) return;
      for (const pattern of SCHEME_NAME_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
          const candidate = match[1].trim();
          if (candidate.length >= 8 && candidate.length <= 180) {
            discovered.add(candidate);
          }
        }
      }
    });

    let count = 0;
    for (const name of Array.from(discovered)) {
      await upsertSchemeCatalogEntry({
        amcId,
        name,
        normalizedName: normalizeSchemeName(name),
        sourceType: "discovered",
        isActive: 1,
      });
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * Run discovery for all registered AMC sources that use html or selector
 * discovery modes. Called from the run pipeline after each successful download.
 */
export async function discoverAllAmcSchemes(): Promise<{ amcName: string; discovered: number }[]> {
  const db = await getDb();
  if (!db) return [];

  const sources = await db
    .select({
      id: amcSources.id,
      amcId: amcSources.amcId,
      amcName: amcs.name,
      sourceUrl: amcSources.sourceUrl,
      discoveryMode: amcSources.discoveryMode,
    })
    .from(amcSources)
    .innerJoin(amcs, eq(amcSources.amcId, amcs.id))
    .where(eq(amcSources.isActive, 1));

  const eligibleSources = sources.filter((source) => source.discoveryMode === "html" || source.discoveryMode === "selector");
  const discovered = await Promise.all(
    eligibleSources.map(async (source) => ({
      amcName: source.amcName,
      discovered: await discoverSchemesFromSource(source.amcId, source.sourceUrl),
    }))
  );
  return discovered.filter((result) => result.discovered > 0);
}
