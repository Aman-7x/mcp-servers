import w3lib
S = w3lib.S
bd = S('billing-docs')
bd.call('make-a-credit-note', 2, 'credit_note_text', {'id': 'CN-2026-0001'})
bd.call('create-purchase-orders', 1, 'purchase_order_create', {'supplier': 'Mile High Print Co', 'items': [{'description': 'Business cards, 350gsm, 500 pack', 'quantity': 4, 'unit_price': 42}, {'description': 'Trade show banner, 2 x 1 m', 'quantity': 1, 'unit_price': 185}], 'expected_delivery_date': '2026-11-13', 'issue_date': '2026-11-06', 'notes': 'Deliver to 210 Pine St, Denver'})
bd.call('create-purchase-orders', 2, 'purchase_order_text', {'id': 'PO-2026-0001'})
inv = S('invoice')
inv.call('find-overdue-invoices', 1, 'overdue_report', {'as_of': '2026-11-06'})
inv.call('find-overdue-invoices', 2, 'invoice_list', {'status': 'partial'})
