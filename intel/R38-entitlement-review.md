# R38 hosted entitlement review

Independent predeployment review, 26 October 2026. The additive binding design fixes the original single-slot overwrite, but review found three additional failure cases. All three now have an in-memory red/green control using the actual bundled remote authentication and activation handlers with an ephemeral Ed25519 signer. No production request, payment, email or deployment was performed by this review.

| Case | Pre-review behavior | Current behavior |
| --- | --- | --- |
| Active token after 31 days | A second activation copied an earlier permanent purchase into a scoped key with the anonymous 30-day KV TTL; both activated bindings could expire despite a refreshed token | Entitlement bindings have no token TTL. The signed license expiry remains authoritative on every read. Token and document retention are separate. |
| Invalid scoped copy beside valid legacy purchase | An expired, corrupt or wrong-product scoped value blocked legacy migration because the key existed; replacing the compatibility slot then lost the valid purchase | Verify the scoped value for its product. Preserve a valid scoped key; replace a rejected one with the valid legacy purchase before changing the compatibility slot. |
| Signed malformed payload | The preexisting remote verifier accepted signed `exp: "never"` and numeric shape errors that billing rejected | Hosted verification now shares billing's `payloadShapeError`, rejecting malformed required fields and expiry before applying a tier. |

[Red/green receipt](../data/r38_entitlement_review_negative_control.json) confirms invoice Pro after virtual day 31 changes false to true, valid legacy recovery over expired scope changes false to true, and a signed invalid expiry granting Pro changes true to false. These are synthetic operator controls, not customer usage.

The existing eight regressions plus four independent review cases pass 12/12 with no skips. They execute actual paid-job processing, hosted authentication and MCP `tools/call` activation. Coverage includes two singles on one anonymous tenant, concurrent purchases into distinct scopes, bundle precedence, older job replay, legacy migration, failed compatibility-write retry, invalid signatures/expiry/scope, product-specific `/bound`, no license material in its response, other-tenant isolation and unknown-token rejection. The displayed billing declaration count is now 227, reflecting the four added test declarations.

```sh
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local \
  /Users/mike/mcp-servers-work/bin/buildslot -- \
  node --test billing/test/hosted-entitlements.test.mjs
# tests 12; pass 12; fail 0; skipped 0

TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local \
  /Users/mike/mcp-servers-work/bin/buildslot -- \
  node --test billing/test/*.test.mjs remote/test/*.test.mjs
# tests 325; pass 322; fail 2; skipped 1
```

The full suite is not green at this checkpoint. Its two failures are catalogue integration checks: 48 offered singles versus 49 eligible server directories after the concurrent supplier-statement server was created, and generated `billing/src/figures.js` being out of date. The existing workerd SQLite runtime check accounts for the one skip. The parent must regenerate the catalogue's derived files and rerun the full suite against stable source. This review did not regenerate shared figures while another agent owned the new server. [Targeted output](../data/r38_entitlement_review_targeted.tap), [full output](../data/r38_entitlement_review_full.tap).

Remote Wrangler packaging passes without deployment:

```sh
cd remote
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local \
  /Users/mike/mcp-servers-work/bin/buildslot -- \
  npx wrangler deploy --dry-run --strict \
  --outdir /Users/mike/mcp-servers-work/r38-entitlement-remote-dryrun
# Wrangler 4.80.0; exit 0; upload 8118.45 KiB, gzip 1845.59 KiB
```

[Dry-run output](../data/r38_entitlement_review_remote_dryrun.txt). Its owned generated folder was checked with `lsof`, its 22,972,209 bytes and path were recorded in the deletion manifest, then it was removed. [Cleanup receipt](../data/r38_entitlement_review_cleanup.json).

Deploy the remote Worker first, after normal vendor/source checks, so readers understand independent scopes before the new billing fulfillment writer is enabled. Deploy billing second through `npm_config_cache=/Users/mike/.npm-cache-local npm run deploy` in `billing`; this invokes the required preflight, stable-version checks, live intent-page guard and approved-version update. Do not run raw Wrangler deployment for billing. Observe actual marked product-specific `license_status` calls against a synthetic tenant if the parent conducts a controlled live check; a discovery-only `tools/list` is not sufficient. Do not create an actual payment for this review.

Both writers retain the legacy slot. New readers check bundle, requested product and legacy candidates, verifying each key's signature, scope and expiry. Concurrent new purchases into distinct products each persist their own slot before updating legacy. Billing rollback remains readable by the new remote. Rolling remote back to a pre-scoped reader exposes only the last legacy purchase until the new reader returns, although the independent scope keys remain stored; coordinate paired rollback rather than assuming older readers understand the new model.

These controls execute actual Worker source under Node with mocked KV, not live paid fulfillment or a native workerd deployment. Cloudflare KV eventual consistency can delay observations and does not supply transactional migration. Already-overwritten historical purchases cannot be reconstructed from an absent key; holders can reactivate their valid key. Entitlement storage now intentionally follows license validity rather than anonymous token TTL; token/data expiry still applies. No refund/revocation mechanism was added to the existing offline lifetime-license model. Default wildcard `/bound` and `whoami` keep their existing bundle/legacy status semantics; use `product=<id>` for a specific scoped purchase, not as an inventory of every purchase.

[Review receipt and point-in-time source hashes](../data/r38_entitlement_review.json). Parent catalogue edits will change the billing entry point and require the normal final gates again.

## Production verification, 26 October 2026, 06:45 UTC

The preceding source checks retain their original checkpoint and results. The coordinator subsequently deployed remote version `323083e6-f55a-4195-8ba8-71a6c568eed6` and billing version `718485e7-1d17-43f8-aaa4-3c638177be35`, then ran the reviewed native probe from 06:45:09 through 06:45:44 UTC. [Actual edge receipt](../data/r38_hosted_entitlements_live_verification.json), [command output](../data/r38_hosted_entitlements_live_verification.txt).

All ten checks pass across thirteen explicitly marked license-only MCP calls. The edge recognizes a valid legacy invoice purchase, starts Docx free, activates the second single while retaining Invoice Pro, and keeps bundle access to PDF and Docx after replaying the older single. Native KV key metadata confirms that the migrated Invoice scope and activated Docx scope have no anonymous-token expiry. Actual edge authentication returns 401 for wrong-product, expired and malformed signed-expiry bearer keys. Billing's product-specific `/bound` agrees across Invoice, Docx and PDF and returns no license material. The probe checks both expected deployment versions before and after its sequence.

The probe used one marked synthetic tenant and short-lived signed operator keys. It created no Checkout Session, payment, email or business-tool call. Nine owned KV keys were deleted and all owned targets and prefixes were confirmed absent before the private journal was removed. Its `lsof` check and byte/path deletion manifest confirm local journal cleanup. Shared mint counters and unrelated tenants were retained. This verifies production entitlement behavior, not paid webhook fulfillment, customer demand, inbox delivery or actual elapsed 31-day retention; the latter remains covered by the separate virtual-time regression. KV caches can temporarily outlive an authoritative deletion.

The probe itself now has repeatable offline safety tests in [r38-entitlement-probe-safety.test.mjs](../test/r38-entitlement-probe-safety.test.mjs). They execute the actual CLI source inside a VM with fully mocked filesystem, fetch, signing operation and credentials. The only real file read is the CLI source. No test creates a real file, private key, network request or production KV operation.

```sh
BUILDSLOT_MIN_FREE_GB=20 BUILDSLOT_MAX_WAIT=120 \
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local \
  /Users/mike/bin/buildslot node --test test/r38-entitlement-probe-safety.test.mjs
# tests 8; pass 8; fail 0; skipped 0
```

[Durable safety-test output](../data/r38_entitlement_probe_safety_tests.tap). Coverage preserves the original six scenarios: normal verification and cleanup, cleanup-only preserving prior proof, refused reruns, mismatched RPC IDs, foreign-prefix key listings, and failed owned-key deletion. Two additional cases require an ambiguous mint with no observed token to retain its journal, and require a conflicting ownership marker to prevent key listing or deletion. All tests preserve another tenant's token/document and a shared mint counter. Public receipt/log assertions reject raw probe tokens, license material and fake credentials. Existing proof is never overwritten, and cleanup success is never inferred merely from token absence. The test run started with 21 GB available; no temporary harness files remain because all fixtures are in memory.
