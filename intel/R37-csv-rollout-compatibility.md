# R37 cached-markup rollout compatibility

Cached JSON-only guide HTML can later load a newer unversioned browser script. The first CSV implementation bound listeners to CSV controls before initializing the JSON example; those controls do not exist in already cached HTML. The failure was reproduced before changing the implementation.

`scripts/duplicate-rollout-compatibility.mjs` reads the actual historical markup module from commit `d6da6293`. It resolves that module's figures import to the repository's price constants and changes only its script URL when serving the HTML locally. It preserves the pre-fix JavaScript from commit `f5fb8522`, SHA-256 `00131aed63f83fdc24766ec7ae065fbfec7e7b902ff7c639e06e115e6fbca5cb`. It does not approximate the old control structure or contact production.

Before editing, `node scripts/duplicate-rollout-compatibility.mjs --red-only` reproduced the old markup/new CSV-script failure at `2026-10-16T09:52:44.343Z`: `Cannot read properties of null (reading 'addEventListener')`; the initial JSON report remained empty. The distinct receipt is `data/r37_csv_rollout_red_control.json`.

The fix only guards optional CSV bindings/status updates and checks whether the custom-input option exists before selecting it. It changes neither the comparison algorithm nor CSV parsing, validation, normalization, storage, payments or the root agent's versioned asset markup.

Final validation:

```text
node scripts/build-duplicate-demo.mjs
Browser duplicate-reference asset: 74677 bytes

node scripts/duplicate-rollout-compatibility.mjs
PASS: passed

node scripts/duplicate-browser-smoke.mjs --csv --rollout-check
PASS: 23 browser cases; zero diagnostic requests, storage writes or page errors

node --test billing/test/conversion-r37.test.mjs billing/test/duplicate-csv.test.mjs
12 tests passed; 0 failed; 0 skipped
```

The rollout runner first repeats the historical red control, then checks seven final-asset scenarios on the same actual old markup: no CSV controls present; the initial complete JSON diagnosis; the leading-zero preset; normalized-reference preset; manual edits clearing old evidence; manual JSON submission; and another preset after editing. Final page errors, diagnostic network requests and storage writes are all zero. Evidence: `data/r37_csv_rollout_compatibility.json`. The current 23-case CSV/JSON regression writes `data/r37_csv_rollout_current_browser_verification.json`; earlier 23-case and independent 18-case receipts remain unchanged.

Final asset SHA-256: `607931acffaf33ee9041151006056bf8ad05daa8f64e3629f0e5bd27fbbd1449`. Input SHA-256: `de00b0890ccc015a6bb9e40bd9ec99daaf33159c5ecfbe03e368a52404c54c0a`.

All owned compatibility-test Chrome contexts closed. Their temporary profiles were removed after `lsof` found no open handles, with deletion sizes and paths recorded in `data/build-deletions.jsonl`. No live API, Stripe call, checkout, deployment, publication or outgoing message was performed by this workstream. The root agent owns the final gated release and production verification.
