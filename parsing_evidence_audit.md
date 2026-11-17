# Factsheet Parsing Evidence Audit

## Abakkus Flexi Cap Fund — July 2026

**Official PDF:** https://www.abakkusmf.com/uploads/Abakkus_Mutual_Fund_Factsheet_July_2026_7d7bfc4d4b.pdf

The user supplied a cropped visual excerpt headed **“MARKET CAP ALLOCATION %”**. The crop does not retain the scheme heading, so its 5.84% / 3.25% / 78.90% values must **not** be assigned to Abakkus Flexi Cap Fund without page-level verification. It is retained as an example of why visual label-to-value associations must be checked against the full page.

The full official PDF was independently cross-checked. On **PDF page 9** (printed page 7), the page header and chart legend explicitly identify **Abakkus Flexi Cap Fund** with the following values:

| Allocation label | Verified percentage |
|---|---:|
| Large Cap | 44.79% |
| Mid Cap | 19.13% |
| Small Cap | 29.20% |
| Cash & Cash Equivalents | 6.88% |

The PDF text extractor preserves these legend rows on page 9 but the earlier scheme-boundary routine did not select that page reliably. This is a confirmed page-association failure, not an absence of disclosure. The hybrid reader treats it as a page-level visual chart requiring vision extraction, caches the result against the document and selected scheme, and returns the visual evidence with the allocation response.

## HDFC Flexi Cap Fund — July 2026

The cached HDFC July 2026 factsheet includes a consolidated market-cap table on **PDF page 107**. The table header explicitly lists `SCHEME`, `Large Cap`, `MidCap`, and `SmallCap`, and the exact `HDFC Flexi Cap Fund` row reads 70.94%, 14.42%, and 11.00% respectively.

This is a verified selected-scheme table row, not a nearby scheme-page inference. The reader now parses this exact page-level row from the cached signed PDF before attempting visual verification, retains page 107 as evidence, and does not use the immediately adjacent HDFC Small Cap Fund row.

## Workspace validation — 19 August 2026

The workspace continues to render the cached-factsheet selector with **50 stored** AMC documents after page-evidence safeguards were added. The selection entry point remains separate from new and historical AMC retrieval, preserving the no-redownload workflow.

## Industry/Sector and portfolio page-evidence audit — 19 August 2026

The selected-scheme page reader was run against **HDFC Flexi Cap Fund**, **SBI Flexicap Fund**, **Franklin India Large Cap Fund**, and **Mirae Asset Large Cap Fund**. It now withholds Industry/Sector and portfolio data unless the selected scheme page contains an explicit allocation or holdings table with structurally reliable labels. HDFC’s earlier manager-table and fragmented holding output was suppressed. SBI, Franklin, and Mirae returned `no_table_on_page` rather than unsupported values. These outcomes are intentional: an unavailable allocation is safer and more transparent than a wrong allocation.
