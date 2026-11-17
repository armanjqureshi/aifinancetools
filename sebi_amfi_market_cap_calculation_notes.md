# SEBI/AMFI Market-Cap Calculation Research

## Official classification source

The calculation must use the dated **AMFI Categorisation of Large, Mid and Small Cap Stocks** dataset, not a current market-data estimate. AMFI states that it prepares the stock list in consultation with SEBI and stock exchanges under SEBI circular `SEBI/HO/IMD/DF3/CIR/P/2017/114` dated 6 October 2017. The official AMFI page exposes a 2026 **Jan–June** Excel and PDF dataset.

Source page: <https://www.amfiindia.com/otherdata/categorisation-of-stocks>

Official 2026 Jan–June workbook: <https://portal.amfiindia.com/spages/AverageMarketCapitalization30Jun2026.xlsx>

The workbook’s primary sheet records `Sr. No.`, `Company name`, `ISIN`, BSE/NSE/MSEI symbols, exchange market-cap averages, `Average of All Exchanges (Rs. Cr.)`, and `Categorization as per SEBI Circular dated Oct 6, 2017`. The first data row is Reliance Industries Ltd (`INE002A01018`) categorised as `Large Cap`; the dataset therefore supports an auditable ISIN-first mapping before normalized-name matching.

## Initial design rules

1. Match each factsheet to the latest official AMFI classification snapshot that was effective on the factsheet’s reporting date; never use a later reclassification without clearly labelling it.
2. Map equity holdings by ISIN where available, then by normalized company/security name with an explicit review state for ambiguous matches.
3. Aggregate portfolio weights only for verified equity-company mappings. Keep cash, debt, ETFs, REITs, InvITs, derivatives, and unresolved securities as separate buckets.
4. Label the calculated result as **Calculated from holdings using the dated AMFI classification list**, distinct from any allocation printed in the factsheet.
5. Persist the AMFI source URL, classification period, mapped securities, unmapped securities, and calculation confidence so every result can be audited or corrected.

## Imported July 2026 snapshot

The official workbook has been imported as snapshot `1`, effective **1 July 2026**. It contains **5,427** classified securities: **100 large-cap**, **150 mid-cap**, and **5,177 small-cap**. Every calculated result retains this snapshot identifier and official source URL so that the classification decision can be reproduced during review.

## End-to-end page-evidence validation

The cached **HDFC Flexi Cap Fund** July 2026 factsheet (document `2100001`) was validated against its original selected-scheme page. PDF page **7** has the exact standalone scheme heading and a full `PORTFOLIO` table with equity, REIT, debt, cash, subtotals, and a `Grand Total 100.00`. The reader recovered 81 page-local holdings totalling 100.00% and retained the result as `full_portfolio`; the nearby “Top Ten Holdings” footnote was correctly treated as a flag for individual rows rather than a top-holdings-table header.

The calculation selected snapshot `1` because it was effective on the July 2026 reporting date. It mapped 69 holdings and retained 12 unresolved holdings, producing 93.69% mapped holding-weight coverage. Its status is therefore **partial**, not verified. The calculated allocation is stored separately from factsheet-disclosed market-cap allocation and persists the snapshot, mapped holdings, unresolved holdings, coverage, and status for audit.
