# R36 organic distribution and new workflow evidence

Measured 2026-10-16 UTC. Status: local metadata patch complete; root owns publication. No paid API calls, account creation, messages, comments, pushes or deploys performed by this agent. Initial disk check: `df -g /System/Volumes/Data` returned Avail=51 GB.

## Deliverable 1: surface an existing quote-to-invoice workflow

`scripts/mirror-seo.py` now describes quotes as "quote-to-invoice conversion: create price quotes, estimates and proposals, then convert an accepted quote to an invoice" and adds `quote-to-invoice` to its existing topics. This changes the generator used by both mirror publication paths, so the next mirror sync retains the metadata. Existing estimate/proposal vocabulary stays present. No fleet rename or registry alias.

Evidence the capability exists: `servers/quotes/src/index.ts:637` registers `quote_accept`, which copies stored quote numbers into the shared invoice store when available, otherwise returns `invoice_create`-ready items. `node --test servers/quotes/test/smoke.test.mjs` passed 6/6, including "create, revise, text-export and accept a quote; the invoice carries the same numbers" and the absent-invoice-store fallback. `python3 scripts/mirror-seo.py check` returned `48/48 published servers described`.

Root publication command: `node scripts/apply-mirror-seo.mjs quotes`. This updates the targeted mirror description/topics/README via the existing publisher. This agent has not run it. Read-only follow-up: `node scripts/r36-organic-probe.mjs`. Do not claim ranking lift until the changed metadata is publicly visible and the same query instrument surfaces it.

### GitHub baseline

Command: `node scripts/r36-organic-probe.mjs`, completed `2026-10-16T00:27:38.405Z`. Calls `gh api -X GET search/repositories -f q=<query> -F per_page=10`; checks `incomplete_results` and runs a positive control before believing zero. Positive control `modelcontextprotocol`: 1,346 repositories, first `modelcontextprotocol/modelcontextprotocol`.

| Query | Total repositories | Our rank in top 10 |
| --- | ---: | ---: |
| mcp quote estimate proposal | 1 | 1 |
| mcp quote invoice | 30 | 5 |
| mcp quote conversion | 0 | absent |
| mcp convert quote invoice | 0 | absent |
| mcp work order field service | 3 | 1 |
| mcp accounts receivable aging | 2 | 2 |
| mcp three way matching | 1 | no estate server |
| mcp supplier invoice matching | 2 | no estate server |

These are repository-search coverage measurements, not query volume, traffic or willingness to pay. The existing small niches already surface zero-star estate repos. That makes accurate capability vocabulary a plausible next step; it does not establish an SEO revenue forecast.

## Deliverable 2 recommendation: a line-level three-way invoice matcher

Recommend a new `three-way-match` server only if it ships a specific documented result: detect a supplier invoice that agrees in grand total but disagrees by SKU with the PO and accepted delivery quantities. Accept caller-supplied structured documents; report evidence and exceptions without claiming OCR, sibling-store integration or payment approval.

### Primary evidence of a real workflow and specific failures

- [AvidXchange, 2-way vs. 3-way matching](https://www.avidxchange.com/blog/2-way-vs-3-way-matching-faqs-pros-cons/), read live with `web.open`: quantities can disagree between invoice/PO/receipt, totals can disagree, and unexpected shipping costs can create exceptions. Their published tolerance example orders 100 packages and distinguishes invoices for 102 vs115 under a 5% tolerance. This establishes concrete AP checks, not demand for this product.
- [Precoro, 3-way matching](https://precoro.com/blog/why-implementing-3-way-matching-is-important/), read live with `web.open`: the documents must match in quantity, unit price, total and PO number; partial delivery or missing receipt matters. It distinguishes physical-goods purchases from services. Do not promise this automatically validates every service invoice.
- [nicolaltafini/invoice-reconciliation-agent](https://github.com/nicolaltafini/invoice-reconciliation-agent), fetched with `gh api repos/nicolaltafini/invoice-reconciliation-agent/readme --jq .content | base64 --decode`: the maintainer's example bills 25 circuit breakers after 20 were delivered, with EUR 62.50 at risk. Its README requires Docker/PostgreSQL and an Anthropic API key. It has deterministic matching and structured invoice parsing already: our distinction is installation scope and a caller-supplied data contract, not invention of matching.

### Competitor source establishes a defensible narrower distinction

[zavora-ai/mcp-procurement](https://github.com/zavora-ai/mcp-procurement) already offers a local zero-configuration procurement server with 37 tools, including `three_way_match`. Do not claim this market has no local MCP matcher.

Command: `gh api repos/zavora-ai/mcp-procurement/contents/src/server.rs --jq .content | base64 --decode`, inspected lines 281-300 at retrieval time. [Source](https://github.com/zavora-ai/mcp-procurement/blob/main/src/server.rs#L281): it sums received quantities across every line/SKU and compares that aggregate with the sum ordered; it compares the whole invoice amount with PO total using floating-point values. A within 2% amount difference selects `within_tolerance` even when `qty_match` is false. The input is a whole invoice amount, not priced invoice lines. Thus equal aggregate quantities can hide one SKU short and another over, and equal totals cannot identify unit-price changes offset by other lines.

Implementation acceptance example, newly designed for this server (not a competitor runtime test): PO A 10 at 100 cents and B 10 at 100 cents; receipt A 5/B 15; invoice A 10/B 10. Every document totals 20 units, invoice/PO value 2000 cents. A line-aware report must flag A 5 units billed but unreceived and B 5 received beyond order. The aggregate competitor code would regard aggregate quantity and amount as matching by inspection; no competitor runtime was run.

### Implementable scope

- One deterministic `three_way_match` tool with PO supplier/reference/currency + SKU quantities/unit prices, a list of dated receipts with accepted/rejected quantities, and one supplier invoice with its PO reference, currency and priced lines. All amounts integer minor units; bounded scaled quantities; reject duplicates, ambiguous lines, invalid references and unsafe integers.
- Identify missing/unordered SKU, per-SKU short delivery, billed quantity above accepted receipt, unit-price mismatch, currency/reference mismatch, and invoice total inconsistent with supplied lines. No silent currency conversion or fuzzy SKU matching. Return the three source values alongside each exception, rather than just a confidence score.
- Partial delivery is allowed when invoiced quantity is no higher than accepted receipts and agreed PO quantity. Missing receipt is an explicit exception. Tolerances must be visible and must never make a missing SKU/receipt disappear.
- Optional saved report/list/get + CSV export using ordinary project storage conventions. Free checks should be usable; Pro can remove saved-report limits. No document parsing, ERP credentials, payment execution or approval assertions.
- README with the offsetting-SKU example and a second partial-delivery success case; install instructions that actually work; exact free/Pro limits and checkout. Public standalone mirror plus a guide answers "How do I check a supplier invoice against my purchase order and delivery note in Claude?"
- Required verification: offsetting SKU quantities; quantity rejection; price offsets that preserve grand total; partial delivery; multiple receipts; currency mismatch; missing/duplicate SKU; decimal quantities and integer money boundaries; free/Pro gates; MCP stdio smoke; hosted call if it is advertised as hosted. Publish one real capability, not multiple registry names for it.

Measured search whitespace: the GitHub baseline above has 1 result for `mcp three way matching` and 2 for `mcp supplier invoice matching`. The one matching repo is [Procure](https://github.com/akhilkrishnankv/Procure), whose description includes Odoo, LangGraph and GPT4o Vision. Broader `mcp invoice reconciliation` returned 17 repositories; the category is occupied. Narrow line-evidence + no-key/no-ERP setup is the proposed product distinction. No willingness-to-pay evidence has been measured; the release should be judged by public install success and subsequent human arrivals, not listing count.

## Deliverable 3: repair indexed bank-statement promises

A free public search for `MCP server reconcile incoming bank payments unpaid invoices local` returned our [mcpservers.org listing](https://mcpservers.org/servers/mcp-zovo-one-s-bank-statement) at position 4 with a PDF/CSV parsing claim. Current `servers/bank-statement/src/index.ts:221` imports CSV; `reconcile_expenses` at 509 matches debits to expense entries, not incoming invoice settlements.

The project's own guide `billing/src/content.js:9854`, `bank-statement-pdf-to-excel-in-chat`, repeats unsupported claims: it says this server reads PDF layout, extracts date/amount/balance and checks running balances. Root has assigned its correction to the conversion owner. Honest replacement: "Turn a bank CSV export into categorised Excel rows from chat. Import the bank's CSV, apply rules, export CSV. PDFs require separate extraction and verification before this server can import rows."

Directory correction draft: "Import bank-statement CSV exports, categorise transactions, summarise accounts and reconcile bank debits with logged business expenses. Local operation; no PDF/OCR extraction, bank connection or automatic payment posting. Free tier available; one-time Pro license." Direct page curl returned 403, so this run verifies the indexed snippet, not the live body. `gh search` found no demonstrated authoritative public source repo for that directory entry; no correction submitted, no email sent.

## Public search footprint and Glama controls

Followed treg skill discovery but only called the specifically free `tinyfish.web.search` endpoint with `X-Treg-Route-Max-Cost: 0`; did not call the routed search capable of paid fallback. Each CLI call reported `$0`.

Commands follow this form: `treg call tinyfish.web.search --query 'query=<q>' --query domain_type=web --header 'X-Treg-Route-Max-Cost: 0'`.

| Query | Response evidence | Call id |
| --- | --- | --- |
| Model Context Protocol official specification | 9 results, first modelcontextprotocol.io specification | 4b8e85b49ce1480794372554449702fa |
| site:mcp.zovo.one | 2 URLs: homepage and /mcp/time-tracker | 6df649d1b7c648b7b1d4b67302541adf |
| MCP server convert accepted quote estimate invoice Claude | 8 results; competitor products, GitHub workflow and Glama tool page; no estate URL | ab017f4f61b34523a1989ad0da04bc07 |
| MCP server three way matching supplier invoices purchase orders goods receipts | 8 AP articles, no MCP install page | a78b2514fe694025a50a5cc0c5ad8d97 |
| MCP server compare supplier quotes procurement | 9 results incl. zavora-ai/mcp-procurement | e5dbedd17a474eccb11e4501684a7f2c |
| MCP server reconcile incoming bank payments unpaid invoices local | 9 results; ours directory snippet at 4 | b6f8b21b07f84b0e952307ad3cf14d20 |

A site: query is not a census of indexed pages, and one provider is not Google Search Console. The measured conclusion is sparse retrieval in this instrument. Do not call it zero indexed pages.

Glama direct `curl -sSL --max-time 25 -w '%{http_code}'` probes: `/mcp/servers/theluckystrike/mcp-statement-of-account` returned 200 and title `mcp-statement-of-account by theluckystrike | Glama` (positive control); `/mcp/servers/theluckystrike/mcp-quotes` returned 404. Product `/s/quotes` returned 200. These establish sampled public-page presence/absence, not a fleet count. Badge API redirects are not listing proof. Full Glama/account submission is outside this agent's publication scope.

## Artifacts and cleanup

- Changed: `scripts/mirror-seo.py` (quotes capability/topics only).
- Added: `scripts/r36-organic-probe.mjs` (read-only positive-controlled search instrument).
- Added: this report.
- Raw temporary HTML snapshots used only for title/status checks will be removed after an open-file check, with bytes and paths recorded below. No user files or agent session files are deleted.

Deletion manifest: 293951 bytes, `/Users/mike/mcp-servers/intel/r36-glama-control.html`; created in this task, `lsof` returned no open handles; removed.

Deletion manifest: 52 bytes, `/Users/mike/mcp-servers/intel/r36-glama-quotes.html`; created in this task, `lsof` returned no open handles; removed.

Deletion manifest: 47313 bytes, `/Users/mike/mcp-servers/intel/r36-quotes-live.html`; created in this task, `lsof` returned no open handles; removed.

Deletion manifest: 5484 bytes, `/Users/mike/mcp-servers/intel/r36-directory-bank.html`; created in this task, `lsof` returned no open handles; removed.
