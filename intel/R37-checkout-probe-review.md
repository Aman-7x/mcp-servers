# R37 generic checkout probe review

Reviewed `scripts/checkout-lifecycle-probe.mjs` and `test/checkout-probe-ownership.test.mjs` after the R37 session/product generalization. No execute mode, Stripe command, production request, browser, Session creation or deployment was performed during this review.

The session option is limited to `r` followed by digits. It selects separate private state, persistent lock and public report paths. The new single-product option is allowlisted; the second product must remain the bundle. R36 retains its legacy default scope, and the new product cannot reuse the R36 evidence path. Expiry verification compares its requested product scope with saved state before querying anything.

Ownership still requires a live Session created in the run window, exact probe marker, unique source, tenant/client reference, submitted product and order token. Verification binds report run ID, start time, deployed version and hashed source/tenant/session/order evidence. It requires both product handoffs, replay reuse, unpaid fulfillment refusal, completed browser cleanup and 30–31-minute expiry bounds. Earlier failure evidence cannot become a passing handoff. OS locking uses a stable inode, blocks other processes, and releases on normal exit or SIGKILL. Keep the empty lock file in place.

One defect was fixed: expected deployment versions previously accepted any 36-character mixture of hexadecimal digits and hyphens. A value consisting of 36 hyphens could enter execute mode and reach live creation before failing the returned-version assertion. Both argument validation and the internal execute guard now require canonical UUID groups. Negative controls reject malformed versions before IO. Additional R37 controls reject a different deployment version and expiry intervals outside the approved bounds.

Validation:

```text
node --test test/checkout-probe-ownership.test.mjs
10 tests passed; 0 failed; 0 skipped.

node --check scripts/checkout-lifecycle-probe.mjs
git diff --check
exit 0
```

Prepared browser command, held until the root agent confirms the billing deployment is live:

```sh
node scripts/duplicate-browser-smoke.mjs --live --screenshots
```

That command uses marked GET requests and synthetic editable records. Its request routing blocks all other origins. It neither submits a checkout nor sends email. Browser/network/visual evidence is recorded separately from checkout lifecycle evidence.
