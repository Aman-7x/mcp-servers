# Gate W3, answer pages truth check

Run 2026-11-06 against `data/s1106/content/W3-live.json` (12 pages). W3-live.json was not edited.

## Score 90 / 100

9 PASS, 3 FIX, 0 BLOCK.

Deductions. Three pages need copy fixes (minus 3 each). One advisory set (minus 1) covers a stale billing PRODUCTS line, raw call files that were overwritten, and one invoice number that names two different clients on sister pages.

## How each check was run

1. Claude capability. Every answer, native line and FAQ was compared with the facts in the brief. The code execution and file creation default was confirmed at https://support.claude.com/en/articles/12111783-create-and-edit-files-with-claude (on by default for Free, Pro, Max and Ultra on web, desktop and mobile) and https://claude.com/pricing. No page says Claude "cannot", "can't" or "is unable". No page mentions ChatGPT or Cursor.
2. Server claims. Each tool name was checked against `data/s1105/catalog_tools.txt` and `billing/src/index.js` line 2139 onward (hosted tool lists). Free and Pro limits were read from each server's `src/index.ts`. The hosted behaviour was read from `remote/src`. Prices were checked by importing PRODUCTS with node. Every server is usd 19, the bundle is usd 39, and `SINGLE_PRODUCT_IDS.length` is 49, so "$39 once for all 49 servers" holds.
3. Examples. Run `python3 ~/mcp-servers-work/gate-w3/cmp.py`. It deep-compares each example field with the JSON in the matching `calls/<slug>.<n>.<tool>.json` and checks that the args are equal. All 23 examples match with 0 field differences, and every args object is identical. The letter_render text equals the raw `letter` field apart from one trailing newline. Both leave examples marked "shown in full" equal the raw response exactly. I recomputed the arithmetic by hand. The 5-year MACRS rows sum to 3,499.00. The 7-year rows match Pub 946 A-1 (14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93 and 4.46 percent). USD 1,350 at 1% for 38 days on a 30-day month comes to 17.10. 38, 17 and 8 days late are all correct.
4. Copy. Control test first. A bad string gave exit 1 with 2 hard fails, so the scanner works. Then `python3 -I ~/Desktop/humanize/scan.py prose/*.md` over every prose field gave 0 hard fails, exit 0, and 11 soft "this_is_opener" warnings (from "This is a shortened copy" in the notes). A regex pass found 0 colons, 0 em or en dashes, 0 double hyphens and 0 exclamation marks in prose. HUMANIZE banned words came to 0. A soft point is that every `needs` list has exactly three items (rule of three). It is not a fail.
5. Tokens. In W3-live.json, `anon_` gave 0 hits, 32-hex gave 0 hits and `http` gave 0 hits.

## Per slug

### create-invoices: PASS
The 3 a calendar month cap, the credit line and the Pro logo and prefix are confirmed at `servers/invoice/src/index.ts:23,202-204,525-529,845-859`. The hosted invoice_pdf returns a one-hour HTML link (`calls/create-invoices.2.invoice_pdf.json`). The example matches `calls/create-invoices.1.invoice_create.json`.

### find-overdue-invoices: PASS
overdue_report keeps unpaid and partial invoices, sorts worst first and gives totals per currency (`servers/invoice/src/index.ts:869-887`). It uses total minus paid and leaves credit notes out, so FAQ 2 is true. "Partly" is fair because it does not deny the sandbox capability.

### make-a-credit-note: PASS
The cap of 5 documents a calendar month across both kinds is at `servers/billing-docs/src/index.ts:31,611`. The PDFs are Pro (`:716,979`) and the report is Pro (`:1135`). These match PRODUCTS at `billing/src/index.js:42`.

### create-purchase-orders: PASS
purchase_order_receive keeps a partial delivery open (`servers/billing-docs/src/index.ts:1049-1051`). The statuses open, partially_received and received are at `:938`. The example uses `unit_price_minor`, which the schema accepts (`:99`), and the result matches the raw call.

### write-a-payment-reminder: PASS
3 unpaid invoices chased at once on free (`servers/dunning-letters/src/index.ts:23,137`), Markdown or HTML (`:231`). The late fee appears only in reminder 2 and the final notice (`letters.ts:89-122`). Interest is simple on a 30-day month (`engine.ts:152-160`). PRODUCTS `billing/src/index.js:59` agrees.

### track-accounts-receivable: PASS
Aging is uncapped and statements are capped at 5 a month with rebuilds free (`servers/statement-of-account/src/index.ts:38,158-160,188`). The PDF (`:359`), the level 3 final demand (`:484`) and statements_report (`:551`) are Pro. dunning_text includes the bank lines (`:460-464`). In the raw response, Bayline is in the 31-60 bucket and Harbor Dental in the 0-30 bucket, as the note says.

### read-bank-statements: FIX
Every other claim checks out. The free tier has 2 accounts, a 12 month window and 5 rules (`servers/bank-statement/src/index.ts:25-27,260,413`). The 30-day TTL is refreshed on every write (`remote/src/index.ts:72`).

FAQ 1 is not exact. A PDF is refused only on the `url` upload path (`remote/src/shims/bank-upload.ts:100-113,126`). A PDF sent as `content_base64` is stored, and it fails later at statement_import header detection (`servers/bank-statement/src/detect.ts:307`).

Replace faq[0].a with this text.
> No. The server imports delimited text such as a CSV export. A PDF sent by link is refused, and one sent as bytes fails at import. Claude can still read the PDF itself in the chat.

### calculate-depreciation: PASS
Free covers 10 assets, unlimited schedules, listing and disposals. asset_journal and asset_report are Pro (`servers/asset-register/src/index.ts:21,204,378,579`). Year or month granularity is at `:297`. The page does not repeat the README's Pro overstatement. One optional point is that meta "the math is simple" sits a little against the answer's "the risk is in the inputs". It is not a truth defect.

### make-an-onboarding-plan: PASS
Free allows one hire per apply. Applying to many hires and as_csv are Pro (`servers/onboarding/src/index.ts:36,245-246,290-297`). PRODUCTS `billing/src/index.js:64` agrees.

### create-work-orders: PASS
Free allows 5 open orders (`servers/work-order/src/index.ts:31,236`). The PDF (`:577`) and the invoice payload (`:635`) are Pro. The example matches the raw calls. The advisory is that the two parts add_line responses were overwritten by the labour call (same file name, `create-work-orders.0.work_order_add_line.json`). The args with 20% markup exist only in `content/run11.py:7-8` (8600 and 1250 minor). They agree with 103.20, 15.00 and materials 13320 in the surviving responses.

### track-employee-leave: FIX
Server claims are true. Leave is uncapped on free, and leave_import and leave_export_ics are Pro (`servers/leave/src/index.ts:13,352,400`). Every calendar day is counted (`leave.ts:61-62`), and personDays 5 is a count of people per day, not leave days.

The answer undersells Claude. It leaves out that Claude can build a leave tracker spreadsheet with file creation, and it says "A chat keeps no record" although memory is on by default. That is the same "Claude cannot" pattern that failed two earlier gates.

Side defect, outside this page. PRODUCTS `billing/src/index.js:68` says Pro is "unlimited policies and the CSV export of requests and balances". The free line names "the leave calendar and the annual report". None of these exists in the leave source. The page is right and PRODUCTS is stale. Fix PRODUCTS to "bulk CSV import of requests and the .ics export of approved leave".

Replace the answer with this text.
> Partly. Claude can count days off from a list you paste, draft a leave policy and, with code execution on (the default on Free, Pro and Max), build a leave tracker spreadsheet. That file changes only when you ask for a new version, so requests, approvals and balances live in whichever copy you saved last. Connect the Leave server (free token) and Claude adds employees with their yearly allowance and carry-over, records vacation, sick, unpaid and parental requests, approves or rejects them, and shows balances and who is out in any date range.

Replace native with these two lines.
> "Counts days off from a list you paste and drafts a leave policy."
> "Builds a leave tracker spreadsheet when code execution is on."

Replace meta_description with this text.
> Partly. Claude can add up days and build a tracker file. The Leave server keeps each request and approval, and shows balances and who is out on any day.

### keep-a-mileage-log: FIX
Server claims are true. Free has 20 trips a month (`servers/mileage-log/src/log.ts:27`, `index.ts:187-194`) and one rate per jurisdiction and category (`index.ts:313`). The export is Pro (`:417`). PRODUCTS `billing/src/index.js:63` agrees.

The answer has the same omission as the leave page. Claude can build a mileage log spreadsheet with file creation, and "A chat keeps no log" ignores this.

Replace the answer with this text.
> Partly. Claude can total the miles in a list you paste and multiply by a rate, and with code execution on (the default on Free, Pro and Max) it can build a mileage log spreadsheet. That file grows only when you upload it again and ask for a new version. Connect the Mileage Log server (free token) and Claude logs each drive as business, medical, moving, charitable or personal, prices it at the rate you set for the day it was driven, and totals the deductible amount for any period. No rate ships with it, so you enter the one you use.

Replace native with these two lines.
> "Totals the miles in a list you paste."
> "Builds a mileage log spreadsheet when code execution is on."

Replace meta_description with this text.
> Partly. Claude can total trips and build a log file. The Mileage Log server keeps every drive with its purpose and prices it at the rate in force that day.

## Advisories, no change required to pass
- INV-2026-0001 is Maple Street Bakery on create-invoices but Bayline Logistics on find-overdue-invoices, write-a-payment-reminder and track-accounts-receivable. These were separate tokens, so each is true, but a reader moving between the pages sees one number with two clients.
- The help center now lists Ultra next to Free, Pro and Max. "(the default on Free, Pro and Max)" is still true.
- The mileage example rate of USD 0.76 is stored under jurisdiction "US federal". The note already tells readers to check it against the published rate.
