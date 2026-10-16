# R37 local release integration

Three post-fix local archives passed exact-byte, dependency-boundary and real workflow verification. This report covers local artifacts; publication, public URL bytes, customer usage and paid fulfillment remain separate evidence.

Office v0.22.7 now initializes **49 local children and exposes 447 measured tools**. Duplicate invoice review exposes eight standalone tools; office aggregates the two shared license tools, so adding the child contributes six proxy tools. The existing three-way matcher and duplicate reviewer retain separate report namespaces.

| Local archive | Runtime version | Bytes | SHA-256 | Actual calls |
| --- | --- | ---: | --- | ---: |
| `bundles/duplicate-invoice-check.mcpb` | 0.22.7 | 3,276,192 | `a70a2548ed418122aee80bfe7fa66de0c1927c0d4f1e3b6ed24b13d8bddc206d` | 10 |
| `bundles/three-way-match.mcpb` | 0.22.6 | 3,276,937 | `afa608954d51d94b2a439874224b2bd592c51812076c86fe0d207b2c91899c14` | 3 |
| `bundles/office-suite.mcpb` | 0.22.7 | 32,011,115 | `767320b858a29983da1b36e4ccc2c3d1651d13f78febea7e75d202556588d3a0` | 8 |

The corrected three-way matcher keeps its source/package/runtime version 0.22.6; its new archive is intended for the v0.22.7 release collection. Its older immutable registry descriptors and old hashes remain unchanged. The new duplicate descriptors bind the exact new SHA above under two names for one capability: `io.github.theluckystrike/duplicate-invoice-check` and `io.github.theluckystrike/supplier-invoice-duplicates`. `bundles/SHA256SUMS-r37.txt` covers all three archives. No archive embeds its own descriptor hash.

## Verification

All npm commands used `npm_config_cache=/Users/mike/.npm-cache-local`; build/test/pack commands ran through `/Users/mike/bin/buildslot`. Packing used `TMPDIR=/Users/mike/mcp-servers-work` and `/opt/homebrew/bin/bash scripts/build-mcpb.sh --only <target>`. Each standalone passed all 29 strict scoped release checks with zero gaps. Office passed its explicit packaging-only gate: 49 declared children, 51 package closures, exact build/proxy child-list parity, current source/dist/package versions and actual internal dependency version ranges. Targeted gates cannot be disabled through `RELEASE_CHECK=0`.

`node scripts/verify-r37-local-artifacts.mjs` exited 0 from buildslot. It checked ZIP CRC, extracted the exact archives outside the repository, initialized the actual entries, matched every manifest tool name/description to runtime, and ran real business calls. Results and command-independent hashes are retained in `data/r37_release_integration.json`. Final verification completed at 2026-10-16T08:24:34.921Z. Packaging output is retained in `data/r37_duplicate_pack_result.txt`, `data/r37_matcher_pack_result.txt` and `data/r37_office_pack_result.txt`.

ESM and CommonJS guards restricted every child file resolution to the extracted archive server tree. Both deliberate outside-artifact imports were rejected. Resolution measurements:

- duplicate-invoice-check: 512 resolution events, 223 unique files, 8 actual tools.
- three-way-match: 511 resolution events, 223 unique files, 8 actual tools.
- office-suite: 33,417 resolution events, 1,110 unique files, 447 actual tools.

The verifier compared each packaged duplicate/matcher `store.js` byte-for-byte with the corrected compiled output, including both copies inside office. Duplicate business checks covered exact-scope separation, conflicting amounts, union candidate counts, save/get/page/CSV, schema errors and the free saved-count cap while full diagnosis/export remain available. Matcher checks saved offsetting-quantity exceptions, retrieved the actual accepted quantity and exported the exception. Office exercised both workflows through the proxy. Literal source references `report_get`/`report_page` remained unchanged.

The office workspace integration suite before the later product-store correction passed 9/9 with zero failures/skips in 14.337 seconds. It includes completeness controls, both report namespaces, raw CSV/HTML/prose preservation, child structuredContent/metadata preservation, exact source references, and separate callable namespace metadata. Child payloads are opaque; the proxy no longer rewrites arbitrary user text. It remaps only documented retrieval hint fields and adds `_meta["office-suite/tool-names"]` plus `office://tools_map`.

Independent review caught Windows ancestor traversal and escaped CSV response-budget defects before publication. The product owner's final RESULT records 24/24 duplicate tests, 4/4 matcher storage tests, and 7/7 focused independent controls. The independent audit separately tests the corrected exact standalone archives with repository fallback blocked; see `intel/R37-independent-product-audit.md` and `data/r37_product_audit.json`. No native Windows OS run is claimed; the model controls exercise the actual storage function with Windows drive and UNC path/filesystem boundaries.

## Whole-estate baseline

After final local artifact verification, exactly one default check ran:

```sh
/Users/mike/bin/buildslot env TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local node scripts/release-check.mjs
```

It exited **1 with 177 failures and 28 named gaps**. `data/r37_full_estate_release_check.txt` retains exact output; its JSON companion categorizes the failures. Of the 177 rows, 54 are older package versions differing from umbrella 0.22.7. Seven old standalone skeletons still fail many wiring checks, and the zip competitor-research note is expired. The estate test row also reports current integration follow-ups: two billing tests (validation counts and new download catalog entry) and two scheduled buy-page tests. Remote tests passed. These current integration failures must not be called exclusively legacy. A later coordinator repair/test is separate from this timestamped baseline.

The default gate still examines every server and its six estate assertions. Scoped standalone releases validate their own declared package/source/dist/registry versions, allowing the corrected matcher to retain version 0.22.6. Internal dependency ranges are checked against each dependency's actual local version, rather than forcing unchanged shared license code to the umbrella version. Missing/malformed compiled versions now fail; either JavaScript quote style is accepted. The default full-estate version comparison remains against the umbrella. A known-bad office compiled version was rejected, and restoring the exact original bytes restored a passing packaging gate.

## Cleanup and limits

The first packaging checkpoint was withdrawn when independent review found the storage defect. `data/r37_release_integration_pre_fix.json` retains those superseded hashes explicitly marked not release-ready. Current archives, descriptors and checksums use the post-fix bytes above.

Every owned extracted verification scope and synthetic store was checked with lsof, logged with its size/path in `data/build-deletions.jsonl`, and removed. The 24 office-test helper deletion records were consolidated there; all recorded fixture paths were absent. Initial inventory work files and the superseded checksum file were likewise removed with guarded manifests. Final project archives and current checksum output remain. Disk availability was 32 GB before final packaging and 34 GB after the default estate check; no low-disk threshold was triggered. No fixture exceeded 50 MB. No browser was started by this agent.

No publication, push, commit, npm publish, live product calls, payment or outreach was performed by this agent. The local archive checks do not certify every old child feature, paid checkout fulfillment, install success, demand or ROI.
