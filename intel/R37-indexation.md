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

The sitemap record was last submitted October12 and last downloaded October16 at06:58:29UTC, before R37's launch. Google reports zero errors and warnings,293 submitted URLs and no pending fetch. Its sitemap `indexed` counter is0 despite the independently indexed homepage, so it is not treated as a complete host-wide indexed-page count. [Official sitemap-list API](https://developers.google.com/webmaster-tools/v1/sitemaps/list); [aggregate evidence](../data/r37_google_sitemap_inspection.json).

The current site build adds the actual v0.22.8 release record and sorts release chronology by date, with semantic version as a tie-breaker. The older semantic-version-first order selected an earlier release date as the site-wide freshness hint. Current product HTML is regenerated from the corrected README links. This fixes current release metadata and install links; it does not establish the cause of Google's earlier crawl decisions or guarantee future crawling/indexing.

The accepted IndexNow request, working public GitHub/registry routes and directory receipt remain separate distribution observations. The next commercial need is qualified buyer discovery and workflow feedback. Finalized GSC impressions/clicks still use their explicitly frozen prelaunch window; these URL inspections do not replace that traffic measurement.
