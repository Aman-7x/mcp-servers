# R37 explicit free-tier refusal results

status: DONE for the bounded source-wrapper changes; generated hosted integration belongs to the coordinator.

Seventeen affected servers: time-tracker, invoice, price-tracker, clauses, docx, kanban, recurring, calendar, timezone, bank-statement, expense-tracker, currency, zip, image, pdf, spreadsheet and barcode. No versions, descriptions, algorithms or tier bounds changed.

## Evidence

`df -g /System/Volumes/Data` reported 32 GB before the initial seven-server task and 35 GB before the extension.

Before rebuilding, the seven initial actual-stdio regression cases all failed against the previous compiled servers: genuine free-cap refusals had `isError` undefined instead of true. No fake handlers were substituted. The ten extension servers were tested after their rebuilds; no pre-build negative-control run is claimed for them.

All seventeen workspace builds exited 0 through `/Users/mike/bin/buildslot env npm_config_cache=/Users/mike/.npm-cache-local npm run build --workspace <package>`. The initial seven were built together, the next nine together, and barcode separately. Packages use the `@theluckystrike/mcp-<server>` names.

Final combined command:

```sh
/Users/mike/bin/buildslot node --test servers/{time-tracker,invoice,price-tracker,clauses,docx,kanban,recurring,calendar,timezone,bank-statement,expense-tracker,currency,zip,image,pdf,spreadsheet,barcode}/test/refusal.test.mjs
```

Result: **18 tests, 18 passed, zero failed, zero skipped; 2834.364333 ms.** These are actual MCP stdio tool calls against built servers. An actual delayed localhost HTTP response fills the watch quota while `watch_add` fetches; the post-fetch refusal returns an error and stores no extra watch. Currency uses a synthetic fresh cache and a loopback-only ECB URL, so it cannot contact the external ECB. Other fixtures are synthetic local accounting records and generated small files. No production calls or paid APIs were used.

The shared test helper code is copied into each affected server so standalone mirrors do not depend on a sibling server's tests. It closes transport, retries bounded lsof checks for a briefly exiting child, records size/path, then removes its own directory. The final audit counted 58 deletion records totaling 938,800 bytes; every recorded path was absent. No fixture exceeded 50 MB. `git diff --check` exited 0.

## Actual refusal changes

- Time tracker: the third rated project and both 101st-entry creators.
- Invoice: both creators when the monthly invoice cap refuses creation.
- Price tracker: initial and post-fetch watch caps, manual-add cap, and free multi-watch refresh.
- Clauses: own-library cap, JSON import/export refusal, and over-limit assembly.
- Docx: capped proposal/contract creation and filling a template with more than ten placeholders. Placeholder inspection remains useful success.
- Kanban: project-board/open-task caps, custom columns and past weekly reviews.
- Recurring: active-schedule create/resume caps and Pro-only audit history.
- Calendar: direct URL-import refusal, extra calendars, and existing gated over-wide list/search/free-busy/export branches.
- Timezone: participant count, recurring search, contacts and monthly calendar-file cap.
- Bank statement: account cap, category-rule cap and Pro-only export.
- Expense tracker: project/mileage-project, category-rule, xlsx/row export and rebill-item refusal branches.
- Currency: a wholly historical range outside the readable window, through the existing refusal helper. Clamped ranges and conversions still return measured data.
- ZIP: entry, byte and monthly archive refusals across create/add/month bundle.
- Image: batch/output-size/custom-watermark refusals through its existing helper.
- PDF: merge/page-count/stamp/business-footer/reorder refusals through its existing helper.
- Spreadsheet: three no-write refusal results from `sheet_write`, `sheet_add_column`, and `sheet_convert`, preserving accompanying notes in the error text.
- Barcode: PNG/monthly/batch refusal helper.

Existing smoke/adversarial/contract assertions that explicitly required success for these complete refusals were corrected. Positive Pro calls and successful partial-output assertions remain unchanged.

## Successful output controls

The regressions retain ordinary success when useful work actually completes despite an upgrade note: invoice business profile and branded PDF; clamped time history; truncated price history; clause search with an unapplied tag filter; branded documents and placeholder inspection; recurring creation with downgraded anchor rules and its three-month forecast; calendar conflict scans over a clamped range; a shortened meeting search; bank/expense clamped results and free CSV; currency partial history and clamped conversion; existing ZIP reads; measured capped image colors; two-file PDF merge and inspection; truncated spreadsheet reads; and free SVG generation.

No lexical filter was introduced. The same upgrade prose can appear in useful output and in a complete refusal; the actual refusal branch now supplies the MCP error flag.

## Full source scan and precise limits

`R37-refusal-source-inventory.json` records an AST traversal of **281 JavaScript/TypeScript primary source files**, finding **155 actual `upgradeText` calls across 48 servers**, with path, line, enclosing function, statement excerpt and source hashes. Every occurrence was reviewed, including multiline calls, plain-success aliases with other names, and refusal-string helpers traced to callers. Searches additionally covered `gated`, `freeLimit`, `limit` and `withNotes` refusal paths. No further direct plain-success refusal wrappers were found in primary source after these seventeen fixes. This is source-review evidence, not functional certification of all estate tools.

Remaining semantics are explicit:

- Time-tracker wholly unread historical reports and ambiguous project-resolution questions retain normal non-error answers. Expense/bank historical empty or unread ranges likewise retain their existing reporting policy.
- Clauses import returns aggregate diagnostic JSON with added/replaced/skipped/blocked counts. Its all-new-rows-blocked case can report zero imported rows without an error, while partial imports remain useful successful results. This outcome-dependent policy is not changed by the wrapper repair.
- Full inline reports with a Pro-only optional file write, free clause-library titles/summaries, and complete matcher diagnostics with a refused optional save retain useful output and upgrade metadata.
- Generated `remote/src/vendor` is a separate integration input. The 08:11 UTC scan still found its old generated wrappers, so the coordinator must regenerate it, run its exact-patch gate, compile and test the hosted pipeline before publishing. This agent neither edited generated vendor files nor deployed anything.

## Failures and boundaries

The first post-build seven-server run found three new-test fixture mistakes: clause search returns metadata rather than body text; `invoice_pdf` requires `number`; docx's template cap is ten, so the negative fixture needs eleven. Correcting fixtures required no runtime algorithm change.

One ZIP cleanup observed a briefly exiting process. It refused deletion, as required; after confirmed closure the retained directory was manifested and removed. The helpers now retry bounded lsof checks, and the final 18-test run passed cleanup.

Old suites were not run wholesale: their existing temporary helper can remove directories without lsof, and some adversarial fixtures exceed the user's 50 MB fixture limit. The new focused controls obey those rules. No broad suite or full-estate release-green claim is made.

Cost: approximately 24 wall minutes across the two bounded assignments; zero paid calls. No commits, pushes, publication, shared-license edits, billing edits, remote edits or version bumps were performed by this agent. Primary runtime source is stable for coordinator vendoring and office repacking.
