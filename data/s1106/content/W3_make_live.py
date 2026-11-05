#!/usr/bin/env python3
"""s1106 W3: build content/W3-live.json (same entry schema as s1105 content/W2-live.json and can-claude-live.json) from raw calls in
~/mcp-servers/data/s1106/calls/ (gitignored). Calls were made on 2026-11-05 between 17:45 and 18:00 UTC (2026-11-06 Mac time) through
https://mcp.zovo.one/mcp/<id>/t/<token> with two free tokens minted at /mcp/connect (content/w3lib.py, run1.py to run15.py).
Token 1 profile Reyes Studio (design studio), token 2 profile Ortiz Refrigeration (create-invoices, create-work-orders).
Results are the server's own text. Edits, each stated in the note when it applies:
(1) the 'Free tier: 600 calls/hour ...' footer is dropped because it carries the token, (2) one-hour download links show as <download link>,
(3) JSON answers may be shortened to a subset of fields, with every shown value unchanged. When the server answers with a line and then
JSON (invoice_create), the subset is taken from the JSON block."""
import json, os, re
CALLS = os.path.expanduser('~/mcp-servers/data/s1106/calls')
OUT = os.path.expanduser('~/mcp-servers/data/s1106/content/W3-live.json')
RUN = '2026-11-05'
TOKRE = re.compile(r'anon[_:][0-9a-f]{6,}|tenant=')

def raw(f):
    return json.load(open(f'{CALLS}/{f}.json'))

def clean(t):
    t = '\n'.join(l for l in t.splitlines() if not l.startswith('Free tier: 600 calls/hour'))
    return re.sub(r'https://mcp\.zovo\.one/mcp/download/[0-9a-f]+', '<download link>', t).strip()

def body(f):
    r = raw(f)['response']['result']
    assert not r.get('isError'), f
    return clean('\n'.join(c['text'] for c in r['content'] if c.get('type') == 'text'))

def nosecret(s, f):
    assert not TOKRE.search(s), f'token in {f}'
    return s

def text(f):
    return nosecret(body(f), f)

def js(f):
    t = body(f)
    return json.JSONDecoder().raw_decode(t[t.index('{'):])[0]

def keep(d, keys):
    return {k: d[k] for k in keys}

def pick(f, keys, sub=None):
    d = js(f)
    if sub: d = sub(d)
    return nosecret(json.dumps(keep(d, keys), ensure_ascii=False), f)

def field(f, k):
    return nosecret(clean(js(f)[k]), f)

def ex(f, prompt, result, note=''):
    r = raw(f)
    return {'prompt': prompt, 'tool': r['tool'], 'args': dict(r['args']), 'result': result, 'note': note, 'is_error': False, 'run': RUN}

LINK = 'Download links last one hour, so they are shown here as <download link>.'
SHORT = 'The server answers in JSON. This is a shortened copy, and every field shown is unchanged.'
CODE = 'With code execution on (the default on Free, Pro and Max)'
code = CODE[0].lower() + CODE[1:]
def PRO(server_name, adds):
    return f'Pro is $19 once for the {server_name} server, or $39 once for all 49 servers. ' + adds
KEEP30 = {'q': 'Where is my data kept?', 'a': 'On the hosted server your records are kept for your token for 30 days, refreshed on every write. Install the server locally if you want nothing to leave your machine.'}

P = []
def page(slug, sid, h1, title, query, meta, answer, native, needs, e1, e2, faq):
    P.append({'slug': slug, 'repo': sid, 'server_id': sid, 'h1': h1, 'title': title, 'query': query, 'meta_description': meta, 'answer': answer,
              'native': native, 'needs': needs, 'example': e1, **({'example2': e2} if e2 else {}), 'faq': faq})

def lines(keys):
    return lambda d: {**d, 'lines': [keep(l, keys) for l in d['lines']]}

# 1 Invoice: create invoices (token 2)
page('create-invoices', 'invoice', 'Can Claude create invoices?', 'Can Claude create invoices? Numbered, saved and tracked', 'can claude create invoices',
 'Yes, as a document. The Invoice server also numbers each invoice, keeps it for later chats and records what each client has paid.',
 f"Yes, as a document. Claude can lay out an invoice from what you tell it, and {code} it can write it as a PDF or Word file. Projects and memory can keep your business details. What a chat does not keep is a number series that never repeats, or a record of what each client has paid. Connect the Invoice server (free token) and Claude creates invoices with the next number, saves them, records full or part payments and lists what is overdue.",
 ['Lays out an invoice from a list of items.', 'Writes it as a PDF or Word file when code execution is on.'],
 ['Invoice numbers that are never reused.', 'Full and part payments recorded against each invoice.', 'An overdue list across every client.'],
 ex('create-invoices.1.invoice_create', 'Invoice Maple Street Bakery for the cooler door job on work order WO-2026-0001.',
    pick('create-invoices.1.invoice_create', ['number', 'client', 'issue_date', 'due_date', 'total', 'status', 'lines']),
    'The client was saved with client_add first. The server answers with one line and then JSON. This is a shortened copy of the JSON, and every field shown is unchanged.'),
 None,
 [{'q': 'Does it create invoices in QuickBooks or Xero?', 'a': 'No. It keeps its own invoices and numbers under your token, and it writes nothing to QuickBooks or Xero.'},
  {'q': 'Do I get a PDF?', 'a': 'On the hosted server invoice_pdf returns a one-hour link to an HTML invoice that you print to PDF from the browser. A local install writes the PDF file.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Three invoices a calendar month, payments and the overdue report are free, and the free invoice page carries a small credit line. ' + PRO('Invoice', 'It adds unlimited invoices, your logo with no credit line, and a custom number prefix.')}])

# 2 Invoice: overdue report (token 1)
page('find-overdue-invoices', 'invoice', 'Can Claude find overdue invoices?', 'Can Claude find overdue invoices? Days late and totals', 'claude overdue invoice',
 'Partly. Claude can sort an invoice list you upload. The Invoice server keeps every invoice and lists the unpaid ones past due, worst first.',
 f"Partly. {CODE} Claude can read an invoice export you upload and sort out what is past due. A chat does not hold your invoices and payments, so its list is only as current as the file you gave it. Connect the Invoice server (free token) and Claude lists every invoice not paid in full whose due date has passed, worst first, with days overdue, the amount still open and a total per currency. Part payments you recorded are taken off.",
 ['Sorts an invoice export you upload by due date.', 'Drafts a reminder email for a late client.'],
 ['Every unpaid invoice past its due date, worst first.', 'Part payments taken off the amount still open.', 'A total per currency, never added across currencies.'],
 ex('find-overdue-invoices.1.overdue_report', 'Which invoices are overdue?',
    pick('find-overdue-invoices.1.overdue_report', ['as_of', 'count', 'invoices', 'totals_per_currency'], lambda d: {**d, 'invoices': [keep(i, ['number', 'client', 'due_date', 'days_overdue', 'outstanding']) for i in d['invoices']]}),
    'Three invoices were created and USD 500.00 was paid on INV-2026-0001 first. ' + SHORT + ' INV-2026-0002 also has a USD 150.00 credit note in the Billing Docs server, and this report shows the invoice before that credit.'),
 ex('find-overdue-invoices.2.invoice_list', 'Which invoices are part paid?',
    pick('find-overdue-invoices.2.invoice_list', ['count', 'invoices'], lambda d: {**d, 'invoices': [keep(i, ['number', 'client', 'due_date', 'total', 'status', 'paid', 'balance_due']) for i in d['invoices']]}),
    SHORT),
 [{'q': 'Does it send reminders?', 'a': 'No. It lists what is late. The Dunning Letters server writes reminder letters for each stage, and you send them.'},
  {'q': 'Does the report take off credit notes?', 'a': 'No. It works from invoices and payments in the Invoice server. The Statement of Account server ages each client balance with credit notes taken off.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'The overdue report, payments and the invoice list are free on every tier, and creating invoices is free for 3 a month. ' + PRO('Invoice', 'It adds unlimited invoices, your logo on the invoice page and a custom number prefix.')}])

# 3 Billing Docs: credit note
cn = lambda d: {**d, 'created': {**keep(d['created'], ['id', 'invoice_number', 'client', 'issue_date', 'total', 'reason']), 'lines': [keep(l, ['description', 'quantity', 'unit_price', 'amount']) for l in d['created']['lines']]},
                'invoice': keep(d['invoice'], ['number', 'total', 'credited_total', 'still_creditable'])}
BD_FREE = 'Five documents a calendar month, credit notes and purchase orders counted together, are free, and so are the plain-text versions and the lists. '
BD_PRO = 'It adds unlimited documents, the A4 credit note and purchase order pages, and the billing report of credits and late orders.'
page('make-a-credit-note', 'billing-docs', 'Can Claude make a credit note?', 'Can Claude make a credit note? Against the original invoice', 'claude credit note',
 'Yes, as a document. The Billing Docs server issues a numbered credit note against a saved invoice, line by line, and writes the text to send.',
 f"Yes, as a document. Claude can draft a credit note or credit memo from what you tell it, and {code} it can save it as a file. What a chat does not do is tie the note to the invoice it reverses, with its own number and the invoice's own prices. Connect the Billing Docs server (free token) and Claude credits a whole invoice, a gross amount or named lines of an invoice saved in the Invoice server, gives the note a CN number, and writes a plain-text version to paste into an email.",
 ['Drafts the wording of a credit note or credit memo.', 'Saves it as a file when code execution is on.'],
 ['A CN number and the invoice it reverses on every note.', "Credited lines priced from the invoice's own lines.", 'A plain-text note ready to paste into an email.'],
 ex('make-a-credit-note.1.credit_note_create', 'Credit Harbor Dental one hosting setup on INV-2026-0002. We billed it twice.',
    pick('make-a-credit-note.1.credit_note_create', ['created', 'invoice'], cn),
    'Invoice INV-2026-0002 for USD 2,700.00, with two hosting setup lines at USD 150.00, was created in the Invoice server first. ' + SHORT),
 ex('make-a-credit-note.2.credit_note_text', 'Write it up so I can email it to them.', text('make-a-credit-note.2.credit_note_text'), LINK),
 [{'q': 'Does it change the invoice?', 'a': 'No. The credit note is stored in Billing Docs with the number of the invoice it reverses, and the invoice record keeps its total. The Statement of Account server takes the credit off the client balance.'},
  {'q': 'What is free, and what does Pro add?', 'a': BD_FREE + PRO('Billing Docs', BD_PRO)}])

# 4 Billing Docs: purchase order
po = lambda d: {'created': {**keep(d['created'], ['id', 'supplier', 'issue_date', 'expected_delivery_date', 'status', 'total']), 'lines': [keep(l, ['description', 'quantity', 'unit_price', 'amount']) for l in d['created']['lines']]}}
page('create-purchase-orders', 'billing-docs', 'Can Claude create purchase orders?', 'Can Claude create purchase orders? Numbered POs to send', 'claude purchase order',
 'Yes, as a document. The Billing Docs server raises numbered purchase orders, writes the text to email the supplier and records what arrived.',
 f"Yes, as a document. Claude can draft a purchase order from a list of items, and {code} it can save it as a PDF or spreadsheet. Projects and memory can keep your supplier details. What a chat does not keep is a PO number series and the status of each order until the goods arrive. Connect the Billing Docs server (free token) and Claude raises a numbered purchase order with totals, writes a plain-text order to email the supplier, and records full or partial deliveries against it.",
 ['Drafts a purchase order from a list of items.', 'Saves it as a file when code execution is on.'],
 ['A PO number on every order that is never reissued.', 'Open, partly received or received status per order.', 'Each delivery kept with its date and note.'],
 ex('create-purchase-orders.1.purchase_order_create', 'Order 4 packs of business cards at USD 42 and one trade show banner at USD 185 from Mile High Print Co, delivered by 13 November.',
    pick('create-purchase-orders.1.purchase_order_create', ['created'], po), SHORT),
 ex('create-purchase-orders.2.purchase_order_text', 'Write the order so I can email it.', text('create-purchase-orders.2.purchase_order_text'), LINK),
 [{'q': 'Does it send the order to the supplier?', 'a': 'No. It writes the order text, and you send it. purchase_order_receive then records what arrived, and a partial delivery keeps the order open.'},
  {'q': 'What is free, and what does Pro add?', 'a': BD_FREE + PRO('Billing Docs', BD_PRO)}])

# 5 Dunning Letters
ct = lambda d: {**d, 'send_now': [keep(x, ['client', 'reference', 'outstanding', 'days_late', 'send', 'threshold_date']) for x in d['send_now']]}
page('write-a-payment-reminder', 'dunning-letters', 'Can Claude write a payment reminder?', 'Can Claude write a payment reminder? Letters that escalate', 'claude invoice chaser',
 'Yes, it writes them well. The Dunning Letters server also tracks which reminder each late invoice is on, adds agreed late fees and lists what to send today.',
 "Yes. Claude writes a polite or firm payment reminder well, and Projects and memory can keep your usual wording. What a chat does not keep is which letter each late invoice has had, when the next one is due, or the interest your terms allow to date. Connect the Dunning Letters server (free token) and Claude registers each unpaid invoice, works out when reminder 1, reminder 2 and the final notice fall due, writes the letter for the current stage with any late fee, and lists what to send today. It sends nothing itself.",
 ['Writes a reminder in the tone you ask for.', 'Softens the wording for a client you want to keep.'],
 ['Three letters on a schedule counted from the due date.', 'Late payment interest at the rate your terms allow.', "Today's list of letters to send."],
 ex('write-a-payment-reminder.1.letter_render', 'Bayline still has not paid INV-2026-0001. Write the next reminder.', field('write-a-payment-reminder.1.letter_render', 'letter'),
    'The invoice was registered with its open balance of USD 1,350.00 and terms of 1% a month, and reminder 1 was recorded as sent on 7 October first. This is the letter field of the answer. 1% a month on USD 1,350.00 for 38 days comes to USD 17.10.'),
 ex('write-a-payment-reminder.2.chase_today', 'Who do I need to chase today?', pick('write-a-payment-reminder.2.chase_today', ['on', 'send_now', 'counts'], ct),
    'Each invoice to chase is shown with six of its fields. ' + SHORT),
 [{'q': 'Does it email the client?', 'a': 'No. It writes the letter as Markdown or a printable HTML page, and you send it. letter_sent then records the date so the next stage can follow.'},
  {'q': 'Can I charge a late fee?', 'a': 'Only if your terms allow one. Pass the monthly rate when you register the invoice, and reminder 2 and the final notice state the amount accrued to the letter date.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'All three letters in both formats, late fees, payments, the aging summary and the daily chase list are free, with up to 3 unpaid invoices chased at once. ' + PRO('Dunning Letters', 'It removes the limit of 3 invoices chased at once.')}])

# 6 Statement of Account
ag = lambda d: {**d, 'aging': [keep(a, ['client', 'not_yet_due', 'overdue', 'outstanding']) for a in d['aging']]}
page('track-accounts-receivable', 'statement-of-account', 'Can Claude track accounts receivable?', 'Can Claude track accounts receivable? Aging by client', 'claude accounts receivable',
 'Partly. Claude can age an export you upload. The Statement of Account server ages saved invoices by client, nets payments and credits, and writes statements.',
 f"Partly. {CODE} Claude can sort an invoice export you upload into 30, 60 and 90 day buckets in its sandbox. It works from that file each time, so payments and credit notes made since are missing. Connect the Statement of Account server (free token) and Claude ages the invoices saved in the Invoice server by client and currency, with payments, applied deposits and credit notes taken off, and writes a statement of account to email each client.",
 ['Ages an invoice export you upload in its sandbox.', 'Explains what an aging report shows.'],
 ['Aging per client from the invoices you already saved.', 'Payments and credit notes taken off each balance.', 'A statement of account to paste into an email.'],
 ex('track-accounts-receivable.1.statement_aging', 'Who owes me money, and how late is it?', pick('track-accounts-receivable.1.statement_aging', ['as_of', 'clients', 'aging'], ag),
    'Three invoices were saved in the Invoice server first, with a USD 500.00 part payment from Bayline and a USD 150.00 credit note for Harbor Dental. The server answers in JSON. This is a shortened copy that shows each client with four of its fields, unchanged. In the full answer Bayline sits in the 31 to 60 day bucket and Harbor Dental in the 0 to 30 day bucket.'),
 ex('track-accounts-receivable.2.statement_text', 'Write Harbor Dental a statement for October to today.', text('track-accounts-receivable.2.statement_text'), LINK),
 [{'q': 'Does it chase late payers?', 'a': 'It writes a friendly or firm chaser with dunning_text, listing every overdue invoice with your bank details, and you send it. The final demand letter is Pro.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Aging is free with no cap, and statements are free for 5 a calendar month, with rebuilds free. ' + PRO('Statement of Account', 'It adds unlimited statements, the A4 statement page, the final demand letter and the receivables report across every client.')}])

# 7 Bank Statement
sm = lambda d: {**d, 'by_currency': {'USD': {**keep(d['by_currency']['USD'], ['count', 'money_in', 'money_out', 'net']), 'groups': [keep(g, ['group', 'count', 'net']) for g in d['by_currency']['USD']['groups']]}}}
ts = lambda d: {**d, 'transactions': [keep(t, ['date', 'amount', 'description']) for t in d['transactions']]}
page('read-bank-statements', 'bank-statement', 'Can Claude read bank statements?', 'Can Claude read bank statements? Yes, and keep the history', 'can claude read bank statements',
 'Yes. Claude reads a PDF or CSV statement you upload. The Bank Statement server keeps imported months in a ledger you can total and search later.',
 f"Yes. Claude reads a bank statement you upload as a PDF or CSV and answers questions about it, and {code} it can total and chart the rows in its sandbox. Projects can keep the files. What a chat does not keep is one ledger that grows month by month with repeated rows skipped. Connect the Bank Statement server (free token) and Claude imports each CSV export into a saved ledger per account, totals money in and out by category, month or counterparty, and searches every stored line.",
 ['Reads an uploaded PDF or CSV statement and answers questions about it.', 'Totals and charts the rows in its sandbox when code execution is on.'],
 ['One saved ledger per account that later months add to.', 'Rows already imported skipped on the next import.', 'Totals by category, month or counterparty across months.'],
 ex('read-bank-statements.1.statement_summary', 'Where did the money in my checking account go in October?', pick('read-bank-statements.1.statement_summary', ['from', 'to', 'group_by', 'count', 'by_currency'], sm),
    'A ten-line October CSV was uploaded with bank_upload and imported with statement_import first. The server answers in JSON. This is a shortened copy, and each group is shown with three of its fields, unchanged.'),
 ex('read-bank-statements.2.transactions_search', 'How much did I spend at Shell in October?', pick('read-bank-statements.2.transactions_search', ['query', 'matches', 'transactions'], ts),
    'Each match is shown with three of its fields. ' + SHORT),
 [{'q': 'Can it read a PDF statement?', 'a': 'No. The upload has to be delimited text such as a CSV export, and a PDF is refused. Claude can still read the PDF itself in the chat.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Two accounts, import, search and summaries are free, and the free tier reads back the last 12 months. ' + PRO('Bank Statement', 'It adds unlimited accounts, the full history, unlimited category rules and the statement export.')},
  KEEP30])

# 8 Asset Register
s5 = lambda d: {**d, 'asset': keep(d['asset'], ['id', 'name', 'cost', 'in_service_date']), 'periods': [keep(p, ['year', 'amount', 'basis']) for p in d['periods']]}
s7 = lambda d: {**d, 'category': keep(d['category'], ['code', 'name']), 'periods': [keep(p, ['year', 'amount']) for p in d['periods']]}
page('calculate-depreciation', 'asset-register', 'Can Claude calculate depreciation?', 'Can Claude calculate depreciation? MACRS schedules by year', 'claude depreciation schedule',
 'Yes, the math is simple. The Asset Register server keeps each asset and builds its schedule from bundled tax tables such as IRS MACRS, year by year.',
 f"Yes. Claude can explain straight-line and declining-balance depreciation and work out a schedule, and {code} it can build one in a spreadsheet. The risk is in the inputs, such as the wrong class life or convention, and a register that lives in one file. Connect the Asset Register server (free token) and Claude adds each fixed asset with its rate and life from a bundled table, IRS MACRS, HMRC pools or the Polish annex, builds the schedule per year or month, and values the register at any date.",
 ['Explains depreciation methods and works out a schedule.', 'Builds a schedule in a spreadsheet when code execution is on.'],
 ['Rate, life and convention from a bundled tax table.', 'A register of fixed assets kept between chats.', 'Net book value of the register at any date.'],
 ex('calculate-depreciation.1.asset_schedule', 'Show the depreciation schedule for the MacBook Pro I bought in March.', pick('calculate-depreciation.1.asset_schedule', ['asset', 'convention', 'periods'], s5),
    'The laptop was added with asset_add first as 5-year property for USD 3,499.00. ' + SHORT + ' The six years add up to the full cost.'),
 ex('calculate-depreciation.2.asset_schedule', 'What would USD 12,000 of 7-year equipment bought in June 2026 depreciate by each year?', pick('calculate-depreciation.2.asset_schedule', ['category', 'convention', 'periods'], s7),
    'This asset is not in the register. asset_schedule prices it without saving it. ' + SHORT),
 [{'q': 'Does it apply bonus depreciation or section 179?', 'a': 'No. The US table is the GDS schedule under the half-year convention from IRS Publication 946 Table A-1. Ask your accountant whether bonus depreciation, section 179 or the mid-quarter convention applies to you.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Ten assets, schedules, the register listing and disposals are free. ' + PRO('Asset Register', 'It adds unlimited assets, the monthly depreciation journal and the yearly asset report.')}])

# 9 Onboarding
pg = lambda d: {'hire': {**keep(d['hire'], ['name', 'role', 'start_date', 'percent_complete', 'overdue']), 'tasks_detail': [keep(t, ['id', 'text', 'owner', 'due', 'status']) for t in d['hire']['tasks_detail']]}}
page('make-an-onboarding-plan', 'onboarding', 'Can Claude make an onboarding plan?', 'Can Claude make an onboarding plan? Tasks for each new hire', 'claude employee onboarding',
 'Yes, as a checklist. The Onboarding server copies a role template to each new hire, with due dates from the start day, and lists overdue tasks.',
 "Yes, as a checklist. Claude can write an onboarding plan for a role, and Projects and memory can keep it for the next hire. What a chat does not keep is each hire's own copy with due dates and a record of what is done. Connect the Onboarding server (free token) and Claude adds a hire with a start date, applies a role template so every task gets an owner and a due date, marks tasks done, and lists what is overdue across all hires.",
 ['Writes an onboarding checklist for a role.', 'Keeps it in a Project for the next hire.'],
 ['A dated copy of the plan for each hire.', 'HR, manager and IT tasks, each with an owner.', 'Overdue tasks across every hire in one list.'],
 ex('make-an-onboarding-plan.2.onboarding_progress', "How is Priya's onboarding going?", pick('make-an-onboarding-plan.2.onboarding_progress', ['hire'], pg),
    'Priya was added with a start date of 26 October, a six-task designer template was applied, and three tasks were marked done first. The server answers in JSON. This is a shortened copy, and each task is shown with five of its fields, unchanged.'),
 ex('make-an-onboarding-plan.3.onboarding_overdue', 'Is anything overdue for new hires?', pick('make-an-onboarding-plan.3.onboarding_overdue', ['overdue', 'total']),
    'Days late are counted from the day of the call, here 5 November. ' + SHORT),
 [{'q': 'If I edit the template, do current hires change?', 'a': 'No. Each hire copies the template when it is applied, so a plan already under way stays as it was.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Hires, templates, tasks, progress and the overdue list are free, with a template applied to one hire per call. ' + PRO('Onboarding', 'It applies a template to many hires in one call and exports a plan as CSV.')}])

# 10 Work Order (token 2)
wo = lambda d: {'created': keep(d['created'], ['id', 'status', 'priority', 'client', 'site_address', 'requested_date', 'description'])}
page('create-work-orders', 'work-order', 'Can Claude create work orders?', 'Can Claude create work orders? Jobs, parts and labour', 'can claude create work orders',
 'Yes, as a document. The Work Order server numbers each job, logs parts and labour, moves it from scheduled to done and writes a completion report.',
 f"Yes, as a document. Claude can draft a work order or job sheet, and {code} it can save it as a file. What a chat does not keep is a numbered job with its status, the parts and hours logged against it, and totals worked out from those lines. Connect the Work Order server (free token) and Claude raises a WO-numbered job with the site and priority, logs parts with markup and labour hours, moves the job from draft to done, and writes a completion report with a sign-off block.",
 ['Drafts a work order or job sheet.', 'Saves it as a file when code execution is on.'],
 ['A WO number and site address on every job.', 'Parts with markup and labour hours totaled from the lines.', 'A completion report for the client to sign.'],
 ex('create-work-orders.1.work_order_create', "Maple Street Bakery's walk-in cooler door does not seal. Open a high priority job for the back kitchen.", pick('create-work-orders.1.work_order_create', ['created'], wo), SHORT),
 ex('create-work-orders.2.completion_report_text', 'The job is done. Write the completion report.', text('create-work-orders.2.completion_report_text'),
    'Two parts lines with a 20% markup and 1.5 hours of labour were added, and the job was moved to done first. ' + LINK),
 [{'q': 'Does it create the invoice?', 'a': 'Not on the free tier. work_order_invoice_payload builds invoice-ready lines on Pro, and you raise the invoice in the Invoice server.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Five open work orders, lines, status moves and the text completion report are free. ' + PRO('Work Order', 'It adds unlimited open orders, the completion report PDF, the invoice payload and the board report.')}])

# 11 Leave
page('track-employee-leave', 'leave', 'Can Claude track employee leave?', 'Can Claude track employee leave? Balances and who is out', 'can claude track employee leave',
 'Partly. Claude can add up days from a list. The Leave server keeps each request and approval, and shows balances and who is out on any day.',
 "Partly. Claude can count days off from a list you paste and draft a leave policy, and Projects and memory can keep notes. A chat keeps no record of who asked for what, who approved it and what each person has left. Connect the Leave server (free token) and Claude adds employees with their yearly allowance and carry-over, records vacation, sick, unpaid and parental requests, approves or rejects them, and shows balances and who is out in any date range.",
 ['Counts days off from a list you paste.', 'Drafts a leave or PTO policy.'],
 ['Each request with its type, dates and approval.', 'A balance from allowance and carry-over, minus booked days.', 'Who is out on each day of a range.'],
 ex('track-employee-leave.2.leave_balance', 'How much vacation does Sam have left?', text('track-employee-leave.2.leave_balance'),
    'Sam was added with 15 days a year and 2 carried over, and a four-day December vacation was requested and approved first. The answer is shown in full.'),
 ex('track-employee-leave.3.leave_out_range', 'Who is out the week of 21 December?', text('track-employee-leave.3.leave_out_range'),
    'Priya also asked for a half day on 23 December, still pending. Pending requests count as planned absence. The answer is shown in full.'),
 [{'q': 'Does it skip weekends and holidays?', 'a': 'No. It counts every day in the range you give, so book a week off as Monday to Friday.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Employees, requests, approvals, balances and the who is out view are free with no request limit. ' + PRO('Leave', 'It adds bulk import of requests from CSV and an .ics calendar export of approved leave.')}])

# 12 Mileage Log
ms = lambda d: {**d, 'categories': [{**keep(c, ['category', 'trips', 'distance', 'totals']), 'lines': [keep(l, ['date', 'to', 'distance', 'rate', 'amount']) for l in c['lines']]} for c in d['categories']]}
ta = lambda d: {'logged': keep(d['logged'], ['id', 'date', 'from', 'to', 'distance', 'unit', 'purpose', 'category']), 'notes': d['notes']}
page('keep-a-mileage-log', 'mileage-log', 'Can Claude keep a mileage log?', 'Can Claude keep a mileage log? Trips priced by date', 'can claude keep a mileage log',
 'Partly. Claude can total trips you list. The Mileage Log server keeps every drive with its purpose and prices it at the rate in force that day.',
 "Partly. Claude can total the miles in a list you paste and multiply by a rate, and Projects and memory can keep notes. A chat keeps no log that grows trip by trip with dates, purposes and categories. Connect the Mileage Log server (free token) and Claude logs each drive as business, medical, moving, charitable or personal, prices it at the rate you set for the day it was driven, and totals the deductible amount for any period. No rate ships with it, so you enter the one you use.",
 ['Totals the miles in a list you paste.', 'Explains what a mileage log usually records.'],
 ['A dated log of every drive with its purpose.', 'Each trip priced at the rate in force on its day.', 'Personal trips kept on record and left out of the total.'],
 ex('keep-a-mileage-log.2.mileage_summary', 'What is my mileage deduction for October?', pick('keep-a-mileage-log.2.mileage_summary', ['from', 'to', 'trips_in_window', 'trips_priced', 'categories', 'personal_unpriced'], ms),
    'A business rate of USD 0.76 a mile from 1 July 2026 was entered with rate_set, and three October trips were logged first. The rate is a figure you enter, so check it against what your tax authority publishes. ' + SHORT),
 ex('keep-a-mileage-log.1.trip_add', 'Log 14.2 miles from the studio to Harbor Dental in Aurora on 6 October for the kickoff meeting.', pick('keep-a-mileage-log.1.trip_add', ['logged', 'notes'], ta), SHORT),
 [{'q': 'Does it know the IRS rate?', 'a': 'No. No rate ships with this server. You set the rate per category and the date it starts, and each trip is priced at the rate in force on its day.'},
  {'q': 'What is free, and what does Pro add?', 'a': 'Twenty trips a calendar month, one rate per jurisdiction and category, the trip list and the summary are free. ' + PRO('Mileage Log', 'It adds unlimited trips, a dated series of rates and the CSV export for your accountant.')}])

DEMAND = {
 'create-invoices': 'suggest2.txt: "can claude create invoices", "can claude create an invoice", "can claude do invoices" (no /can-claude/ invoice page exists; /use-cases/create-invoice-in-claude/ is the how-to page, GSC "invoiced to claude" 5 imp pos 74.8 there)',
 'find-overdue-invoices': 'suggest2.txt: "claude overdue invoice", "claude billing overdue"',
 'make-a-credit-note': 'suggest2.txt: "claude credit note", "claude credit memo"',
 'create-purchase-orders': 'suggest2.txt: "claude purchase order", "claude ai purchase order"',
 'write-a-payment-reminder': 'suggest2.txt: "claude invoice chaser", "claude overdue invoice"; GSC 1020-1105: "chase overdue invoices automatically" 30 imp pos 85.5 and "chase overdue invoices" 1 imp pos 84 (both on /use-cases/chase-overdue-invoices/)',
 'track-accounts-receivable': 'suggest2.txt: "claude accounts receivable" (seed "claude aging report" returned no rows)',
 'read-bank-statements': 'suggest2.txt: "can claude read bank statements", "can claude analyze bank statements", "claude bank statement analysis", "giving claude bank statements"',
 'calculate-depreciation': 'suggest2.txt: "claude depreciation schedule", "claude depreciation" (seed "can claude calculate depreciation" returned no rows)',
 'make-an-onboarding-plan': 'suggest2.txt: "claude employee onboarding"',
 'create-work-orders': 'GSC 1020-1105: "work order mcp server" 4 imp pos 11.2 on /servers/work-order/; GSC 1106 page row /servers/work-order/ 4 imp pos 11.2 (no autocomplete row; seed "claude work order" returned none)',
 'track-employee-leave': 'weak: GSC 1106 page row /use-cases/employee-leave-tracker/ 1 imp 1 click pos 2; seeds "claude leave tracker" and "claude pto tracker" returned no rows',
 'keep-a-mileage-log': 'weak: GSC 1106 page row /servers/mileage-log/ 2 imp pos 5.5; seed "claude mileage" returned no rows',
}
json.dump({'_readme': ['s1106 W3: /can-claude/<slug>/ live answer pages for paid catalog servers. Generator content/W3_make_live.py, raw calls data/s1106/calls/ (gitignored), checker content/W3_check.py.',
                       'Calls ran 2026-11-05 17:45 to 18:00 UTC (2026-11-06 Mac time), so run is 2026-11-05, the server date that days-late figures use.',
                       'query is the Google autocomplete or GSC phrase where one exists. Constructed: create-work-orders, track-employee-leave, keep-a-mileage-log. Demand evidence per slug is in content/W3-demand.json.'],
           'pages': P}, open(OUT, 'w'), indent=1, ensure_ascii=False)
json.dump(DEMAND, open(OUT.replace('W3-live.json', 'W3-demand.json'), 'w'), indent=1, ensure_ascii=False)
print(len(P), 'pages ->', OUT)
