# R37 independent hosted funnel review

Reviewed the uncommitted `billing/src/funnel.js`, `remote/src/index.ts`, and `remote/test/funnel.test.mjs` on 2026-10-16. This is a source review and local control run, not deployment evidence. Source line references below describe the version read during this review; integration may move them.

Disk preflight: `df -g /System/Volumes/Data` reported 32 GB available. Read `CONVENTIONS.md` and `CLAUDE.md`. No builds, browser, paid API, deployment, token mint against production, or source edits were performed. No temporary folders were created or deleted.

## Findings requiring integration decisions

### P1: stats aggregation exceeds the Worker operation limit

`billing/src/funnel.js:125–140` lists every retained counter, then issues one `get` per relevant row. One list containing 1,000 valid rows consumes 1,001 KV operations. `Promise.all` does not make those reads one operation. The function also lists old dates when only today's rows were requested. A public route invoking this function becomes an unbounded scan and fails as observations spread across dates, sources, products, and events.

The control below throws at operation 1,001. Cloudflare documents a limit of 1,000 external operations per invocation and recommends storing small values in list metadata to avoid one get per key: [KV limits](https://developers.cloudflare.com/kv/platform/limits/), [list metadata guidance](https://developers.cloudflare.com/kv/api/list-keys/).

Suggested fix: write the aggregate count into KV metadata alongside the existing value, list only requested UTC-date prefixes, and aggregate metadata without per-row gets. Bound total pages/rows and reject or explicitly flag incomplete results. A page cap must never return ordinary totals that look complete. Because this instrument is not deployed yet, metadata migration can be avoided by choosing the final schema before deployment. If supporting legacy rows, use a bounded fallback and test the exhausted fallback path.

### P1: a missing cohort sidecar turns probes into ordinary observations

`remote/src/index.ts:2208–2213` makes the credential valid before scheduling the sidecar write. `billing/src/funnel.js:57–64` interprets `null` as an ordinary, unattributed token. A successful call arriving before the sidecar is written, or at a location with a negative cached lookup, therefore puts a probe-minted token into ordinary counters if that request omits the probe header. Read failures and malformed records are correctly rejected, but a successful missing read is not.

The same reclassification happens when a sidecar expires. The sidecar TTL is fixed at mint (`funnel.js:40–42`); the credential TTL is refreshed on use (`remote/src/index.ts:2702–2704`). Continued activity can keep a probe credential valid beyond the sidecar's life. The limitation text discloses attribution loss, but not this change from probe to ordinary. Source attribution loss and probe exclusion are different guarantees.

Cloudflare states that both existing values and negative lookups are cached, and even local read-after-write visibility is not guaranteed: [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/). Awaiting the sidecar write alone does not eliminate negative-cache or cross-location cases.

Suggested fix: give missing/expired anonymous sidecars an unknown cohort, or skip these observations with explicit coverage accounting. If old-token observations must remain ordinary, explicitly weaken the sticky-probe guarantee and require every controlled probe request to carry the header. A stronger design carries the cohort with the validated credential's record so authorization and classification do not rely on independently visible keys. Include delayed visibility and expiration controls, not only rejected reads.

### P1: real free-tier refusals are counted as successful business calls

`billing/src/funnel.js:79–82` rejects `isError:true` and a leading `Error:` only. Several existing business tools intentionally return normal text on refusal:

- `servers/time-tracker/src/index.ts:546,618`: the entry cap returns `ok(gate.upgradeText(...))` before saving an entry.
- `servers/time-tracker/src/index.ts:316,852`: `gated()` returns ordinary text for the project-rate cap.
- `servers/invoice/src/index.ts:627,695`: invoice creation's `r.gated` branch returns `ok(r.gated)`.
- `servers/price-tracker/src/index.ts:352`: refreshing multiple watches on free returns ordinary text without refreshing.

`remote/src/shims/license.ts:266` generates a leading quoted feature followed by `is a Pro feature`, so the leading-error heuristic does not catch it. The local control reproduces this with the entry cap text: classification is `true`. These results receive a success trailer and can increment the first-success observation before any requested business action succeeds. The current SDK negative test supplies `isError:true` itself, so it does not cover the estate's actual refusal behavior.

Suggested fix: add an explicit outcome marker at refusal sites or normalize hosted refusal results, then use it in classification. Do not simply reject any output mentioning Pro: invoice business profile/PDF output and truncated price history can contain upgrade text while returning useful completed output. If the intended metric is only a non-error protocol envelope from a business tool, rename and describe it that way rather than claiming business success. Test one real capped core tool and one partial-but-useful success containing an upgrade note.

### P2: counter-write failure permanently consumes a first-success marker

`billing/src/funnel.js:108–114` writes the deduplication marker before updating its counter. If the counter read/write fails, the next call sees the marker and returns, so no first-success observation is recorded for that token/server/day. The control below leaves one marker and zero counters even after the write path recovers and the operation is retried.

This loss can occur without a race: Cloudflare permits only one write per second to a particular KV key, while these counters share a daily key across the whole source/server/cohort population. Sequential overlapping users can encounter write limits, in addition to ordinary read-modify-write races. [KV limits](https://developers.cloudflare.com/kv/platform/limits/).

Suggested fix: document this specific undercount if best-effort telemetry is acceptable; for a reliable first-observation metric, derive it from independently stored daily markers or use a serialized/atomic store. Simply reversing writes trades this loss for duplicates and is not an atomic fix. Add a failed-counter-write/retry control to make the chosen behavior explicit.

## Checks that passed and limits of the review

Command: `node --test remote/test/funnel.test.mjs`. Result: 11 tests, 11 passed, zero failed. This runs the new helper against in-memory KV and includes the real SDK JSON transport. It does not execute the full remote Worker pipeline or emulate Cloudflare consistency/write limits.

The new helper persists only allowlisted source/cohort/event labels, a restricted server label, counts, and hashes of opaque random credentials. The export reads only count keys. Neither arguments/results nor raw credentials are added to telemetry. The raw token in the existing upgrade checkout URL remains existing product behavior, not an added telemetry field. This review makes no claim about unrelated platform access logs.

The response update preserves structured and unknown result fields through JSON parse/stringify. It still rewrites published virtual paths and strips configured prefixes after appending the trailer, and deletes content-length after mutation. Download persistence and data flushes precede scheduling response telemetry. No upload/download change or local stdio telemetry was found in this diff. These statements are source inspection, not an end-to-end Worker upload/download regression test.

Discovery and license administration are excluded, RPC/tool errors are excluded when accurately marked, and Pro credentials do not receive the free trailer. Anonymous credentials bound to Pro can still contribute first-anonymous-token observations; the metric is about credential kind, not free-tier population. Labels already warn that ordinary is unmarked rather than human, source is unverified, first means per UTC day, today is partial, empty counts do not prove historical zero, and no conversion rate is inferred.

Counter and marker TTLs are bounded. The separate fixed sidecar TTL versus refreshed credential TTL is the probe-classification issue above. Current tests await sidecar writes against an immediately consistent Map and do not model expiration.

## Reproducible controls

Run from `/Users/mike/mcp-servers`; all credentials below are synthetic and never sent anywhere. The fixture uses 1,000 synthetic server labels to isolate the operation-count boundary; the same boundary applies to any combination of valid date/source/server/event rows.

```sh
node --input-type=module <<'NODE'
import {
  funnelStats, readFunnelCohort, saveMintCohort,
  successfulBusinessResponse, recordFunnelEvent,
} from './billing/src/funnel.js';
const NOW = Date.parse('2026-10-16T08:00:00Z');
const TOKEN = 'anon_' + 'a'.repeat(32);
const memory = new Map();
let visible = true;
const kv = {
  get: async key => visible ? memory.get(key) ?? null : null,
  put: async (key, value) => memory.set(key, value),
};
await saveMintCohort(kv, TOKEN,
  new Request('https://example.invalid/mcp/token?acq=guide', {
    headers: { 'x-mcp-probe': '1' },
  }));
console.log('probe_visible', await readFunnelCohort(kv, TOKEN));
visible = false;
console.log('probe_negative_cache', await readFunnelCohort(kv, TOKEN));
const refused = {
  jsonrpc: '2.0', id: 1,
  result: { content: [{ type: 'text', text:
    '"more than 100 stored entries (free tier)" is a Pro feature. Pro is a one-time $19 for this server, lifetime.' }] },
};
console.log('real_cap_text_classified_success', successfulBusinessResponse({
  jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'entry_add' },
}, refused));
let operations = 0;
const keys = Array.from({ length: 1000 }, (_, i) => ({
  name: `funnel:v1:count:2026-10-16:ordinary:guide:server-${i}:successful_business_call`,
}));
const capped = {
  list: async () => { operations++; return { keys, list_complete: true }; },
  get: async () => {
    if (++operations > 1000) throw new Error('simulated Cloudflare operations limit');
    return '1';
  },
};
try {
  await funnelStats(capped, { now: NOW });
  console.log('stats_limit_missed');
} catch (error) {
  console.log('stats_1000_rows', { operations, result: error.message });
}
const store = new Map();
let failCount = true;
const flaky = {
  get: async key => store.get(key) ?? null,
  put: async (key, value) => {
    if (key.includes(':count:') && failCount) throw new Error('simulated write rate limit');
    store.set(key, value);
  },
};
const event = {
  server: 'invoice', event: 'first_successful_anon_token_server_day',
  source: 'guide', cohort: 'ordinary', token: TOKEN,
};
try { await recordFunnelEvent(flaky, event, NOW); } catch {}
failCount = false;
await recordFunnelEvent(flaky, event, NOW + 1000);
console.log('marker_precedes_failed_counter', {
  markers: [...store.keys()].filter(k => k.includes(':first:')).length,
  counters: [...store.keys()].filter(k => k.includes(':count:')).length,
});
NODE
```

Observed output before integration fixes:

```text
probe_visible { source: 'guide', cohort: 'probe' }
probe_negative_cache { source: 'unattributed', cohort: 'ordinary' }
real_cap_text_classified_success true
stats_1000_rows { operations: 1001, result: 'simulated Cloudflare operations limit' }
marker_precedes_failed_counter { markers: 1, counters: 0 }
```

## Integration recommendation supplied to the coordinator

Use a dedicated Durable Object keyed by UTC day to atomically update counters and insert the first-token/server/day marker in the same transaction. A narrow internal method should accept only validated fixed labels and a daily digest; it must never store the raw credential or tool inputs/results. Keep the scheduled remote recording best effort so counter-store failure cannot change a tool response. Delete expired daily records with an alarm, because Durable Object storage does not inherit KV TTL behavior. Bound the public read to at most 31 daily objects and cap rows/response size; an unavailable day must produce an explicit incomplete/unavailable response rather than a silently complete total. This removes the KV counter's per-key write ceiling and marker-before-counter failure together.

For anonymous sidecars, drop missing/unavailable classifications instead of making them ordinary. A current explicit probe header can still classify that observation as probe without a visible sidecar. Coverage text must disclose skipped anonymous observations. Reclassifying missing sidecars as ordinary is incompatible with reliable exclusion of previously marked probes.

There is no reliable business-refusal signal in the shared `upgradeText()` string itself: the same string appears in successful partial output and complete refusals. Fix the actual refusal result wrappers to declare `isError:true`, including these source locations:

- `servers/time-tracker/src/index.ts:316`: `gated()`; `:546` and `:618`: direct capped entry returns.
- `servers/invoice/src/index.ts:627` and `:695`: `if (r.gated) return ok(r.gated)` branches.
- `servers/price-tracker/src/index.ts:352`: the multi-watch refresh refusal.

Further direct plain-success refusal branches found by `rg -n 'return .*gated|\\.gated|return .*upgradeText|return .*Pro feature' servers/*/src/index.ts`: `clauses:384,436`, `docx:593,706`, `kanban:331`, and `recurring:270,401,698`. Those additional branches were located by source search, not exercised as runtime controls. Existing `fail()` results and partial-success notes must retain their intended behavior. Updating server source can require corresponding exact-string vendor patch updates per `CLAUDE.md`.

No source changes were made. The remaining release checks are the integrator's final helper/route tests, a full remote pipeline control for a successful file-producing tool, a real capped tool, negative-cache probe exclusion, sidecar expiration, and a large bounded stats fixture that cannot claim truncated counts as complete.

## Second review: atomic version 2 and billing hooks

This section preserves the failed version-1 controls above as historical evidence. Disk preflight for the second review (`df -g /System/Volumes/Data`) reported 35 GB available. No production calls, deployment, heavy builds, browser, or source edits were performed.

The following three hashes from `shasum -a 256 billing/src/funnel.js billing/src/funnel-state.js remote/src/index.ts` exactly matched `data/r37_funnel_runtime_verification.json` when checked:

```text
b686ed50e5f9a82f1c0fc81840fcd37d28f5df4a142cd2013327198b6d52a636  billing/src/funnel.js
bb11e882e8ceb237503fffa85a0d0e14e2df4af7b3ed309846fb875efb65d9c4  billing/src/funnel-state.js
bb40401390627553a69df4ba4801b5bca91a75549ae1bb4dcb5191d23a0637d0  remote/src/index.ts
```

This verifies the source/evidence association, not a deployment. The runtime evidence is a prior local Miniflare/workerd run; I inspected its test source and did not rerun workerd during this pass. `billing/test/funnel-runtime.test.mjs` uses the actual SQLite-backed class, exercises a rollback after the summary write but before the first marker, checks that the native alarm also rolls back, and retries the same batch successfully. Its native fault injection is inside `storage.transaction`, rather than an imitation transaction used to claim native behavior.

**Resolved by actual source:**

- The per-key KV counter and its marker-before-counter failure are replaced by one daily Durable Object transaction in `billing/src/funnel-state.js:acceptFunnelBatch`. Summary, first marker, replay identity, metadata, and alarm commit together. The request retry uses one stable observation identity and serialized body; a replay after an ambiguous successful write cannot increment the batch twice. A new invocation intentionally gets a new identity.
- `funnelStats` now reads at most seven daily objects, each returning at most 70 source/cohort/event cells. It validates day, completeness, size, labels, counts, duplicate cells, and unexpected row fields. It pools across servers explicitly. A failed day clears the combined rows and produces null totals; the actual billing route returns HTTP 503. It does not label a partial count as complete.
- Missing/expired anonymous sidecars now return null and both callers skip them. Explicit current probe headers remain probe even on missing/unavailable metadata. This fixes the original eventual-consistency and sidecar-expiration contamination without asserting complete traffic capture.
- The private host has `workers_dev = false`, no public route, and a default 404 handler. Billing and remote use cross-worker FUNNEL bindings with `script_name = "mcp-funnel"`. The billing FulfillmentState binding/migration remains separate. The host accepts only fixed labels, bounded batch metadata, and hashes; no tool arguments/results or raw credentials are sent to it.
- The first seven legacy server fixes change actual refusal return sites to `isError:true`, rather than broad prose matching. The invoice refusal test includes positive `business_set` and branded PDF results that still contain a Pro note, so useful partial results remain successful. The runtime helper still describes successful protocol business responses rather than proven completed customer tasks.

Focused command: `node --test billing/test/funnel-state.test.mjs remote/test/funnel.test.mjs`. Result: 21 tests, 21 passed, zero failed or skipped. This includes a 1,000-server fixture, exactly seven summary fetches, idempotent ambiguous retry, transaction failure/retry, and missing/expired sidecars. These are local helper/state controls, not a full remote Worker response pipeline test.

**Remaining findings raised during the second pass:**

1. HEAD offer observations: the billing router normalizes HEAD to GET before the purchase branch and initially observed every such branch. A real local `worker.fetch` call confirmed HEAD `/buy/invoice?acq=store.product` returned 200 and incremented ordinary offer_view. Require the actual `request.method === "GET"` before recording an offer, with HEAD as a negative control. The coordinator accepted this fix.
2. The first seven refusal fixes were incomplete. Actual source and generated hosted vendor source still showed plain-success wrappers in `calendar:63`, `timezone:85`, `bank-statement:54`, `expense-tracker:41`, `currency:25`, and `zip:57`. Examples include timezone recurring-slot refusal, bank-statement export refusal, expense xlsx export refusal, and zip archive caps. Require actual wrapper changes plus a denied operation and a useful partial-success control for each affected family. The coordinator assigned these six additional fixes.
3. Acquisition propagation was absent: `rg -n --max-columns 200 --max-columns-preview 'acq' billing/src/setup.js billing/src/pages.js billing/src/content.js billing/src/index.js` found only unrelated acquisition_source fields. Existing first-party links therefore declared no acquisition to the new sidecar reader, and existing `src` purchase labels were not translated. Require explicit first-party `acq` labels on token-entry links or a bounded mapping of known existing `src` declarations for non-token billing requests. Do not infer humans or provenance from referrers; never rewrite an existing anonymous token's sidecar attribution from a later query. The coordinator is integrating this.
4. The privacy copy initially said daily records expire after the UTC date ends; the actual alarm is day start plus 31 days. Require the copy to say 31 days from the UTC date's start (at most 31 days from an event). The coordinator was already correcting this.

**Actual billing router controls:**

The review imported `billing/src/index.js` and `namespaceHarness` in an inline `node --input-type=module` script. All global fetches were replaced with synthetic responses; no request reached Stripe or another external service. Captured `ctx.waitUntil` promises were awaited before reading counters. The successful POST headers included same-origin Origin, HTML Accept, form Content-Type, `sec-fetch-mode:navigate`, and `sec-fetch-dest:document`, with body `intent=checkout`. Fresh/resume fixtures returned a synthetic open/unpaid session for product invoice; the cached probe fixture returned a synthetic cache entry. Synthetic identifiers were never printed.

```text
fresh: status303, mockedStripeCalls1, ordinaryHandoffs1, probeHandoffs0, metricErrors0
resume: status303, mockedStripeCalls1, ordinaryHandoffs1, probeHandoffs0, metricErrors0
cached-probe: status303, mockedStripeCalls0, ordinaryHandoffs0, probeHandoffs1, metricErrors0
stripe-failure: status502, mockedStripeCalls1, ordinaryHandoffs0, probeHandoffs0, metricErrors0
counter-failure: status303, mockedStripeCalls1, ordinaryHandoffs0, probeHandoffs0, metricErrors1
```

Thus a failed counter write does not change a successful checkout response, while a failed checkout does not increment a handoff. New-session, resumed-session, and cached-probe redirect branches all record the declared handoff. Handoffs count emitted redirects, not unique sessions or payments; retrying a purchase request is a new response observation.

A second inline script replaced global fetch with an unconditional exception, then called the actual router with fresh namespace harnesses. GET offer returned 200 and one offer observation; invalid product returned 404 and zero observations; invalid POST returned 400 and zero observations; a valid-format anonymous token without a sidecar returned 200 and zero observations. For stats, marking today's object unavailable returned 503, complete false, ordinary null, zero rows, and exactly seven object requests. HEAD initially reproduced the finding above. No billing runtime controls relied on source regex alone.

Final late-pass status is pending the coordinator's method, acquisition, privacy, and additional-refusal edits. No further storage/transaction blocker was found in this pass. Re-run only the affected controls after those edits; preserve the distinction between bounded complete retrieval and incomplete measurement coverage.

## Final billing-hook pass after coordinator fixes

The preceding pending status is superseded for billing hooks, acquisition propagation, and privacy wording. The additional legacy refusal rebuild/release work remains a separate coordinator-owned gate; this review does not declare the entire server estate complete.

At the coordinator's request, the executed router controls are now persistent regression tests in `billing/test/funnel-checkout.test.mjs`. Command: `node --test billing/test/funnel-checkout.test.mjs`. Final result: 11 tests, 11 passed, zero failures or skips. The test file invokes the actual billing Worker router, traps every outbound fetch, uses only synthetic fixtures, and creates no disk fixtures or live sessions.

The final source at `billing/src/index.js:observeBillingFunnel` now checks the actual request method before recording: GET for offer_view and POST for checkout_handoff. HEAD remains a normal product response but contributes no view. `acquisitionUrl` maps only fixed source families and leaves explicit acquisition declarations authoritative; `readFunnelCohort` still gives an anonymous token's stored sidecar precedence. Explicit unknown acquisition remains unattributed even alongside a known source label. Tests also verify that unknown raw labels are absent from stored object values and exported stats.

The actual rendered purchase form and bundle alternative preserve the bounded acquisition value. Controls cover explicit `acq=github` alongside conflicting `src=store.s.invoice`, known `store.s.invoice` and `store.guide.duplicate-demo` declarations, stored token provenance, and missing-token sidecars. Source inspection also finds explicit fixed acquisition labels on product, setup, and guide token-entry links. This is declared-source tracking, not verified referral provenance.

The live-response behavior is covered locally for fresh checkout redirects, resumed sessions, cached probe redirects, rejected intent, scripted POST redirects, Stripe failure, counter failure, and incomplete stats. Counter failure leaves the purchase redirect unchanged; failed or rejected checkout attempts create no handoff count. Public incomplete stats still use exactly seven object calls and return HTTP 503 with null totals and no misleading partial rows.

`billing/src/index.js` now says daily records are retained for at most 31 days from the UTC date's start, matching the alarm calculation. Re-running `shasum -a 256 billing/src/funnel.js billing/src/funnel-state.js remote/src/index.ts` after the billing changes produced the same three hashes recorded above, so the existing native-workerd evidence still corresponds to the reviewed counter implementation.

No additional release-blocking defect was found in the final bounded review of the atomic counter service and billing hooks. Remaining release evidence belongs to the wider legacy-refusal rebuild/tests and the coordinator's final deployment checks. No deployment or production measurement was performed by this reviewer.
