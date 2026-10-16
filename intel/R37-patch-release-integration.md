# R37 v0.22.8 corrective release integration

The three local v0.22.8 archives passed strict scoped packaging gates and isolated exact-archive workflow checks. Shared license v0.22.7 now advertises the actual 48 paid singles. No product algorithm, storage, output or permission behavior changed in this patch. Publication and public URL verification remain with the orchestrator.

The patch resolves a real distribution gap: corrected storage bytes previously lived in archives while immutable registry rows still selected older archives. Duplicate review, three-way matching and office now each declare version 0.22.8 in package/source/dist and all named outer descriptors. Their intended URLs use the new v0.22.8 release collection. Old published rows/assets were not modified.

| Archive | Bytes | SHA-256 | Actual tools / calls |
| --- | ---: | --- | --- |
| `bundles/duplicate-invoice-check.mcpb` | 3,276,144 | `181379eb6dcff3d90b55e080dd9c180f6c96802e991872865a6b0ce422b3aaea` | 8 / 11 |
| `bundles/three-way-match.mcpb` | 3,276,889 | `6397928ec44ea9d5c406a66f4eb7aa9a2f34f5731bf8ef9972fadfdac882f040` | 8 / 4 |
| `bundles/office-suite.mcpb` | 32,010,970 | `7f50d6d16d445dddcee054b24e8586de4daff9d91b77d22a28730647305cc91d` | 447 / 9 |

Office initializes all 49 declared children and exposes 447 tools. Both standalone servers expose eight tools. `data/office-suite-tool-inventory.json` records the new actual bundled inventory. All nine outer descriptor files contain the exact matching new archive hash; each product has primary and descriptive namespaces, while its `server.mcpb.json` mirrors the primary. The six names identify three capabilities, not six products. `bundles/SHA256SUMS-r37-patch.txt` is the current patch checksum manifest.

## Preservation and scope

Before changing source or derived outputs, the exact three previous archives were copied to `bundles/releases/v0.22.7/` with their own SHA manifest. Each copy was checked against its prior recorded hash. Prior integration evidence and three packaging logs were copied to explicit `v0.22.7` filenames. The prior office inventory is `data/office-suite-tool-inventory_v0.22.7.json`. Those permanent forensic outputs are not test fixtures.

`data/r37_patch_source_snapshot.json` captures the eight duplicate/matcher core/store/output/index hashes before this patch. They remain byte-identical. The only shared license implementation change is `SERVER_COUNT = 47` to `48`; package metadata advances to 0.22.7. The independent reviewer separately confirmed the count-neutral license code is identical, actual billing paid products total 48 with no free-ID overlap, and all eight implementation hashes match.

Older children declare `^0.22.6` for the license, which correctly admits 0.22.7. The prior exact-caret comparison falsely rejected that compatible patch. Both packaging gates now verify actual stable versions against supported caret/exact ranges. Incompatible major/minor, downgrade, invalid zero-major upgrades, unsupported syntax and malformed/unsafe numeric versions are rejected; one permanent test covers 11 boundary cases. Unknown range syntax fails closed. Default estate checks remain available and were not run by this agent during this patch.

## Commands and evidence

Every npm command set `npm_config_cache=/Users/mike/.npm-cache-local`; build/test/pack commands used `/Users/mike/bin/buildslot`. Temporary storage used `/Users/mike/mcp-servers-work`.

- `npm install --package-lock-only --offline --ignore-scripts --no-audit --no-fund` exited 0. Root lock versions match all four updated packages.
- `npm run build --workspace @theluckystrike/mcp-license --workspace @theluckystrike/mcp-duplicate-invoice-check --workspace @theluckystrike/mcp-three-way-match --workspace @theluckystrike/mcp-office-suite` exited 0.
- The corresponding four-workspace `npm test` command passed 103 tests: license 45, duplicate 24, matcher 25 and office 9; zero failures/skips. `data/r37_patch_tests.txt` retains output. The range control passed separately in `data/r37_patch_range_test.txt`.
- `node scripts/release-check.mjs --only duplicate-invoice-check` and the corresponding matcher command each passed 29/29 checks with zero gaps. Outputs: `data/r37_patch_duplicate_gate.txt`, `data/r37_patch_matcher_gate.txt`.
- `/opt/homebrew/bin/bash scripts/build-mcpb.sh --only <target>` exited 0 for each archive. Office's packaging-input gate checked 49 children and 51 package closures; it does not certify every older feature. Pack outputs use `data/r37_patch_{duplicate,matcher,office}_pack_result.txt`.
- `node scripts/verify-r37-local-artifacts.mjs --output data/r37_patch_release_integration.json --expected-version 0.22.8` exited 0. Completion time: 2026-10-16T09:15:45.710Z. The verifier checks ZIP CRC, initialized version, exact manifest/runtime names and descriptions, and current corrected compiled store bytes.

Exact archive dependency resolution was constrained to each isolated extracted server tree for both ESM and CommonJS, including all office children. Deliberate outside-tree imports were rejected. Actual checks covered duplicate grouping/source boundaries, saved-cap diagnosis and free export, exact source references, matcher offsetting-quantity exceptions, save/get/page/CSV, and both workflows through office. Packaged license code matches the rebuilt source and reports version 0.22.7. Actual `license_status` responses confirm the 48-server bundle, $19 single/$39 bundle and `agent_settleable: false`; human checkout permissions remain unchanged.

The verifier's dynamic expected versions read each declared package version and can additionally require a single explicit patch version. Its new output option is restricted to a JSON artifact under `data/`, preserving prior evidence rather than silently overwriting it. Hash binding remains outside the archive; no self-referential hash is embedded.

`data/r37_patch_validation.json` records the bounded validation summary. Independent exact-archive review passed at 2026-10-16T09:18:46.015Z with 32 actual guarded calls, both standalone and office save-three/cap-four/free-evidence controls, all nine descriptors, and unchanged permissions/prices. Its evidence is `data/r37_patch_product_audit.json`; public URL byte verification remains pending root publication. An initial reviewer read before descriptor hash assignment was retried after all fields were filled; it was not a change to archive bytes.

## Cleanup and limits

Isolated extracted archive scopes and synthetic stores were closed, checked with lsof, recorded with sizes/paths in `data/build-deletions.jsonl`, and removed. Eleven office fixture deletion records were consolidated into the main manifest; seven current matcher fixture records were copied there while retaining their original tracked manifest. All recorded fixture paths were absent. No fixture exceeded 50 MB. Disk available was 34 GB at patch start and after final packaging. No browser was started by this agent.

No publication, push, commit, deployment, paid API, payment or outreach was performed by this agent. This patch does not certify the older fleet, customer demand, paid fulfillment or ROI. Root owns generated facts/pages/README/catalog refresh, remote/billing deployment, default estate verification and final publication.
