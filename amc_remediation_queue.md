# AMC Factsheet Download Remediation Queue

## Priority 1 — Official Server Denial

| AMC | Observed result | Safe remediation path |
|---|---|---|
| HDFC Mutual Fund | Official page and archive are browser-visible; server receives HTTP 403 | Identify an approved public historical-document API or obtain AMC allowlisting; do not bypass the access control. |
| Edelweiss Mutual Fund | Registered official page returns HTTP 403 to the server | Use an approved public document feed or exact direct official link. |

## Priority 2 — Official Source Times Out

| AMC | Observed result | Safe remediation path |
|---|---|---|
| Bajaj Finserv, DSP, Kotak, Quant, Quantum, Trust, Union | Official source did not respond within the bounded request window | Find a documented API, CDN document path, or browser-observed first-party request and then validate its PDF date. |

## Priority 3 — Dynamic or No Server-Readable Link

| AMC group | Sources |
|---|---|
| Dynamic listing or archive UI | 360 ONE, Aditya Birla, Bandhan, Bank of India, Baroda BNP Paribas, Choice, Franklin Templeton, JioBlackRock, JM Financial, Mahindra Manulife, Mirae Asset, Motilal Oswal, PGIM India, Samco, SBI, Sundaram, Taurus, The Wealth Company, WhiteOak, Zerodha |
| No requested-month result in current static source | Old Bridge |

Each source must be recovered through an official archive/API path or direct official document link. Dynamic hashes, timestamps, and filename substitutions must never be guessed.
