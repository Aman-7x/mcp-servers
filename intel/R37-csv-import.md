# R37 local CSV import for duplicate-invoice proof

Status: implementation and local browser verification complete; production deployment and live CSV verification belong to the root agent's next gated release. The earlier JSON-only production evidence remains in its original files.

The guide's existing comparison example now accepts a local UTF-8 CSV through an actual file picker. A copyable four-record template and a sample-review button show the fixed input contract before a user prepares a file. Import replaces the JSON editor with the complete parsed input and runs the same `check()` product core. No records are appended, skipped, truncated or stored. The preset selector switches to “CSV or edited records” so an old example label cannot misdescribe imported evidence.

The parser requires exact unique headers for `record_id`, `entity_id`, `supplier_id`, `document_type`, `invoice_number`, `invoice_date`, `currency` and `total_minor`, in any order. Only the actual optional core fields `entity_label` and `supplier_label` are allowed in addition; included label columns need nonempty values. Unknown, missing and duplicate headers fail. No column mapping, trimming, date conversion, currency conversion or identifier coercion occurs. Only an already validated canonical positive decimal integer `total_minor` string is converted to a safe JavaScript integer. Invoice references, record IDs, leading zeros and Unicode remain exact.

Quoted commas, escaped double quotes and LF/CRLF/CR record delimiters are supported. A single UTF-8 transport BOM is accepted. Embedded newlines are parsed as quoted content, then rejected by the actual core schema's control-character rule. Malformed quotes, ragged/blank internal rows, invalid dates/types/currencies/IDs, duplicate record IDs and invalid amounts reject the entire batch. The pure parser requires a schema validator argument; the browser passes the actual source `checkSchema.parse`, and unit tests pass the compiled product schema. No record-validation or comparison algorithm is duplicated.

Bounds apply before and during parsing: the file must be nonempty and at most 2 MiB before `arrayBuffer()` is called; bytes are checked again after the read. UTF-8 decoding is fatal rather than replacing invalid source bytes. The parser bounds text bytes, header length, column count, cell length and 1,000 data records. It validates the whole batch before returning. The existing 2 MiB JSON editor limit remains; a CSV whose expanded JSON cannot fit even compactly is rejected with an explicit smaller-batch message.

Each selected file has a generation token. A newer file, preset, sample, manual edit or explicit JSON submit invalidates the earlier read. Older successful reads and failures cannot overwrite newer input, reports or statuses. Selecting a file immediately clears previous evidence; a rejected or empty selection leaves no old report visible. Manual editing clears results and requires another explicit check. The page makes no diagnostic requests or storage writes.

Files:

- `billing/browser/duplicate-csv.mjs`: pure bounded CSV transport and fixed template.
- `billing/browser/duplicate-demo.mjs`: file reading, generation control, input conversion and existing core rendering.
- `billing/src/duplicate-demo-markup.js`: hand-written UI and column help. There is no `scripts/build-content.mjs` in this repository.
- `scripts/build-duplicate-demo.mjs`: parser added to the source provenance hash.
- `billing/src/duplicate-demo-bundle.js`: regenerated browser asset, 74,634 bytes with existing MIT/Zod notices.
- `billing/test/duplicate-csv.test.mjs`: 11 new top-level parser tests; the existing conversion test also checks the file-picker and sample controls.
- `scripts/duplicate-browser-smoke.mjs --csv`: separate CSV evidence and screenshot paths, preserving prior evidence.

Validation on the final source:

```text
node --test billing/test/duplicate-csv.test.mjs billing/test/conversion-r37.test.mjs
12 tests passed; 0 failed; 0 skipped.

node scripts/build-duplicate-demo.mjs --check
Browser duplicate-reference asset: 74634 bytes

node scripts/duplicate-browser-smoke.mjs --csv --screenshots
PASS: 23 browser cases; zero diagnostic requests, storage writes or page errors
```

The 23 Chrome controls comprise the prior 11 JSON cases plus 12 CSV cases. They cover actual file import, quoted/Unicode/zero preservation, inert HTML-looking references, all-or-nothing rejection, invalid UTF-8 and double BOM, zero reads for oversized/empty files, 1,001 records, an older file completing after a newer file, preset/manual-edit/manual-submit races, stale read rejection and cleared selection. Browser: Chrome 155.0.8059.80. Evidence: `data/r37_csv_browser_verification.json`.

Both `intel/R37-csv-demo-desktop.png` and `intel/R37-csv-demo-mobile.png` were opened and inspected. The local-file controls, column help, scrollable template, JSON and reason groups remain readable; the 390-pixel page has no horizontal overflow and renders records as labeled cards. Owned Chrome contexts closed, and temporary profiles were removed only after `lsof` found no handles, with path/size manifest entries. All owned browser profile paths were confirmed absent.

Local asset SHA-256: `00131aed63f83fdc24766ec7ae065fbfec7e7b902ff7c639e06e115e6fbca5cb`. Core/UI/parser input SHA-256: `73006c8f0de163c6cd81cd4a10c1d64d4a9a3567eddfc40f96b5d3079b383467`.

No MCP/server core, storage/output code, MCPB artifact, payment or funnel behavior changed. No publication, deployment, checkout submission, Stripe command, paid API, account creation or outgoing message was performed by this workstream. CSV convenience is not evidence of buyers, revenue, confirmed duplicates, payment approval, complete history or ROI.

After the root agent confirms the CSV billing deployment is live, production verification uses the new paths:

```sh
node scripts/duplicate-browser-smoke.mjs --live --csv --screenshots
```
