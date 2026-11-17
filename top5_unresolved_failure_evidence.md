# Top Five July-Unresolved AMC Failure Evidence

## Retrieval Test Basis

The application was asked for **July 2026** through the same registry downloader used by the workspace. The five sources were selected by AMFI's latest available April–June 2026 average-AUM table, while the factsheet failure period remains July 2026.

| AMC | Application reproduction outcome | Official page evidence |
|---|---|---|
| SBI Mutual Fund | `No factsheet PDF link found` | The official factsheet page exposes year and month selectors, but no server-readable document link in its initial HTML. |
| Kotak Mahindra Mutual Fund | `Official access required` | The official Forms and Downloads page lists Factsheet as an investor resource, but the document host times out or declines the server request. |
| Aditya Birla Sun Life Mutual Fund | `No July 2026 factsheet link was exposed` | The official factsheet page returns `No Record(s) Found` to server-side extraction. |
| DSP Mutual Fund | `not a valid PDF` | The official Download Center returns `0 items found` and a loading shell to server-side extraction; the tested static July candidate did not yield a PDF. |
| Mirae Asset Mutual Fund | `reports March 2020` | Mirae's public feed named July 2026 records, but both linked PDF contents extracted as March 2020. The latest August 2026 feed record was separately content-verified and stored. |

## Primary URLs

- AMFI monthly average-AUM endpoint: `https://www.amfiindia.com/api/average-aum-fundwise?fyId=1&periodId=1`
- SBI factsheets: `https://www.sbimf.com/factsheets`
- Kotak Forms and Downloads: `https://www.kotakmf.com/Information/forms-and-downloads`
- Aditya Birla Factsheets: `https://mutualfund.adityabirlacapital.com/forms-and-downloads/factsheets`
- DSP Download Center: `https://www.dspim.com/downloads?category=Information%20Documents&sub_category=Factsheets`
- Mirae factsheets: `https://www.miraeassetmf.co.in/downloads/factsheet`

## Remediation Priority

| Priority | AMC | Root cause | Compliant remediation path | Expected benefit |
|---:|---|---|---|---|
| 1 | SBI Mutual Fund | The public page is a year/month selector shell; the registered server scrape sees selector labels but no actual PDF link. | Observe and reproduce SBI's own month-selection metadata/API request, then select only the exact July record and validate its PDF text. | Recovers the largest unresolved AMC without guessing URLs. |
| 2 | Kotak Mahindra Mutual Fund | The registered investor-resource page is discoverable, but the document request needs a public feed, a stable delivery domain, or approved source access. | Identify Kotak's official document listing endpoint or obtain a vendor-approved allowlist/API route; retain direct-link validation until then. | Recovers the second-largest unresolved AMC and removes a hard access gate. |
| 3 | Aditya Birla Sun Life Mutual Fund | The server receives an empty archive result (`No Record(s) Found`) rather than the selected-month records. | Capture the archive page's official date/filter request and invoke that record feed directly. | Converts a dynamic archive into a deterministic period adapter. |
| 4 | DSP Mutual Fund | The Download Center is client-rendered and returns a `0 items found` shell to ordinary server extraction; the tested static candidate was HTML, not a PDF. | Use the Download Center's official search-results API or preloaded record payload; reject any target lacking the `%PDF` signature before parsing. | Eliminates false static-path attempts and can recover a high-AUM AMC. |
| 5 | Mirae Asset Mutual Fund | The public feed's historical July titles link to stale March 2020 PDF content, while its current August record is valid. | Keep the public-feed adapter, add a content-period freshness rule per record, and accept a record only when its PDF period equals the requested month. | Already retrieves the latest August factsheet safely; historical coverage depends on Mirae correcting or exposing valid July links. |
