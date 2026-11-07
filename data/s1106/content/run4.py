import w3lib
S = w3lib.S
S('invoice').call('find-overdue-invoices', 9, 'invoice_get', {'number': 'INV-2026-0002'})
bd = S('billing-docs')
bd.call('create-purchase-orders', 1, 'purchase_order_create', {'supplier': 'Mile High Print Co', 'items': [{'description': 'Business cards, 350gsm, 500 pack', 'quantity': 4, 'unit_price_minor': 4200}, {'description': 'Trade show banner, 2 x 1 m', 'quantity': 1, 'unit_price_minor': 18500}], 'expected_delivery_date': '2026-11-13', 'issue_date': '2026-11-06', 'notes': 'Deliver to 210 Pine St, Denver'})
bd.call('create-purchase-orders', 2, 'purchase_order_text', {'id': 'PO-2026-0001'})
