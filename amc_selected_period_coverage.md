# AMC Selected-Period Retrieval Coverage

## Scope and Method

This status captures the 14 August 2026 server-side audit for a **July 2026** request. The downloader was required to retrieve a PDF, parse its text, and confirm the printed reporting period before treating the request as successful. A source page, filename, or upload month alone is not sufficient.

| Audit outcome | AMC count | Interpretation |
|---|---:|---|
| Verified July 2026 PDF | 20 | The selected-period downloader fetched a PDF and parsed July 2026 from the content. |
| Not retrieved in the audit | 30 | The page was blocked, dynamic, timed out, lacked a July link, or needs a dedicated archive adapter. |

The 20 verified sources in the audit were **Abakkus, Angel One, Axis, Canara Robeco, Capitalmind, Groww, Helios, HSBC, ICICI Prudential, Invesco, ITI, LIC, Navi, Nippon India, NJ, PPFAS, Shriram, Tata, Unifi, and UTI**. The runtime now also keeps the verified 360 ONE July archive-card selection separate from that PDF's detected August reporting date.

## Supplied Official Reference Classification

| AMC | Supplied-reference status | Verified period or access result | Runtime treatment |
|---|---|---|---|
| HDFC | Server-blocked | Direct link returned HTTP 403 to the server | Preserve exact direct-link fallback; do not guess archive URLs. |
| Axis | PDF period verified | July 2026 | Uses the observed static month/year filename pattern. |
| Edelweiss | Server-blocked | Direct link returned HTTP 403 to the server | Preserve exact direct-link fallback. |
| ICICI Prudential | PDF period verified | July 2026 | Uses the verified `Complete.pdf` snapshot only for July 2026. |
| Invesco | PDF period verified | July 2026 | Uses the observed date-based filename pattern, with parsed-PDF validation. |
| ITI | PDF period verified | July 2026 | Retains July snapshot only; the upload token is not extrapolated. |
| Mahindra Manulife | Server-blocked | Direct link returned HTTP 403 to the server | Needs a server-readable archive page or browser-observed request. |
| Navi | PDF period verified | July 2026 | Retains July snapshot only; dynamic timestamp is not extrapolated. |
| UTI | PDF period verified | July 2026 | Upload path says August, but PDF text says July; the verified PDF date governs. |
| WhiteOak | Server-blocked | Direct link returned HTTP 403 to the server | Needs a server-readable archive page or browser-observed request. |
| JioBlackRock | Content unavailable | Content request timed out after headers | Needs a working archive page or a server-readable official URL. |

## Safeguards

The workspace now supports month and year selection, exact-period cache reuse, and a direct official PDF fallback. Every ordinary selected-period request must match the PDF's parsed reporting month. The one documented exception is **360 ONE**, where the official July archive card links to a PDF with August printed inside it; both values are retained and displayed separately rather than relabelling the PDF.
