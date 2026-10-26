# R38 organic distribution and one new workflow candidate

Measured 2026-10-26. Scope: free public primary pages, documented GitHub read API, exact Registry GETs and local repository sources. No paid calls, outreach, account creation, sign-in or remote mutation by this agent.

## Finding and implemented change

The existing focus mirrors already carry working product/demo links, accurate source installation instructions, explicit npm-unpublished warnings and pricing. Rewriting search metadata would not resolve an observed gap. Both focus source READMEs, however, lacked those free proof links and did not direct a reader to the companion workflow.

Added a short browser-proof paragraph, product link and two-row task comparison to `servers/three-way-match/README.md` and `servers/duplicate-invoice-check/README.md`. The comparison distinguishes one invoice against PO/accepted receipts from repeated references across a supplied history batch. It states the actual paid value: removing the three-saved-report limit. The bundle includes both. These edits are ready for orchestrator mirror publication; this agent did not publish them. Organic traffic or revenue improvement remains unproven.

Validation commands:

- `git diff --check -- servers/three-way-match/README.md servers/duplicate-invoice-check/README.md`
- `python3 scripts/mirror-seo.py check` returned `50/50 published servers described`; seven older free directories are pending mirrors.
- Public GETs of both linked guide URLs verified HTTP200 and the exact `matcher-demo`/`duplicate-demo` fragment IDs. See `data/r38_distribution_readme_verification.json`. This verifies link targets, not fresh browser/runtime correctness.

## Current discoverability

`data/r38_distribution_github.json` preserves the original eight frozen R37 query texts, complete public result projections and both focus README hashes. Command shape: `gh api --method GET 'search/repositories?q=<encoded frozen query>&per_page=20'`; exact texts are in `data/r37_organic_queries_frozen.json`. All responses report complete results and fit the page.

| Frozen query ID | Duplicate mirror position / total |
| --- | --- |
| buyer_duplicate_invoice | 1 / 8 |
| buyer_supplier_invoice | 1 / 1 |
| buyer_vendor_bills | 1 / 2 |
| buyer_invoice_duplicate_check | 1 / 1 |
| exact_capability | 2 / 7 |
| exact_mirror | 1 / 1 |

Positive controls: the matcher is first of 11 for `mcp three way match in:name,description`; the frozen competitor exact-name query returns its expected single result. These are metadata-search observations, not search volume, people, installations or causal ranking improvement.

Exact public GETs in `data/r38_distribution_surfaces.json` verify:

- [Duplicate source listing on Glama](https://glama.ai/mcp/servers/theluckystrike/mcp-duplicate-invoice-check): HTTP200, correct title and exact source GitHub repository. This was HTTP404 in the retained R37 snapshot and is now independently confirmed listed.
- [Matcher source listing on Glama](https://glama.ai/mcp/servers/theluckystrike/mcp-three-way-match): HTTP200 and exact source repository.
- Both exact [Registry latest routes](https://registry.modelcontextprotocol.io/v0.1/servers/io.github.theluckystrike%2Fduplicate-invoice-check/versions/latest) return structured server documents. Registry presence is upstream distribution evidence, not customer acquisition.
- Both focus product pages return the expected title/canonical and relevant guide links. HTTP200 alone does not establish Google indexing.
- The attempted public directory search returns HTTP403 with a challenge title. This is observation failure, not proof that a listing is absent. Prior free submissions remain pending unless a real listing or curator receipt proves otherwise. Do not resubmit blindly.

The GitHub literal `no_unpublished_npx:false` field is deliberately annotated: the command appears in an explicit warning that it fails. Reading the surrounding text verifies that no unpublished npx path is recommended.

## Current platform rules

The [current GitHub search documentation](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories) confirms default repository search uses name, description and topics; README requires an explicit qualifier. The [current Glama FAQ](https://glama.ai/mcp/faq) describes repository-based discovery. The now-live duplicate listing is evidence that the existing source/indexing path worked; it does not identify which upstream caused discovery.

The [current Smithery publication guide](https://smithery.ai/docs/build/publish) supports local MCPB publication and bundle distribution. Local stdio servers do not need a fabricated remote endpoint to fit this route. Authentication/publication remains a separate gate; no account or CLI publication was attempted. Prior login-gated findings are not treated as a fresh account check.

Used the treg skill for initial discovery. Its closest GitHub routes advertised nonzero prices, so none were called. Public native APIs and primary documents supplied the evidence for $0 API spend. Details: `data/r38_distribution_research.json`.

## The requested platform study

The requested original path has moved to `/Users/mike/Desktop/research/platform-analysis-2026/index.html`. Read all 168,257 bytes; SHA256 `ef9a60f6ff3367b1bbce8e64d5d0adeee93553591e328d5d8bf220a7e75afadc`, matching retained R36 provenance. Command: Python `Path(resolved_path).read_bytes()` and `hashlib.sha256(bytes).hexdigest()`. No COLDSTORE restore was needed and no private financial exports were copied.

Its September 1–2 results are historical background. The study assigns MCP a 20% experimental allocation, explicitly notes lack of native billing and warns that production throughput does not establish realized revenue. Its empty-slot and platform scores are not current demand measurements. Current checkout/GSC evidence must govern commercial claims.

## One new server candidate: supplier-statement-check

Recommendation: one small workflow experiment, not another broad accounting suite. Compare a supplier's supplied open-item statement with a supplied AP open-item export. Report invoices or credit notes appearing on only one side, conflicting amounts/dates, and ambiguous repeated references. This is distinct from the existing customer-facing AR statement generator, bank debit/expense matching, batch duplicate review and PO/receipt SKU comparison.

The [primary AutoEntry workflow documentation](https://help.autoentry.com/en/articles/2459511-reconcile-a-supplier-statement) confirms an established supplier-statement versus purchase-invoice reconciliation workflow, explicit supplier selection, exact automatic matches and manual resolution of discrepancies. This establishes that the job exists, not willingness to pay for this implementation. Its feature description is not copied into product claims.

`data/r38_distribution_candidate_queries.json` froze six queries before execution. Command shape: `gh api --method GET 'search/repositories?q=<encoded query>&per_page=30'`. Complete arrays in `data/r38_distribution_candidate.json`:

| Query, all `in:name,description` | Results |
| --- | ---: |
| mcp supplier statement | 1 |
| mcp vendor statement | 0 |
| mcp supplier reconciliation | 3 |
| mcp statement reconciliation | 5 |
| mcp accounts payable | 17 |
| mcp three way match, positive control | 11 |

Do not describe this as an empty market or first/only server. Metadata searches can miss README-only functionality. The closest public primary READMEs were read through `gh api repos/<owner>/<repo>/readme`; hashes and relevant lines are retained in `data/r38_distribution_competitors.json`:

- [ledger-mcp](https://github.com/JuampiMasyk/ledger-mcp): invoices against payments, with synthetic ledger/evals.
- [Fortnox MCP](https://github.com/Walma-Labs/fortnox-mcp): accounting API, supplier invoices and ageing, requiring the user's Fortnox account.
- [CSV reconciliation MCP](https://github.com/Ivansky1/unlav-data-tools-mcp): a real generic exact-key substitute; hosted and pay-per-call. Domain-specific typed money and complete accounting evidence would need to earn the difference.
- [Finance reconciliations API](https://github.com/bookchaowalit/finance-reconciliations-api): generic hosted reconciliation API/database scaffolding.

None of these four READMEs explicitly describes comparing supplier open-item statements with a separate AP export. No competitor runtime was tested.

### Exact proposed implementation contract

Implement only after orchestrator allocates ownership. This report is a reviewable build brief, not a delivered server.

- Local stdio `@theluckystrike/mcp-supplier-statement-check`, tool `supplier_statement_check` plus the established report list/get/page/delete/CSV and licensing tools.
- Inputs: `statement_records`, `ledger_records`, `save:false`. Each side allows 0–1000 records, with at least one total. Each record has unique side-local `record_id`, exact `entity_id`, `supplier_id`, uppercase three-letter `currency`, `document_type:invoice|credit_note`, exact `document_reference`, real `document_date`, positive safe-integer `outstanding_minor`. Credit notes use positive absolute outstanding values and compare only with credit notes. Reject unknown fields and controls/outer whitespace. Label input explicitly as open items on a common date chosen by the user.
- Match only within exact `(entity_id,supplier_id,currency,document_type,document_reference)`. Never infer supplier identity, remove punctuation, strip leading zeros or match amounts greedily. Repeated keys on either side are ambiguous; retain every source row and do not select a winner.
- Output deterministic complete evidence: `matched`, `only_in_statement`, `only_in_ledger`, `amount_mismatch`, `date_mismatch`, `ambiguous_reference`, source IDs and original fields. Status may say `no_discrepancies_in_supplied_open_items`; never `safe_to_pay` or a claim that supplier balances reconcile. No aggregate loss estimate.
- Explicit boundaries: no PDFs/OCR, ERP connection, payment matching, full opening/closing balance reconciliation, tax interpretation, writeback, payment approval, hidden saved history or completeness guarantee. Two stale/incomplete exports can agree while both are wrong.
- Free includes every diagnostic and complete paged/CSV evidence, including unsaved previews. Pro $19 removes only the three-saved-report cap; $39 bundle includes it. This repeats the current unvalidated commercial model, so payment conversion remains a hypothesis.
- Tests before publication: independent exact-key oracle; shuffled-order determinism; every-row coverage; invoice/credit and entity/supplier/currency isolation; repeated-reference ambiguity; Unicode/leading-zero negatives; dates/unsafe money; CSV formula escaping; response budget/paging; free-save cap preserving diagnosis; real stdio calls; clean-clone mirror build; exact downloaded MCPB call; no hosted install claim.
- Distribution deliverable: one source README with explicit phrase `supplier statement reconciliation` and `vendor statement`, one standalone mirror, correct official Registry row, live free synthetic browser proof, exact download and all client configurations. Re-run the frozen candidate queries after public indexing. Do not count platform receipts as buyer validation.

Commercial decision: public evidence supports a narrow workflow/distribution experiment. It does not prove positive ROI. Pooled hosted counters cannot rank server demand: the KPI agent confirmed that successful responses are pooled and unattributed. Do not fabricate a usage-led product pick. Additional product count should not be reported as revenue progress; measure unmarked demo starts, successful useful calls, real checkout handoffs and paid completions with operator probes excluded.
