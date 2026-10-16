# R37 exact SheetJS artifact checks

The three exact root-owned 0.22.9 archives passed this bounded local verification at 10:43:32 UTC on October 16, 2026. The receipt is `data/r37_sheetjs_artifacts.json`: 33 actual tools/call requests, including five license-status requests, plus tools/list and the Office resource map. No archive bytes changed during verification. Publication and hosted deployment remain separate steps.

| Archive | Bytes | SHA256 | Listed tools | Actual tools/call |
|---|---:|---|---:|---:|
| spreadsheet | 5,179,288 | `38a13a55c122fd3c1709a91e90805366268a183f937d1dd1414aa10b8e14b7f6` | 10 | 11 |
| expense-tracker | 5,178,277 | `363ef8958bf7fbc4022488ae5af885a6087ddac45b71e431234e348359e48048` | 14 | 6 |
| office-suite | 29,703,676 | `0555833c1465b2a5583179eab963d8f068888077cc6410d3008254dbc469c300` | 447, 49 children | 16 |

`node scripts/verify-r37-sheetjs-artifacts.mjs` defaults to those three archives in `bundles/`, expected product version 0.22.9 and SheetJS 0.20.3. It writes `data/r37_sheetjs_artifacts.json`. `--archive-dir`, `--expected-version` and a constrained `--output data/name.json` allow separate preserved receipts. It requires at least 20 GB free disk before starting.

Each archive is hashed and its ZIP CRC, relative paths, absence of symlinks, manifest/package/runtime versions and installed SheetJS versions checked. Actual `xlsx.js`, `xlsx.mjs` and `dist/cpexcel.full.mjs` payload hashes must match the official 0.20.3 tarball whose full SHA256 was first checked as `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`. Spreadsheet and Office must actually resolve the codepage module during execution.

All three archives' SheetJS payload hashes matched; spreadsheet and Office actually resolved `cpexcel.full.mjs`. There were zero actual outbound attempts.

The harness runs actual MCP stdio `tools/list` and business calls from the extracted archive, with ESM and CommonJS resolution constrained to its server tree. Known-bad outside ESM/CommonJS imports are required to fail. Ordinary Node fetch, HTTP/HTTPS, TCP/TLS and datagram network entry points are blocked; fetch and net.connect negative controls prove the guard rejects outbound attempts. Children inherit the guard. This is a Node API guard, not an OS network sandbox or a guarantee against malicious native code.

Spreadsheet checks use two fixtures built directly as OOXML ZIPs without a SheetJS writer: canonical numeric Excel date serials and literal ISO date cells. Both must read as September 3, 2026 at 15:30:00 and September 4 date-only, with numeric values 7 and 8. The actual info/read/convert/readback calls must agree, and conversion must leave source bytes unchanged. Appending to the Dates sheet must retain the untouched Keep sheet's formula and cached/numeric values. A 501-row free write must return `isError:true` and create no output.

A separate old-versus-candidate baseline in `data/r37_sheetjs_artifact_preparation.json` confirms that the existing `cellNF:false` reader option drops number formats in both SheetJS 0.18.5 and 0.20.3. With `cellNF:true`, both expose the original `#,##0.00` format. The exact archive roundtrip changed that format to `General` in both standalone spreadsheet and Office. The harness records this inherited limitation instead of claiming that all formatting survives. Edited and converted sheets intentionally replace formulas and formatting with values.

Expense checks add one synthetic USD 12.34 receipt. Free XLSX export must return `isError:true` and leave no file; free CSV remains available. The process then restarts with a one-hour offline bundle key signed in parent memory. Its private key and license text are never printed or written by the harness. Actual Pro XLSX export is reopened from its bytes and its amount, currency, date and merchant validated. Office must pass the equivalent forwarded spreadsheet and expense calls through the declared tools map. All data/config paths are synthetic and isolated.

Two old-archive failures are preserved separately: the current old spreadsheet archive declares 0.22.5, rejecting an expected 0.22.6 (`r37_sheetjs_old_archive_red.json`); when expected 0.22.5 is supplied, installed SheetJS 0.18.5 rejects the required 0.20.3 (`r37_sheetjs_old_dependency_red.json`). Neither is candidate runtime verification. Every synthetic scope is checked with `lsof`, recorded with bytes/path in the deletion manifest, then removed.

These bounded controls do not test vulnerability exploits, certify every possible workbook, cover macros/external links, or certify all Office child workflows. Source migration tests, public download verification, hosted checks and publication remain separate evidence.
