import w3lib
S = w3lib.S
inv = S('invoice')
inv.call('create-invoices', 0, 'client_add', {'name': 'Harbor Dental', 'address': '45 Wharf St, Portland, ME 04101'}, False)
inv.call('create-invoices', 0, 'invoice_create', {'client': 'Northwind Cafe', 'items': [{'description': 'Menu board design', 'quantity': 1, 'unit_price': 950}], 'issue_date': '2026-11-02'}, False)
inv.call('create-invoices', 0, 'invoice_mark_paid', {'number': 'INV-2026-0001', 'amount': 500, 'paid_date': '2026-10-15', 'method': 'bank transfer', 'reference': 'BL-7731'}, False)
inv.call('create-invoices', 2, 'invoice_pdf', {'number': 'INV-2026-0002'})
bd = S('billing-docs')
bd.call('make-a-credit-note', 1, 'credit_note_create', {'invoice': 'INV-2026-0002', 'reason': 'Hosting setup billed twice', 'lines': [{'line': 2, 'quantity': 1}], 'issue_date': '2026-11-06'})
