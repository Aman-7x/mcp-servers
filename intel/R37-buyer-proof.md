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

Full browser validation and Worker-serving tests remain pending the orchestrator's canonical facts and asset-route wiring. The generated asset hash must be rebuilt if the product core changes before release. No publication, account creation, paid APIs, outgoing messages or production mutations were performed by this workstream.
