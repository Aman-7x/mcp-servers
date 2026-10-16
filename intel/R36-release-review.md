# Three-way-match release review

Review status: source/runtime checks pass after the fixes below. Publication, packaged release validation, registry submission and Docker image execution remain the release owner's gates. This review does not claim deployment or revenue.

## Findings and fixes

1. The original raw-shape MCP registration silently stripped an unknown top-level `tax_minor`, returning `matched`, despite the strict input contract. Nested unknown fields already failed. Registered `checkSchema` itself and added real stdio regressions for both top-level and nested unknown fields. Unsupported adjustments now produce an input error.
2. The advertised receipt bounds could produce a response the default SDK client could not read. A direct serialization probe measured 50,000 distinct receipt rows at 3,444,132 input bytes and 39,550,314 escaped JSON-RPC response bytes. A real SDK call at 15,000 receipt rows failed with `Connection closed`; the client reported `ReadBuffer exceeded maximum size of 10485760 bytes`. The old large-input test invoked the pure matcher and could not detect this failure.
3. Added an 8 MiB escaped-content inline budget. Larger reports return an explicit overview with free `report_page` access to every issue, SKU row, original source row and receipt evidence entry. Saved reports use their persistent UUID; large unsaved checks and failed saves use the last two process-local previews, expiring after 30 minutes. Small report results retain their original shape. No diagnostic check or page requires Pro. Each page has `total`, `next_offset` and at most 100 rows. SKU pages expose receipt counts; receipt arrays have their own pages, including a pathological 50,000-entry array for a single duplicated SKU.
4. CSV could independently exceed the SDK response buffer. It now retains the original response for small exports and returns explicit continuation fields for large exports. Offset/limit chunks contain up to 1,000 rows and repeat the CSV header. A real SDK test verifies automatic fallback, continuation and the final-page behavior.
5. The new Dockerfile originally omitted the timezone package, although the shared license profile imports its engine. Coordinated with the release owner's timezone bootstrap fix. The Dockerfile now includes timezone source/package/runtime engine and calls the bootstrap before the license build. The README source-install sequence includes the same bootstrap. No Docker executable exists on this host, so this review does not claim an image build.

## Verification evidence

Commands run from `/Users/mike/mcp-servers`:

```sh
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local npm run build --workspace @theluckystrike/mcp-three-way-match
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local npm test --workspace @theluckystrike/mcp-three-way-match
```

Build exited 0. Final test output:

```text
# tests 25
# pass 25
# fail 0
# duration_ms 7276.631958
```

The 50,000-row SDK test completed in 5071.492042 ms. It retrieved all 50,004 issues and all 50,002 SKU rows, checked the last original receipt source row and its exact line evidence, read a large saved report and its pages, preserved all free diagnostics when the save cap was reached, confirmed preview eviction, and observed no transport errors. The large-CSV SDK test completed in 1986.436041 ms. Its saved fixture was 49,548,238 bytes, below the 50 MB fixture guard. These timings and counts are TAP output or assertions from `test/large-transport.test.mjs`.

The suite also verifies offsetting quantity and price errors despite equal totals; partial receipts; rejected units; cumulative accepted receipts; explicit prior billing; missing and unknown SKUs; duplicates in each document source; document reference collisions; supplier/PO/currency mismatches; invalid dates and numeric bounds; safe money boundaries and product/aggregate overflow; CSV formula escaping; 500-line free diagnosis; file permissions and atomic temporary-file removal; edited derived-report recomputation; malformed-source refusal without overwriting; safe ID validation; relative, non-directory and symlink storage rejection; concurrent and independent-process save caps; direct Pro storage policy; cache expiry; and small stdio report CRUD/export behavior.

An additional inline Node assertion probe imported `dist/core.js` and `test/helpers.mjs`. With four accepted units, two rejected units, two previously invoiced units and a current invoice for two, it returned `matched`, available quantity two and undelivered quantity six. Raising prior billing to three returned `exceptions`. A deterministic independent arithmetic oracle then checked 5,000 generated single-SKU quantity/price combinations against the simple acceptance inequalities; output was:

```json
{"combinedPartialRejectedPrior":{"supported":"matched","excess":"exceptions"}}
{"independentQuantityPriceOracle":{"cases":5000,"matched":141,"exceptions":4859,"failures":0}}
```

## Contract and limitations

README/SPEC promises were compared with `src/core.ts`, `src/store.ts`, `src/index.ts`, `src/output.ts` and actual MCP calls. Quantity accumulation remains exactly integral under the documented row bounds; money products and sums use BigInt and return invalid/null for unsafe numeric output. Rejected units never increase invoice support. Ambiguous receipt rows are preserved as excluded evidence. Matching never updates prior billing history or approves payment; these limitations are stated publicly.

The SDK also limits encoded incoming messages to 10 MiB. An independent real stdio probe generated a schema-shaped 19,544,227-byte request using long Unicode SKUs; it failed with `Connection closed` and `write EPIPE`. README/SPEC now state this byte bound separately from row counts. Clients must submit a request fitting their transport buffer. This review does not claim every maximum-length Unicode field combination can travel in one stdio message.

No signed production Pro key was generated or activated in this review. Invalid activation was rejected through MCP; free-cap enforcement was exercised through MCP and independent processes; direct `saveReport(..., true)` verifies the uncapped storage branch. The shared Ed25519 verifier is reused. A paid checkout/key-delivery/activation transaction remains outside this review's evidence.

Storage integrity rejects saved files over 64 MiB; that guard was inspected, not exercised by creating an oversized fixture. This review does not claim protection against a hostile process with write access racing filesystem operations, power-loss durability, or concurrent reads during another process's deletion. Report writes use rename and 0600 permissions; saves/deletes and cap checks use the shared advisory file lock.

`command -v docker` exited 1 with no path. A fresh source dependency build and final packaged runtime validation belong to the release owner; this review did not install at the root, push, publish, deploy or make paid calls.

## Cleanup

Temporary test folders were checked with `/usr/sbin/lsof -t +D <folder>` before removal. `servers/three-way-match/cleanup-manifest.jsonl` records each folder's path, size and no-open-handles result. Initial one-off probes inherited the existing system TMPDIR; those folders were removed immediately and recorded. All subsequent suite and boundary probes explicitly used `/Users/mike/mcp-servers-work`. No fixture exceeded 50 MB. `df -g /System/Volumes/Data` showed 51 GB available before review and 50 GB at the final check. No browser, heavy fleet build, git mutation or integration-file edit was performed by this reviewer.

Changed server artifacts: `src/index.ts`, new `src/output.ts`, `Dockerfile`, `README.md`, `SPEC.md`, `test/smoke.test.mjs`, `test/store.test.mjs`, new `test/large-transport.test.mjs`, new `test/output.test.mjs`, and generated `dist` output. The integration owner received the stable eight-tool inventory and exact pagination/CSV API before regenerating distribution surfaces.
