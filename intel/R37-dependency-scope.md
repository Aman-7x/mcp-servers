# R37 dependency advisory scope

**Material inherited risk remains in the office archive's spreadsheet reader: `xlsx@0.18.5` is packaged and ordinary read tools reach its affected parser.** The other five flagged packages are present in all three published archives at versions beyond the listed advisory fixes. They remain older in the repository lock/install, so the root CI warning is not dismissed.

Evidence: `data/r37_dependency_scope.json`. This was a read-only review of primary advisories, repository source and exact ZIP contents. The three local archive hashes matched the previously independently downloaded v0.22.8 public assets. No dependency update, exploit, tool invocation, build, browser, deployment or temporary extraction occurred. Available disk was 24 GB.

## Exact versions

All package metadata entries in each archive were inspected, including nested paths; the inventory and selected compiled-file hashes/line excerpts are retained in the JSON.

| Package | Root lock and installed version | Duplicate standalone | Matcher standalone | Office archive | Listed advisory fix |
| --- | --- | --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | 1.30.0 | 1.32.1 | 1.32.1 | 1.32.1 | 1.31.0 |
| `proxy-addr` | 2.0.7 | 2.0.8 | 2.0.8 | 2.0.8 | 2.0.8 |
| `fast-uri` | 3.1.7 | 3.1.8 | 3.1.8 | 3.1.8 | 3.1.8 on this branch |
| `hono` | 4.13.5 | 4.13.13 | 4.13.13 | 4.13.13 | 4.13.7 |
| `ip-address` | 10.7.0 | 10.7.4 | 10.7.4 | 10.7.4 | 10.7.1 |
| `xlsx` | 0.18.5 | Package absent | Package absent | **0.18.5** | 0.19.3 / 0.20.2, outside the stale npm distribution |

The audit's SDK affected range ending at 1.30.1 is not the installed version: the actual root version is 1.30.0. Packaging resolves production ranges independently in staging with `npm install --omit=dev --no-audit --no-fund --ignore-scripts --no-package-lock` at `scripts/build-mcpb.sh:333` and `:432`. This explains why the artifact inventory differs from a root-lock audit. It also means a root audit is not an artifact SBOM and repeated packaging is not pinned to the root's dependency versions.

Reviewed archive SHA-256 values:

- Duplicate: `181379eb6dcff3d90b55e080dd9c180f6c96802e991872865a6b0ce422b3aaea`.
- Matcher: `6397928ec44ea9d5c406a66f4eb7aa9a2f34f5731bf8ef9972fadfdac882f040`.
- Office: `7f50d6d16d445dddcee054b24e8586de4daff9d91b77d22a28730647305cc91d`.

## Advisory conditions and relevant paths

**MCP OAuth client, GHSA-6qxp-vccf-f47h.** The advisory concerns HTTP OAuth clients that hold credentials and accept an authorization server selected by an MCP server. It explicitly excludes MCP servers and stdio clients. Duplicate and matcher connect `StdioServerTransport`; office connects that transport and starts local children with `StdioClientTransport`. No first-party HTTP OAuth `authProvider`, `auth()` or `fetchToken()` path was found in the packaged application scan. Independently of those usage conditions, all three archives carry SDK 1.32.1, above the fixed 1.31.0 version. The affected root dependency remains a separate concern for any other application using its OAuth client. [Maintainer-published advisory](https://github.com/advisories/GHSA-6qxp-vccf-f47h).

**Proxy trust, GHSA-jqcg-44mw-7w3h.** Exploitation requires a vulnerable proxy-trust calculation, such as a misrepresented IPv4-mapped IPv6 trust subnet, combined with forwarded-IP input. Packaged SDK HTTP helpers depend on Express 5.3.0, which depends on patched `proxy-addr@2.0.8`. The reviewed first-party entrypoints use stdio and do not configure Express trust proxies. The package is present; it is not evidence of a reachable HTTP trust boundary in these entrypoints. [Maintainer-published advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h).

**URI normalization, GHSA-hrr3-gc8f-f4qj.** This issue concerns security decisions using inconsistent case normalization of percent-encoded hosts in scheme-relative references. The exact artifact chain is SDK `server/index.js` / `client/index.js` → `validation/ajv-provider.js` → AJV 8.20.0 → `fast-uri@3.1.8`. Thus this is a validation dependency, not a package we can label absent or globally unused. Its packaged version is fixed for this advisory; a vulnerable host-allowlist decision was not found in the first-party scan. [Maintainer-published advisory](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj).

**Hono JSX, GHSA-hxh3-vqpv-xpqv.** The issue requires untrusted strings in particular server-side JSX boundary/root rendering positions. Hono 4.13.13 is packaged through SDK HTTP dependencies and exceeds the 4.13.7 fix. No first-party `hono/jsx` renderer was found in the three applications. This conclusion concerns the named JSX advisory, not all Hono behavior. [Maintainer-published advisory](https://github.com/advisories/GHSA-hxh3-vqpv-xpqv).

**IP address handling, GHSA-j6r3-76f7-8jcv and GHSA-h3mg-xc3c-68pw.** The prerequisites are respectively cross-family subnet decisions or oversized untrusted input reaching `Address6` validation. The packaged dependency chain includes SDK HTTP auth handlers → `express-rate-limit` → `ip-address@10.7.4`, above the 10.7.1 fixes. No first-party subnet/Address6 call was found. This is presence at a patched version, not a claim that every transitive call is unreachable. [Subnet advisory](https://github.com/advisories/GHSA-j6r3-76f7-8jcv), [Address6 resource-exhaustion advisory](https://github.com/advisories/GHSA-h3mg-xc3c-68pw).

**SheetJS, GHSA-4r6h-8v6p-xvw6 and GHSA-5pgg-2g8v-p4x9.** Both standalones lack the `xlsx` package and have no first-party XLSX import. Office includes `xlsx@0.18.5`, below both fixes. The vendor identifies crafted-file prototype pollution through 0.19.2 and ReDoS through 0.20.1. Its prototype-pollution advisory distinguishes input parsing from export-only usage. [Vendor prototype-pollution advisory](https://cdn.sheetjs.com/advisories/CVE-2023-30533), [vendor ReDoS advisory](https://cdn.sheetjs.com/advisories/CVE-2024-22363).

The office archive contains this concrete compiled path:

1. `server/index.js:17` includes the spreadsheet child; `:332` forwards tool calls to its stdio client.
2. `server/node_modules/@theluckystrike/mcp-spreadsheet/dist/index.js:263` registers `sheet_info`; `infoText` at `:234` calls `loadWorkbook` at `:236`.
3. `sheet_read` at `:269` uses `open` at `:102`, which calls `loadWorkbook` at `:104`.
4. `server/node_modules/@theluckystrike/mcp-spreadsheet/dist/sheet.js:165` invokes `XLSX.read(readFileSync(full), ...)` for non-CSV/TSV/TXT inputs.

The corresponding source is `servers/spreadsheet/src/sheet.ts:195`. Row slicing happens after workbook parsing. The free 5 MiB notice in `servers/spreadsheet/src/index.ts:105` also happens after `loadWorkbook`; neither that notice nor the 5,000-row presentation cap establishes a safe parser boundary. A user directing these tools to an untrusted workbook reaches the affected parser. No crafted file was executed, so this review establishes the input path, not a demonstrated exploit or its precise impact.

Office's expense tracker also imports XLSX, but its observed compiled uses at `dist/index.js:762–765` construct and write a workbook. That export-only path is distinct from the confirmed spreadsheet read path. Other child behaviors and hosted vendor bundles were not exhaustively audited.

## Smallest practical follow-up

Schedule a dedicated SheetJS dependency patch for spreadsheet and its office distribution. Use a vetted official release at least 0.20.2; the vendor's current installation instructions point to 0.20.3 and recommend pinning/vendoring the tarball. Verify source/integrity and run focused spreadsheet read/write/date/formula/format-preservation and expense-export regressions, then publish new immutable artifacts. Ordinary npm `xlsx` remains at 0.18.5, so a broad `npm audit fix --force` is not the remedy. [Official installation and vendoring instructions](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).

Separately reconcile the root lock's five fixable dependencies with tested patched versions and add an exact-archive dependency inventory/audit step. Do not infer that the root warning is fixed merely because the three archives happen to contain newer packages. Until the SheetJS patch is validated, avoid treating the office spreadsheet reader as appropriate for untrusted workbooks.

This is a bounded triage of eight advisories across six packages, not a blanket security clearance. The previously successful product workflows and artifact hash checks did not exercise adversarial XLSX parsing.
