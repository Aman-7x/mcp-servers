# R37 SheetJS remediation rehearsal

Observed 2026-10-16T10:38:25.257469+00:00. The isolated source candidate passes targeted checks. No production or published assets changed.

Worktree: `/Users/mike/mcp-servers-work/r37-sheetjs-rehearsal`, base `d31617c1035f485c69efacb50d595bf4528a8b5c`. Copy only the exact 14 paths and SHA256 values in `data/r37_sheetjs_rehearsal.json` `candidate_files`; exclude temporary outputs and merge cleanup records separately.

## Supported dependency changes

The official [Node installation guide](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) names the exact 0.20.3 CDN tarball. Both spreadsheet and expense-tracker must pin that same URL because Office packaging rejects conflicting external dependency strings. The lock records SHA512 integrity. No broad dependency update was performed.

Tarball: 2409319 bytes, SHA256 `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.

SheetJS 0.20.3 exports true ESM. Expense export requires `XLSX.set_fs({ writeFileSync })`; three spreadsheet test-fixture modules need filesystem injection for direct library writers. Spreadsheet loading installs the official codepage table. Remote vendor generation retains its existing exact buffer-write transform; the regenerated vendor files are included.

## Measured checks

- Bootstrap timezone engine, build license, timezone, spreadsheet and expense-tracker: passed. An initial attempt built full timezone before license; the corrected order passed.
- `node --test servers/spreadsheet/test/*.test.mjs servers/expense-tracker/test/*.test.mjs`: 127 cases, 126 passed, zero failed, one existing stateless-store skip. Signed Pro expense XLSX export passed.
- `node --test remote/test/*.test.mjs`: 89 passed, zero failures/skips. `node remote/build-vendor.mjs` passed.
- `wrangler deploy --dry-run`: passed, 8116.07 KiB / gzip 1844.76 KiB. This did not deploy.
- Scoped spreadsheet and expense release checks each passed 29 checks at unchanged source version 0.22.6. Future release metadata and exact new archives still require verification.

The original expense test expected `isError:false` for three free-tier refusals changed earlier in R37. Running the unchanged main test against unchanged main compiled code reproduced its first failure. The candidate requires errors and retains the no-output/no-storage assertions.

## Date behavior and compatibility

The [vendor date guide](https://docs.sheetjs.com/docs/csf/features/dates/) documents its 0.20 date overhaul: raw Date cells use UTC; `sheet_to_json` defaults to local worksheet clock values. The original raw-cell test now checks UTC hours/minutes and retains its public JSON assertions.

A permanent test uses two small, fixed XLSX fixtures with literal numeric serials and literal type-d ISO XML. Expected output is exactly September 3 at 15:30:00 and September 4 as a date-only value. It makes 36 actual public tool calls: reads, conversions and rereads in UTC, Ho Chi Minh and New York, then rereads every converted file in every timezone. All match those exact expected worksheet clock values.

An additional baseline comparison retains an important migration difference: under Ho Chi Minh, the old library wrote numeric-date files with a 30-second offset and canceled it when reading. A canonical literal numeric serial for 15:30:00 was read as 15:29:30 by the old build and correctly as 15:30:00 by the candidate. Old-produced numeric-date file outputs therefore change by 30 seconds under the corrected reader. ISO cells and UTC/New York controls did not show that difference. No heuristic compensation or weakened expected-output check was added. Nine read/JSON UTC option combinations retained the encoded numeric value; no supported option preserves both the old compensating bug and correct canonical serials.

## Limits and remaining release work

The [prototype-pollution advisory](https://cdn.sheetjs.com/advisories/CVE-2023-30533) fixes arbitrary-file reading in 0.19.3. The [ReDoS advisory](https://cdn.sheetjs.com/advisories/CVE-2024-22363) fixes versions through 0.20.1 in 0.20.2. The candidate uses 0.20.3. No exploit was executed.

This rehearsal did not perform live hosted business calls, inspect new MCPB bytes, or validate a legacy encoded XLS/XLSB file. An attempted BIFF5 fixture had already replaced non-ASCII text during generation, so it was discarded as evidence. Codepage initialization follows official ESM guidance but is not a legacy-format certification.

Root still needs versioned spreadsheet, expense and Office builds/archives, affected alias/catalog updates, exact-archive tests, hosted read/write calls and required deployment/publication gates. Allow roughly 20–35 minutes if those remain green. Before publication, discard the candidate to roll back. After publication, restore catalog selection and Worker version while preserving every immutable asset.

## Handoff and cleanup

The worktree remains until root copies the listed files and independent review finishes. The temporary key-directory symlink was lsof-checked, recorded in its cleanup manifest and removed; its private-key target was never copied or changed. Root must merge cleanup records separately and lsof-check the worktree before eventual removal. The JSON contains commands, exact counts and the complete date observations.
