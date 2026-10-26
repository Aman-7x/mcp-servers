# R38 supplier and Office release packaging

The new supplier statement server and Office proxy are packaged at v0.25.0. These are verified local artifacts awaiting the coordinator's publication. The wider estate is not certified by these scoped checks.

| Artifact | Bytes | SHA-256 | Actual MCP tools |
| --- | ---: | --- | ---: |
| `supplier-statement-check.mcpb` | 3,284,791 | `98784c618a5f7df7c0e3ea4d4528200c10ea43d65eff785fbc1cde55216b306b` | 8 |
| `office-suite.mcpb` | 30,003,480 | `4918b493051b5a2c067c73013d093a0da08c9a41f8ac8ecd8f538107c167fb1a` | 453 |

Commands producing those figures:

```sh
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local /Users/mike/mcp-servers-work/bin/buildslot -- npm run build -w servers/supplier-statement-check -w servers/office-suite
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local /Users/mike/mcp-servers-work/bin/buildslot -- node --test --test-concurrency=1 servers/supplier-statement-check/test/*.test.mjs servers/office-suite/test/*.test.mjs
node scripts/release-check.mjs --only supplier-statement-check
node scripts/check-office-build-inputs.mjs
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local /Users/mike/mcp-servers-work/bin/buildslot -- /opt/homebrew/bin/bash scripts/build-mcpb.sh --only office-suite
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local /Users/mike/mcp-servers-work/bin/buildslot -- /opt/homebrew/bin/bash scripts/build-mcpb.sh --only supplier-statement-check
TMPDIR=/Users/mike/mcp-servers-work npm_config_cache=/Users/mike/.npm-cache-local /Users/mike/mcp-servers-work/bin/buildslot -- node scripts/r38-verify-packaging.mjs
```

The source suites passed 40/40 with no skips in 42.876 seconds. The parent subsequently added two metadata contract tests; both pass in the separate final metadata check. The final supplier release gate passes 29/29, zero gaps. Office packaging inputs verify 50 children and 52 package closures, including all source/dist/package versions and local dependency ranges. These checks do not certify every older child's business behavior.

The exact-archive verifier checks the CRC and content bytes of all 2,179 supplier ZIP members and 5,415 Office ZIP members against the self-contained packaged trees used for actual MCP calls. It checks 79,307,203 uncompressed Office bytes without creating a temporary extraction fixture larger than 50 MB. It then performs 24 real local tool calls under isolated XDG directories, plus handshakes, full tools lists against exact manifest names/descriptions, and an Office resource read. Checks cover comparison; saved retrieval; paging; CSV; fourth-save refusal retaining free diagnostics and CSV; truthful $19/$39 payment descriptors; bad calendar-date and unsafe-integer errors; signed offline single-product activation allowing a fourth report; and Office routing/resource maps. No real purchase, hosted call, provider email, or paid API call is involved. The signing private key remains in memory; the generated test license is saved only to the isolated activation config, which is removed after lsof proves no open handles.

## Office tool names and preserved evidence

The proxy originally forgot that a basename had already collided after moving the first pair to qualified names. A third child could therefore reintroduce a bare `report_get`. The new collision history keeps later children scoped. Explicit supplier report retrieval hints now name the actual exposed tools, while original references, source rows, CSV cells and unrelated prose remain unchanged.

An actual Office stdio regression failed before the fix and passes afterward. The prior published v0.22.9 inventory contains 447 names. Comparing it with the new measured inventory finds zero removed names and these six additions:

- `supplier_statement_check`
- `supplier-statement-check_report_list`
- `supplier-statement-check_report_get`
- `supplier-statement-check_report_page`
- `supplier-statement-check_report_delete`
- `supplier-statement-check_report_export_csv`

The intermediate prototype had five bare report helpers. Those were never published; the final v0.25.0 artifact scopes them. Use `office://tools_map` for the authoritative mapping. [Exact name comparison](../data/r38_packaging_collision_names.json) records both comparisons.

## Artifact preservation and limitations

The supported packaging commands replaced only the derived current supplier/Office outputs. Before rebuilding Office, its prior v0.22.9 archive was copied to `bundles/releases/v0.22.9/office-suite.mcpb` and verified against its original SHA-256 `0555833c1465b2a5583179eab963d8f068888077cc6410d3008254dbc469c300`. It remains unchanged. Other server versions and archives were retained. New immutable staging files and their checksums are under `bundles/releases/v0.25.0/`.

An initial full source run had two existing cleanup-hook races while child handles disappeared. The helper now retries an unsettled lsof result within its existing deadline; deletion still requires status 1 and empty output. The final full rerun passes. The new proxy routing control, ZIP checks, and signed-activation readbacks are synthetic operator evidence, not customers or willingness to pay.

v0.23.0 was the initial unpublished supplier prototype version. The coordinator selected v0.25.0 to avoid reusing historical release identifiers already documented for v0.23/v0.24. Earlier prototype receipts preserve their original version and timestamp. Final package/source/descriptor/manifest/handshake versions agree at v0.25.0.

[Release assets](../data/r38_packaging_release_assets.json), [exact archive verification](../data/r38_packaging_archive_verification.json), [source tests](../data/r38_packaging_final_source_tests.tap), [supplier gate](../data/r38_packaging_gate_final.txt), [Office pack log](../data/r38_packaging_office_pack.txt), [supplier pack log](../data/r38_packaging_supplier_pack.txt).
