# R38 revenue and acquisition audit — 26 October 2026

MCP Checkout gross remains $0 across all available completed Sessions. Finalized Google Search still supplies zero measured clicks. The hosted instrument now records 19 ordinary successful protocol responses, but every success is unattributed and no ordinary checkout handoff is recorded. This is movement from the previous zero recorded activation; it does not establish human users, completed buyer jobs or willingness to pay.

Collection: 2026-10-26T05:11:17.264Z–05:11:52.124Z, with a subsequent six-URL indexed-version inspection. [Raw aggregate audit](../data/r38_kpi_audit.json), [decision summary](../data/r38_kpi_summary.json), [exact URL inspection](../data/r38_kpi_index_inspection.json). All API use was read-only and unpaid. No Checkout Session, tool call, live probe, email, account, indexing request or production change was created.

| Measure | Current observation | Evidence and scope |
| --- | --- | --- |
| MCP paid Checkout history | 0 paid MCP Sessions; $0 recorded gross | Exhausted 2 pages, 186 completed Sessions, all 186 paid shared-account positive controls. Exact `mcp.zovo.one` success host, current known MCP prices and product metadata independently find zero MCP paid matches. Full expanded line-item coverage asserted. Available history begins 2024-10-09; latest completed account record 2026-10-20. Not every payment channel or net profit. |
| MCP Checkout, rolling 28 days | 8 Sessions: 4 tagged probes, 4 untagged; 0 untagged paid | Sep 28 05:11:17–Oct 26 05:11:17 UTC; 200 account records/2 pages reach Sep 18, proving full-window coverage. Untagged does not prove a buyer. |
| MCP Checkout, rolling 7 days | 0 Sessions | Oct 19 05:11:17–Oct 26 05:11:17 UTC; 100 account records/1 page reach Oct 6. Account read control nonzero. |
| Google Search | 38 impressions / 0 clicks across 6 MCP URL rows | Sep 26–Oct 23, 28 finalized reporting dates. Exact-host page filter; parent host control 4,939 impressions / 46 clicks across 297 page rows. No `/s/` product or `/guides/` row returned. |
| GitHub repository | 83 views / 43 reported unique clients; 2,972 clones / 360 clone clients; 2 stars | Oct 11–24 API window; not people, installs or successful jobs. Referrer rows: Google 2 views/1 client, github.com 1/1, official registry 1/1. These tiny referrer counts do not rank channel ROI. |
| Hosted protocol use | 19 ordinary successful responses; 7 first anonymous token/server/day observations; 19 upgrade impressions | Oct 20 00:00–Oct 26 05:11:19 UTC. Every success source is `unattributed`. Public counters pool all servers. No defensible per-server usage winner. |
| Hosted offer and handoff | 1,581 ordinary offer views; 0 ordinary checkout handoffs | Same hosted window. Ordinary means unmarked, not human. Source labels are caller declarations; offer views include automation and prior operator contamination. |
| Guard-passing navigation | 3 seven-date clicks; all 3 `buy.unknown-product`; 0 other guard-passing clicks | Instrument 3, fetched 05:11:20 UTC. The three observations are invalid-product navigation, not evidence of valid product purchase intent. |

The six Google page rows are home 26 impressions, connect 7, time-tracker protocol endpoint 2, and price-tracker/token/zip protocol endpoints 1 each. Search impressions currently concentrate on the homepage and connection/protocol routes, not the task guides or offers. The data does not support an organic buyer funnel.

The unknown-product finding is checked against `billing/src/index.js`: its unknown `/buy/` product branch counts a guard-passing request under a validated source or `buy.unknown-product`, then returns 404. A total upgrade-click label therefore mixes this dead-route diagnostic with valid navigation. Preserve the diagnostic and expose it separately. The current data identifies neither the requested invalid product nor its referrer; do not invent a broken product link.

Exact URL Inspection finds duplicate-invoice-check, three-way-match, their duplicate-reference guide, downloads and the older invoice page unknown to Google. The homepage positive control is indexed and was last crawled Oct 18 22:21:19 UTC. Prior receipts called the two focus products and downloads discovered but not indexed. This changed coverage response is not independent evidence of deindexing; URL Inspection is an indexed-version snapshot, not a live fetch or submission result. The six exact URLs in the separate receipt govern this conclusion. Two guessed noncatalogue paths in the preliminary collector are excluded; the reusable collector now derives its inspection URLs from the preserved R37 inventory.

Compared with the 17 October revenue review, MCP paid history stays 0 while the shared-account paid control grows from 182 to 186. GSC shifts from 34 impressions/0 clicks in Sep 16–Oct 13 to 38/0 in Sep 26–Oct 23. GitHub shifts from 58 views/32 clients to 83/43; clones shift from 3,457/279 clients to 2,972/360. Rolling 28-day untagged MCP Sessions shift from 31 to 4. These windows overlap and age records out; these are descriptive changes, not causal sprint gains or declines. The older hosted receipt had 0 ordinary successful responses, 287 ordinary offer views and 0 handoffs during roughly its first 15 hours after instrumentation; comparing its exposure with a later seven-date window does not yield a conversion or growth rate.

The current hosted success counts by UTC date are Oct 20: 1; Oct 21: 1; Oct 22: 2; Oct 23: 0; Oct 24: 12; Oct 25: 0; Oct 26 partial: 3. Success means a returned protocol result passed the instrument's checks, not that a relevant operator completed a useful business task. Seven token/server/day observations can include repeat tokens, several servers or automation; they are not seven customers. Missing sidecars, deferred write failures and local use remain outside observed capture. All seven daily aggregate reads are complete; that proves bounded retrieval, not perfect instrumentation coverage. No new live positive-control event was created to avoid contamination; the existing nonzero ordinary counters and local controls are reported separately.

The highest expected return now is qualified distribution into an observable task, followed by repeat-use and purchase evidence. Link the exact working browser task, canonical guide and matching product from a relevant permitted listing or community surface. Verify indexing, clicks and attributed trials after publication; a submission receipt is not acquisition. Use proposed buyer-trial gates already recorded in the revenue review: 10 qualified supplied-data trials, 3 voluntary repeat batches and 1 independent paid outcome before treating broader catalogue expansion as a revenue strategy. These are management thresholds, not measured outcomes or forecasts.

Keep useful free diagnostics while testing the recurring reason to pay. The current invoice-review upgrade removes a saved-report count cap; no buyer evidence yet says that cap is the paid need. The 19 unattributed responses do not validate a new server idea, price cut or weaker free tier. Actual ROI remains unavailable because total attributable agent, hosting and acquisition costs have not been reconciled; a lifetime sale is not MRR.

Fresh Resend configuration at 05:15:11 UTC confirms `zovo.one` verified with sending enabled, receiving disabled, in `ap-northeast-1`; the local key is present and the account read returns 3 domains. This proves configuration, not inbox delivery or key send scope. The local campaign remains 18 manual rows, 0 email rows, 0 explicit opt-ins and 0 eligible recipients in dry-run. No email was attempted. This is not a census of production setup-email subscribers; no eligible subscriber audience is inferred from anonymous tokens. [Fresh configuration and dry-run receipt](../data/r38_kpi_email_config.json). Source targets and outbox hashes remain unchanged. No new email service is required to run the existing path; relevant opted-in participants and measured buyer outcomes remain the missing commercial input.

Reproduction and verification:

```sh
node scripts/r38-kpi-audit.mjs --collect
# Existing snapshot is deliberately preserved; rerun requires a new output path.
# Native calls: stripe checkout sessions list --live --limit 100 [--starting-after cursor]
# stripe get /v1/checkout/sessions --live -d status=complete -d limit=100 -d expand[]=data.line_items
# gh api repos/theluckystrike/mcp-servers/traffic/{views,clones,popular/referrers}
# Read-only GSC searchAnalytics/query on sc-domain:zovo.one; exact hostname, final data, row cap checked.
# GET https://mcp.zovo.one/stats/{funnel,clicks} with x-mcp-probe: 1.
python3 scripts/gsc_inspect_r3.py https://mcp.zovo.one/s/duplicate-invoice-check https://mcp.zovo.one/guides/check-duplicate-supplier-invoice-references-in-claude https://mcp.zovo.one/s/three-way-match https://mcp.zovo.one/downloads https://mcp.zovo.one/ https://mcp.zovo.one/s/invoice
node --test test/kpi-populations.test.mjs
node --test billing/test/funnel-state.test.mjs billing/test/funnel-r1.test.mjs billing/test/funnel-checkout.test.mjs
```

Population controls pass 6/6; funnel controls pass 32/32, including false-success rejection, cohort handling, transaction rollback and retry/deduplication behavior in the local harness. These tests do not replace live paid fulfillment or full traffic capture. [Population test output](../data/r38_kpi_population_tests.txt), [funnel test output](../data/r38_kpi_funnel_tests.txt). The six prior evidence files retain their original SHA-256 hashes. Credentials and raw customer/Session objects remain in memory. No dashboard or shared reporting file was edited by this audit.

## Closing snapshot, 09:12 UTC

The immutable initial figures above are retained. [Closing native audit](../data/r38_kpi_final_audit.json) and [derived comparison](../data/r38_kpi_final_summary.json) still show zero MCP paid completions/$0 gross, four untagged 28-day Sessions, zero untagged seven-day Sessions, 38 finalized Search impressions/zero clicks and unchanged GitHub traffic windows. Six tagged 28-day probes are excluded. Unmarked hosted offer views are now 1,612; successful responses remain 19, first token/server/day observations seven and handoffs zero. Four known dead-route navigations are counted in seven UTC dates, with zero others. These changes do not establish buyers or causal launch effects.

[Closing exact URL inspection](../data/r38_kpi_final_index_inspection.json): the homepage is indexed and was crawled at 08:35 UTC; the other seven inspected URLs, including the new supplier product and guide, are unknown to Google. No submission is represented as indexing.
