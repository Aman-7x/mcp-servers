# R37 duplicate supplier invoice distribution wiring

Measured 2026-10-16. Scope: local `duplicate-invoice-check` v0.22.7 metadata, source-backed comparison, five synthetic operator acceptance tasks and an actual browser-demo GIF. This agent did not publish, deploy, send outreach, create accounts or use paid APIs. Release publication and regenerated site routes are orchestrator-owned and must be verified separately.

## Coherent local installation and buyer scope

`billing/src/setup.js` contains the product, eight measured tools, three reproducible buyer prompts and six local client angles. The browser-only Claude Web route excludes this local stdio server. Local setup pages now describe local transport and omit the unrelated hosted-install alternative and office-only explanation. Six rendered setupPage objects were checked for the actual local path, no fabricated hosted endpoint, and the max 1000-record/free-evidence contract; the Claude Web page returns null.

`billing/src/compare.js` compares the explicit supplied-batch contract with current Oracle documentation and the Invoice Triage Copilot author's write-up. [Oracle's 26A primary documentation](https://docs.oracle.com/en/cloud/saas/financials/26a/fappp/how-can-i-find-duplicate-invoices-without-considering-the.html) documents an optional combination of supplier, type, amount, currency and date. [The project author's primary write-up](https://github.com/ajoys24/invoice-triage-copilot/blob/main/WRITEUP.md) describes its broader extraction/PO/exception workflow, read-only duplicate-number MCP tool and in-memory demonstration database. Both read live on 2026-10-16. Neither competitor was executed; no runtime performance, price superiority or novelty claim is made. No compare_none waiver was added.

The implemented contract supersedes the exploratory product-choice proposal: every record has its own exact entity ID, the batch bound is 1000, and aggregate saved data is limited to 64 MiB on every tier. Complete checking, source evidence, pages and CSV remain free. Three concurrent saved snapshots fit the free tier; 19 USD single or 39 USD bundle removes only the count cap. No PDF/OCR, ERP, implicit historical lookup, payment clearance, fraud probability or recoverable-money total is advertised.

## Five frozen operator buyer tasks

Command: `node scripts/measure-r37-user-value.mjs`.

The expectations and inputs in `data/r37_user_value_frozen.json` were written before the first actual tool execution; their SHA256 is bound into `data/r37_user_value_evidence.json`. The script runs existing built production code over MCP stdio in an isolated free-tier data directory. It does not call a model. Scores are explicitly binary acceptance coding: 3 only if every frozen count/rule/source-preservation/workflow assertion passes; 0 otherwise. This is not customer preference or human research.

Round 46, `data/user_value_r46.json`: 5/5 tasks passed, 14 actual tools/call requests. Scenarios:

1. Same raw reference with differing date/amount: two candidate records, exact and normalized groups, conflicting fields preserved.
2. Formatting variation versus a leading-zero difference: two candidate records in one normalized group; third original record retained without merging it.
3. Separate entity, supplier, currency and credit-note scopes: all five original rows retained, zero groups. The supplied-batch limitation remains explicit.
4. Distinct invoice references with the same amount/date: two candidates in one weak review group, with an explicit legitimate-explanation warning.
5. Overlapping reasons: four candidates counted once in three groups; three saves succeeded; the fourth retained full diagnostics at the free save cap. All four source rows exported to CSV, pages remained accessible, all three task-created saved snapshots were deleted and saved count returned to zero.

Full bounded receipts (arguments and exact results) are in `data/r37_user_value_evidence.json`. Existing rounds 1–45 were untouched. Measured sub-second tool times cover local execution only, excluding model transcription, app setup, accounting review and buyer time savings.

Harness correction: the first attempt incorrectly expected `report_delete.deleted` to be boolean true. The documented implementation returns the deleted UUID. The harness assertion was corrected to compare the exact UUID; expected buyer outcomes and frozen inputs were unchanged. Two later full runs passed. This was a measurement-harness correction, not a product-runtime change.

## Distribution assets with actual behavior

`assets/duplicate-invoice-check-logo.svg` extends the existing dark-blue invoice-document vector style; `rsvg-convert` rendered its 400x400 PNG. No AI image generation or paid call was used.

Command: `node scripts/capture-r37-demo.mjs`.

`assets/demo-duplicate-invoice-check.gif` is an 800x656, five-frame animation of the exact production demo markup and JavaScript running in Chrome 155 on a loopback server. Captured states show the editable synthetic input, computed overlapping groups, formatting collision, significant leading zeros and a potentially legitimate same-amount/date group. Output was computed by the browser, not painted onto a screenshot. The GIF contains no user/customer financial data. Its 427288 bytes/SHA256 and exact source binding are in `data/r37_demo_gif_evidence.json`. Diagnostic network requests 0, page errors 0. Logo PNG and GIF contact-sheet frames were visually inspected for legibility and truthful output.

The owned fresh browser context was closed. Each temporary runtime storage scope, frame directory and fresh profile was checked with lsof before deletion; size/path/reason manifests are appended to `data/build-deletions.jsonl`. No browser login/profile or user data was removed.

## Metadata and checks

`data/tools.json` adds exactly eight name/description entries from actual `collectRuntimeTools('./servers/duplicate-invoice-check/dist/index.js')` initialization and tools/list, not regex parsing. Existing entries are unchanged. No tools/call was inferred from tools/list; task proof is recorded separately above.

`scripts/sync-mirrors.sh` adds the server to the existing publication inventory. `scripts/mirror-seo.py` adds capability language, five relevant topics and the actual browser-guide link. Its existing hosted truth source keeps this server local-only. The check reports 50/50 publishable mirror entries described; seven older unmirrored skeletons remain separately pending. Description/topics emit successfully. These are configured inventory counts, not proof that 50 mirrors were freshly published.

Syntax checks passed for setup/compare JavaScript, both measurement/capture scripts, and Python source. The current six local setup renders and Claude Web exclusion passed explicit assertions. `git diff --check` passed for this agent's source/data changes. No broad fleet-release or competitor-runtime pass is claimed.
