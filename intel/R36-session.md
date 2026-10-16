# R36 revenue and organic distribution sprint

Session: 2026-10-16 00:22:43–04:22:43 UTC. Status: engineering and publication complete; automatic expiry verification and sampled observation remain in progress. The clock deadline has not yet been reached.

## Commercial result and biggest win

Recorded MCP storefront Checkout gross is **$0**. The complete seven-day baseline has zero untagged MCP Sessions, and a separate completed-only Stripe query exhausts all available matching history: two pages, 182 paid account Sessions, zero with success URL hostname `mcp.zovo.one`. This measures available Checkout records, not other payment channels, refunds, fees or profit. Two marked unpaid operator Sessions created in this sprint are excluded from commercial metrics. There is no measured revenue lift or positive ROI from this sprint.

The biggest durable win is a working route from a specific buyer problem to evidence, installation and a verified upgrade handoff. A supplier invoice can agree in grand total while disagreeing by SKU. The new matcher exposes that error, provides its complete evidence free, and offers a clear $19 saved-report upgrade or $39 lifetime bundle. A visitor can try the matching engine in the browser before installing. Working versioned downloads replace links that previously sent almost every product to an unrelated one-asset latest release.

Qualified discovery remains the constraint. GSC reports 34 MCP-host impressions and zero clicks across September 15–October 13 inclusive. GitHub reports 25 unique visitors across October 1–14, without independent human verification. A fresh unprimed documentary trial names the estate in 9/18 buyer answers, six first-listed; raw host URLs appear in 15/18. Older trials differ in model/search conditions, so this is visibility evidence, not a causal revenue comparison. These measurements do not share a funnel denominator.

Ten specialist agents were used across the sprint, with separate KPI, conversion, organic research, implementation, integration, outreach, blind recommendation, release review, resume-race and artifact-verification tasks. Follow-up audits reused existing agents. Structured tool-call provenance: `data/r36_agent_orchestration.json`; this is a total-agent count, not ten simultaneous workers.

## Published product and distribution

- [Three-Way Invoice Match](https://mcp.zovo.one/s/three-way-match): local stdio, eight tools, exact SKU matching, whole-unit quantities and integer minor-unit money. Inputs are a purchase order, accepted/rejected receipts, invoice and explicitly supplied prior invoicing. No OCR, PDF extraction, ERP integration or payment approval is claimed. Full diagnostics and pagination are free; free storage permits three simultaneous saved reports, Pro removes that cap.
- [Editable buyer proof](https://mcp.zovo.one/guides/match-supplier-invoice-purchase-order-delivery-note-in-claude#matcher-demo): compiled from the same pure matching core. Six actual Chrome scenarios pass locally and in production, including offsetting quantities, offsetting prices and valid partial delivery. No diagnostic requests, field uploads, storage or page errors. Desktop/mobile screenshots were inspected. The product page and mirror link directly to the demo.
- Public [v0.22.6 release](https://github.com/theluckystrike/mcp-servers/releases/tag/v0.22.6) contains standalone and office archives. Unauthenticated downloaded bytes match the exact tested SHA-256. The [standalone mirror](https://github.com/theluckystrike/mcp-three-way-match) installs/builds/tests independently and has green GitHub CI.
- Official registry names `io.github.theluckystrike/three-way-match` and `io.github.theluckystrike/supplier-invoice-matching` are verified at 0.22.6 with the exact archive hash and no remote endpoint. These are two names for one capability.
- [Download catalog](https://mcp.zovo.one/downloads): 56 explicit versioned asset links, all public HEAD 200. Older products retain actual older versions. Reachability does not certify the older fleet's functionality.
- Office archive: all 48 children initialize and expose 441 tools. The previous static manifest incorrectly declared 407. Runtime inventory now drives packaging. CRC and every-file repack comparison passed. The office README and guide counts now match the proxy; the broader standalone catalog is counted separately. Its [public mirror CI](https://github.com/theluckystrike/mcp-office-suite/actions/runs/38843677329) passes install/build/runtime tests: five pass, three monorepo inventory tests skipped. Source office tests pass all eight.
- New matcher repository is first in three narrow GitHub query snapshots (two, three and seven total results). Quote-to-invoice metadata also published; one query moved 5→3 and two previously empty queries now return the repository. No search-volume or durable ranking claim. IndexNow accepted four URLs; this does not establish indexing.
- Submitted one free Finance listing through [mcpservers.org's invited form](https://mcpservers.org/submit). Success receipt and screenshot captured; **pending curator review**, not a published listing. Fee $0. This directory supplied 239/242 measured registry-referral requests, which are not independently identified people. No new awesome-list PR was opened into its existing twelve-PR backlog.

## Checkout and runtime verification

Latest billing version: `a2d71ca6-ac77-4a12-94a7-fc2e04feda0f`, deployed through the unchanged release gate after [PR #68](https://github.com/theluckystrike/mcp-servers/pull/68) merged. All 59 purchase GET shapes passed with zero Session creation during the gate. Earlier source/product work merged in PRs #65–67. Release history: `data/r36_release.json`.

Billing fixes preserve a tenant across single-to-bundle and cancellation navigation, describe confirmation-page key delivery accurately, remove unsupported scarcity/popularity claims, require hosted tokens, and correct the bank guide to CSV-to-Excel. The local matcher does not advertise unsupported web-client or hosted setup.

A read-only provider audit verifies all 28 configured Stripe Prices are active, USD, correctly named and correctly priced; twenty additional products use inline pricing. The CLI credential cannot expire live Sessions. An initial permission preflight therefore stopped before creating anything. A subsequent explicit operator-only short-expiry option bounds marked Sessions to approximately 31 minutes, derives expiry from order identity for stable retries, rejects stale operator forms and caps cache life before expiry. Ordinary checkout timing is unchanged.

Separate real-browser unpaid QA then created exactly two tagged Sessions: matcher **1900 USD cents**, bundle **3900 USD cents**. Both preserve expected product/version metadata; repeating each order returns the same checkout; unpaid fulfillment returns 402. No customer, payment intent, payment details or charge. Their automatic expiry is due by **03:36:48 UTC**; read-only verification remains pending. This verifies unpaid handoff and refusal, not a completed live paid fulfillment. Positive fulfillment is covered by billing tests and ephemeral local signing/activation, without a live purchase.

The manual tool binds state and report by run/version/source/tenant, checks product/order/session evidence, preserves prior failures, uses atomic writes and holds an OS lock. Real cross-process tests prove exclusion and release after exit/SIGKILL. The browser blocks the Stripe payment page. Only exact owned unpaid Sessions qualify for cleanup; it cannot expire arbitrary customer Sessions.

Validation evidence:

- Full root checkpoint: 2,273 tests, 2,241 pass, 32 skip, zero fail. A real resume directory-creation race was fixed with deterministic coverage distinguishing directories from files/symlinks. Later focused changes are reported separately rather than pretending the whole suite was rerun.
- Matcher: 25 tests, 5,000 independent arithmetic cases, 1,022 real calls against the exact standalone artifact, dependency guards preventing monorepo fallback, and fresh source build. Office proxy performed real matching/get/CSV calls. Oversized outputs use free complete paging within the SDK budget; source inputs and storage are bounded.
- Billing: 190/190. Ownership/recovery/locking: 6/6. KPI/blind selection: 6/6. Outreach sender: 30/30. Office source: 8/8. Matcher source Docker/runtime CI, matcher mirror CI and repaired office mirror CI are green.
- Artifact verification: `intel/R36-artifact-verification.md`, `data/r36_public_downloads.json`, `data/r36_office_repack_verification.json`. Browser evidence: `data/r36_browser_demo_live_verification.json`. Checkout: `data/r36_checkout_lifecycle.json`.

## Outreach access

Resend is already connected locally and on the Worker; `zovo.one` is verified and sending-enabled. **No new account or key is needed.** Inbox delivery remains untested and no outreach email was sent. The useful next input is an opted-in buyer/partner list with consent source/date and requested purpose, current suppression records, and an explicit campaign/batch instruction. Existing eighteen research rows yield zero eligible recipients.

[Resend's acceptable-use policy](https://resend.com/legal/acceptable-use) requires opt-in and excludes unsolicited scraped-list campaigns. Use invited directory submissions and repository contribution routes for curator distribution. The sender has stable idempotency, atomic locks/outbox, suppression and consent checks, timeout handling and a ten-attempt cap. Dry-run makes no network calls or writes; the legacy bypass was retired. Details: `docs/OUTREACH_RESEND_SETUP.md` and `intel/R36-outreach.md`.

## Measurement limits and remaining defects

- Full estate release-check remains **126 failures and 28 gaps** in older version metadata, seven older free skeletons and an expired comparison exception. Matcher is 30/30 green. The broad gate was not weakened; publication is not an estate-wide certification.
- Older immutable office registry descriptors still reference v0.22.0. This session does not silently rewrite them. The current download catalog and office README pin the verified new archive; both new matcher names pin their new hash.
- 32 anonymous stored-data IDs include probes. Forty-nine signed license IDs are not proven paid. Zero `session:` checkout-license records; five LICENSES keys are mailing-list rows. Missing data, current populations and lifetime totals are not interchangeable.
- A sampled external bank-statement listing still advertises PDF parsing. The project's own guide is corrected to CSV; the external listing was not corrected or claimed as verified live content.
- A diagnostic earlier exposed the Cloudflare token in operator tool output. The current exact-value scan checks tracked/unignored project artifacts in memory and records no matching files in `data/r36_credential_artifact_check.json`. Token rotation was not performed; that would affect shared access outside this sprint.
- The requested research path had moved. Spotlight resolved `/Users/mike/Desktop/research/platform-analysis-2026/index.html`; all 168,257 HTML bytes / 68,576 visible-text characters were read. Its September 1–2 platform/pricing data are dated background. The applied conclusion is to validate demand and billing rather than count production capacity as earnings. Minimal provenance: `data/r36_research_source.json`; private financial exports were not copied into this repo.

## Session observation and files

Read-only snapshots began at **00:48:50 UTC** after initial engineering work and run about every five minutes until the session deadline **04:22:43 UTC**. They check deployment/pin consistency, cron state, public checkout health and complete seven-day untagged MCP Stripe results. They generate no demand. The session is four hours; monitoring starts later and is sampled, not continuous uptime certification.

Initial health returned 503 through the existing recovery cooldown after approved-version drift was repaired; it recovered by 01:14:07 UTC. Additional transient 503 samples occurred around deployments while the cron caught up. These are retained in `data/r36_watch.json`. Final sample and coverage will be recorded after the deadline. No claim of uninterrupted healthy service is made.

The main dashboard passes nine real Chrome tab switches with no page errors and fits a 390px phone viewport without horizontal body overflow. Desktop/mobile screenshots were inspected; mobile navigation keeps the commercial results near the top. Evidence: `data/r36_dashboard_verification.json`.

Main dashboard: `../index.html`. KPI evidence: `../data/r36_kpi_audit.json` and `../data/r36_completed_checkout_audit.json`. Directory receipt: `../data/r36_directory_submission.json`. Owned test/browser/mirror work is closed and removed only after lsof proves no handles; deletion paths and sizes are retained in `../data/build-deletions.jsonl` and office cleanup evidence. No user data, browser logins or agent sessions are deleted.
