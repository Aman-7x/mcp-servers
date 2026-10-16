# R37 hosted response measurement

Status: durable implementation verified locally and with nine live controls in a coordinated stable deployment window. One marked anonymous token and three successful pure hosted calls were created for verification, then token-owned KV state was cleaned. This agent created no Stripe Session, payment, email, paid API call, commit, push or deployment.

## Problem and resulting behavior

The old hosted upsell used `!auth.isPro && !dataless` and a string replacement. It could label an error result as success. The new path parses the actual JSON-RPC envelope, requires a matching successful business `tools/call`, and excludes discovery, licence administration, envelope errors, `isError:true`, legacy leading `Error:` text, malformed results and unsuccessful HTTP statuses. It preserves structured output and is independent of object property order. A successful response is not proof of a completed customer task or a human reading it.

The first local measurement implementation used KV counters. Eleven passing focused tests did not establish ship readiness. Independent review reproduced four material defects: an unbounded stats scan, missing-sidecar probes entering ordinary counts, unmarked legacy domain refusals treated as success, and a failed counter write permanently consuming a first marker. The current implementation replaces KV counters with atomic daily Durable Objects, skips missing anonymous cohorts, and bounds stats. Root separately owns the real legacy refusal flags; those fixes must ship with this instrument. No heuristic rejects every result merely mentioning Pro, because useful partial results can include upgrade text.

## Authoritative implementation

`billing/src/funnel.js` contains the shared classification/client helper, so the unchanged billing deployment gate hashes its imported bytes. `remote/src/index.ts` schedules one batched observation after a successful response and completed storage flushing. `billing/src/funnel-state.js` exports the actual daily Durable Object class.

The orchestrator hosts the class in a new private `mcp-funnel` Worker. Billing and remote bind `FUNNEL` using `script_name = "mcp-funnel"`. There is no new class or migration in the existing billing Worker; its fulfillment object and rollback lifecycle remain separate. No local stdio server gains telemetry.

## Units and privacy

| Event | Exact observation |
| --- | --- |
| `successful_business_call` | Successful business `tools/call` response after storage flush; free or Pro |
| `first_successful_anon_token_server_day` | First observed successful response per anonymous token, endpoint, UTC date and ordinary/probe cohort |
| `upgrade_impression` | One upgrade trailer emitted in a successful free business response; not proof of human visibility |
| `offer_view` | Billing hook: GET200 checkout-intent offer response; no Checkout Session created |
| `checkout_handoff` | Billing hook: explicit valid POST followed by redirect to Stripe; not payment |

`ordinary` means unmarked observations, including automation. It does not mean people, buyers or customers. `probe` means a current explicit `x-mcp-probe:1` header or a stored probe marking from token mint. These populations have separate counters and first markers.

Source labels are fixed: `unattributed`, `store.product`, `store.setup`, `guide`, `github`, `directory`, `oauth`. They are unverified declarations, not demonstrated acquisition. Unknown source text is not stored. A token-mint sidecar stores just source/cohort under SHA-256(token), with a 31-day KV TTL. OAuth mints use `oauth`. Existing anonymous tokens with absent, expired or negative-cached sidecars are unmeasured; they never silently become ordinary. A currently marked probe can still be counted as probe without a visible sidecar. Corrupt or unavailable sidecars drop unmarked observations.

For first-observation deduplication, the caller hashes UTC day + cohort + server + anonymous token before calling the object. Only this hash, fixed labels and a fresh random response UUID enter the object. No raw token, licence identity, email, IP, tool arguments/results or filenames are added to this instrument. Public stats export only pooled source/cohort/event counters; they expose no hashes, response UUIDs, individual marker records or server-level identity breakdown. Existing operational data and hosting logs have their own behavior.

## Atomicity, retry and bounded retention

One returned hosted response sends its successful-call, daily-first and emitted-upgrade events in one object request. Inside one SQLite storage transaction, the object validates the batch, checks its response UUID, checks its daily token/server hash, then writes the summary, markers, metadata and retention alarm together. A partial failure commits none of them. A transport retry reuses exactly the same response UUID and payload; a genuinely new tool invocation has a fresh UUID and counts as another response. Conflicting payload reuse is rejected. The helper retries an ambiguous failure once, with bounded five-second fetch attempts. There is no Stripe operation in this helper.

The day object's alarm expires all records at UTC day start plus 31 days, so event retention is at most 31 days. An early alarm reschedules the retained deadline; the cleanup deletes storage and the alarm. Source sidecars expire separately 31 days after mint. Token validity and product data retention are unchanged.

Cloudflare documents that a SQLite-backed object's direct storage operations participate in `storage.transaction`, including those made on the storage object instead of the obsolete transaction argument: [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transaction). The actual workerd control below verifies rollback of both the summary write and alarm, not just a Node mock.

## Same-date exports and completeness

`funnelStats(env,{days:7})` issues at most seven daily object reads. Each day returns at most 70 fixed cells: seven sources × two cohorts × five events. There are no KV list/get loops and no per-marker reads. Product/server observations are pooled in the public summary; first-token deduplication still includes the server internally. The maximum seven-date export is 490 cells.

Unknown, unavailable, oversized, duplicate-cell, malformed or incomplete daily replies make the whole result `complete:false`, with `ordinary:null`, `probe:null` and no deceptively partial row totals. The flag describes counter retrieval, not complete capture of every request. Deferred recording failures and missing source/probe sidecars still drop observations.

All events from one response share one captured observation timestamp. Windows are UTC calendar dates, with today partial; seven dates are not a rolling exact 168-hour window. Starts before deployment are unmeasured. Empty counters are neither deployment proof nor historical zero. Response counts, token/server/day first observations and checkout redirects are different units; no cross-population conversion rate or ROI is calculated.

## Billing integration API

```js
import { readFunnelCohort, recordFunnelEvent, funnelStats } from './funnel.js';
const observedAt = Date.now();
ctx.waitUntil((async () => {
  const cohort = await readFunnelCohort(env.REMOTE_DATA, tenant, request.headers, request);
  if (!cohort) return;
  await recordFunnelEvent(env, {server:id,event:'offer_view',...cohort}, observedAt);
})().catch(() => console.error(JSON.stringify({event:'billing_funnel_record_failed'}))));
// POST303 hook uses event:'checkout_handoff'.
// Read-only stats uses the whole env, never env.REMOTE_DATA:
await funnelStats(env,{days:7});
```

Hosted responses call `recordFunnelEvents(env,{server,events,source,cohort,token?},observedAt)` once. Recording and mint sidecar writes use `waitUntil`; failures never alter the tool answer or authentication. Billing routes, privacy text, private-worker hosting and release coordination remain root-owned.

## Verification and remaining release evidence

`node --test billing/test/funnel-state.test.mjs remote/test/funnel.test.mjs`: 21 local controls passed. Coverage includes transaction rollback after the summary but before the first marker, 100 concurrent first responses, replay/conflict handling, committed-reply-loss retry, 1000 synthetic server observations retrieved with exactly seven object subrequests, incomplete/oversized/duplicate/truncated responses, negative-cache and expired probe metadata, raw-token rejection, retention alarm and five real SDK HTTP outcome envelopes. The pure storage harness stages transaction writes and alarms and serializes concurrent transactions; it is not substituted for the platform check below.

Actual platform-compatible runtime command:

```sh
MCP_MINIFLARE_MODULE=/Users/mike/.npm-global/lib/node_modules/wrangler/node_modules/miniflare/dist/src/index.js MCP_FUNNEL_EVIDENCE_PATH=/Users/mike/mcp-servers/data/r37_funnel_runtime_verification.json /Users/mike/bin/buildslot node --test --test-reporter=spec billing/test/funnel-runtime.test.mjs
```

The Miniflare/workerd test uses real SQLite-backed objects and the production compatibility date. It verifies 26 actual responses, one replay, concurrent calls, one first observation, probe/ordinary separation, native rollback after summary/alarm writes, native alarm rollback, and successful retry without losing the first observation. Sanitized source hashes and results are written to `data/r37_funnel_runtime_verification.json`. This test is explicitly skipped by generic test discovery unless the runtime module is configured; do not mistake that skip for a platform pass. All runtime scopes are disposed, checked with `lsof`, recorded in `data/build-deletions.jsonl`, and removed.

The local controls alone do not establish deployment or commercial demand. The live checks below verify the pure business-response and refusal paths on the coordinated release. File-producing hosted calls, paid fulfillment and product/archive verification have separate evidence owned by the orchestrator; this agent's pure live controls do not cover those paths.

## Live coordinated verification, 2026-10-16

`data/r37_funnel_live_verification.json` records the actual 08:37:37–08:38:23 UTC controls. The public stats endpoint returned HTTP200, instrument 2 and complete retrieval. A marked token minted with declared source `guide` had its fixed `guide/probe` sidecar verified through the KV API. A 35-second bounded propagation delay preceded business calls.

Six negative controls returned no success trailer and no guide/probe success-counter change: initialize, tools/list, license_status, unknown tool, invalid convert_time arguments, and a real barcode PNG free-tier refusal. The latter three declared actual errors; the first three returned their expected non-business results.

Three successful pure timezone responses each emitted exactly one trailer. Two carried the explicit probe header. The third deliberately omitted that header and remained in the stored probe cohort. The guide/probe deltas were exactly three successful business responses, one first anonymous-token/server/day observation, three emitted upgrades, zero offer views and zero checkout handoffs. Every ordinary counter remained unchanged during these controls. No uploaded/output files or external tool API calls were involved.

The ordinary baseline already contained 59 offer views. Root traced those to the earlier release gate's unmarked GET probes and corrected the client to mark every gate GET. These 59 operator responses remain in history and are not buyer demand; no counter was erased or subtracted.

The Cloudflare deployment API independently confirmed the expected sole 100 percent versions inside the QA window: private `mcp-funnel` c09f6360-34da-4107-82ae-15e7ae4ac387, remote fce85227-ab19-4bb3-98f7-3d7cd4891f54 and billing f84bdaac-4d09-4a56-b5f8-3fb8085aecea. Root performed deployment; this agent did not.

Cleanup considered seven exact token-owned keys: four successful DELETE acknowledgments and three already absent keys, with zero failures. Global Durable Object counters and shared IP mint/discovery rate limits were untouched. The private state folder was checked with `lsof`, recorded with byte size in `data/build-deletions.jsonl`, and removed. Deletion acknowledgments do not imply immediate eviction of cached credentials at every edge.

These controls establish the returned-response measurement path and probe isolation. They do not establish human impressions, completed customer jobs, paid fulfillment, qualified demand, conversion rate or ROI. Source labels remain declared provenance; exported event counts remain pooled across servers.

## Postpatch count verification

The targeted postpatch controls in `data/r37_patch_funnel_live_verification.json` ran from 2026-10-16T09:23:31.870Z through 2026-10-16T09:24:19.648Z. The prior nine-control report remains byte-for-byte unchanged. Shared measurement helper and Durable Object source hashes still match the earlier real workerd test; this narrower rerun tests the changed paid-server count and representative behavior.

The deployment IDs were parsed directly from `data/r37_patch_remote_deploy_result.txt` and `data/r37_patch_billing_deploy_result.txt`, then independently checked against the latest Cloudflare deployment API before and after the controls. Both snapshots confirmed one version at 100 percent: remote `2e375e9d-344b-4da5-a451-20784e055381`, billing `15b4fb3e-7bcb-4fc1-8104-b2727926132b`, private funnel `c09f6360-34da-4107-82ae-15e7ae4ac387`. No deployment happened during the test.

Six actual controls passed. `tools/list`, `license_status`, an invalid-argument business request, and the real barcode PNG Pro refusal returned no success trailer and did not change guide/probe business counters. Licence status reported a $39 bundle covering 48 paid servers. The refusal also named all 48 servers and declared `isError:true`. Two pure successful timezone responses each returned exactly one trailer naming all 48; the second deliberately omitted the current probe header and remained in the saved probe cohort.

The guide/probe delta was exactly two successful responses, one first anonymous-token/server/day observation, two emitted upgrades, zero offer views and zero checkout handoffs. Ordinary counters remained unchanged. The earlier 59 ordinary offer responses remain documented operator contamination, not demand.

One new marked token was used. Cleanup acknowledged deletion of four exact token-owned KV keys; three other exact candidate keys were already absent. The private state folder passed `lsof`, was logged with byte size and removed. Global event counters and shared IP rate-limit state were untouched. No Stripe Session, payment, email, paid API call, external tool API, file-producing business call or browser was created by this verification.
