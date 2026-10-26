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
