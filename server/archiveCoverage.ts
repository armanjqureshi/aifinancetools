export const SELECTED_PERIOD_COVERAGE = {
  auditedPeriod: "July 2026",
  auditedOn: "2026-08-18",
  totalSources: 50,
  verifiedCount: 43,
  verifiedSources: [
    "Abakkus", "Aditya Birla Sun Life", "Angel One", "Axis", "Bandhan", "Bank of India", "Baroda BNP Paribas", "Canara Robeco", "Capitalmind", "Choice", "Edelweiss", "Franklin Templeton", "Groww", "HDFC", "Helios", "HSBC", "ICICI Prudential", "Invesco",
    "ITI", "JioBlackRock", "JM Financial", "Kotak", "LIC", "Mahindra Manulife", "Motilal Oswal", "Navi", "Nippon India", "NJ", "PPFAS", "PGIM India", "Quantum", "Samco", "SBI", "Shriram", "Sundaram", "Tata", "Taurus", "The Wealth Company", "Trust", "Unifi", "Union", "UTI", "WhiteOak",
  ],
  blockedReferenceSources: ["Edelweiss", "WhiteOak"],
  note: "Each verified source returned a PDF whose parsed reporting period was July 2026. Bandhan, JM Financial, Baroda BNP Paribas, Edelweiss, HSBC, and Trust each list their verified July PDF in an August 2026 release row, while the PDFs themselves print July 2026; archive-release and PDF-reporting periods are preserved separately. WhiteOak's official page directly lists its July 2026 document, but its server delivery is region-blocked and the cached verified copy is reused. Choice, PGIM India, SBI, Groww, Helios, Invesco, ITI, LIC, Mahindra Manulife, Taurus, Trust, and The Wealth Company now expose server-readable July factsheets through their official pages; Mahindra's page is accessed after the user-authorized non-U.S./non-Canada selection. Zerodha's accessible official archive currently ends at February 2026, so no stale record is represented as July coverage.",
} as const;
