# R37 local release integration

Status: PRE-FIX CHECKPOINT ONLY. Independent review found a Windows data-directory bug; both archives require rebuilding after the store corrections. No publication is authorized from these checkpoint bytes.

The office proxy v0.22.7 adds duplicate-invoice-check as a local child. Its final bundled-entry MCP inventory measures **49 children and 447 exposed tools**. The new server has eight standalone tools; office aggregates the two license tools, so the additional child contributes six exposed tools. Names that collide with the existing three-way matcher retain separate child prefixes. The proxy exposes `three-way-match_report_get` and `duplicate-invoice-check_report_get` independently.

Commands and evidence:

- `buildslot env npm_config_cache=/Users/mike/.npm-cache-local npm run build --workspace @theluckystrike/mcp-office-suite` exited 0.
- `node scripts/runtime-tool-inventory.mjs servers/office-suite/dist/index.js` measured 447 tools. `data/office-suite-tool-inventory.json` now records the final bundled-entry measurement (2026-10-16T08:11:46.330Z).
- `buildslot env TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local node --test servers/office-suite/test/duplicate-invoice.test.mjs servers/office-suite/test/children-complete.test.mjs` reported 4 tests, 4 passed, 0 failed, 0 skipped. Actual proxy calls checked candidate grouping, source scope separation, save/get, record paging, CSV and schema errors. The completeness negative control removed a real child from a copy and detected the omission.
- `node scripts/check-office-build-inputs.mjs` checked 49 children and 51 local package closures. A temporary mutation of the office compiled version to 9.99.99 was rejected; restoring the original bytes restored a passing gate.

`build-mcpb.sh --only <standalone>` now invokes all 29 per-server release checks. `--only office-suite` invokes a clearly scoped local packaging-input gate; this checks child/build-list parity, every child entry, source/dist/package versions and actual internal package version ranges. Targeted gates cannot be disabled through `RELEASE_CHECK=0`. The default release-check still covers the whole estate and runs its six estate assertions. Scoped passes do not certify the old fleet.

The internal dependency version check now compares a dependency range with that dependency's actual package version, rather than forcing all dependencies to the umbrella release version. The new product and office package are v0.22.7 while the unchanged shared license remains v0.22.6. The source/dist version check now accepts either quote style and rejects missing/malformed versions rather than silently passing an unparsed value.

Standalone manifests now also use actual built-entry `tools/list`, including helper-registered license tools, instead of a source parser. Outer registry descriptors are separate from archive contents; their SHA-256 values were filled after final packaging and verification. No self-referential archive hash is introduced.

`scripts/verify-r37-local-artifacts.mjs` verified the exact local archives: ZIP CRC, fresh isolated extraction, initialized v0.22.7, exact manifest/runtime names and descriptions, source-scoped duplicate evidence, actual save/get/page/CSV and errors, free saved-count cap with full diagnosis, and all 49 office children. ESM and CommonJS guards constrain every child resolution to its extracted archive tree; an explicit outside-tree import is a known-bad control. Extracted derived outputs and synthetic storage are removed only after lsof proves no open handles, with size/path deletion manifests.

No publication, push, commit, npm publish or live product calls were performed by this agent. The whole-estate release gate had older failures before R37; this integration does not relabel those as green.

Evidence integrity: the old proxy rewrote tool-name words inside arbitrary child result text, which could corrupt a caller invoice reference such as `report_get`. R37 preserves opaque JSON, raw CSV, HTML and prose. It forwards child structuredContent and metadata, adds separate namespace metadata, and remaps only documented report retrieval hints. Regression fixtures assert literal tool-name source/CSV/HTML/prose values remain exact, and metadata still names the correct per-child callable tool.

Pre-fix checkpoint commands:

- `buildslot env TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local /opt/homebrew/bin/bash scripts/build-mcpb.sh --only duplicate-invoice-check` exited 0 after all 29 scoped release checks passed with zero gaps. The script uses Homebrew Bash 5. The first attempt stopped on an old double-quote-only VERSION grep; replacing it with strict Node parsing for either quote style fixed the script without changing any runtime version.
- The same build command with `--only office-suite` exited 0. The packaging gate checked 49 children and 51 package closures. The final artifact inventory measured 447 tools. `data/r37_office_pack_result.txt` retains ASCII packaging output.
- `buildslot env TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local node scripts/verify-r37-local-artifacts.mjs` exited 0. `data/r37_release_integration.json` records exact archive sizes, hashes, ZIP CRC, actual calls and constrained dependency resolution. Both ESM and CommonJS outside-artifact import controls were rejected.
- The full office suite after the opaque-payload correction passed 9 tests, zero failures/skips in 14.337 seconds. This includes raw CSV/HTML/prose and child structuredContent preservation with the correct separate namespace hints.

| Local archive | Bytes | SHA-256 | Actual runtime |
| --- | ---: | --- | --- |
| `bundles/duplicate-invoice-check.mcpb` | 3,275,536 | `83265138e9cea3570879c6551e689608dc29c31f0fa537c427d3a2efecb48e31` | 8 tools, 10 business calls |
| `bundles/office-suite.mcpb` | 32,010,183 | `66fb0e60c78dcdcd784f69e20f23cbb8ba5f1f620dccb30c4cc6a46ff89d93e3` | 447 tools, 5 business calls |

The standalone guard observed 511 module resolutions covering 223 unique files. Office observed 33,416 resolutions covering 1,110 unique files. Every successful file-based dependency resolution remained inside the respective extracted archive's server tree. All 49 office children initialized. No feature completeness claim is made for the older estate.

The standalone verifier exercised the three-saved-report cap while confirming full diagnosis and CSV remain free; it also checked conflicting references, union candidate counts, exact scope separation, preserved literal tool-name evidence and schema errors. The office verifier exercised those duplicate review and retrieval operations through the actual proxy. It did not make a payment, exercise every legacy feature or certify paid fulfillment.

The checkpoint SHA values below are superseded. Outer descriptor hashes have been removed pending post-fix packaging. Their two distinct registry names identify the same capability; the extra descriptive name is not a second product. The active SHA256SUMS file was removed pending post-fix packaging. Office's older immutable registry descriptors were not rewritten to imply a new published registry version.

The exact-archive verifier's extracted derived artifacts and synthetic data were checked with lsof, logged with sizes/paths, and removed. Initial source inventory work files were likewise removed with manifests. No project output archive was removed after successful final packaging. Disk available at final packing was 33 GB; no low-disk threshold was triggered.

Hold received after the checkpoint verifier completed: product agent owns duplicate and three-way matcher Windows store fixes. Checkpoint dependency/business results remain evidence about those exact old bytes only. The final release verifier must rerun against rebuilt standalone and office archives after the orchestrator signals stable sources.
