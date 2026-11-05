import w3lib
S = w3lib.S
d = S('dunning-letters')
d.call('write-a-payment-reminder', 0, 'invoice_register', {'client': 'Bayline Logistics', 'reference': 'INV-2026-0001', 'amount_minor': 135000, 'currency': 'USD', 'due': '2026-09-29', 'issued': '2026-09-15', 'late_fee_percent_per_month': 1, 'note': 'USD 500.00 of USD 1,850.00 paid on 2026-10-15'})
d.call('write-a-payment-reminder', 0, 'letter_sent', {'invoice': 'INV-2026-0001', 'stage': 1, 'sent': '2026-10-07'})
d.call('write-a-payment-reminder', 1, 'letter_render', {'invoice': 'INV-2026-0001', 'on': '2026-11-06'})
d.call('write-a-payment-reminder', 2, 'chase_today', {'on': '2026-11-06'})
