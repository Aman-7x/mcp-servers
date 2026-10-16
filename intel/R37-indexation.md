# R37 Google index and sitemap inspection

Read-only Search Console checks at09:36–09:37UTC used the existing service account and `webmasters.readonly` scope. No sitemap submission, indexing request, account configuration or permission escalation occurred.

| Inspected public URL | Google's indexed-version result |
| --- | --- |
| /s/duplicate-invoice-check | URL is unknown to Google |
| /guides/check-duplicate-supplier-invoice-references-in-claude | URL is unknown to Google |
| /s/three-way-match | Discovered - currently not indexed |
| /downloads | Discovered - currently not indexed |
| / | Submitted and indexed; allowed; successful mobile crawl September29 |
| /s/invoice | Discovered - currently not indexed |

The indexed homepage is the positive control. These API results concern Google's stored version, not a live indexability test, ranking, traffic or demand. [Official URL Inspection documentation](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect). Full public-URL records are in [data/r37_google_index_inspection.json](../data/r37_google_index_inspection.json).

The sitemap record was last submitted October12 and last downloaded October16 at06:58:29UTC, before R37's launch. Google reports zero errors and warnings,293 submitted URLs and no pending fetch. Google documents `contents[].indexed` as deprecated and says not to use it. Its returned0 is retained only as raw data, with no indexed-page-count inference ([official resource schema](https://developers.google.com/webmaster-tools/v1/sitemaps)). [Official sitemap-list API](https://developers.google.com/webmaster-tools/v1/sitemaps/list); [aggregate evidence](../data/r37_google_sitemap_inspection.json).

The deployed current site adds the actual v0.22.8 release record and sorts release chronology by date, with semantic version as a tie-breaker. The older semantic-version-first order selected an earlier release date as the site-wide freshness hint. Current product HTML is regenerated from the corrected README links. Seven public HTTP controls at09:59UTC verify the actual October16 Last-Modified/sitemap dates, current release chronology, canonical guide, versioned reviewed script and all three current install links (`data/r37_csv_public_asset_verification.json`). This fixes current release metadata and install links; it does not establish the cause of Google's earlier crawl decisions or guarantee future crawling/indexing.

The accepted IndexNow request, working public GitHub/registry routes and directory receipt remain separate distribution observations. The next commercial need is qualified buyer discovery and workflow feedback. Finalized GSC impressions/clicks still use their explicitly frozen prelaunch window; these URL inspections do not replace that traffic measurement.

## Final fixed-URL follow-up

The same six indexed-version reads completed 2026-10-16T11:20:42.984Z. The initial snapshot is unchanged. These are Google status observations; no live crawl or traffic outcome is inferred.

| Role | Initial 09:36 UTC | Follow-up 11:20 UTC |
| --- | --- | --- |
| new_product | URL is unknown to Google | URL is unknown to Google |
| new_guide | URL is unknown to Google | URL is unknown to Google |
| matcher_product | Discovered - currently not indexed | URL is unknown to Google |
| download_catalogue | Discovered - currently not indexed | Discovered - currently not indexed |
| older_home_control | Submitted and indexed | Submitted and indexed |
| older_invoice_control | Discovered - currently not indexed | Discovered - currently not indexed |

The new product and guide remain unknown. The matcher changed from discovered/not indexed to unknown; it was not previously indexed, so this is not evidence of de-indexing. The homepage remains an indexed positive control. No indexing gain is observed in these snapshots. [Final raw inspection](../data/r37_google_index_after_final.json).

A later, separate sitemap operation used the existing property role after read-only permission/content checks: accepted, 1 PUT attempt, 1 accepted. The already registered exact project sitemap contains the new product and guide. This is a discovery hint; acceptance does not establish a crawl or indexing. [Google submit API](https://developers.google.com/webmaster-tools/v1/sitemaps/submit), [operation receipt](../data/r37_google_sitemap_resubmission.json). No account, property, key or role was created or changed.
