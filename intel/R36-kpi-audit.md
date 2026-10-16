# R36 KPI audit — 2026-10-16

status: DONE

Measured demand remains small. Google now reports impressions, overturning the stale zero-impression narrative, but no storefront clicks. Seven-day MCP checkouts and gross paid checkout amount are zero. A separate completed-only audit now exhausts all available Checkout history: 182 paid account sessions, zero MCP storefront sessions. Recorded MCP checkout gross is therefore $0; other payment channels and net business revenue are outside this measurement.

## Current measurements

| Channel and scope | Result | Evidence / control |
|---|---|---|
| Stripe, seven days ending 2026-10-16T00:24:11Z | 0 MCP sessions; 0 paid; $0 gross paid checkout amount | `stripe checkout sessions list --live --limit 100`, MCP `success_url` scope; oldest returned Sep 24 proves full seven-day coverage; same account sample contains 16 paid sessions elsewhere |
| Stripe, latest 100 only | 8 MCP sessions: 3 tagged probes, 5 untagged, 0 paid | Same command; untagged does not prove human |
| GSC, Sep 15–Oct 13 inclusive (29 dates) | 34 impressions, 0 clicks | Read-only JWT, `searchAnalytics/query`, date dimension and page contains `//mcp.zovo.one/`; same query for `//zovo.one/` returns 5,486 impressions/49 clicks |
| GSC pages | homepage 28 impressions; `/mcp/connect` 5; `/mcp/time-tracker` 1 | Same API with page dimension |
| GSC visible queries | `site:zovo.one`: 10 impressions | Same API with query dimension; anonymization means query totals do not equal page totals |
| Cloudflare, Oct 9 00:23:54–Oct 16 00:23:54 UTC | 1,154,085 estimated requests; 5,277 render-qualified browser requests including assets; 1,257 on sitemap URLs | `node scripts/traffic.mjs --no-gsc --out data/r36_kpi_audit.json`; all 13 adaptive day/half-day slices below 10,000-row cap; largest 9,898 |
| Sitemap coverage | 289/289 crawled by search/AI UA; Googlebot 41/289 | Same command; crawling is not indexing or people |
| Registry ecosystem storefront referrals | 242 raw requests: mcpservers.org 239, Glama 2, mcpi.app 1 | Same command, referer-host grouping; does not independently identify people |
| GitHub, Oct 1–14 | 47 views, 25 uniques, 3,253 clones, 232 clone clients, 2 stars | `gh api repos/theluckystrike/mcp-servers/traffic/{views,clones,popular/referrers,popular/paths}` and repo metadata, invoked by traffic instrument |
| Remote KV, current population | 0 live token records; 39 anonymous data documents across 32 distinct tenant IDs; 1,396 license data documents across 49 IDs; 0 bindings/download records | Cloudflare read-only keys REST API with complete cursor pagination: 3,219 keys, 4 pages; nonempty namespace is positive control |
| LICENSES KV | 0 `session:` license rows; 4 `sub:` and 1 `unsub:` email rows | Same read-only keys API, complete single page; raw five rows are not licenses |
| Upgrade counter v3 | 0 clicks in 7 days; historical v3 979, legacy 1,690 excluded | `curl -fsS --max-time 20 https://mcp.zovo.one/stats/clicks`; nonzero historical v3 is read control; no synthetic counted click sent |

Raw evidence and query metadata: `data/r36_kpi_audit.json`. No credential values, tokens, customer identities, or checkout IDs were printed or added to the audit.

## Instrument repairs

`scripts/kpi.mjs` previously treated `anon:` per-server documents as token mints, `tok:` token records as stored-data tenants, and every LICENSES row as a minted license. It also mixed account-wide and storefront checkout signals and used cross-window conversion ratios. The collector now deduplicates anonymous tenant IDs, labels current expiring populations, restricts minted license records to paid non-probe MCP sessions, excludes signed test IDs and unverified bindings, and bounds session-to-click comparison to seven days. The original unfiltered scan remains explicitly incomplete; completed-only checkout history is separately exhausted.

`node scripts/kpi.mjs --from-audit` refreshes only the currently verified KPI rows, retains per-channel timestamps/windows, and explicitly marks other rows stale. It performs no network calls or signed-key probes. This command produced the current `data/kpi.json`; the collector's full network path was not run.

Validation: `node --check scripts/kpi.mjs`; `node --test test/kpi-populations.test.mjs` → 3/3 pass. Fixtures cover token/document/email separation, cross-storefront/probe/window separation, and signed probes with bindings never becoming paid tenants. Additional assertions verified seven-day coverage, positive controls, absence of credential-like identifiers, the current KPI values, and undefined conversion with a zero denominator.

## Limitations and next actions

1. Prioritize referred successful jobs from mcpservers.org and individual GitHub mirrors: mcpservers.org supplies 239/242 measured registry-ecosystem requests. More listing totals alone do not demonstrate ROI. This evidence is referral volume, not measured revenue attribution.
2. Add explicit probe-tagged first-success and upgrade-impression events before evaluating upsell conversion. The 32 anonymous storage tenants include operator and validation activity; 49 signed license IDs are unproven as paid and remain excluded. No current person-level activation or retention rate is established.
3. Focus search work on specific demonstrated buyer jobs. All 34 impressions attach to three URLs, and the only visible query is a site operator query. Do not infer buyer demand from 289 crawled URLs or add content based solely on crawl totals.
4. Treat render-qualified traffic as a browser heuristic. Proof is associated with a UA string across the whole window, so automation and unrelated clients sharing the UA can pass. The historical PL country exclusion cannot reliably remove this operator (task timezone is Asia/Ho_Chi_Minh). GitHub uniques also lack independent human verification.
5. Do not label every assistant-UA fetch user initiated: the instrument combines Claude-User with Claude-SearchBot/anthropic-ai, and combines Perplexity scheduled/user crawlers. No new blind recommendation test or full URL-index inspection census was performed.

The unfiltered Stripe-account pagination attempt reached its 50-page guard because the shared account has more than 5,000 Sessions. A follow-up query filters status=complete, then paginates to has_more=false: two pages cover all 182 completed Sessions, all paid, spanning October 2024–October 2026. Exact success_url hostname mcp.zovo.one matches zero. This establishes zero recorded MCP Checkout gross across available completed history without exporting raw customer/session objects. It does not establish profit or revenue from other channels. Evidence: data/r36_completed_checkout_audit.json; reproducible read-only script: scripts/audit-completed-checkouts.mjs. API semantics: https://docs.stripe.com/api/checkout/sessions/list.

No publishing, deployments, outreach, paid API calls, or account creation occurred. No temporary folders were created.
