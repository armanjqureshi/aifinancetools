# Dynamic Archive Discovery Priority

## Scope

The July 2026 coverage baseline verifies 28 of 50 AMC sources. Aditya Birla's subsequently verified July archive document is pending the next coverage refresh. This priority list excludes sources that already have an exact verified July snapshot and focuses on pages where an official archive control or client-side record request is likely to expose a retrievable PDF.

## Implementation Waves

| Wave | AMC sources | Why this order |
|---|---|---|
| 1 | SBI, DSP, Kotak, Bandhan, Baroda BNP Paribas | Large or material unresolved sources with visible factsheet/download pages, selector controls, or client-rendered archive shells. |
| 2 | Franklin Templeton, JM Financial, PGIM India, Sundaram, Taurus | Official literature/download pages that need first-party record request inspection. |
| 3 | 360 ONE, Old Bridge, WhiteOak, Edelweiss, The Wealth Company | Sources with dynamic hashes, period mismatch evidence, access denial, or an existing direct-link fallback that require a more constrained approved-access path. |

The method for every wave is the same: invoke the official page's own archive controls, capture its first-party record response, validate the selected PDF's content month, and only then add a source adapter. No document URL is inferred from a guessed token or filename substitution.
