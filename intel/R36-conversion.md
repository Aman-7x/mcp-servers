# R36 conversion audit — 2026-10-16

status: DONE (implementation and local verification; production release belongs to root)

The defensible conversion improvement is to keep the buyer's hosted connection attached while choosing a bundle or replacing an expired checkout. R35's successful-call upsell brought the token to the single-server purchase page, but two bundle links and Stripe's cancellation URL discarded it. A buyer could pay and still see a free hosted connection. No conversion-rate or revenue improvement has been measured.

## Evidence and implementation

- `node --test billing/test/conversion-r36.test.mjs` before implementation: 5 tests, 0 pass, 5 fail. The bundle intent link, Stripe cross-sell link, and cancellation URL each lacked the synthetic tenant query parameter. Checkout/pricing copy also contradicted actual fulfillment.
- The same tests after implementation: all pass. A route-level sequence GETs the rendered single-server purchase page, follows its real bundle link, POSTs the intent, inspects the Stripe request, and passes its tenant metadata to the existing fulfillment bind decision. GET performs zero external requests; the bundle retains its configured $39 Price. A separate route sequence retrieves an expired session and verifies its replacement preserves tenant metadata.
- `checkoutCustomText` accepts an optional tenant and validates it before adding it to the cross-sell URL. Invalid tokens and attempted query injection are omitted. Stripe creation passes its validated tenant to this function. The success URL is unchanged. Cancellation now carries tenant so an expired-session replacement can still bind.
- Intent, pricing, success and bundle copy describe direct confirmation-page key delivery. They do not promise a key embedded in a Stripe receipt or guaranteed email. The success page explains that `/recover?session_id=...` needs the session id from the saved confirmation URL. Optional transactional email remains unchanged.
- `npm_config_cache=/Users/mike/.npm-cache-local npx wrangler secret list --format json` from `billing/`: `RESEND_API_KEY` is present in production secret metadata. No values were read or printed. R35's missing-secret diagnosis is stale; this does not prove inbox delivery.
- The guarantee heading now names the actual purchased product. It distinguishes local storage from hosted storage and acknowledges hosted rate limits. Pricing no longer invents a scheduled November 8 increase, frames token/download counters as people, or silently sells Time Tracker from an “any one server” link. The single-server row leads to the catalogue's real `#servers` anchor.
- Welcome mail uses current listed-count/price/limit data, describes per-server limits and the 600-calls/hour hosted limit, and links `/mcp/connect` with its token prerequisite. The subject uses the catalogue count; the bundle offer uses the count of actual paid products. Current values are 55 listed servers and 46 paid server products, derived from `figures.js` and `SINGLE_PRODUCT_IDS` respectively, rather than R35's typed 47.
- Scheduled setup/offer mail no longer invents popularity evidence or a $59 future bundle price. Footer, welcome and privacy now disclose welcome/+48h setup/+168h offer behavior. Privacy describes Resend transactional delivery, subscription storage and opt-out suppression; it no longer denies all email or the advertised support mailbox. Existing subscription/drip tests inspect captured email payloads; no emails were sent.
- The legacy `/guides/bank-statement-pdf-to-excel-in-chat` URL remains reachable, with CSV-first title, description, H1 and instructions. `servers/bank-statement/src/index.ts` registers `statement_import` as a bank CSV importer and `statement_export` as Pro-only CSV/JSON. The rewritten guide denies PDF/OCR support and running-balance proof, discloses Pro export and no direct `.xlsx` creation, and explains that the original CSV can be opened in Excel without buying anything. The linked categorisation guide also explicitly excludes all PDF inputs and describes expense reconciliation rather than invoice matching. A rendered-route test covers the correction and metadata.

## Verification commands

All commands run from `/Users/mike/mcp-servers` except where noted.

1. `df -g /System/Volumes/Data`: 51 GB available before work.
2. `node --test billing/test/conversion-r36.test.mjs billing/test/checkout-r1.test.mjs billing/test/checkout.test.mjs billing/test/bind.test.mjs`: 53/53 pass after the original conversion changes.
3. `node --test billing/test/subscribe-drip.test.mjs billing/test/conversion-r36.test.mjs billing/test/checkout.test.mjs`: 25/25 pass after email/privacy corrections.
4. `node --test billing/test/conversion-r36.test.mjs billing/test/subscribe-drip.test.mjs billing/test/checkout-r1.test.mjs billing/test/figures.test.mjs billing/test/guide-figures.test.mjs`: 60/60 pass after the CSV guide correction.
5. `cd billing && npm_config_cache=/Users/mike/.npm-cache-local npm test`: 186 tests, 186 pass, 0 fail, 491.475 ms. Includes real-key signing/verification and paid fulfillment-route tests. No external calls in the added regression tests.
6. `node --test billing/test/conversion-r36.test.mjs billing/test/bind.test.mjs`: final recovery wording correction, 14/14 pass, 100.71 ms.
7. `git diff --check`: exit 0.

One command failed during validation setup: root `npm test --workspace=mcp-billing` reports “No workspaces found”; billing is a standalone package, not a declared root workspace. Running its documented test command from `billing/` passed. No build, deploy, purchase, email, push or paid API call was performed by this agent.

## Artifacts

- `billing/src/index.js`
- `billing/src/scheduled-monitor.js`
- `billing/src/content.js`
- `billing/test/conversion-r36.test.mjs`
- `billing/test/checkout.test.mjs`
- `billing/test/checkout-r1.test.mjs`
- `billing/test/subscribe-drip.test.mjs`
- `intel/R36-conversion.md`

## Impact and limits

The implemented behavior preserves automatic activation on the tested detours and removes misleading promises at purchase and signup. Prices, fulfillment eligibility, free usefulness and signing remain unchanged. Tests use synthetic tokens and stub Stripe/Resend; they prove request/metadata behavior and rendered claims, not a production paid purchase or inbox placement. Root must release through `docs/BILLING_RELEASE_CONTROL.md` and inspect the deployed pages. Old Stripe sessions created before this change keep their old URLs/copy. No trial or A/B framework was added: the small, unverified human audience does not justify it. Audience acquisition remains the constraint; these fixes protect future intent rather than create it.
