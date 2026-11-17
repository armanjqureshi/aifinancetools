# June 2026 Fallback Audit

## Scope

The audit retried exactly the **30 AMC sources that did not produce a verified July 2026 PDF** in the prior selected-period audit. It requested June 2026 from each registered official source using four bounded concurrent workers. No document was stored during this audit.

## Result

| Requested period | Sources audited | PDFs verified and stored | Sources without a verified June PDF |
|---|---:|---:|---:|
| June 2026 | 30 | 0 | 30 |

Every attempted source either exposed no server-readable June factsheet link, timed out, or returned an official access denial. The downloader correctly rejected all of these outcomes rather than storing a wrong-period document.

| Outcome group | Count | Sources |
|---|---:|---|
| No June link exposed in server-readable content | 21 | 360 ONE, Aditya Birla, Bandhan, Bank of India, Baroda BNP Paribas, Choice, Franklin Templeton, JioBlackRock, JM Financial, Mahindra Manulife, Mirae Asset, Motilal Oswal, Old Bridge, PGIM India, Samco, SBI, Sundaram, Taurus, The Wealth Company, WhiteOak, Zerodha |
| Official source timed out | 7 | Bajaj Finserv, DSP, Kotak, Quant, Quantum, Trust, Union |
| Official source returned HTTP 403 | 2 | Edelweiss, HDFC |

## Data Integrity

The July audit outcomes were not overwritten. Because no PDF passed June reporting-period validation, no fallback document was inserted into storage or the database.
