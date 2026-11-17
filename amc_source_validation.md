# AMC Source Validation Notes

## 360 ONE Asset

- **Registered source:** `https://www.360.one/asset/mutual-funds/downloads/`
- **Observed structure:** a dynamic downloads page listing fund names and a Factsheet area; the initial rendered page did not expose a direct PDF URL.
- **Initial classification:** AMC-level source, requiring a DOM/API discovery adapter before automated factsheet retrieval.

## Abakkus Mutual Fund

- **Registered source:** `https://www.abakkusmf.com/factsheet.html`
- **Observed structure:** monthly consolidated AMC factsheets with direct PDF links on the page.
- **Latest observed document:** July 2026, `/uploads/Abakkus_Mutual_Fund_Factsheet_July_2026_7d7bfc4d4b.pdf`.
- **Initial classification:** AMC-level source with direct monthly PDF discovery.

## Aditya Birla Sun Life Mutual Fund

- **Registered source:** `https://mutualfund.adityabirlacapital.com/forms-and-downloads/factsheets`
- **Observed structure:** a factsheet page whose downloadable content is rendered dynamically; the initial page load did not expose PDF links.
- **Initial classification:** AMC-level source requiring a DOM/API discovery adapter.

## Angel One Mutual Fund

- **Registered source:** `https://www.angelonemf.com/downloads`
- **Observed structure:** an interactive downloads page with a dedicated Factsheets tab, with document rows appearing only after tab selection.
- **Initial classification:** AMC-level source requiring a tab-aware DOM/API discovery adapter.

## Axis Mutual Fund

- **Registered source:** `https://www.axismf.com/downloads`
- **Observed structure:** a dynamic downloads hub with no PDF records in its initial page payload.
- **Initial classification:** AMC-level source requiring a first-party API or dynamic-content discovery adapter.

## Bajaj Finserv AMC

- **Registered source:** `https://www.bajajamc.com/downloads?factsheet=`
- **Observed structure:** an AMC-level Factsheet download control with year and month selectors.
- **Initial classification:** monthly consolidated AMC factsheet source requiring selector/API-based discovery.

## Bandhan Mutual Fund

- **Registered source:** `https://bandhanmutual.com/downloads/factsheets`
- **Observed structure:** the page rendered without extractable factsheet content in the initial browser load.
- **Initial classification:** source registered; automated discovery requires a dynamic-page or alternate-endpoint adapter.

## Bank of India Mutual Fund

- **Registered source:** `https://www.boimf.in/investor-corner`
- **Observed structure:** the investor-corner page rendered without extractable factsheet content in the initial browser load.
- **Initial classification:** source registered; automated discovery requires a dynamic-page or alternate-endpoint adapter.

## Baroda BNP Paribas Mutual Fund

- **Registered source:** `https://www.barodabnpparibasmf.in/downloads/monthly-factsheet`
- **Observed structure:** a monthly, consolidated AMC factsheet source with year/month selectors and direct PDF downloads.
- **Latest observed document:** July 2026, `BBNPP_MF_Fund_Facts_July_2026_19491.pdf`.
- **Initial classification:** direct monthly AMC factsheet discovery.

## Canara Robeco Mutual Fund

- **Registered source:** `https://www.canararobeco.com/documents/forms-downloads/forms-information-documents/information-documents/factsheets/`
- **Observed structure:** a paginated archive of direct monthly factsheet PDFs.
- **Latest observed document:** June 2026, `Canara-Robeco-factsheet-as-on-June-2026.pdf`.
- **Initial classification:** direct monthly AMC factsheet discovery.

## Capitalmind Mutual Fund

- **Registered source:** `https://capitalmindmf.com/factsheet.html`
- **Observed structure:** a residency declaration gate prevents factsheet content from loading on initial access.
- **Initial classification:** source registered; discovery needs a compliant session-state adapter.

## Choice Mutual Fund

- **Registered source:** `https://choicemf.com/disclosures/factsheets`
- **Observed structure:** it supports a consolidated factsheet plus scheme selection and financial-year/month filtering.
- **Initial classification:** supports both consolidated and scheme-aware factsheet discovery through the page's dynamic data source.

## DSP Mutual Fund

- **Registered source:** `https://www.dspim.com/downloads?category=Information%20Documents&sub_category=Factsheets`
- **Observed structure:** a download center with a dedicated Digital Factsheet destination and dynamic category filtering.
- **Initial classification:** scheme-aware digital factsheet source requiring first-party data/API discovery.

## Edelweiss Mutual Fund

- **Registered source:** `https://www.edelweissmf.com/downloads/factsheets`
- **Observed structure:** a year/month selector with a direct consolidated factsheet link.
- **Latest observed document:** August 2026, `Edelweiss_Factsheet_August__2026_10082026160011.pdf`.
- **Initial classification:** direct monthly AMC factsheet discovery.

## Franklin Templeton India

- **Registered source:** `https://www.franklintempletonindia.com/downloads/fund-literature`
- **Observed structure:** a fund-literature hub, but browser access is currently blocked by a CAPTCHA challenge.
- **Initial classification:** source registered; automated discovery needs a compliant alternative source or a manual document fallback.

## Groww Mutual Fund

- **Registered source:** `https://www.growwmf.in/downloads/fact-sheet`
- **Observed structure:** a category-based document center with a fact-sheet section and separate factsheet disclosures.
- **Initial classification:** AMC source requiring category/API discovery of the actual monthly factsheet document.

## HDFC Mutual Fund

- **Registered source:** `https://www.hdfcfund.com/mutual-funds/factsheets`
- **Observed structure:** direct links to a consolidated monthly AMC factsheet and an index-solutions factsheet, plus an historical archive.
- **Latest observed document:** June 2026, `HDFC MF Factsheet - June 2026.pdf`.
- **Initial classification:** direct monthly AMC factsheet discovery.
