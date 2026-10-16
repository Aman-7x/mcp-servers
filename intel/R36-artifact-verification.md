# R36 local release artifact verification

Measured 2026-10-16. Matcher passes. Office runtime passes, but its original manifest requires repack before publication.

Evidence: `data/r36_artifact_verification.json` retains archive measurements, exact runtime checks, all resolved module filenames, package closure counts, the manifest delta and executable verification scripts. `data/r36_bundle_tool_inventory.json` retains the measured names and descriptions to build the corrected manifest. No publication, remote requests, paid calls or account changes occurred in this verification.

| Artifact at inspection | Version | Archive bytes | Files | Expanded bytes | Manifest tools | Runtime tools |
|---|---:|---:|---:|---:|---:|---:|
| `bundles/three-way-match.mcpb` | 0.22.6 | 3,276,647 | 2,177 | 10,280,148 | 8 | 8 |
| `bundles/office-suite.mcpb` | 0.22.6 | 31,998,234 | 5,614 | 83,992,113 | 407 | 441 |

Archive counts and byte sizes came from Python `zipfile.ZipFile(...).infolist()` and file `stat()`. `ZipFile.testzip()` returned `None` for both archives. All files matched the corresponding existing built tree byte-for-byte by SHA-256; there were zero unsafe paths, zero symlinks and zero mismatches. The matcher was extracted into the task work directory. Office was not duplicated into a fixture larger than 50 MB: every archive file was compared against its existing built tree, then that byte-equivalent entry was executed.

Original SHA-256, measured by `hashlib.sha256(path.read_bytes()).hexdigest()`:

- Matcher: `22a7b3fa21624cacd644ab90d62b42c85b7067960dee26efd185dd751a816012`
- Office: `5e5fea89b60cec407b87d762ba7f961e014a883fb235b88b9e2ad31575bb9d45`

These hashes identify the inspected original artifacts, not any later repack. Office must be checked again after its manifest changes.

## Real artifact execution

Commands were `node /Users/mike/mcp-servers-work/r36-artifact-verification/verify.mjs standalone`, `... office-suite` and `... bootstrap`. The runner used the canonical MCP SDK client and fixture helper, but started the extracted matcher entry itself. It passed only PATH, isolated HOME/XDG paths, an empty license key and the module-guard configuration to the server. The office runner started `bundles/office-suite/server/index.js`, whose bytes and every dependency file had been compared with the archive.

An ESM resolution loader and CommonJS `_resolveFilename` guard rejected every file module outside the permitted artifact root. Office child environments inherited the guard. This also prevented the office monorepo/package resolution fallbacks from masking a missing archive dependency. No dependency outside either artifact root resolved successfully. Node and its built-in modules are the intended system dependencies.

Matcher: 1,022 successful real `tools/call` requests, exactly eight tools.

- Equal invoice/PO grand totals with accepted quantities 5 and 15 versus billed quantities 10 and 10 returned exceptions, including `invoiced_above_accepted`. Saved report retrieval retained source quantity 5; CSV included the exception.
- Free license, three saved reports, refusal of a fourth save, useful diagnosis after refusal, delete and replacement save all passed.
- A 50,000-row receipt fixture returned 50,004 issues and 50,002 SKU rows. All rows were retrieved through 501 issue pages and 501 SKU pages using the default SDK transport.
- The last receipt row `UNKNOWN-99-499` was retrieved; a save-cap refusal retained free preview paging.
- A large saved report returned its paginated overview and last source row. CSV at offset 50,000 returned its final two rows with `next_offset: null`.

The matcher guard recorded 511 resolution events and 223 unique files. Its complete external package closure was `@modelcontextprotocol/sdk`, `@theluckystrike/mcp-license`, `@theluckystrike/mcp-timezone`, `ajv`, `ajv-formats`, `fast-deep-equal`, `fast-uri`, `json-schema-traverse`, `zod` and `zod-to-json-schema`; all came from the extracted archive. Exact relative filenames and counts are retained in the JSON evidence.

Office: 441 tools discovered and three successful real calls: `three_way_match`, `report_get` and `report_export_csv`. The proxy returned the same offsetting-quantity exceptions, retained the accepted quantity and exported the issue. All 48 child servers initialized. Guards recorded 32,904 resolution events, 1,105 unique files and 196 package names, all within the byte-equivalent office server tree. The exact dependency closure is retained in the JSON evidence. This is proof of matcher delivery through the office proxy, not a regression test of every office feature.

## Manifest defect requiring root repack

Office's original manifest declared 407 names against 441 actual runtime tools: 51 runtime-only names and 17 manifest-only names. The full arrays are in `office_manifest_delta` in the JSON evidence. The missing tools include price tracking, backlink checking and hourly-rate tools, plus actual collision-prefixed checklist, purchase-requisition and credit-note tool names. Phantom declarations include unprefixed `run_*`, `credit_note_*`, `business_set`, `rate_set`, `trip_list`, `asset_add` and `category_rules` names.

Root was notified immediately. Root is correcting the manifest builder to use the measured runtime inventory. This report deliberately leaves the office artifact pending repack and final byte comparison. Matcher manifest and runtime agree exactly.

## Fresh-source bootstrap

A second isolated fixture copied only the existing license, timezone and matcher `src`, package manifests and tsconfigs, plus `scripts/bootstrap-timezone.mjs`; no `dist` or existing `node_modules` were copied. The root workspace declaration was retained, with its unused root `marked` dependency omitted. Package-local source and manifests were unchanged. The fixture's logical size after install/build was 41,237,900 bytes.

Every npm command set `npm_config_cache=/Users/mike/.npm-cache-local`. Under `buildslot`, offline-first `npm install --offline --ignore-scripts --no-audit --no-fund` failed `ENOTCACHED` for TypeScript registry metadata. Public registry fallback `npm install --prefer-offline --ignore-scripts --no-audit --no-fund` installed 101 packages in 12 seconds. Then the documented sequence exited 0:

```sh
node scripts/bootstrap-timezone.mjs
npm run build --workspace @theluckystrike/mcp-license
npm run build --workspace @theluckystrike/mcp-three-way-match
```

The freshly compiled source entry exposed eight tools and passed the same three real matching/get/CSV calls. Guards resolved 223 unique files exclusively within this source fixture, including the local workspace dependency chain. This verifies the documented build order without stale dist outputs, using a dependency-complete source subset. It does not claim a full monorepo fresh-clone installation. Docker was not tested because the Docker CLI is unavailable.

## Cleanup

Task work folders are removed only after `lsof -t +D` returns exit 1 with empty stdout. The JSON evidence's `cleanup` records the deleted path and logical size. Verification scripts are preserved as strings in the JSON evidence so they can be recreated after temporary-folder cleanup. All changes owned by this verification are limited to this report and its two data files.

## Corrected office repack

Root replaced the source-regex manifest with actual runtime tools/list output and measured the built entry again. All 441 names/descriptions agree with the independent inventory. Final archive CRC and every file comparison pass; only the manifest changed. Final SHA-256: `5221f20c51572f8da17808a8f03097a76d4d48b72c7d0c2509708297129277bc`. See `data/r36_office_repack_verification.json`.
