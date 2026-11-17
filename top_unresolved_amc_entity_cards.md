# Top Unresolved AMC Entity Cards

## Reference Date and Primary Ranking Source

The analysis uses the official AMFI **July 2026** monthly workbook as the ranking source. AMFI publishes the workbook at `https://portal.amfiindia.com/spages/amjul2026repo.xls` from its monthly data page. The application’s unresolved set is the 22 AMC sources without a PDF whose content validated as July 2026.

## Candidate Large Unresolved Brands

The initial candidate set for AUM ranking is SBI Mutual Fund, Kotak Mahindra Mutual Fund, Aditya Birla Sun Life Mutual Fund, DSP Mutual Fund, and Mirae Asset Mutual Fund. Final ordering and AUM values will be taken from the official workbook before root-cause analysis.

AMFI's official Average AUM page loads the Next.js script `/_next/static/chunks/app/aum-data/average-aum/page-c6ffae17d24e886d.js`; its data request will be inspected to retrieve the current AMC-wise AUM records.

The script exposes the first-party API `/api/average-aum-fundwise`. Its initial response returns financial-year options, including `id: 1` for April 2026–March 2027. The July AMC-wise records can be requested using the endpoint's additional period parameters identified in the same client script.

AMFI's Average AUM API currently exposes the first quarter of FY2026–27 as the period **April–June 2026**; it does not provide a July 2026 AMC-wise quarter. The root-cause ranking will therefore use this latest official AMC-wise AUM quarter as the size reference, while the retrieval failure reference date remains July 2026.

## Official AUM Ranking

The AMFI endpoint `https://www.amfiindia.com/api/average-aum-fundwise?fyId=1&periodId=1` returned the following average AUM values in ₹ crore for the latest available quarter (April–June 2026), using the `average_aum_excluding_domestic_including_overseas` field:

| Rank in July-unresolved set | AMC | Average AUM (₹ crore) |
|---:|---|---:|
| 1 | SBI Mutual Fund | 1,257,352.2888 |
| 2 | Kotak Mahindra Mutual Fund | 590,459.9953 |
| 3 | Aditya Birla Sun Life Mutual Fund | 427,675.2173 |
| 4 | DSP Mutual Fund | 229,801.5981 |
| 5 | Mirae Asset Mutual Fund | 224,952.4165 |

Bandhan Mutual Fund ranked next in the candidate comparison at 204,046.0497 ₹ crore. The five named above are therefore the target set for retrieval root-cause analysis.
