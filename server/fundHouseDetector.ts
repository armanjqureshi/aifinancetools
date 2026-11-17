/**
 * Fund House Detection and Factsheet URL Mapping
 *
 * Detects the fund house from a mutual fund name and provides
 * the factsheet download URL for each supported fund house.
 */

export type FundHouse =
  | "HDFC"
  | "ICICI Prudential"
  | "Axis"
  | "SBI"
  | "Aditya Birla"
  | "Kotak"
  | "UTI"
  | "Nippon India"
  | "DSP"
  | "Franklin Templeton"
  | "Mirae Asset"
  | "Tata"
  | "IDFC"
  | "Canara Robeco"
  | "Edelweiss"
  | "PGIM India"
  | "Invesco"
  | "Motilal Oswal"
  | "Quant"
  | "Bandhan"
  | "Unknown";

interface FundHouseConfig {
  name: FundHouse;
  patterns: RegExp[];
  factsheetUrl: string;
  factsheetPageUrl: string;
}

export const FUND_HOUSE_CONFIGS: FundHouseConfig[] = [
  {
    name: "HDFC",
    patterns: [/\bhdfc\b/i],
    factsheetUrl: "https://files.hdfcfund.com/s3fs-public/",
    factsheetPageUrl: "https://www.hdfcfund.com/mutual-funds/factsheets",
  },
  {
    name: "ICICI Prudential",
    patterns: [/\bicici\b/i, /icici\s*pru/i, /icici\s*prudential/i],
    factsheetUrl: "https://www.icicipruamc.com/",
    factsheetPageUrl: "https://www.icicipruamc.com/knowledge-center/fund-feature",
  },
  {
    name: "Axis",
    patterns: [/\baxis\b/i],
    factsheetUrl: "https://www.axismf.com/",
    factsheetPageUrl: "https://www.axismf.com/downloads",
  },
  {
    name: "SBI",
    patterns: [/\bsbi\b/i],
    factsheetUrl: "https://www.sbimf.com/",
    factsheetPageUrl: "https://www.sbimf.com/en-us/downloads",
  },
  {
    name: "Aditya Birla",
    patterns: [/aditya\s*birla/i, /\babc\b.*fund/i, /\babsl\b/i],
    factsheetUrl: "https://mutualfund.adityabirlacapital.com/",
    factsheetPageUrl: "https://mutualfund.adityabirlacapital.com/Investor-Services/Downloads",
  },
  {
    name: "Kotak",
    patterns: [/\bkotak\b/i],
    factsheetUrl: "https://www.kotakmf.com/",
    factsheetPageUrl: "https://www.kotakmf.com/General/Downloads",
  },
  {
    name: "UTI",
    patterns: [/\buti\b/i],
    factsheetUrl: "https://www.utimf.com/",
    factsheetPageUrl: "https://www.utimf.com/downloads",
  },
  {
    name: "Nippon India",
    patterns: [/nippon/i, /\bnim\b/i],
    factsheetUrl: "https://mf.nipponindiaim.com/",
    factsheetPageUrl: "https://mf.nipponindiaim.com/FundsAndPerformance/Pages/Downloads.aspx",
  },
  {
    name: "DSP",
    patterns: [/\bdsp\b/i],
    factsheetUrl: "https://www.dspim.com/",
    factsheetPageUrl: "https://www.dspim.com/downloads",
  },
  {
    name: "Franklin Templeton",
    patterns: [/franklin/i, /templeton/i],
    factsheetUrl: "https://www.franklintempletonindia.com/",
    factsheetPageUrl: "https://www.franklintempletonindia.com/investor/resources/downloads",
  },
  {
    name: "Mirae Asset",
    patterns: [/mirae/i],
    factsheetUrl: "https://www.miraeassetmf.co.in/",
    factsheetPageUrl: "https://www.miraeassetmf.co.in/downloads",
  },
  {
    name: "Tata",
    patterns: [/\btata\b/i],
    factsheetUrl: "https://www.tatamutualfund.com/",
    factsheetPageUrl: "https://www.tatamutualfund.com/downloads",
  },
  {
    name: "Canara Robeco",
    patterns: [/canara/i, /robeco/i],
    factsheetUrl: "https://www.canararobeco.com/",
    factsheetPageUrl: "https://www.canararobeco.com/downloads",
  },
  {
    name: "Edelweiss",
    patterns: [/edelweiss/i],
    factsheetUrl: "https://www.edelweissmf.com/",
    factsheetPageUrl: "https://www.edelweissmf.com/downloads",
  },
  {
    name: "PGIM India",
    patterns: [/pgim/i],
    factsheetUrl: "https://www.pgimindiamf.com/",
    factsheetPageUrl: "https://www.pgimindiamf.com/downloads",
  },
  {
    name: "Invesco",
    patterns: [/invesco/i],
    factsheetUrl: "https://www.invescomutualfund.com/",
    factsheetPageUrl: "https://www.invescomutualfund.com/downloads",
  },
  {
    name: "Motilal Oswal",
    patterns: [/motilal/i, /oswal/i],
    factsheetUrl: "https://www.motilaloswalmf.com/",
    factsheetPageUrl: "https://www.motilaloswalmf.com/downloads",
  },
  {
    name: "Quant",
    patterns: [/\bquant\b/i],
    factsheetUrl: "https://www.quantmutual.com/",
    factsheetPageUrl: "https://www.quantmutual.com/downloads",
  },
  {
    name: "Bandhan",
    patterns: [/bandhan/i],
    factsheetUrl: "https://www.bandhanmutual.com/",
    factsheetPageUrl: "https://www.bandhanmutual.com/downloads",
  },
  {
    name: "IDFC",
    patterns: [/\bidfc\b/i],
    factsheetUrl: "https://www.idfcmf.com/",
    factsheetPageUrl: "https://www.idfcmf.com/downloads",
  },
];

/**
 * Detect the fund house from a mutual fund name.
 */
export function detectFundHouse(fundName: string): FundHouse {
  for (const config of FUND_HOUSE_CONFIGS) {
    for (const pattern of config.patterns) {
      if (pattern.test(fundName)) {
        return config.name;
      }
    }
  }
  return "Unknown";
}

/**
 * Get the fund house configuration by name.
 */
export function getFundHouseConfig(fundHouse: FundHouse): FundHouseConfig | undefined {
  return FUND_HOUSE_CONFIGS.find((c) => c.name === fundHouse);
}

/**
 * Get the factsheet page URL for a fund house.
 */
export function getFactsheetPageUrl(fundHouse: FundHouse): string {
  const config = getFundHouseConfig(fundHouse);
  return config?.factsheetPageUrl ?? "";
}

/** Resolve legacy detector labels to user-registered AMC registry slugs. */
export function getRegisteredAmcSlug(fundHouse: FundHouse): string | undefined {
  const slugs: Partial<Record<FundHouse, string>> = {
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
  return slugs[fundHouse];
}

export const ALL_FUND_HOUSES: FundHouse[] = FUND_HOUSE_CONFIGS.map((c) => c.name);
