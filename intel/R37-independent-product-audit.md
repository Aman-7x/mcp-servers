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

## Public release bytes verified

The pending public status above is superseded. After the coordinator published [v0.22.7](https://github.com/theluckystrike/mcp-servers/releases/tag/v0.22.7), this reviewer downloaded all four assets with unauthenticated `curl -q`, following redirects. Each final response was HTTP 200. Each archive was byte-for-byte identical to the locally reviewed release artifact, and the downloaded `SHA256SUMS.txt` matched the local checksum file and all three downloaded archives. An initial release-API 404 while publication was still running is retained in the evidence rather than counted as a completed release failure.

| Public asset | Bytes | SHA-256 |
| --- | ---: | --- |
| [duplicate-invoice-check.mcpb](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.7/duplicate-invoice-check.mcpb) | 3,276,192 | `a70a2548ed418122aee80bfe7fa66de0c1927c0d4f1e3b6ed24b13d8bddc206d` |
| [three-way-match.mcpb](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.7/three-way-match.mcpb) | 3,276,937 | `afa608954d51d94b2a439874224b2bd592c51812076c86fe0d207b2c91899c14` |
| [office-suite.mcpb](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.7/office-suite.mcpb) | 32,011,115 | `767320b858a29983da1b36e4ccc2c3d1651d13f78febea7e75d202556588d3a0` |
| [SHA256SUMS.txt](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.7/SHA256SUMS.txt) | 266 | `e7a551cbcdbab4ce69c6d8fe74ae193656a805329c2d752d90485514b25b961f` |

The corrected matcher retains runtime version 0.22.6 inside the v0.22.7 release asset. Duplicate and office runtime versions are 0.22.7.

The actual downloaded duplicate archive was extracted and launched with repository resolution forbidden and outbound product networking blocked. ESM and CommonJS external-import negative controls both failed as intended; all 223 distinct resolved files remained inside the extracted artifact. The process reported version 0.22.7 and eight tools. Four actual stdio calls passed: free license status, a normalized-reference candidate pair with an exact-supplier negative control, a one-record page with the correct next offset, and complete three-record CSV evidence. The broader local 33-call and free-cap controls above apply to these identical archive bytes; they were not rerun as if they were new public-customer observations.

All 57 URLs in `billing/src/downloads.js` also returned HTTP 200 to unauthenticated HEAD requests with redirects and concurrency bounded at four. This establishes catalog URL reachability at the check time, not byte equality for the 54 older catalog assets. Neither synthetic business calls nor HEAD requests establish ordinary users, installation, demand, conversion, or revenue.

Bounded results, individual public URLs/statuses, checksums, runtime controls, and catalog outcomes are in `data/r37_public_downloads.json`. The initial cleanup attempt correctly refused to remove the scope while open handles existed. After the processes exited, a fresh `lsof` check found no open handles; the owned download/extraction scope was removed and its 48,964,709 bytes recorded in `data/build-deletions.jsonl`. No deployment, registry update, mirror publication, or billing change was performed by this reviewer.


## Independent v0.22.8 version and count patch review

The coordinator requested a new immutable release because the registry's old matcher and office versions did not identify the corrected archive bytes. The complete v0.22.7 audit and public proof are preserved in `intel/R37-independent-product-audit_v0.22.7.md`, `data/r37_product_audit_v0.22.7.json`, and the original public-download evidence. Those earlier assets and observations have not been relabeled as v0.22.8.

The new bounded evidence is `data/r37_patch_product_audit.json`. Source review confirmed that all eight duplicate/matcher implementation files (`core`, `store`, `output`, and handlers) match the prepatch hashes. The shared license implementation changes only `SERVER_COUNT` from 47 to 48; its package version becomes 0.22.7. A count-neutral source hash was identical before and after. The hosted shim also changes only that count. Signature verification, product matching, free/Pro permissions, browser checkout, and prices are unchanged.

An independent import of the actual billing catalogue found 48 single PRODUCTS after excluding `bundle`; every single has a corresponding local license gate. None of the eight free catalogue ids overlaps that set. `hourly-rate` and the `office-suite` aggregator have no separate paid product, and the bundle still grants the wildcard. Singles remain $19 and the bundle $39. The dependency gate's new compatibility predicate admits compatible stable caret ranges without requiring every older child to adopt the shared package's patch version; it rejects unsupported/malformed ranges. This is a packaging check, not a license permission change.

All three package, manifest, and actual initialized runtime versions are now 0.22.8. All nine named outer descriptors preserve their prior namespaces and contain the correct v0.22.8 archive URL, version, and final SHA-256. This includes both office namespaces and the matcher aliases. The first handoff omitted descriptor hashes; the independent gate stopped before runtime, the release agent filled the hashes, and the completed handoff passed. The evidence also records two corrected reviewer-harness assumptions: payment count is expressed in `payment.alternative.grants`, and the office proxy may explicitly return `isError: false` on success. These were harness issues, not product defects.

| Exact local artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| duplicate-invoice-check.mcpb | 3,276,144 | `181379eb6dcff3d90b55e080dd9c180f6c96802e991872865a6b0ce422b3aaea` |
| three-way-match.mcpb | 3,276,889 | `6397928ec44ea9d5c406a66f4eb7aa9a2f34f5731bf8ef9972fadfdac882f040` |
| office-suite.mcpb | 32,010,970 | `7f50d6d16d445dddcee054b24e8586de4daff9d91b77d22a28730647305cc91d` |

The independent runner used `/Users/mike/bin/buildslot node <owned-scope>/audit.mjs` and extracted the final archives outside the repository. Both ESM and CommonJS known-bad external imports were rejected for each archive. All resolved files stayed inside the respective artifact: 223 for each standalone and 1,110 for office. Product fetch/HTTP/TCP entry points were blocked. Archived core/store/output bytes matched current compiled files; both corrected storage hashes still match the v0.22.7 proof. Each archive carries license package 0.22.7 with count 48.

The actual servers completed 32 stdio tool calls: nine duplicate, eight matcher, and fifteen office. Both standalone products and both office routes saved three reports, returned a fourth-save cap while preserving complete diagnostics, and retained free access to evidence. Duplicate controls included exact supplier exclusion, preview record paging, complete CSV and literal source text. Matcher controls included offsetting quantity exceptions, complete inline capped evidence, saved retrieval/CSV and literal source references. Actual standalone license responses retained `agent_settleable: false`, browser checkout and $19/$39 prices; cap messages in every tested route named all 48 servers. Each standalone exposed eight tools; office exposed 447 tools and 49 children.

The checksum manifest matched all three final archives, and a final hash reread found no mutation during the review. No remaining material blocker was found in this narrow patch. This is local artifact and descriptor evidence; public v0.22.8 bytes and live registry state remain pending coordinator publication and a separate read-only verification. The old v0.22.7 Windows/CSV red controls and large oracle suite were not rerun because the relevant implementation bytes are unchanged.

Cleanup used a fresh `lsof` check with no open handles. The owned extraction, guard, runner and synthetic-data scope was removed, with 108,941,219 bytes logged in `data/build-deletions.jsonl`; the smaller scopes reset after harness corrections were separately checked and logged. No source edit, publication, commit, deployment, paid call, or customer observation was performed by this reviewer.


## Independent public v0.22.8 verification completed

The preceding pending public-byte status is superseded. Unauthenticated `curl -q` GETs followed redirects and returned HTTP 200 for [duplicate-invoice-check](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.8/duplicate-invoice-check.mcpb), [three-way-match](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.8/three-way-match.mcpb), and [office-suite](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.8/office-suite.mcpb). Downloaded bytes exactly matched the three independent prepublication hashes and sizes in the table above, and were byte-for-byte equal to the local audited archives. The downloaded [SHA256SUMS.txt](https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.8/SHA256SUMS.txt) also returned HTTP 200 and matched all three archives and the local patch checksum file.

The downloaded duplicate archive itself completed five actual stdio calls with outbound product networking blocked: license status, save a normalized-reference candidate pair plus an exact-supplier negative control, retrieve all three records, fetch a one-record evidence page with the correct next offset, and export all three CSV records. Its runtime reports 0.22.8 and eight tools. The real free license response names all 48 paid servers, keeps $19/$39 pricing, and returns `agent_settleable: false`. Known-bad ESM and CommonJS imports from the repository were rejected; all 223 distinct resolved files remained inside the downloaded archive.

Independent public proof is now in `data/r37_patch_independent_public_downloads.json`. The coordinator's broader public/catalog/registry verifier concurrently replaced the initially shared `data/r37_patch_public_downloads.json` before an independent copy was made. The separate file explicitly records that it was reconstructed from the successful independent terminal output (exit 0 with all three hashes and complete runtime results), the exact checked checksum bytes, and the actual deletion manifest. No result was inferred from the coordinator's verifier or relabeled as an independent run.

The owned download/extraction/synthetic-data scope was removed after a clear `lsof` check; 48,903,084 bytes are recorded in the deletion manifest. The original v0.22.7 evidence remains untouched. This phase establishes public artifact equality and a controlled downloaded-runtime workflow; the coordinator separately owns current registry and 57-URL reachability verification. It establishes no installation, ordinary user, demand, conversion, or revenue.
