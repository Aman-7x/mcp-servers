# R37 duplicate-invoice buyer proof

Scope: a new guide and editable browser demonstration for supplied-history invoice-reference review. This is separate from matching goods to a purchase order and accepted delivery. There is no ERP connection, PDF extraction, OCR, payment verdict, completeness guarantee, uniqueness claim or measured ROI.

Guide: `/guides/check-duplicate-supplier-invoice-references-in-claude#duplicate-demo`.

The guide explains a four-record fixture with overlapping exact-reference, normalized-reference and same-amount/date reasons. It distinguishes four candidate records from eight group memberships. It makes leading zeros, exact entity/supplier/currency/type boundaries and potentially legitimate same-amount/date invoices visible in editable examples. Product, versioned download, setup and $19 Pro links lead out of the explanation; $39 bundle pricing uses the generated canonical figures.

The browser imports `check` directly from `servers/duplicate-invoice-check/src/core.ts`. There is no second comparison algorithm. Rendering uses `textContent`; input values are never HTML. The example runs without accounts, uploads, report persistence or diagnostic network requests. It rejects `save: true` rather than implying that the browser saved a report. It also bounds JSON text before parsing; the product schema enforces the same 1,000-record comparison bound. Pro removes only the saved-report-count cap; it does not unlock diagnostic evidence.

Files owned here:

- `billing/src/content.js`: guide, import and guide/product/related maps only.
- `billing/src/duplicate-demo-markup.js`: form, results containers and scoped responsive CSS.
- `billing/browser/duplicate-demo.mjs`: fixture presets, input handling and evidence rendering.
- `scripts/build-duplicate-demo.mjs`, `billing/src/duplicate-demo-bundle.js`: browser build with core/UI SHA-256 and bundled MIT/Zod notices.
- `billing/test/conversion-r37.test.mjs`: source provenance and actual Worker asset/guide/product path checks.
- `scripts/duplicate-browser-smoke.mjs`: real Chrome checks, optional marked production GET verification and screenshots. No checkout submission or email.

Commands and evidence so far:

```text
node scripts/build-duplicate-demo.mjs
node scripts/build-duplicate-demo.mjs --check
Browser duplicate-reference asset: 69642 bytes

node --check billing/src/content.js
node --check billing/src/duplicate-demo-markup.js
node --check billing/browser/duplicate-demo.mjs
node --check billing/test/conversion-r37.test.mjs
node --check scripts/duplicate-browser-smoke.mjs
git diff --check
All exit 0.

node --input-type=module (import built core check and test/helpers fixture)
summary: record_count=4, candidate_record_count=4, unflagged_record_count=0,
group_count=3, group_memberships=8.
rules: exact_reference, normalized_reference, same_amount_date.
```

## Production browser evidence

After the root agent confirmed the approved billing deployment `f84bdaac-4d09-4a56-b5f8-3fb8085aecea`, this workstream ran:

```text
node scripts/duplicate-browser-smoke.mjs --live --screenshots
PASS: 11 browser cases; zero diagnostic requests, storage writes or page errors
```

The actual product page's proof link opened the production guide and asset in Chrome 155.0.8059.80. Tests exercised all six presets plus edited untrusted HTML-looking references, duplicate record IDs, invalid calendar dates, fractional/unsafe money, save requests, 1,001 records and more than 2 MiB of UTF-8 text. The four-record example returned four distinct candidate records, three reason groups and eight memberships. Negative outputs retained the supplied-batch limitation. Editing and running checks produced zero additional network requests and zero browser-storage writes; no field values were uploaded.

Evidence: `data/r37_duplicate_browser_live_verification.json`. Both `intel/R37-duplicate-demo-live-desktop.png` and `intel/R37-duplicate-demo-live-mobile.png` were opened and visually inspected. The evidence groups, records and price links are readable; the 390-pixel layout uses labeled record cards without horizontal page overflow.

A separate marked GET of `/assets/duplicate-demo.js` downloaded 69,642 bytes. Its SHA-256 exactly matched the local compiled export: `ecf4a6432d9bed34c3f942b7862d450f5915c6c99b374c4a71e72d2a23470504`. Core/UI source input SHA-256: `4e8663e6b97fd4d2b6486760fe60e9d4bb8f1a4eafb538e12574690bfa3a64ce`. Evidence: `data/r37_duplicate_live_asset_verification.json`.

The isolated live-QA Chrome context closed. `lsof` found no open handles before deletion of `/Users/mike/mcp-servers-work/r37-duplicate-browser-S3gkaL` (8,823,854 bytes), recorded in `data/build-deletions.jsonl`; the path is absent. No user browser profile was used or removed. No checkout submission, Stripe command, account creation, paid API, outgoing message or deployment was performed by this workstream. These checks prove the observed example behavior, not demand, paid fulfillment or ROI.
