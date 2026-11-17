# Official AMC Access Remediation Audit

## HDFC Mutual Fund

The public page at `https://www.hdfcfund.com/mutual-funds/factsheets` is browser-accessible and exposes the current HDFC Mutual Fund factsheet as a direct official `files.hdfcfund.com` PDF. It also exposes a **View Historical Factsheet** control with a year selector from 2000 through 2026. The downloader's server request to the direct PDF remains HTTP 403, so this browser-visible archive alone does not yet create a safe server-side adapter. The next investigation step is to identify the site's public historical-year request or document metadata, without bypassing its access controls.

## Snapshot-backed source verification

| AMC | July 2026 outcome | Action |
|---|---|---|
| Choice | Verified PDF retrieved and parsed as July 2026 | The existing exact official snapshot is safe to retain. |
| Navi | Verified PDF retrieved and parsed as July 2026 | The existing exact official snapshot is safe to retain. |
| 360 ONE | Official July archive card retrieved; linked PDF reports August 2026 | Retain both archive-card and PDF-reported dates separately. |
| ITI | Official July snapshot timed out after 15 seconds | Retain direct-link fallback; do not assume the static archive API request until its payload is independently reproduced. |

## Hybrid registry verification

| AMC | Hybrid adapter outcome |
|---|---|
| HDFC | The official July 2026 PDF was successfully retrieved and parsed after applying ordinary document content-negotiation and language headers with the official factsheet page as referrer. |
| Mahindra Manulife | The exact official July PDF was retrieved and parsed with an extended bounded timeout. |
| JioBlackRock | The exact official July PDF was retrieved and parsed with an extended bounded timeout. |
| WhiteOak | The observed July-labelled URL was rejected because the PDF text reports September 2026; the registry correctly retains a dynamic/direct-link path rather than falsely accepting it. |

## Automatic coverage expansion — verified 16 August 2026

| AMC | Verified official July retrieval result |
|---|---|
| Motilal Oswal | The exact official date-labelled Active Funds PDF downloaded through the application downloader and parsed as July 2026. |
| Quantum | The exact official CDN document URL downloaded through the application downloader and parsed as July 2026. |
| Samco | The exact official media-domain document URL downloaded through the application downloader and parsed as July 2026. |
| Union | The exact official document URL downloaded through the application downloader and parsed as July 2026. |

The same bounded verification rejected the 360 ONE regular-plan candidate because its PDF reports August 2026, despite its July filename. Other unverified candidate hosts either did not respond within the bounded request window, failed ordinary HTTPS retrieval, or returned an access response; they were not added to the automatic registry.

## Verified public feed discovery

Mirae Asset's official factsheet page loads `DownloadFactsheet.js` and requests the public first-party endpoint `https://www.miraeassetmf.co.in/AjaxService/GetDownloadsData`. The endpoint is a candidate for a deterministic month-aware feed adapter; any returned document URL must still pass PDF-content period validation.

The official page initializes the feed with `modulename = "Factsheet"`, `pgno = 1`, and `pgsize = 10`. Its generated `AjaxService.GetDownloadsDataAsync` proxy receives this request object and returns records containing `PublishDate`, `Title`, and `URL`. The adapter can use this public feed contract without rendering the page or interacting with CAPTCHA controls.

Live validation of the Mirae July 2026 Active and Passive URLs returned documents whose extracted factsheet text identified March 2020 data. The public-feed adapter therefore rejects them instead of accepting the feed's July title as proof of the reporting period.

PGIM's official factsheet page exposes a 2026 year selector in the rendered page but did not load any visible factsheet/API/download resource in the initial browser resource trace. It remains an archive-page candidate rather than a verified public feed.

A direct text extraction of the same official PGIM page returned only navigation and legal content, with no historical factsheet records or PDF URLs. No server-readable public feed was confirmed.

## Public-feed and candidate validation outcomes

| Source | Official route inspected | Result |
|---|---|---|
| Mirae Asset | `AjaxService/GetDownloadsData` public feed | The feed exposes July 2026 Active and Passive records, but the linked PDFs extract as March 2020. The new adapter rejects them rather than accepting the feed title. |
| PGIM India | Official factsheet page | No server-readable document feed or record payload was exposed. |
| Bank of India | Official investor-corner PDF | The July 2026 document downloaded with compliant first-party headers and parsed as July 2026. It is now a verified snapshot adapter. |
| Bajaj Finserv | Official media-domain July filename | The PDF identifies its data as of June 2026, so the July request remains rejected. |
| SBI Mutual Fund | Official July candidate | The standard request returned HTML rather than a PDF; no snapshot was registered. |

Mirae's latest **August 2026 Active Fund Factsheet** was separately retrieved from the same official public feed, verified as August 2026 from PDF content, and stored through the application router as document `1890001`. The feed adapter therefore rejects stale historical targets while accepting a content-consistent current document.

Aditya Birla's official factsheet page contains the first-party script `Content/js/factsheet_fd.js`. The script binds the 2026 year selector and a `factSheetGoBtn` handler, confirming that month records are injected after a year-filter request rather than appearing in the initial server HTML.

The client script does not use a conventional `fetch`, `$.get`, or `$.ajax` call in its visible source. The next inspection step is to observe the runtime request triggered by the page's own 2026 Go action rather than infer an undocumented endpoint.

The official 2026 Go action requests `postlogin/CustomApi/Resources/FactsheetAccordionById` with the first-party Sitecore list identifier `12cd6fed-904e-4380-879e-4d5407a78b41`. The resulting official archive lists August, July, June, and earlier 2026 PDFs, including `/-/media/bsl/files/resources/factsheets/2026/absl-factsheet_aug-2026.pdf` and `/-/media/bsl/files/resources/factsheets/2026/empower-factsheet---june-2026.pdf`.

The August 2026 archive PDF downloads as a valid 255-page PDF and identifies itself as **Monthly Factsheet August 2026 (Data as on 31 July 2026)**. It was stored through the application router as document `1020001`. The June archive PDF also downloads as a valid 254-page official PDF, but was not stored because the newer August document is available.

The independently selected July 2026 official archive PDF downloads as a valid 258-page PDF and identifies itself as **Monthly Factsheet July 2026 (Data as on 30 June 2026)**. It was stored through the application router as document `1920001`, separate from the August document.

During the first dynamic-archive wave, SBI Mutual Fund's official factsheet URL did not render controls or page text in the connected browser; the extracted browser HTML was saved for static inspection. This confirms that the browser-render path must be paired with source HTML/script inspection rather than treated as a server-readable archive response.

DSP's official Download Center loads its month records from the first-party JSON feed `https://www.dspim.com/downloads.json?page=1&per_page=10&category=Information%20Documents&sub_category=Factsheets&sort=latest-insight`. The browser-visible response exposes `Factsheet June 2026 - 16 Jul 2026` and the exact PDF `https://www.dspim.com/downloads/dsp-factsheet-june-2026.pdf`, followed by May and earlier 2026 records. The July path fails because DSP had not published a July record at the time of inspection; June is the latest available official record.

The new public-feed adapter can now discover DSP's exact month records. However, the official June document host delivered only 113,914 of 12,894,499 bytes during a 240-second standard request. The adapter remains a valid discovery profile, but the PDF delivery host is currently too slow for automatic ingestion; it must return a structured timeout rather than be counted as successful coverage.

Bandhan Mutual Fund's official factsheet archive returned HTTP 403 in the connected browser, so no archive controls or first-party record request could be observed through this path. Baroda BNP Paribas Mutual Fund's official monthly-factsheet URL closed the browser connection before page inspection; an alternate official source path is required rather than repeating the same request.

Kotak's official Forms and Downloads page renders only its layout shell in the connected browser and exposed no page-level API/resource requests after load. The factsheet records therefore appear to require a different official route, additional client initialization, or a document-feed endpoint; the current page cannot yet be adapted safely.

Sundaram Mutual Fund timed out in the connected browser. Franklin Templeton's official fund-literature page rendered only its loading state and no archive controls. Neither source exposed a first-party month record response in the current browser session; they remain constrained pending an alternate official API or stable document-feed route.

Taurus Mutual Fund's official Drupal factsheet page is server-readable, but it did not expose a July 2026 entry or another current monthly factsheet link in the rendered content. It remains an official static-page source requiring a real current document record rather than a guessed path.

Baroda BNP Paribas Mutual Fund's official monthly-factsheet page is reachable through text extraction but returns a jurisdictional eligibility gate rather than document records. This requires an approved official archive or document endpoint that is accessible without misrepresenting user residency; the current page must not be automated beyond its disclosed access conditions.

JM Financial Mutual Fund's official page exposes a client-rendered downloads route and deep product URLs, but no factsheet data API or document request appeared in the loaded resource list. A separate official content endpoint or user-provided direct archive record is needed before adding an automatic adapter.

SBI search evidence confirms that the official factsheet page advertises a 2026 year selector and indexes June 2026 factsheet entries, including an All SBIMF Schemes document and a passive-solutions document. The selector endpoint itself is not exposed in the initial page extraction or standard bundled-script response, so the next step is first-party runtime/network inspection rather than URL inference.

A subsequent SBI page extraction rendered the Sitefinity page content, but the browser console became unavailable before selector controls and network request metadata could be queried. The source must therefore be inspected through a fresh browser/runtime session or an official selector endpoint discovered from publicly exposed Sitefinity configuration; no selector URL has been inferred.

The fresh normal browser retry also returned **502 Bad Gateway — Microsoft-Azure-Application-Gateway/v2** before any selector control loaded. This confirms the current issue is an upstream SBI gateway outage in this environment, not a stale browser session. No retry, request rewriting, or inferred selector endpoint was attempted.

## SBI public eFactsheet discovery

SBI's official `factsheets` page is indexed with named public June 2026 records, including **All SBIMF Schemes Factsheet June 2026** and **SBI MF Passives Factsheet June 2026**. However, SBI does not expose a separate indexed public eFactsheet-style month page comparable to Kotak's `/factsheet/July_2026/` route. Standard server requests failed once during TLS negotiation and once through IPv4 HTTP/1.1 after a 45-second connection timeout; the normal browser route repeatedly returned the Azure 502 gateway page. Thus, no official public PDF asset could be captured or validated in this environment. No URL was inferred from the search snippets.

Kotak Mutual Fund's official Forms and Downloads page exposes a dedicated Factsheet year selector. Selecting 2026 triggers an empty client-rendered result region, confirming that the records are fetched dynamically rather than present in page HTML. The page now provides a normal official control path suitable for first-party request inspection.

Kotak's normal 2026 Factsheet selector issued the first-party request `GET /api/kotakapi/forms/user/getmonthlist/219?year=2026`, which returned the available month list `[7,6,5,4,3,2,1]`. This establishes header ID 219 as the official factsheet archive source and confirms that the site has current 2026 month records. The subsequent record-list request still needs to be captured from the client implementation before an adapter is added.

Kotak's public `main.js` configuration defines the relevant first-party routes `downloadFormAndDownloadMonthList = /api/kotakapi/forms/user/getmonthlist/` and `downloadFormAndDownloadOptionList = /api/kotakapi/forms/user/getsubheaderList/`, with a separate document delivery base `https://java17vlbapi.kotakmf.com/kotakapi/`. The exact record-list parameter contract has not yet been captured, so no endpoint variant was inferred or called.

The normal Kotak selector flow confirmed the paired record endpoint: `GET https://www.kotakmf.com/api/kotakapi/forms/user/getsubheaderList/219?year=2026&month=7`. Its official response contains `Factsheet for July 2026` with `content = FormsDownloads/Factsheet/Factsheet-for-July-2026/KotakMFFactsheetJuly2026.pdf` and file name `KotakMFFactsheetJuly2026.pdf`, followed by June through January 2026 records. This is a first-party record response, not an inferred filename.

The official content host `https://java17vlbapi.kotakmf.com/kotakapi/` returned HTTP 401 for the exact July PDF both with standard server headers and through the normal public browser session with credentials included. The retrieval constraint is therefore at Kotak's separate document-delivery host, not archive discovery. The record endpoint is usable for availability status, but no PDF adapter is registered until Kotak exposes a public delivery route or authorizes the host.

Kotak's official June archive record identifies `FormsDownloads/Factsheet/Factsheet-for-June-2026/KotakMFFactsheetJune2026.pdf`. The corresponding exact official delivery request also returned HTTP 401 and a 71-byte HTML response, confirming that the document-host restriction applies to both July and June rather than a period-specific gap.

Kotak's normal browser page now reliably renders the 2026 month buttons January through July after the year is selected. The published client bundle contains the configured protected document base but no public authorization header, bearer token, redirect handler, or alternate delivery base. The next compliant step is to test the page's own month-button download action and inspect its resulting first-party network behavior; no credential or URL is inferred from this observation.

Clicking Kotak's normal June button triggers the same first-party record request with an explicit `type=month` parameter: `GET /api/kotakapi/forms/user/getsubheaderList/219?year=2026&month=6&type=month`. No protected delivery-host request was observed at the button stage; the page must render a subsequent record/link action before a document request occurs.

The immediate rendered DOM after the normal June click did not expose a factsheet PDF anchor or launch a protected document request. The month action therefore retrieves a record state but not a publicly consumable download action in this runtime; further inspection must identify the component-specific record rendering or a separately loaded client chunk.

The normal Kotak page loads multiple first-party lazy chunks (`1001`, `7953`, `3135`, `1024`, `4814`, `6984`, `3647`, `4120`, and `3132`), but a bounded scan found no published literal reference to the factsheet delivery base or record endpoints in those chunk files. The page has been instrumented only to observe ordinary `window.open` behavior from its own month button; no authentication, cookie, header, or access-control mechanism has been modified.

Repeating the official June button action after normal delivery observation produced no `window.open`, navigation, popup, or `java17vlbapi` document request. It issued only the public `getsubheaderList` record request. The normal page therefore does not expose a browser-authorized PDF delivery action in this session; the record API is separate from the access-controlled document host. A fully automatic server adapter requires a Kotak-provided public delivery URL, documented API credential, or allowlisting route.

The separate public page `https://www.kotakmf.com/factsheet/July_2026/` renders in the connected personal browser and visibly displays a PDF control. However, the browser automation connection twice dropped when activating that control, so its target URL has not yet been captured. This is an automation-session issue distinct from the public page's availability; the target is not inferred from the visible icon.

An official-domain search found the public July eFactsheet page, Forms and Downloads, the legacy Kotak bank factsheet page, and a monthly market-update page, but did not index a direct Kotak July 2026 PDF URL. The page's first visible cover identifies itself as **Fund Fact Sheet August 2026, Data as of July 2026** despite the `July_2026` URL. Any automated adapter must therefore validate the actual PDF period and must not treat the page-path month alone as proof of the document period.

The public eFactsheet page remained accessible in the personal browser after reload. Its normal PDF icon is visible and hoverable; activating the key after hover did not navigate or download, consistent with hover not moving keyboard focus. The eFactsheet cover itself states August 2026 and data as of 31 July 2026, reinforcing that the public page is a generated current document rather than a straightforward July-labelled PDF endpoint.

The captured HTML from the public month page resolves the visible PDF icon to the explicit relative asset `Kotak MF Factsheet August 2026.pdf`. Therefore the public document candidate is `https://www.kotakmf.com/factsheet/July_2026/Kotak%20MF%20Factsheet%20August%202026.pdf`. This is an official asset directly exposed by Kotak's public page, not an inferred document-host path. Its content period must still be parsed before it is registered.

The public asset returned HTTP 200 with `content-type: application/pdf`, was 27,999,519 bytes, and parsed successfully through the application downloader as **July 2026**. It was stored automatically as document `1950001` with 1,195,124 extracted text characters. Kotak is therefore a verified July 2026 automatic source through the public eFactsheet page, and its prior protected Forms and Downloads document-host constraint no longer blocks the selected-period workflow.

## Bandhan public eFactsheet discovery

Bandhan's official all-schemes page at `/downloads/factsheet/all-schemes` is publicly indexed and advertises August 2026 factsheet coverage, but it returns only the JavaScript application shell to standard extraction. The normal browser connection timed out before its rendered controls or record requests became observable, and a standard first-party server request also timed out. AMFI's official download center links to Bandhan's factsheet index but does not expose a Bandhan PDF asset or alternate record feed. No public month-page, explicit PDF asset, or documented first-party API was exposed, so no URL was inferred or registered.

Using Bandhan's alternate official `www` host with ordinary IPv4 HTTP/1.1 headers successfully reached the public application shell. The host redirects to the canonical non-`www` page and returns HTTP 200 HTML with the published React bundle `/static/js/main.8a96cab8.js` (plus the monitoring script `/ruxitagentjs_ICA7NVfhqrux_10343260715123811.js`). This provides an official, inspectable first-party route for deriving the app's factsheet request behavior without guessing document URLs.

The published bundle identifies the public factsheet component and first-party route names `monthlyFactsheets`, `monthlyFactsheetChoices`, `downloadGCSFile`, and `/wp-json/finance-api/v1/posts/monthly-factsheets`. The canonical site rewrites the public `wp-json` request to its app shell rather than returning a record payload. The bundle also references the public CMS host `https://cmsnew.bandhanmutual.com`, whose `https://cmsnew.bandhanmutual.com/category/factsheet/` category exposes the 2026 post `https://cmsnew.bandhanmutual.com/monthly-factsheets-2026/`; that post has an empty rendered content area, and its REST endpoint requires authentication. The bundle references an `pnservices.bandhanmutual.com/internal/...` service with internal request headers. That service is explicitly excluded from this investigation; no internal header, credential, or service endpoint is used for automatic retrieval.

### Isolated Browser Capture — 17 August 2026

With the user-approved personal-browser connector disabled, the isolated sandbox browser loaded `https://bandhanmutual.com/downloads/factsheet/all-schemes` successfully and rendered the expected public controls: `Factsheet - All Schemes`, `Factsheet - Passive Schemes`, `Select Year`, and `Select Month`. Opening the year selector yielded `No options available`. Browser performance entries showed the page's selector data request was an XHR to `https://pnservices.bandhanmutual.com/internal/investorservices/encdec/investor/v1/dashboard/cms-call` (about 2.05 seconds and no transferred response bytes). Therefore, the live public page currently depends on an endpoint explicitly labelled `internal`; the isolated normal-page run did not reveal a separate public PDF URL, a public archive record request, or selector values. This confirms that the bot must not add an adapter based on that endpoint or any page-embedded internal headers or keys. No Bandhan PDF is inferred, stored, or registered.

The separately rendered public `Factsheet - Passive Schemes` route (`/downloads/factsheet/passive-schemes`) produces the same empty selector state and a second request to the same internal service (about 15.08 seconds, again with no transferred response bytes). There is no distinct passive-scheme public PDF request to validate or register.

### Official scheme-page discovery — 17 August 2026

An independently indexed official Bandhan page, `https://bandhanmutual.com/mutual-funds/equity-funds/bandhan-small-cap-fund/regular`, rendered normally in the isolated browser. Its public Downloads panel includes a visible `Factsheet July 2026` item alongside the scheme information document, KIM, latest portfolio, and other July materials. This is a separate public surface from the all-schemes selector and may expose a valid first-party document action. The exact link must still be extracted from the saved public DOM, downloaded, and content-validated before it is used by the bot.

The rendered `Factsheet July 2026` anchor resolves to `https://storage.googleapis.com/nonprod-static-assets-121to59kaawfgfi7bol/2026/07/afcd97a4-bandhan-factsheet-june-2026.pdf`. Its 4,021,803-byte PDF is genuine, but its text repeatedly states `as on 30th June 2026`. It is rejected as a July candidate despite the page label; no Bandhan adapter or cached document has been created from it. Bandhan's separately rendered public Disclosures page also exposes a `Factsheet` `View Now` control, which is an additional official navigation surface still to be inspected.

The official Disclosures `Factsheet` action navigates to the same all-schemes route. On a fresh normal isolated-browser render, that route now populated the public selectors with `2026`, `August`, and a visible `August 2026` record with an explicit download control. This is materially different from the earlier empty-selector state. The normal August download action is the next permissible source for extracting a public document URL; its returned PDF must still be content-validated before registration.

Invoking the visible public August download control produced only two XHR entries to the same `pnservices.bandhanmutual.com/internal/.../cms-call` path, with zero transferred response bytes and no direct PDF or first-party public document request. The public control therefore did not expose a usable public URL in this browser run. The bot does not call, replay, or derive access from the endpoint because it is explicitly marked `internal` and does not provide a readable public response.

The independently indexed official Bandhan Innovation Fund scheme page also renders a `Factsheet July 2026` anchor, but it resolves to the same `afcd97a4-bandhan-factsheet-june-2026.pdf` document already content-validated as June. This confirms the period mismatch is not unique to the Small Cap page and cannot be resolved by treating the scheme-page label as evidence of a July document. No valid July or August combined factsheet asset is exposed by these two public scheme-page surfaces.

An AdvisorKhoj index page publicly lists Bandhan Fund Fact Sheets, including a July 2026 section in search results, but its rendered page currently exposes only collapsed category headings and no July document URL or first-party Bandhan-hosted PDF target. It therefore supplies no usable public asset evidence and is not used by the bot.

After expanding the public AdvisorKhoj Fact Sheets section, each named 2026 month (including July) resolves only to `https://bandhanmutual.com/downloads/factsheets`, Bandhan's general public factsheet landing route. No indexed record includes an independent PDF URL, Google Storage object key, or first-party download URL. This confirms the third-party index cannot repair the absent public asset without returning to the same Bandhan selector flow that currently depends on its unreadable internal service request.

### Latest-record retry — 17 August 2026

On the user-requested latest-record retry, a newly reopened isolated browser reached Bandhan's official all-schemes route but remained a blank application shell after reload. The browser page HTML was saved for diagnosis, but no public record, selector value, or download target was rendered in this fresh session. This is a transient client-rendering regression in the isolated session, so the retry will use the previously successful public page state and the published client assets only to capture a normal latest-record action; it will not invoke the internal service directly.

The same isolated public page completed rendering after its JavaScript bundle loaded. Its DOM showed `2026`, `August`, and `August 2026`. The public download control's React-rendered data contained the explicit first-party asset `https://storage.googleapis.com/nonprod-static-assets-121to59kaawfgfi7bol/2026/08/6f1518f8-bandhan-factsheet-july-2026.pdf`. This value was read from the live public page state, without calling or replaying Bandhan's internal endpoint. The PDF is a 132-page, 4,113,523-byte document. Its extracted text states `Equity Snapshot as on 31st July 2026`; it is therefore accepted only for **July 2026**, while retaining **August 2026** as the public archive-release label.

The normal application downloader live-verified and stored the document as `factsheet_documents.id = 2010001` at `factsheets/direct/bandhan/factsheet_July-2026_76808f9d.pdf`, with 800,856 extracted characters and the resolved official Google Storage URL. Bandhan is now a verified public latest-page snapshot, raising July 2026 automatic coverage from 32 to **33 of 50** registered AMC sources.

### JM Financial latest factsheet recovery — 17 August 2026

The official JM Financial factsheet routes `https://www.jmfinancialmf.com/downloads/Factsheet/Factsheet` and `https://www.jmfinancialmf.com/downloads/Factsheet` both returned the publisher's `406 - Not Acceptable` page in the isolated browser, explicitly stating that the request was blocked as suspicious. Public search indexes identify the latest listed record as `Factsheet July 2026` dated 08 July 2026. A first-party path disclosed in the fund house's publicly indexed Instagram reference, `https://www.jmfinancialmf.com/downloads/Factsheet/Factsheet/Factsheet%20July%202026.pdf`, also returned the same 406 response under ordinary server transport. No file was stored and no access-control bypass is attempted. A normal homepage-first browser session remains to be tested before the public route is classified as unavailable.

The official home page was also blocked by the same 406 response in the isolated browser, confirming a publisher-wide block in that environment rather than a path-specific issue. A text-only retrieval of the official factsheet listing, however, rendered the current record sequence and identifies the latest available item as **Factsheet August 2026**, dated **14 August 2026**, followed by July 2026 dated 08 July 2026. The user's personal-browser connector was enabled to retry this normal public flow, but its extension returned HTTP 504 before navigation or document metadata could be captured. No direct August PDF URL has yet been inferred, requested, or stored.

After the user requested a self-directed retry, the personal browser connection recovered. JM Financial's normal public listing rendered the same August 2026 record. Its standard `View` action exposed the exact first-party URL `https://www.jmfinancialmf.com/CMS/downloads/Factsheet/Factsheet/Factsheet%20August%202026.pdf`. This is a document link emitted by the official page rather than an inferred filename. The PDF still requires ordinary retrieval and printed-period validation before the application may store or register it.

The page-exposed PDF was then retrieved through the normal personal-browser page flow and decoded for validation. It is a 64-page, 7,456,412-byte first-party PDF. Its cover states **August 2026 (Details as on July 31, 2026)**, and repeated page text confirms `Details as on July 31, 2026`. The bot therefore rejected the initial August-period storage attempt and stored the document only under the content-validated **July 2026** reporting period. The normal validated import workflow stored it as document `2040001` at `factsheets/uploaded/jm-financial/July-2026_Factsheet-August-2026_cf590a23.pdf`, retaining the official public PDF URL as source provenance. This browser-assisted retrieval did not require a user upload. JM Financial increases selected-period coverage from 33 to **34 of 50** sources.

### Baroda BNP Paribas latest factsheet recovery — 17 August 2026

The official monthly factsheet page rendered the current selector state **2026 / August**, dated 10 August 2026, with the record `Factsheet - July 2026`. Its normal `READ` action exposed the exact first-party URL `https://www.barodabnpparibasmf.in/assets/download_documents/BBNPP_MF_Fund_Facts_July_2026_19491.pdf`. Standard server transport failed with a TLS connection error, but text-only retrieval of the same page-exposed URL delivered the 75-page, 1,875,233-byte PDF for validation. Extracted content repeatedly states `Fund Facts | July 2026` and data as of `July 31, 2026`.

The same exact official URL and verified July period already exist in the cache as document `1080004`, so the bot correctly reused the valid stored document rather than creating another duplicate. Baroda BNP Paribas increases selected-period coverage from 34 to **35 of 50** sources.

### Helios latest factsheet discovery — 18 August 2026

The official Helios downloads page at `https://www.heliosmf.in/downloads` exposes a public Factsheets tab, Monthly Factsheets archive, and 2026 month list. The latest visible record is `July 2026`. Its normal public download action opens the exact first-party PDF `https://www.heliosmf.in/wp-content/uploads/2026/08/helios-mutual-fund-factsheet-jul26.pdf`. This page-emitted URL is the only candidate for ordinary server retrieval and content-period validation.

Ordinary server retrieval returned HTTP 200 and a valid 4,415,307-byte PDF. Repeated scheme pages state `Data As On July 31, 2026`. The same verified July period is already stored in the cache (latest document `1080007`), so the bot reuses the correct document rather than creating a duplicate. Helios was already included in selected-period coverage; its route and status recovery retain the **38 of 50** total without double-counting.

### LIC latest factsheet discovery — 18 August 2026

LIC Mutual Fund's official current monthly-factsheet page at `https://www.licmf.com/downloads/factsheet` lists `31st July 2026` as the current record, followed by June through March. Its normal public PDF action opens the exact first-party document `https://www.licmf.com/assets/downloads/monthly_fact_sheet/2026-2027/08/lic-mf-factsheet-31st-july-2026.pdf`. This page-emitted asset is the sole candidate for ordinary server retrieval and content-period validation.

Ordinary server retrieval returned HTTP 200 and a valid 20-page, 4,867,233-byte PDF. Its cover is headed `31st July 2026`, and scheme pages state `Data as on July 31, 2026`. The same verified July period is already stored in cache (latest document `1080010`), so the bot reuses the correct document rather than creating a duplicate. LIC was already included in selected-period coverage; its route and status recovery retain the **38 of 50** total without double-counting. Mahindra Manulife fallback is not needed for this recovery.

### Mahindra Manulife latest factsheet discovery — 18 August 2026

The official downloads page requires a U.S./Canada residency disclosure. The user explicitly authorized the non-U.S.-person/non-Canada-resident selection, after which the public Investor → Fund Factsheet archive rendered July 2026 as its latest record. The normal July download action opened the exact first-party URL `https://cms.mahindramanulife.com/storage/mmimplweb/uploads/download/ada39b25-9f6e-435f-bcc2-7ede65e51f80.pdf`. This page-emitted document is the only candidate for ordinary server retrieval and PDF-content validation.

Ordinary server retrieval returned HTTP 200 and a valid 5,977,634-byte PDF. Its cover is headed `July 2026`, with repeated `Data as on 31st July 2026` evidence. The normal direct-source validation workflow stored it as document `2220001` at `factsheets/direct/mahindra-manulife/source-link_July-2026_8ebc414b.pdf`, retaining the page-emitted official URL. Mahindra Manulife was already included in selected-period coverage, so this current-route and storage recovery retains the **38 of 50** total rather than double-counting it.

### Genuine uncovered-source wide research ranking — 18 August 2026

The user-approved wide research pass reviewed the ten genuine route-and-PDF gaps. Eight sources have an exact public first-party July 2026 candidate that still requires independent main-task download and PDF-content validation: **Bajaj Finserv**, **Choice**, **DSP**, **Mirae Asset**, **PGIM India**, **Quant**, **Taurus**, and **The Wealth Company**. They are ranked as candidate-ready and will be worked in that order, subject to independent retrieval checks.

**Trust Mutual Fund** visibly lists July 2026 but its automated delivery is WAF-blocked (HTTP 406), so it is ranked after public candidates for a normal browser-session investigation. **Zerodha Fund House** publishes only May 2026 as its latest visible official record, so no July 2026 recovery can be attempted until an official newer document appears. These research results are discovery evidence only; no route is added to the app or counted as covered until the PDF is independently downloaded and its printed reporting period validates as July 2026.

### Bajaj Finserv independent validation — 18 August 2026

The public first-party candidate `https://media.bajajamc.com/wp-content/uploads/2026/07/Abridged-Factsheet_July-2026.pdf` returned HTTP 200 and a valid 16,726,910-byte PDF. Although its filename identifies July 2026, the extracted document consistently states `Data as on 30th June 2026` and its market data is June-end. It is therefore a July publication carrying June data, **not** a July 2026 reporting-period factsheet. The bot correctly rejects it for the July recovery target and does not store or register the route as a July source.

### Choice independent recovery — 18 August 2026

The current official Choice factsheet page exposes the 2026-2027 selector. Its independently researched public July record resolves to `https://doc.choicemf.com/document-master/1786519812-choice_mutual_fund_factsheet_full_july_2026.pdf`, which returned HTTP 200 and a valid 5,931,631-byte PDF. The cover states `July 2026`; the document repeatedly identifies data, portfolio values, and returns as on 31 July 2026. The normal direct-source validation workflow stored it as document `2250001` at `factsheets/direct/choice/source-link_July-2026_cfe6113c.pdf`. Choice raises verified selected-period coverage from 38 to **39 of 50** sources.

### DSP independent delivery check — 18 August 2026

The live official download centre currently renders `Factsheet June 2026` as its latest visible listing. The independently researched public candidate `https://www.dspim.com/downloads/dsp-factsheet-july-2026.pdf` began a first-party 15,374,139-byte PDF response but transferred only 10,887,692 bytes before the bounded 120-second retrieval deadline expired. The partial file is rejected and deleted. DSP remains unresolved: the public July candidate needs a stable complete delivery before PDF text can be validated and stored.

### Mirae Asset current page check — 18 August 2026

Mirae Asset's official factsheet page is accessible and publicly lists August and July 2026 records for both Active and Passive Fund Factsheets. The page's established first-party `GetDownloadsData` feed is used only to select the exact July Active record; the PDF itself must still complete ordinary retrieval and pass content-period validation before it can be stored or counted.

The public feed resolved the exact July Active record to `https://www.miraeassetmf.co.in/docs/default-source/fachsheet/active-factsheet---july-2026.pdf`. It returned HTTP 200 and a valid 6,269,266-byte PDF, but its internal factsheet pages consistently state `Monthly Factsheet as on 30 June, 2026` and `Data as on 30th June, 2026`. The July-labelled route is therefore a July publication with June reporting data, not a July 2026 factsheet. It is rejected for the July recovery target and no document is stored or registered.

### PGIM India independent recovery — 18 August 2026

PGIM India's official Fund Factsheet page visibly lists `Factsheet - July 2026`. Its exact public URL `https://www.pgimindia.com/api/v1/brochure/about-us/image/Factsheet%20-%20July%202026.pdf` returned HTTP 200 and a valid 6,785,169-byte PDF. The cover states July 2026 and the document repeatedly identifies fund details and portfolio data as on 31 July 2026. The normal direct-source validation workflow stored it as document `2280001` at `factsheets/direct/pgim-india/source-link_July-2026_783726d0.pdf`. PGIM India raises verified selected-period coverage from 39 to **40 of 50** sources.

### Quant current page check — 18 August 2026

Quant's official factsheet page is publicly accessible and renders a 2026 archive with August through January records, including a visible `July-2026` factsheet PDF action. The independently discovered first-party July document will be retrieved and content-validated before it can be stored or counted.

Invoking the normal public action displayed beside Quant's `July-2026` row opened `https://quantmutual.com/Admin/Factsheet/quant_Factsheet_June_2026.pdf`. The live July control therefore currently delivers a June-named document, not an independently verified July PDF. It is rejected for the July recovery target; no document or route is registered until Quant exposes a PDF whose content validates as July 2026.

### Taurus current page check — 18 August 2026

Taurus's official factsheet page is publicly accessible and exposes a 2026 selector for its monthly archive. The current page does not render document records until a year is selected; the normal 2026 selection will be used to inspect the public July record and no route will be inferred from a filename.

Selecting 2026 rendered a public `July 2026` record. Its normal action opens the exact first-party document `https://www.taurusmutualfund.com/sites/default/files/downloads/Taurus_Times_July_2026.pdf`. This page-emitted URL will be independently retrieved and content-validated before it is stored or counted.

The page-emitted document returned HTTP 200 and a valid 10,083,605-byte PDF. Its text consistently states `Monthly Factsheet - July 2026` and `as on 31st July 2026`. The normal direct-source validation workflow stored it as document `2310001` at `factsheets/direct/taurus/source-link_July-2026_2869bb99.pdf`. Taurus raises verified selected-period coverage from 40 to **41 of 50** sources.

### Edelweiss latest factsheet route discovery — 17 August 2026

The official Edelweiss factsheet page initially rendered as a client-side shell, then loaded its public selector state as **2026 / Aug** with the current record `Factsheet - August 2026`. The rendered official page HTML exposes the direct first-party target `https://www.edelweissmf.com/Files/MF/Downloads/FACTSHEETS/FACTSHEETS/Edelweiss_Factsheet_August__2026_10082026160011.pdf`. This link is taken from the normal page DOM, not inferred from a filename; its PDF content remains to be retrieved and reporting-period validated before storage.

Ordinary server transport received a publisher `403 Access Denied` response for that direct asset, but the same page-exposed URL was delivered through text extraction and decoded as a valid 200-page, 15,726,684-byte PDF. Its cover text states `EDELWEISS MUTUAL FUND | JULY 2026` and `Data as on July 31, 2026`; it is therefore verified as **July 2026**, not August. The same exact public URL and reporting period already exist in the cache as document `1350001`, so the bot reuses that validated document instead of creating a duplicate. Edelweiss increases selected-period coverage from 35 to **36 of 50** sources.

## Franklin Templeton public fund-literature recovery — 17 August 2026

The isolated sandbox browser rendered Franklin Templeton India's official Fund Literature page at `https://www.franklintempletonindia.com/downloads/fund-literature`. Its public `Fund Factsheets - 2026` accordion lists July through January 2026 records. The rendered July row, `Factsheet as on July 31, 2026`, exposes the exact official document URL `https://www.franklintempletonindia.com/download/en-in/fund-factsheets/7fdc001e-09b9-4ab2-9134-1b4a109f3b14/Factsheet-as-on-July-31-2026_web.pdf`. This is a public DOM record rather than a derived filename and is the candidate for ordinary server retrieval and content-period validation.

The page's normal public resource log exposed `GET /api/literature/v1/responseLitJson?type=download`. Its response contains the nested `FUND-FACTSHEETS` July record with the same document identifier and public relative `literatureHref`; the renderer maps that path under `/download`. A compliant adapter now walks this public feed, selects only `Factsheet` records whose title includes the requested month and year, maps the documented path to the public download route, and leaves the existing PDF-content period gate in place.

Live verification retrieved the exact July PDF by the normal registry downloader with discovery mode `official_public_feed`. The response was an 88-page, 6,472,263-byte `application/pdf` and the extracted text states `Fund Details as on 31 July 2026`, yielding the validated reporting period **July 2026**. The normal cache already contained that same validated document as ID `1170001`; it is therefore reused rather than inserted again. Franklin Templeton raises verified July 2026 automatic coverage from 30 to **31 of 50** registered AMC sources.

## Sundaram Mutual Fund public fundwise-factsheet recovery — 17 August 2026

The isolated sandbox browser loaded `https://www.sundarammutual.com/fundwise-factsheet` and rendered its fundwise factsheet navigation. The page exposes an `Equity Fund` category, an `Open Ended` scheme list, a visible `Consolidated Factsheet` control, and named scheme controls including Sundaram Flexi Cap Fund, Sundaram Mid Cap, and Sundaram Small Cap. The initial DOM extraction did not expose an `href` for the visible Consolidated Factsheet control, so no PDF URL has been inferred. Further investigation is limited to the page's own public resource requests and explicit document actions.

The initial normal page load did not record a factsheet, PDF, document, or download resource request. A subsequent normal click attempt could not be performed because the renderer invalidated the extracted control before interaction and then navigated the isolated session to an empty page. No URL, header, document, or selector value was captured from that failed interaction; the page must be reloaded before any further first-party action is inspected.

After reload, the normal Consolidated Factsheet control opened the page's visible date form (`#dt_InfoDoc`) and `view` button (`#btn_download`). Its published `ViewFiles` function calls `Modules_Forms_Downloads_Fundwise_Factsheet.DownloadArchive(cat, Mnths, ...)` and opens the returned value only when it is neither `Exception` nor `Not Available`. The first-party client proxy declares the public request form `GET /ajax/Modules_Forms_Downloads_Fundwise_Factsheet,App_Web_v2aypqkp.ashx?_method=DownloadArchive&_session=no` with encoded `cat` and `mnth` fields; the rendered page identifies `cat` as `1`. The accepted date format and an actual response still need to be captured through the normal page control. No endpoint variant or PDF URL has been guessed.

The normal month picker confirms the archive input format is `MM/YYYY`. Selecting its rendered July control populated `#dt_InfoDoc` with `07/2026`. The user-approved normal `view` action was invoked with this value; the first-party response remains to be inspected from the page resource log before any server-side request or adapter is considered.

The initial performance log after the July `view` action showed only the published proxy-script resource and did not record a URL containing the proxy's `DownloadArchive` query or a PDF. The browser console likewise contained no public response URL or error from the action. This is inconclusive—not a `Not Available` result—and requires inspection of the page's published `ajax_request` transport before repeating or reconstructing the documented public request.

The published transport uses a standard XMLHttpRequest `POST` with no custom request header. A browser capture of the normal `ViewFiles()` flow for rendered `07/2026` confirms the public first-party request exactly: `POST /ajax/Modules_Forms_Downloads_Fundwise_Factsheet,App_Web_v2aypqkp.ashx?_method=DownloadArchive&_session=no`, body `cat=1\r\nmnth=07/2026`. It returned HTTP 200 `text/html` containing the public document URL `https://www.sundarammutual.com/uploaddir/consolidated_factsheet/Consolidated_Factsheet_7_2026_140726_121722.pdf`, which the normal page passes to `window.open`. This is a page-exposed archive response, not a guessed URL; the PDF remains to be retrieved and validated by content before adapter registration.

The app now implements the documented public archive request with the selected `MM/YYYY` period and accepts only a public `https` PDF returned by the endpoint. Live verification selected exactly the captured July document, retrieved a 12,097,337-byte PDF, and parsed its reporting period as **July 2026**. The normal `downloadLatest` application procedure then stored it as document `1980001` at `factsheets/direct/sundaram/factsheet_July-2026_b045b8ce.pdf`, preserving the page-exposed resolved PDF URL and 290,962 characters of extracted text. Sundaram raises verified July 2026 automatic coverage from 31 to **32 of 50** registered AMC sources.

## WhiteOak Capital latest factsheet route discovery — 17 August 2026

The official WhiteOak factsheet page rendered the latest record `Factsheet as at July 31, 2026`, published on 13 August 2026. Its normal `View` action exposed the exact first-party URL `https://content.whiteoakamc.com/Whiteoak_Capital_Factsheet_July_2026_24d72b712d.pdf` (the page adds non-essential analytics query parameters). This is a live page-exposed document route, not a guessed filename; the PDF remains subject to content-period validation before it may be stored or counted.

Standard server delivery of the same official asset was blocked by CloudFront with a region restriction, but text extraction retrieved and decoded a valid 66-page, 2,040,489-byte PDF. Its cover has the standalone front-matter label `JULY` / `2026`, and the scheme pages consistently state data as on `31 July 2026`. A previously broad period pattern incorrectly selected an unrelated later September 2026 reference. The reporting-period extractor now prioritizes a standalone front-matter month-year label; its regression test covers this exact failure mode. The normal validation workflow then stored the content-validated **July 2026** document as ID `2070001` at `factsheets/uploaded/whiteoak-capital/July-2026_Whiteoak_Capital_Factsheet_July_2026_24d72b712d_b89b18cd.pdf`, retaining the official route as provenance. WhiteOak increases selected-period coverage from 36 to **37 of 50** sources.

## HDFC latest factsheet route discovery — 17 August 2026

The official HDFC factsheet page renders the current record `Latest Factsheet - July 2026`. Its normal factsheet action exposes the exact first-party URL `https://files.hdfcfund.com/s3fs-public/2026-08/HDFC%20MF%20Factsheet%20-%20July%202026.pdf` (the live page adds non-essential analytics query parameters). This is the current public document route rather than a derived filename; it must be retrieved and content-period validated before storage or coverage changes.

The canonical document URL returned HTTP 200 and a valid 140-page, 7,264,956-byte PDF under ordinary server transport. Its text confirms `July 31, 2026` and reports `3 | July 2026`. The normal `downloadFromSourceLink` validation workflow stored it as document `2100001` at `factsheets/direct/hdfc/source-link_July-2026_e4e73930.pdf`, retaining the canonical HDFC file URL. HDFC was already included in the selected-period coverage due its verified reference profile, so the recovered storage corrects the cache and source outcome without inflating the coverage total beyond **37 of 50**.

## SBI latest factsheet route discovery — 17 August 2026

SBI's official `https://www.sbimf.com/factsheets` page is available again in the normal browser session. It renders a current `All SBIMF Schemes Factsheet July 2026` row (10 MB), a July passive-schemes row, and prior June/May records; the page also renders 2026 year controls. Invoking the current all-schemes `Download` action did not change the browser route, so the exact document request must be captured from the page's public DOM or resource log before any server retrieval. This is a normal first-party page flow; no selector endpoint is inferred or invoked directly.

The rendered official HTML publishes the exact all-schemes target `https://www.sbimf.com/docs/default-source/scheme-factsheets/all-sbimf-schemes-factsheet-july-2026.pdf?sfvrsn=c5ebcccb_4`. Standard server retrieval returned HTTP 200 and a valid 10,197,263-byte PDF. Its text begins `Factsheet as on July 31, 2026`. The normal source-link validation workflow stored it as document `2130001` at `factsheets/direct/sbi/source-link_July-2026_6e5ad392.pdf`, retaining the page-exposed SBI document URL. SBI increases selected-period coverage from 37 to **38 of 50** sources; HSBC fallback was not needed.

## HSBC latest factsheet route discovery — 17 August 2026

HSBC's official investor-resources page renders `The Asset as on - July 2026` under the `Fund factsheets` document category, dated 08 August 2026 and sized 6.68 MB. The record is exposed as a normal page download link in the live document library. Its public anchor must be extracted from the saved page markup before server retrieval and content-period validation; no filename is inferred.

The live page markup exposes the exact first-party document URL `https://www.assetmanagement.hsbc.co.in/assets/documents/mutual-funds/en/baebe6b0-a743-464f-a639-5069594ff653/the-asset-july-2026.pdf`, with the accessible label `Download: The Asset as on - July 2026 (Fund factsheets 6.68 MB, PDF)`. This published asset identifier is preserved as the sole candidate for ordinary retrieval and PDF-content validation.

Ordinary server retrieval returned HTTP 200 and a valid 91-page, 6,999,534-byte PDF. Its cover states `The Asset August 2026 (Data as on July 2026)`, and the content confirms data as on July end 2026. The existing period extractor correctly selected **July 2026** from the explicit data-as-of evidence rather than the release label. The normal source-link validation workflow stored the factsheet as document `2160001` at `factsheets/direct/hsbc/source-link_July-2026_106ae1ad.pdf`, retaining the page-exposed official document URL. HSBC was already included in selected-period coverage, so this cache and status recovery preserves the **38 of 50** total rather than double-counting it.

## Groww latest factsheet route discovery — 17 August 2026

Groww's official `https://www.growwmf.in/downloads/fact-sheet` page is publicly accessible in the normal browser. Its `Fact Sheet` section exposes a document-subcategory selector, initially showing `Factsheet Disclosures`, with a `2026 - 2027` option in the normal control. The currently visible disclosure files are not portfolio factsheets. The 2026-2027 listing must be selected and its rendered direct document links captured before any PDF candidate can be validated.

Selecting the normal `2026 - 2027` option renders four first-party document cards, including `Monthly Factsheet July 2026.pdf`, alongside June, May, and April 2026 factsheets. The selected view was saved as official page HTML for exact-href inspection. The July card is the current candidate; its published URL must be extracted from the card markup rather than inferred from its filename.

The inspected July card publishes the exact official asset `https://assets-netstorage.growwmf.in/compliance_docs/Downloads/Fact%20Sheet/2026%20-%202027/Monthly%20Factsheet%20July%202026.pdf`. It is the sole candidate for ordinary server retrieval and PDF-content validation.

Ordinary server retrieval returned HTTP 200 and a valid 121-page, 10,028,804-byte PDF. Its first-page text identifies `July`, and subsequent content repeatedly states sources and returns as on 31 July 2026. The exact official URL and verified July period already exist in the cache as document `1200003`; the bot therefore reuses it rather than creating a duplicate. Groww was already included in selected-period coverage, so this route and status recovery preserves the **38 of 50** total rather than double-counting it. Invesco fallback is not needed for this recovery.

## Invesco latest factsheet route discovery — 17 August 2026

Invesco's official factsheet library at `https://www.invescomutualfund.com/literature-forms/factsheets` is publicly accessible in the normal browser. The 2026 list renders seven monthly records, with `Factsheet - July 2026` as the latest available record. Its normal `Download` action remains on the listing page, so the page's rendered document markup must be inspected to capture the exact first-party PDF target before retrieval.

Opening the normal `Factsheet - July 2026` record exposes the exact official target `https://www.invescomutualfund.com/docs/default-source/factsheet/invesco-mf-factsheet-july-2026.pdf?sfvrsn=25cb9fc2_2`. This page-published file path is the sole candidate for standard delivery and PDF-content validation.

Standard server retrieval returned a valid July factsheet PDF. Its text repeatedly reports market and portfolio information as on 31 July 2026. The exact official URL and content-validated July period already exist in the cache as document `1740001`; the bot reuses that document rather than duplicating storage. Invesco was already included in selected-period coverage, so the verified route and source-status recovery retain the **38 of 50** total rather than double-counting it.

## ITI latest factsheet route discovery — 17 August 2026

ITI's official downloads page at `https://www.itiamc.com/downloads` is publicly accessible in the normal browser. Its live factsheet listing shows `Factsheet - July 2026` as the latest record, followed by June, May, and April. The normal July download control was invoked; it preserves the listing-page route rather than navigating the current tab. The existing official ITI July document reference must be fetched and content-validated against the live July record before it can be treated as the current route.

The matching official document reference `https://itiamc.com/admin/pdf/1786700653-ITI_Factsheet-July.pdf` returned HTTP 200 and a valid 41-page, 3,078,992-byte PDF under ordinary server transport. Its front matter states `(JULY 2026)` and `July 31, 2026`. The normal source-link validation workflow stored the factsheet as document `2190001` at `factsheets/direct/iti/source-link_July-2026_cc20cb41.pdf`, retaining the official ITI URL. ITI was already included in selected-period coverage, so this verified route and current storage state retain the **38 of 50** total. Helios fallback is not needed for this recovery.

## Genuine uncovered-source recovery outcomes — 18 August 2026

The user-approved wide research pass identified exact public candidates, all of which were independently retrieved and content-validated before any storage decision. **Bajaj Finserv**'s July-labelled PDF carried 30 June 2026 data, **Mirae Asset**'s July Active PDF carried 30 June 2026 data, and **Quant**'s live July control delivered a June-named PDF; all three were rejected for the July recovery target. **DSP** retains a valid official discovery feed but its direct PDF delivery remains incomplete under bounded retrieval, so no incomplete file was stored.

**Choice**'s official July PDF `https://doc.choicemf.com/document-master/1786519812-choice_mutual_fund_factsheet_full_july_2026.pdf` was validated as July 2026 and stored as document `2250001`. **PGIM India**'s official July PDF `https://www.pgimindia.com/api/v1/brochure/about-us/image/Factsheet%20-%20July%202026.pdf` was validated as July 2026 and stored as `2280001`. **Taurus**'s official July PDF `https://www.taurusmutualfund.com/sites/default/files/downloads/Taurus_Times_July_2026.pdf` was validated as July 2026 and stored as `2310001`.

**Trust**'s normal July-page action emitted `https://www.trustmf.com/Content/2026/8/TRUSTMF%20Fact_20260810124407.pdf`. Although the document was published in August, it repeatedly states `NAV as on 31st July 2026` and `Data as on 31st July 2026`. The normal direct-source validation workflow stored it as document `2340001`. The new validated routes raise selected-period coverage to **42 of 50** sources.

**The Wealth Company**'s official factsheet page visibly lists `Factsheet as on 31-07-2026`. Its normal public action emitted `https://www.wealthcompanyamc.in/uploads/The_Wealth_Company_Factsheet_July_2026_a58370ee64.pdf`. The PDF returned HTTP 200 and consistently states `Data as on July 31, 2026`; the normal direct-source validation workflow stored it as document `2370001`. The Wealth Company raises selected-period coverage from 42 to **43 of 50** sources.

### Zerodha Fund House current archive inspection — 18 August 2026

Zerodha's official `https://www.zerodhafundhouse.com/resources/fund-documents` page is accessible and provides a dedicated `Factsheet` section below its fund-document categories. The initial rendered view exposes scheme documents but not the factsheet-period labels; a direct in-page search for the prior May 2026 label returned no result. The normal page section was then inspected without inferring a newer asset from the old May filename.

The page's server-rendered archive identifies **Factsheet - Feb 26** as its newest public row, followed by January 2026 and then 2025 records. It contains no July or August 2026 entry or official asset URL. The bot now uses the live archive page instead of the old fixed May-2026 PDF, but Zerodha remains outside July selected-period coverage until a content-valid official record is published.

### Latest-mode recovery — Angel One Mutual Fund — 18 August 2026

Angel One's official downloads page is publicly accessible. Its normal `Factsheets` tab exposes the 2026–27, 2025–26, and 2024–25 archive sections. The 2026–27 section will be inspected through its normal public control to identify the newest exact factsheet record and any first-party PDF target.

The live 2026–27 archive currently lists **June 2026** as its newest factsheet, followed by May and April. Its normal `Download` action exposes `https://cms.angelonemf.com/amc-cms/wp-content/uploads/formidable/15/Factsheet-Angel-One-Mutual-Fund-Schemes-Jun-2026.pdf`. This first-party PDF is the current latest-mode candidate and will be content-validated before storage.

The normal direct-source validation workflow downloaded the official PDF, extracted **June 2026** from its content, and stored it as document `2400001`. This is the latest document the official archive currently exposes; latest mode retains its actual period instead of rejecting it because it predates the prior July coverage target.

During the fresh all-source official revalidation on 18 August 2026, Angel One exposed a newer PDF whose content validates **July 2026**. It was stored as document `2640001`; the latest cache now correctly prefers July over the earlier June record.

### Latest-mode recovery — Bank of India Mutual Fund — 18 August 2026

Bank of India's official Investor Corner lists **FACTSHEET JULY 2026** as its newest record, followed by June and earlier documents. Its normal public link resolves to `https://www.boimf.in/docs/default-source/investorcorner/factsheets/factsheet-july-2026.pdf?sfvrsn=ecfba920_3`. The first-party PDF will be content-validated and stored as the current latest document.

The standard direct-source workflow retrieved the official PDF, validated **July 2026** from its content, and stored it as document `2430001`. The current Bank of India latest document is now available for cache reuse.

### Latest-mode recovery — JioBlackRock Mutual Fund — 18 August 2026

JioBlackRock's official factsheet page currently defaults to fiscal year 2026–27 and August, but reports no August document. The previously verified exact first-party July asset remains the newest available public candidate: `https://cdnstorage-ddh3hqhvg3gyedd9.a02.azurefd.net/brcms/factsheetj-msr48uoz-461483.pdf`. It will be validated and cached as the latest available document unless the PDF content identifies a different period.

The direct-source workflow retrieved the first-party asset, validated **July 2026** from PDF text, and stored it as document `2460001`. The latest available JioBlackRock factsheet is now cached for automatic reuse.

### Latest-mode recovery — Navi Mutual Fund — 18 August 2026

Navi's official factsheet page renders the factsheet section but its normal accordion interaction became unavailable in the current browser session. The existing verified first-party July-release candidate remains `https://public-assets.prod.navi-tech.in/navi-website-assests/documents/NaviActiveFundJuly_26_20260813132532.pdf`, published on Navi's official assets host. It will be retrieved and content-validated as the latest available document rather than assumed from the filename.

The standard direct-source workflow retrieved the official asset, verified **July 2026** from the PDF content, and stored it as document `2490001`. Navi's latest available verified factsheet is now cached for automatic reuse.

### Latest-mode recovery — Zerodha Fund House — 18 August 2026

Zerodha's official archive page remains current only through **Factsheet - Feb 26**. Because latest mode now stores the newest document the official archive actually offers, its normal first-party asset `https://assets.zerodhafundhouse.com/offer-documents/factsheet/Factsheet%20-%20Feb%2026.pdf` will be content-validated and cached rather than rejected for predating July.

The direct-source workflow retrieved the official asset, verified **February 2026** from PDF content, and stored it as document `2520001`. Zerodha's current latest available official factsheet is now cached rather than treated as a retrieval failure.

### Latest-mode recovery — Quant Mutual Fund — 18 August 2026

Quant's official July-labelled control was previously rejected only because it delivered a June-period document. Under latest mode, the content-valid official June PDF is the correct latest available candidate: `https://quantmutual.com/Admin/Factsheet/quant_Factsheet_June_2026.pdf`. It will be validated and stored under its actual reporting period instead of being rejected for not matching the old July target.

The standard direct-source workflow retrieved the official PDF, validated **June 2026** from its content, and stored it as document `2550001`. Quant is now available through the cache under its true latest reporting period.

### Latest-mode recovery — Bajaj Finserv Mutual Fund — 18 August 2026

The public Bajaj factsheet selector uses its WordPress downloads endpoint. The live official page exposes `https://media.bajajamc.com/wp-content/uploads/2026/07/Abridged-Factsheet_July-2026.pdf` as its newest factsheet-labelled PDF, after `Factsheet_June-2026.pdf`. The July-labelled asset will be content-validated before storage; latest mode will retain the actual printed reporting period rather than infer it from the filename.

The direct-source workflow retrieved the official July-labelled PDF, verified that its content reports **June 2026**, and stored it as document `2580001`. An older parsed `MPC-update-August-2026.pdf` record was correctly excluded from latest factsheet cache selection because it is market commentary rather than a factsheet.

### Latest-mode cache reconciliation — Mirae Asset Mutual Fund — 18 August 2026

Mirae already has a parsed **August 2026** official document in cache (document `1890001`). Latest mode will reuse that document rather than perform an unnecessary re-download; the prior July audit mismatch is relevant only to strict historical retrieval.

### Latest-mode recovery — DSP Mutual Fund — 18 August 2026

DSP's official JSON download feed now confirms **Factsheet June 2026** as its newest published record, with the public source URL `https://www.dspim.com/downloads/dsp-factsheet-june-2026.pdf`. The downloader will validate and cache this actual latest period; strict July coverage remains a separate historical-audit outcome.

The direct-source workflow retrieved the official feed's PDF, verified **June 2026** from its content, and stored it as document `2610001`. DSP is now cached under its true latest available reporting period.
