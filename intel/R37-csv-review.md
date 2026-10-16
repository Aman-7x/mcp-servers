# Independent R37 local CSV import review

Status: passed for the final local browser asset; deployment was not performed or verified by this reviewer. Evidence: `data/r37_csv_independent_audit.json`. The v0.22.7 and v0.22.8 product/archive/public-byte audit records remain separate and unchanged.

The review covered `billing/browser/duplicate-csv.mjs`, `billing/browser/duplicate-demo.mjs`, the actual generated browser bundle, and its markup. Final core/UI/CSV input hash: `73006c8f0de163c6cd81cd4a10c1d64d4a9a3567eddfc40f96b5d3079b383467`. Source hashes in the evidence identify the exact reviewed bytes. Duplicate MCP core, storage, output, handlers, shared license implementation, and funnel helper/actor hashes stayed identical to the audit baseline.

The distinct SHA-256 of the **served JavaScript bytes** is `00131aed63f83fdc24766ec7ae065fbfec7e7b902ff7c639e06e115e6fbca5cb` (74,634 bytes). The final browser pass included the double-BOM rejection control after the decoder correction. The input-provenance hash above is not the asset-byte hash.

## Source assessment

The parser handles CSV transport and delegates whole-batch validation to the actual product schema. It accepts only the eight required named columns and two optional label columns, in any order. Duplicate, unknown, missing, differently cased, or whitespace-altered headers fail; rows with extra or missing columns fail. Blank rows are not silently skipped. Optional labels remain subject to the same nonempty schema as JSON input. Imported records retain explicit row identifiers rather than gaining inferred row numbers.

Quoted commas, escaped quotes, and LF/CRLF/CR record delimiters are supported. Quoted embedded newlines are parsed as field content and then rejected by the existing control-character schema. They are not stripped or treated as extra records. EOF quote errors, bare quotes, and text or whitespace after closing quotes fail explicitly. Reference and identifier leading zeros, Unicode, and exact scope strings are preserved. Only `total_minor` is converted, after canonical positive-decimal and safe-integer checks; signs, leading zeros, fractions, exponents, hexadecimal, whitespace and unsafe values are rejected.

The file handler checks a positive safe `File.size` no greater than 2 MiB before calling `arrayBuffer()`, checks the returned byte count again, and uses fatal UTF-8 decoding. The final decoder preserves a BOM for the parser, so precisely one initial BOM is accepted consistently and two are rejected. Invalid bytes cannot silently become replacement characters in identifiers. Parser row/column/field bounds constrain work before final validation. JSON expansion beyond the editor's 2 MiB limit rejects the complete import, with no truncated rows.

Every file selection clears the previous editor and evidence before reading. A generation counter invalidates late success and error callbacks when a newer file, manual edit, manual submit, preset, sample, or empty selection supersedes them. Manual edits clear evidence immediately. Rendering uses `textContent` and constructed nodes; source values and filenames never become HTML. The browser still submits only `{records, save:false}` to the unchanged in-memory comparison core and rejects JSON save requests. The custom dropdown label distinguishes imported or edited records from the named synthetic presets.

## Independent execution

Commands used an owned `~/mcp-servers-work/r37-csv-independent-*` scope:

```sh
node <owned-scope>/parser-audit.mjs
node <owned-scope>/browser-audit.mjs
```

The independently constructed parser corpus passed **51/51 cases** against the actual compiled product schema. It covered all three record delimiters, BOM and EOF handling, reordered headers, Unicode and zeros, quoted commas/quotes, the maximum safe integer, 17 invalid integer spellings, unknown/prototype-like headers, missing/duplicate headers, ragged/blank rows, duplicate row identity, malformed quotes, embedded newlines, optional-label semantics, complete 1,000-row preservation, rejection of 1,001 rows, and the UTF-8 text-byte cap.

The final generated asset and production markup were served on loopback to actual Chrome 155.0.8059.80. All **18 independent browser scenarios passed**. They included real file-input imports, malicious-looking text remaining inert, single/double BOM behavior, invalid UTF-8 rejection, stale evidence clearing, the 2 MiB metadata guard before any read, complete 1,000-row identity preservation, and full rejection of 1,001 rows. Deferred `File.arrayBuffer()` promises exercised old success and failure callbacks after newer files, edits, submissions, presets, the sample and clearing the chooser. Strict JSON schema and save-false checks remained active.

The browser made **zero diagnostic network requests**, attempted **zero browser-storage writes**, and emitted **zero page errors**. These observations concern the controlled local test, not ordinary users or the live deployed page. Storage writes and IndexedDB opening were instrumented to fail, and external browser requests were blocked.

One initial harness attempt clicked the sample button while its disclosure was closed and timed out. The harness was corrected to open the visible disclosure before clicking; this is retained in `prior_browser_attempts`, not reported as a product bug or omitted from the record. The final browser pass used the later exact-one-BOM fix supplied by the implementation agent.

## Conclusion and limits

No remaining material blocker was found in this bounded CSV transport/UI review. The feature deliberately rejects arbitrary accounting-export headers, dates, amounts or optional blank label cells rather than mapping or coercing them. Those constraints are stated in the page copy. Existing product comparison semantics, saved-report permissions, payment behavior and hosted measurement were not changed.

The browser was closed. After a clear `lsof` check, the owned harness/profile scope was removed; its 8,834,891 bytes and path are recorded in `data/build-deletions.jsonl`. No deployment, publication, paid call, commit, or production source edit was performed by this reviewer.

## Cached-markup rollout compatibility review

A subsequent rollout issue required a small UI patch: cached pre-CSV guide HTML can outlive the old JavaScript asset, so that HTML may receive a new script without containing any CSV controls. The implementation agent added optional CSV event bindings, guarded CSV status/reset writes, and a check for the new custom preset option. These guards leave legacy JSON operation available. New markup also requests the script with the complete input-provenance hash in its query string. This review did not change production source.

Separate final rollout evidence is `data/r37_csv_rollout_independent.json`. The prior 51-parser/18-browser proof and its asset hashes remain intact above. The rollout's served JavaScript is **74,677 bytes**, SHA-256 `607931acffaf33ee9041151006056bf8ad05daa8f64e3629f0e5bd27fbbd1449`; its distinct input-provenance hash is `de00b0890ccc015a6bb9e40bd9ec99daaf33159c5ecfbe03e368a52404c54c0a`.

An independent Chrome run passed **8/8 scenarios** against exact historical and current markup. Historical markup came from commit `137c8517`; its bytes were independently confirmed identical to the previous release's markup at `d6da6293`. Only the local module import used to obtain its exported HTML was redirected to the unchanged price constants. The historical HTML retained the unversioned script URL and contained no CSV controls. With the final script it initialized the original four-record result, accepted edited JSON and form submission, cleared evidence after invalid JSON, and successfully switched formatting/leading-zero presets without page errors.

The current markup requested `/assets/duplicate-demo.js?v=de00b0890ccc015a6bb9e40bd9ec99daaf33159c5ecfbe03e368a52404c54c0a`. Its sample, real file import with preserved leading-zero identity, double-BOM rejection, and cancellation of a delayed file read after a preset change all passed. The final run made zero diagnostic network requests, attempted zero instrumented storage writes, and produced zero page errors. CSV parser, MCP core, storage and output hashes were unchanged, so the earlier parser corpus was not redundantly rerun.

No remaining material blocker was found in this compatibility patch. This proves the controlled legacy/current DOM combinations locally; deployment and CDN observations remain the coordinator's responsibility. The browser closed, `lsof` found no handles in the owned scope, and its 8,562,940 bytes were removed and recorded in the deletion manifest.
