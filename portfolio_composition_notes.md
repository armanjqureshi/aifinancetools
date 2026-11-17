# Portfolio Composition Validation Notes

## DSP Global Innovation Overseas Equity Omni FoF — July 2026

The stored DSP Mutual Fund factsheet (document `2700001`) contains the exact selected scheme heading **DSP Global Innovation Overseas Equity Omni FoF** and a same-page portfolio table on PDF page **23**. The table is a complete portfolio, not an Industry/Sector allocation. It has a `Name of Instrument` and `% to Net Assets` structure, category blocks, subtotals, and a `GRAND TOTAL 100.00`.

| Portfolio category | Verified examples | Subtotal / weight |
|---|---|---:|
| Money Market Instruments | TREPS / Reverse Repo Investments | 3.86% |
| Others / Overseas Mutual Fund | Bluebox Global Technology Fund; iShares NASDAQ 100 UCITS ETF; Invesco NASDAQ-100 Equal Weight UCITS ETF; KraneShares CSI China Internet ETF | 96.37% |
| Cash & Cash Equivalent | Net Receivables/Payables | -0.24% |
| Grand Total | Complete portfolio table | 100.00% |

The deterministic page-local reader now preserves categories, instrument rows, subtotals, negative cash rows, and grand total. It identified the complete table in **4.8 seconds**. Before the targeted fast path, the same read unnecessarily invoked visual fallback and took about **24.7 seconds**. A production-equivalent selected-scheme benchmark, including the safe no-market-cap visual-skip gate, completed in **5.6 seconds** while returning no unsupported Industry/Sector or market-cap allocation.
