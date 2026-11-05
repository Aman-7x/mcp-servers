import w3lib
S = w3lib.S
inv = S('invoice')
inv.call('create-invoices', 0, 'client_add', {'name': 'Maple Street Bakery', 'address': '18 Maple St, Boulder, CO 80302', 'email': 'owner@example.com'}, False)
inv.call('create-invoices', 1, 'invoice_create', {'client': 'Maple Street Bakery', 'items': [{'description': 'Walk-in cooler door gasket, fitted', 'quantity': 1, 'unit_price': 103.20}, {'description': 'Hinge shim kit', 'quantity': 2, 'unit_price': 15}, {'description': 'Labour, fit gasket and test seal (hours)', 'quantity': 1.5, 'unit_price': 95}], 'issue_date': '2026-11-05', 'notes': 'Work order WO-2026-0001'})
inv.call('create-invoices', 2, 'invoice_pdf', {'number': 'INV-2026-0001'})
