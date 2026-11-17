# Evidence-First Factsheet Reader Benchmark — 19 August 2026

This benchmark verifies that market-cap allocations are returned only after the reader identifies the selected scheme (or an explicit same-page former-name statement), the relevant PDF page, and a market-cap table or chart on that same page.

| AMC | Selected scheme | Result | Evidence page | Outcome |
| --- | --- | --- | ---: | --- |
| Abakkus Mutual Fund | Abakkus Flexi Cap Fund | Verified chart | 9 | Large 44.79%, Mid 19.13%, Small 29.20%, Cash 6.88% |
| Axis Mutual Fund | Axis Bluechip Fund | Verified renamed scheme | 8 | Current heading is Axis Large Cap Fund; page explicitly says formerly known as Axis Bluechip Fund. Large 92.40%, Mid 4.09% |
| DSP Mutual Fund | DSP Flexi Cap Fund | Verified text table | 4 | Large 59.96%, Mid 21.48%, Small 11.03% |
| Franklin Templeton India | Franklin India Large Cap Fund | Withheld | — | Exact scheme/page response was not valid enough to trust; queued for review rather than displaying a value |
| HDFC Mutual Fund | HDFC Flexi Cap Fund | Verified consolidated table | 107 | Page-level table row for HDFC Flexi Cap Fund: Large 70.94%, Mid 14.42%, Small 11.00% |
| ICICI Prudential Mutual Fund | ICICI Prudential Large Cap Fund | Withheld | 14 | The selected scheme page has portfolio and sector information but no numerical market-cap allocation table/chart |
| Mirae Asset Mutual Fund | Mirae Asset Large Cap Fund | Withheld | — | Exact scheme/page response was not valid enough to trust; queued for review rather than displaying a value |
| SBI Mutual Fund | SBI Bluechip Fund | Verified renamed scheme | 13 | Current heading is SBI Large Cap Fund; page explicitly says previously known as SBI BlueChip Fund. Large 81.94%, Mid 13.64%, Small 1.97% |

## Reader policy

The application now treats a market-cap allocation as trustworthy only when the PDF evidence confirms the **selected scheme**, the **source page**, and the **market-cap table or chart** together. This includes an AMC-wide consolidated table only when the same page contains the exact selected-scheme row beneath explicit cap-bucket columns. Rename handling is permitted only where the same page explicitly identifies the selected scheme as a former name. All other outcomes are withheld and placed into the manual review queue with a failure class such as `no_scheme_page`, `no_table_on_page`, `provider_unavailable`, or `invalid_response`.
