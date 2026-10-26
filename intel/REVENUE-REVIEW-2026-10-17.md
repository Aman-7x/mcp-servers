# Why MCP revenue is still zero — 17 October 2026

Audit collected 2026-10-16T23:30:32.680Z–2026-10-16T23:30:37.444Z UTC (17 October ICT). This review updates the owner's local [dashboard](../DASHBOARD.html), which redirects to [index.html](../index.html). It is a commercial diagnosis, not another product launch.

## Direct answer

Engineering progress has outrun commercial validation. The strongest explanation for zero revenue is insufficient qualified discovery and an unproven reason to pay for the upgrade.

Earlier sprints prioritized adding servers, releases and automated checks before establishing repeat buyer use and a paid upgrade. That was the wrong sequence for a revenue goal. More output was repeatedly treated as progress toward sales without evidence that buyers were arriving.

The catalogue has 57 listed pages and 48 paid singles in the last implementation audit. Those counts describe supply. We have no demonstrated acquisition channel delivering a repeat stream of qualified operators, successful buyer jobs and paid upgrades. Existing code and packaging are assets, but their creation does not establish product-market fit.

## Fresh evidence

| Stage | Observed result | Window and practical limit |
| --- | --- | --- |
| Google discovery | 34 impressions, 0 clicks; only 3 URL rows | 2026-09-16–2026-10-13, 28 finalized reporting dates. Home 28 impressions, connect 5, hosted time-tracker endpoint 1; no product sales-page row. Predates the latest launches. |
| GitHub reach | 58 views, 32 reported unique clients | October 2–15, as served by the API. Not qualified visitors, users or installations. |
| Hosted activation | 0 ordinary successful business calls; 13 probe successes | Instrument first record October 16 08:32:08 UTC; collected 23:30 UTC. Roughly 15 hours, not weeks. Does not observe local use, unresolved older tokens or dropped events. |
| Hosted offer interest | 287 ordinary offer views, 0 ordinary handoffs | Same new instrument. Ordinary means unmarked. Includes known operator contamination; does not mean 287 people or buyers. |
| Upgrade clicks | 0 guard-passing clicks | Latest seven UTC dates, instrument 3; legacy/unattributed counts excluded. Headers do not establish people. |
| MCP Checkout | 38 Sessions: 7 tagged probes and 31 untagged; 0 untagged paid | Complete 28-day window 2026-09-18T23:30:32.681Z–2026-10-16T23:30:32.681Z; 2 pages/200 account records reach September 17. A Session is not a verified buyer. |
| Paid MCP Checkout history | 0 paid MCP Sessions; $0 gross | All 182 available completed Checkout records, 2 exhausted pages. Zero MCP matches independently by exact host, current known price and product metadata. 182 paid shared-account records are a positive read control. |

[Fresh aggregate receipt](../data/revenue_audit_2026-10-17.json) records command/API methods, pagination, timestamps, windows and coverage limits. Stripe credentials, full objects, customers and Session IDs remain in memory. Google uses finalized page rows, an exact-host check and a nonzero parent-host control. [Google API documentation](https://developers.google.com/webmaster-tools/v1/searchanalytics/query) specifies reporting dates, finalized data and row limitations. No conversion rate divides these different populations or windows.

Fresh URL Inspection at 2026-10-16T23:31:25.115Z finds the duplicate product and matcher **discovered, currently not indexed**, and the new guide **unknown**. The homepage is indexed. This is better discovery for two products than the prior unknown state, but not an indexed result or traffic gain. The latest product launched only October 16; this snapshot cannot condemn its long-term demand. [Six-URL inspection](../data/r37_google_index_after_revenue_review.json).

## A material reporting error

The September 29 report claimed two MCP sales at $19 each, $38 total, and inferred that license fulfillment worked. That attribution was wrong.

The fresh API read located both referenced records. Each is a paid **$4.99 subscription** with success/cancel host `zovo.one`, no MCP price match, no MCP product metadata and no MCP-named line item. These are another storefront's subscriptions. They prove the shared Stripe account receives payments; they do not prove MCP demand or MCP paid fulfillment. There is no customer-identifying information in the new receipt.

A correction is now prominent at the top of [the original report](R7_MONETIZATION.md); its historical wording and the ledger are preserved. The dashboard's historical $38 claim must not be used for forecasts or ROI. The scoped current MCP Checkout gross is $0. This review does not audit every non-Checkout rail or all-time net profit.

## Why the current approach has not produced money

### Discovery is too small to support a revenue expectation

**Measured evidence; causal interpretation.** Google supplied zero measured clicks in the finalized 28-date window. GitHub reports 58 views and 32 unique clients for October 2–15; those are not qualified customers. Registry rows, search positions and downloads do not establish buyer acquisition. Fresh inspection finds the two focus products discovered but not indexed; the guide remains unknown.

Publishing another server adds supply without a demonstrated way to bring buyers to it. [Evidence](../data/revenue_audit_2026-10-17.json).

### Usage and repeat value are still unproven

**Measurement limit.** The new hosted instrument records zero ordinary successful business calls and zero ordinary checkout handoffs, alongside 13 probe successes. Its first record is October 16 at 08:32 UTC: roughly 15 hours of evidence, not weeks. It excludes local usage and unresolved older tokens; deferred events can drop.

We cannot claim that nobody used any tool, or that an installed audience exists and wants an upgrade. Qualified buyer trials and repeat use remain unknown. [Evidence](../data/revenue_audit_2026-10-17.json).

### The paid benefit may be too weak for occasional users

**Hypothesis to test with buyers.** Duplicate invoice review gives full diagnostics, paging and CSV export away free. The $19 upgrade removes the three-saved-report cap. A user can complete a one-off review without paying.

Test whether real users need ongoing saved reports. A purchase button and a low price do not establish willingness to pay. Do not arbitrarily damage the useful free tier. [Evidence](../servers/duplicate-invoice-check/README.md).

### Distribution work has not produced a proven buyer channel

**Dated evidence, not a full channel census.** One Finance directory submission remains pending in the October 16 receipt. The new Glama page was 404/account-gated. The October 16 outreach audit found 18 manual targets, zero eligible email recipients and zero sends.

These are publication attempts and configuration work; no qualified pipeline has been established. Resend access alone does not supply an audience. [Evidence](../intel/R37-distribution.md).

### Engineering counters obscured the commercial problem

**Confirmed reporting correction.** Server count, tests, archive downloads, token IDs and synthetic recommendations were easier to increase than paid use. The old $38 sales claim also mixed this project with another storefront.

Lead the dashboard with buyer acquisition, observed successful jobs, repeat use, checkout outcomes and scoped revenue. Keep shipping counters as supporting evidence. [Evidence](../intel/REVENUE-REVIEW-2026-10-17.md).

A tested unpaid checkout path reduces implementation risk. It does not prove a buyer wants the offer, has reached it, can finish a real paid purchase, or receives the paid fulfillment. There is no evidence here that changing payment processors would solve the current acquisition problem.

The weak upgrade hypothesis is specific: the duplicate-review tool provides the central diagnosis and export for free, while $19 removes a saved-report cap. An occasional operator may finish the job without requiring more storage. We do not yet have qualified-user evidence establishing that this is the purchase blocker. Keep useful free diagnostics; test the recurring paid job before changing caps or price.

## Change the next sprint's success criteria

Pause new server expansion as the default revenue strategy. Focus the next seven-day commercial test on the invoice-review workflow for bookkeepers/AP operators who already use a compatible assistant.

1. **Recruit 10 qualified workflow trials.** Count an actual relevant operator with a supplied, permitted or redacted batch and an observed completed review. Exclude agents, crawlers, fixture data and directory accepts. Decision threshold: 10 observed trials; diagnose installation and input friction for each failed attempt.

2. **Test repeat use and the existing paid reason.** Ask why a user would return, whether more saved reports matters, and what prevents purchase. Record the answer; do not infer it from a click. Decision threshold: 3 participants return with a second batch and at least 1 independent buyer pays the current offer. These are proposed decision thresholds, not forecasts.

3. **Continue only on commercial evidence.** If 10 qualified users cannot be recruited, change the acquisition approach. If they try but do not return, change the workflow. If they return but do not pay, change the paid offer. Decision threshold: No broad product expansion until buyer acquisition, repeat value and a paid outcome are observed. A week with too few trials is inconclusive, not product rejection.

These thresholds are proposed management decisions, not statistical proof or promised outcomes. Track actual recruitment attempts, observed completion, voluntary second use, stated objections and independent paid orders. A synthetic agent run is verification, never a customer trial. Fix blockers uncovered by those trials; avoid another broad catalogue expansion before this evidence exists.

Resend is already connected and verified in the fresh configuration read. The last campaign audit found 18 manual directory/community rows, zero eligible email recipients and zero sends. An account is not an audience. Use permission-based buyer trials or relevant public spaces that permit participation. This review sends no messages and creates no account. [Existing setup and campaign requirements](../docs/OUTREACH_RESEND_SETUP.md).

## Revenue arithmetic, without pretending it is a forecast

At the current one-time price, $1,000 gross requires **53 single purchases at $19**, or **26 bundle purchases at $39**. At an illustrative **2% qualified-visit-to-purchase rate**, those whole-sale targets require 2,650 or 1,300 qualified visits. Neither that rate nor a qualified-visitor denominator has been measured.

The dashboard includes an interactive scenario calculator. It computes gross as qualified visits × assumed purchase rate × one-time price; target sales are rounded up, and required visits follow that whole-sale count. Optional attributable costs are blank by default and are never silently zero. A scenario surplus is not actual profit or demonstrated ROI. Lifetime license sales are not monthly recurring revenue.

## Verification and scope

Original R37 baseline, final snapshot, observer and index-inspection receipts retain their original SHA-256 values. The current audit is separate and marks API errors unavailable rather than zero. The two historical payment references were cross-checked against fully expanded line items across the completed history.

This change updates local reporting and a read-only collector. It creates no Checkout, payment, email, production deployment or third-party publication. Total agent/hosting/acquisition costs, non-Checkout payment rails, live paid fulfillment and inbox delivery remain unreconciled or untested. The last broad release checkpoint still has 176 failures/28 gaps, including 54 version assertions; it was not rerun for this dashboard update.

Treg discovery reported that its existing team grant is no longer available. The project's existing native Stripe/GitHub/Google APIs supplied the audit without a paid data call, new account or credential change.

Verification: `node --test test/kpi-populations.test.mjs` passes 6/6, retaining the other-storefront/probe and false-paid-tenant controls. `scripts/verify-revenue-dashboard.mjs` passes seven grouped controls through the exact `DASHBOARD.html` redirect: sales correction, single/bundle arithmetic, unknown costs, zero/invalid inputs, all nine tabs, 390/320px layout, and zero external requests/page errors/storage writes. Desktop, mobile and calculator screenshots were visually inspected. [Browser receipt](../data/revenue_dashboard_verification.json). The first run failed its immediate post-close lsof guard; the own profile was retained, then removed only after a later clear check. The bounded retry preserves the deletion guard. [Initial cleanup record](../data/revenue_dashboard_initial_cleanup.json).
