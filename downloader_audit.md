# Downloader Reliability Audit

## 2026-08-12 — SBI Mutual Fund

The registered official factsheet page, `https://www.sbimf.com/factsheets`, returned **502 Bad Gateway** from Microsoft Azure Application Gateway in both the application probe and browser session. The downloader must therefore treat this as a temporary AMC-side availability failure, return a structured result, and continue the remaining batch rather than retrying indefinitely or surfacing an HTML response.

## Controlled Bulk Outcome

The controlled run downloaded and stored factsheets for **35 of 50** registered AMCs. The remaining 15 sources completed with structured outcomes rather than interrupting the run. Their official pages either denied automated access, did not expose a public factsheet-PDF link in server-rendered HTML, or were temporarily unavailable. The application now labels these outcomes as blocked, unavailable, timed out, or no PDF found, while preserving all successful PDFs for factsheet-grounded chat.

## Complete All-Source Controlled Batch

A single follow-up batch attempted **all 50 active AMC sources** with two concurrent requests. It stored **22 newly downloaded factsheets** during that run and completed every source request with a structured outcome. The database now contains **169 downloaded documents across 35 distinct AMCs**. The other 15 source pages remained externally blocked, temporarily unavailable, or did not expose an official PDF link to server-side retrieval; their result is reported in the batch summary rather than breaking the run.
