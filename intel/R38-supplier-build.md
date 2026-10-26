# R38 supplier statement checker source delivery

Implemented `servers/supplier-statement-check` v0.23.0 as one local stdio server.
This is a measured source delivery, not a publication or monetization result.
Public workflow and competition research is retained separately in
`intel/R38-distribution.md`; it does not establish buyer demand.

The tool compares two supplied open-item lists by exact entity, supplier,
currency, document type and reference. Missing-side rows, both amount/date
disagreements and repeated-reference ambiguity retain every original record.
No normalization, guessed allocations, hidden history or recoverable-money total
is produced. The declared `as_of` date neither verifies export freshness nor
silently filters records. Credit notes use positive absolute outstanding amounts
and remain isolated from invoices.

Free use includes all diagnostics, two 30-minute in-process previews, full free
pages/CSV and three saved reports. The $19 single or $39 bundle removes only the
saved-report count cap. Both tiers keep 1000 records per side, a 512 KiB escaped
MCP response budget, 8 MiB file integrity checks and 64 MiB aggregate saved storage.
Saved JSON uses private atomic writes and shared cross-process locks. Reads reject
unsafe paths and files, validate original inputs and recompute derived evidence.

Source gates:

```sh
env npm_config_cache=/Users/mike/.npm-cache-local npm run build --prefix servers/supplier-statement-check
/Users/mike/mcp-servers-work/bin/buildslot -- env npm_config_cache=/Users/mike/.npm-cache-local TMPDIR=/Users/mike/mcp-servers-work npm test --prefix servers/supplier-statement-check
git diff --check -- servers/supplier-statement-check
```

Build exits 0. The complete source suite reports 30 tests, 30 passes, zero failures
and zero skips in 2056.248125 ms. Exact receipts are
`data/r38_supplier_build.log`, `data/r38_supplier_build_tests_final.tap` and
`data/r38_supplier_build_evidence.json`. This includes the independent reviewer's
four adversarial tests, an 80-input brute-force oracle, full row coverage,
permutation invariance, strict dates/money/unknown fields, scope/credit/Unicode
isolation, complete large free evidence pages and CSV, preview expiry, storage
corruption and symlinks, six separate processes competing for three free saved
slots, and actual stdio discovery and business calls. Existing real local signed
single-server and bundle keys pass count-cap removal without weakening input
validation. Save failures and free caps preserve full free diagnostics.

The six client configurations use built local stdio paths; no unpublished npm
install or hosted endpoint is advertised. The README links the parent's exact
same-core browser guide. Both official descriptors point to v0.23.0 archive URLs;
the release agent owns calculating and applying the final archive SHA-256, then
verifying the exact downloaded archive. Root/Office storefront integration,
clean-clone build, mirror publication, official Registry publication and live
browser behavior are separate parent-owned gates and are not claimed here.

Temporary fixtures remain below the user's 50 MiB limit. The owned test helper
checks lsof before removal and logs each path and byte count in the server's
cleanup manifest. No external API, email, payment, account creation, production
deployment, git push or npm publication was performed by this source builder.
The Dockerfile was prepared from the existing monorepo pattern; no Docker image
was built in this source scope. No net-profit or paid conversion claim is made.
