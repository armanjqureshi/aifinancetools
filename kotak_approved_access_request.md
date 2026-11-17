# Kotak Mutual Fund Document-Host Access Request

## Purpose

> Request approved, read-only access to Kotak Mutual Fund's publicly listed factsheet PDF delivery route so a registered factsheet tool can retrieve the same documents made available through Kotak's Forms and Downloads page.

## Observed First-Party Flow

Kotak's public record endpoint exposes dated document metadata for the 2026 factsheets:

`GET https://www.kotakmf.com/api/kotakapi/forms/user/getsubheaderList/219?year=2026&month=7`

The July record identifies `KotakMFFactsheetJuly2026.pdf`; the June record identifies `KotakMFFactsheetJune2026.pdf`. The public document delivery host `https://java17vlbapi.kotakmf.com/kotakapi/` returns HTTP 401 for both exact records, including a standard browser session. No access-control bypass has been attempted.

## Requested Kotak Support

Please provide one of the following approved mechanisms for non-interactive, read-only retrieval of publicly listed factsheets:

1. A documented public factsheet API or document-feed endpoint.
2. An API key or OAuth client with read-only scope for the listed factsheet documents.
3. An allowlist procedure for the application's outbound service identity or IP range.
4. A stable public CDN or download URL for each factsheet record.

## Safeguards in the Application

The application requests a chosen reporting month, accepts only a real PDF response, parses the document, verifies that its printed reporting month matches the selection, and stores the verified file for later reuse. It does not guess opaque document paths, alter Kotak content, submit transactions, or access investor data.

## Interim Fallback

Until approved access is available, an authorized user can download a PDF from Kotak's official page and use the **Choose official PDF** control. The tool validates the selected reporting month inside the PDF before storing it; a wrong-period document is rejected.
