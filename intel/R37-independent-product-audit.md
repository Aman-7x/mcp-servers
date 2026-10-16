# R37 independent duplicate-invoice-check audit

Reviewed the v0.22.7 specification, core, storage, output, handlers, README, existing tests, and actual standalone archive. This audit is independent of the original implementation. No production source was edited by this reviewer. The reviewer added `servers/duplicate-invoice-check/test/independent-boundaries.test.mjs` after identifying the issues below; the product agent owns the fixes.

Disk preflight command `df -g /System/Volumes/Data` reported 33 GB available. All extraction and runtime data uses an owned `~/mcp-servers-work/r37-independent-product-*` scope. No paid API, account, deployment, public tool call, or office bundle mutation occurred. Machine-readable evidence is `data/r37_product_audit.json`.

## Findings and red/green controls

**P1, fixed in source and compiled controls: Windows storage ancestry.** The original `store.ts:dataDir` used host `path.resolve` with `.split('/')`. On Windows that makes the remaining drive/UNC path one component, so nonrecursive mkdir attempts the final directory before creating its parents. With an already existing final directory, it also skips intermediate symlink checks. The three-way-match store had the same implementation.

The regression imports the actual compiled `dataDir`, replacing only `node:path` and `node:fs` with a Win32/POSIX path adapter and an observable filesystem model. It neither copies nor replaces the ancestry algorithm. It covers drive roots, UNC roots, POSIX paths, existing symlink ancestry, concurrent EEXIST directory creation, and EEXIST symlink replacement. These are modeled OS-boundary controls, not a claim that a native Windows machine was used.

The corrected code walks `dirname` ancestors up to the root, bounds the walk, checks each real directory, creates missing parents in order, and accepts EEXIST only after checking the actual resulting object. The tests exercise both products in the monorepo. In a standalone duplicate-product checkout, absent matcher companion controls explicitly skip; the duplicate controls still execute. Node versions without synchronous module hooks skip only the OS-model tests, while the real stdio CSV test still runs.

**P1, fixed in source and compiled controls: CSV escaped response exceeded the advertised budget.** A valid 1,000-record input with maximum-length quote-heavy ids, entity/supplier ids, invoice references, and display labels produced a 2,270,013-byte input and an 8,509,475-byte JSON-RPC CSV response, above the 8,388,608-byte contract. The old handler exported the requested row count without invoking the response-budget check. Existing maximum-size tests used short ids and a different label pattern, so they did not reach this boundary.

The corrected `output.ts:csvPage` measures the escaped result and shortens a requested CSV page with a bounded binary search. `returned`, `next_offset`, and `total_rows` accurately describe the shortened page. The regression drives actual stdio, checks each complete response envelope against the budget, parses every CSV record id, follows pages to the end, and verifies exact set equality with all 1,000 input ids. The evidence remains free after pagination; no record disappears to meet the byte cap.

The pre-fix standalone archive SHA-256 was `83265138e9cea3570879c6551e689608dc29c31f0fa537c427d3a2efecb48e31`. Its extracted compiled code failed all four selected independent controls: ancestor creation, symlink rejection, EEXIST handling, and the actual oversized CSV response. Command (the extraction path is a temporary owned scope):

```sh
R37_INDEPENDENT_ARTIFACT_ROOT=<owned-extraction>/server node --test \
  --test-name-pattern='^duplicate-invoice-check:|^actual stdio' \
  servers/duplicate-invoice-check/test/independent-boundaries.test.mjs
```

The corrected compiled products passed all seven controls with:

```sh
node --test servers/duplicate-invoice-check/test/independent-boundaries.test.mjs
```

No existing broad test count or oracle result was treated as a substitute for these independent boundary cases.

## Core and contract assessment

The core uses JSON tuple keys containing exact entity, supplier, document type, and currency, avoiding delimiter collisions and fuzzy joins. It constructs three independent buckets, and candidate counts come from a union of record ids. Source rows are stored once and every group carries complete record-id membership. There is no summation of invoice money, float conversion, currency conversion, loss estimate, or payment approval. Positive safe-integer amounts and real ISO dates are validated; duplicate record ids and unknown fields are rejected.

Normalization changes only ASCII lowercase and four named ASCII separators. Leading zeros, accents, Unicode case, composed/decomposed forms, nonbreaking spaces, Unicode dashes, underscores, and lookalike characters remain distinct. Empty normalized references do not collide. Exact-reference candidates still survive amount/date conflicts. These semantics agree with the specification and the conservative marketing language reviewed.

Storage reads validate source records and recompute derived evidence; malformed persisted records produce an explicit error rather than a clean or zero-candidate result. Saves and deletes share the existing cross-process file lock. Valid report ids cannot inject paths. Files use exclusive temporary creation, private mode, and atomic rename. The free saved-count cap and aggregate byte bound do not remove the current diagnostic. The storage lock remains an advisory local lock; this review does not claim protection from a hostile same-user process replacing ancestors after validation.

The output design keeps full evidence accessible through free previews, saved reports, group-member pages, and CSV. Group summary pages intentionally omit member arrays and provide the separate member route. Preview eviction/expiry is disclosed and fails explicitly. The persisted README distinguishes supplied-batch observations from confirmed duplicates, does not imply outside history or ERP/OCR access, states that unflagged records are not payment approval, and identifies the absent hosted endpoint/npm publication.

## Exact standalone artifact status

The old archive is retained only in the owned temporary extraction for negative controls. The coordinator paused packaging when the bugs were reported. A corrected final standalone archive must be checked independently with repository dependency fallback blocked before this audit labels the actual deliverable verified. The prepared runner includes ESM and CommonJS negative controls, real stdio business calls, normalization/scope boundaries, schema errors, saved-cap behavior, complete free evidence retrieval, file-mode/recomputation checks, and quote-heavy CSV page reconstruction. It does not touch the office archive or another agent's output files.

Final artifact hashes/results and cleanup status will be appended after the corrected repack is available. Public URL byte verification is a later coordinator-authorized follow-up, not part of the local results reported here.

## Corrected exact-artifact verification completed

The pending local-artifact status above is superseded. The corrected standalone archive is 3,276,192 bytes with SHA-256 `a70a2548ed418122aee80bfe7fa66de0c1927c0d4f1e3b6ed24b13d8bddc206d`. The actual extracted process reports version 0.22.7 and eight tools. Its archived `core.js`, `store.js`, `output.js`, and `index.js` bytes match the current compiled files; the reviewed source hashes remained unchanged throughout the final pass.

Executed command: `node /Users/mike/mcp-servers-work/r37-independent-product-vRMOPP/audit-standalone.mjs`. This independently constructed runner extracted the corrected archive, checked ZIP integrity, and launched its server with ESM and CommonJS resolution constrained to the extracted server tree. Known-bad imports from the repository were rejected through both loaders. All 223 distinct resolved files stayed inside the artifact. The child also had outbound fetch/HTTP/TCP entry points disabled; no external call occurred.

The runner completed 33 real stdio tool calls. It checked nine normalization boundaries, four individual exact-scope boundaries, a delimiter-collision negative control, strict schema errors, and a positive overlapping-rule example. Three reports saved; the next save preserved complete diagnostics and free record/CSV retrieval. Saved JSON permissions were 0600, and editing derived candidate counts/groups did not change the recomputed result from `report_get`.

The quote-heavy 1,000-row CSV reconstructed every original record exactly once over two pages. The largest escaped response was 8,383,808 bytes, below the 8,388,608-byte budget. The final README now tells callers that CSV pages may be shorter than the requested limit and that they must follow the returned offset.

The exact corrected standalone's compiled storage also passed all three selected OS-boundary controls:

```sh
R37_INDEPENDENT_ARTIFACT_ROOT=<corrected-extraction>/server node --test \
  --test-name-pattern='^duplicate-invoice-check:' \
  servers/duplicate-invoice-check/test/independent-boundaries.test.mjs
```

Because the Windows bug also affected the companion matcher, I independently extracted its corrected standalone and ran the corresponding three archived storage controls; all passed. Matcher archive SHA-256: `afa608954d51d94b2a439874224b2bd592c51812076c86fe0d207b2c91899c14`. This companion check is limited to its storage ancestry; it does not claim an independent audit of matcher business rules or other office-suite children.

```sh
R37_COMPANION_ARTIFACT_ROOT=<matcher-extraction>/server node --test \
  --test-name-pattern='^three-way-match:' \
  servers/duplicate-invoice-check/test/independent-boundaries.test.mjs
```

No remaining material defect was found in the bounded duplicate-product audit after these two fixes. This is local source and exact-artifact evidence, not proof of publication, installation, customer demand, payment accuracy, or complete estate readiness. The office archive was left to the release agent.

Cleanup completed after `/usr/sbin/lsof -t +D <owned-scope>` returned no open handles. The derived extraction/guard/script/synthetic-data scope was removed, with 30,918,938 bytes and its path recorded in `data/build-deletions.jsonl`. `data/r37_product_audit.json` retains the bounded evidence and hashes; the temporary runner was intentionally removed with the work scope. The persistent independent regression test remains in the product test directory.

Public URL byte verification remains pending the coordinator's publication and explicit final URL.
