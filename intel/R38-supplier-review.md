# Independent supplier statement review

The reviewed comparison and browser code meet the supplied-open-item contract in the exercised cases. No new runtime blocker was found. This is readiness for the parent's release review, not proof of buyer demand, accounting-export completeness, a published working archive, or a release-green estate.

The review independently read `CONVENTIONS.md`, `CLAUDE.md`, `intel/R38-distribution.md`, all four runtime modules, the standalone fixture cleanup helper, the builder's core/storage/stdio tests, the browser controller, and the markup. Runtime files remained under builder/parent ownership. The reviewer added only `servers/supplier-statement-check/test/review-adversarial.test.mjs` and `billing/test/supplier-demo.test.mjs`, plus these review receipts.

`data/r38_supplier_review_initial.tap` records eight direct independent passes, zero failures and zero skips from:

```sh
TMPDIR=/Users/mike/mcp-servers-work /Users/mike/mcp-servers-work/bin/buildslot -- node --test servers/supplier-statement-check/test/review-adversarial.test.mjs billing/test/supplier-demo.test.mjs
```

Those tests exercise these independent invariants:

- Swapping statement and ledger sides preserves keys, ambiguity, amount/date issues and exact membership while reversing missing-side labels. The input includes prototype-like references, decomposed/composed Unicode, credits and repeated references.
- A maximum-sized 2,000-row input with long quote/backslash/multibyte fields recovers every original field byte-for-byte through free source pages and a separately parsed CSV. Each escaped JSON-RPC response remains below the 512 KiB budget. This checks complete values, not only row counts.
- One ambiguous group with 1,000 records per side exposes all 2,000 side-qualified memberships without selecting pairs.
- Two independent OS processes writing the same free storage directory save exactly three reports total. Every saved UUID is distinct and readable; the safe fixture helper checks open handles and records its deletion manifest.
- The actual generated browser JavaScript runs with instrumented DOM sinks and traps on fetch, XHR, WebSocket, EventSource, sendBeacon, local/session storage and IndexedDB. It computes all five synthetic group outcomes without touching those APIs.
- Editor changes and malformed, null, missing-field, save-enabled and oversized input remove stale report/group/summary evidence and disable exports. Hostile source strings stay in text sinks. The complete nine-row CSV escapes formula-like text and revokes its object URL.

The builder subsequently ran its complete standalone suite including the reviewer's four server tests: 30 passes, zero failures and zero skips in `data/r38_supplier_build_tests_final.tap`. That receipt includes real MCP initialization, discovery and tools/call, free-cap partial-result behavior, saved-report retrieval, single and bundle signed licenses, six-process concurrency, storage-failure diagnosis preservation, strict schema/scope/date/money controls, corruption rejection and symlink guards. The reviewer inspected this result; the builder executed that full suite.

An in-memory mutation control verifies that the independent evidence assertions are not vacuous. The actual emitted `dist/output.js` was loaded with only its source-page slice changed to drop the final row. The membership/count assertion rejects that mutant with `ERR_ASSERTION`; the identical assertion passes against the unchanged emitted module. No production source was altered. This is a verifier control, not an invented production bug or a claimed red-to-green repair. Receipt: `data/r38_supplier_review_controls.json`.

`node scripts/build-supplier-demo.mjs --check` confirms the browser bundle matches the reviewed core and controller source. `git diff --check` passes on both new review tests. `data/r38_supplier_review.json` records exact SHA-256 values and scope. Four new billing test declarations require the parent's derived `BILLING_TEST_COUNT` to include them.

Remaining parent gates include actual Chrome behavior/layout/privacy QA, complete storefront/client/release metadata, exact downloaded archive execution, clean-clone mirror build, any required container validation, publication verification, and production deployment checks. None was replaced by the VM test harness. This reviewer made no deployment, publication, payment, checkout, email or paid API call. The comparison remains explicitly limited to two supplied open-item lists; two stale or incomplete exports may agree.
