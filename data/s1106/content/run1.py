import w3lib
S = w3lib.S
inv = S('invoice')
inv.call('create-invoices', 0, 'business_set', {'name': 'Reyes Studio', 'address': '210 Pine St, Denver, CO 80202', 'default_currency': 'USD', 'default_tax_rate': 0, 'payment_terms_days': 14, 'timezone': 'America/Denver', 'bank': 'First Western Bank', 'iban': 'Account 000123456789'}, False)
inv.call('create-invoices', 0, 'invoice_create', {'client': 'Bayline Logistics', 'items': [{'description': 'Trade show stand design', 'quantity': 1, 'unit_price': 1850}], 'issue_date': '2026-09-15'}, False)
inv.call('create-invoices', 1, 'invoice_create', {'client': 'Harbor Dental', 'items': [{'description': 'Website redesign, phase 1', 'quantity': 1, 'unit_price': 2400}, {'description': 'Hosting setup', 'quantity': 2, 'unit_price': 150}], 'issue_date': '2026-10-06'})
