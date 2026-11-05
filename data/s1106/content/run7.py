import w3lib
S = w3lib.S
BANK = ('Date,Description,Amount\n'
 '2026-10-01,OPENING DEPOSIT TRANSFER FROM SAVINGS,2000.00\n'
 '2026-10-02,ADOBE CREATIVE CLOUD,-59.99\n'
 '2026-10-05,XCEL ENERGY,-84.12\n'
 '2026-10-08,SHELL OIL 5544,-48.30\n'
 '2026-10-12,GOOGLE WORKSPACE,-14.00\n'
 '2026-10-15,CLIENT PAYMENT BAYLINE LOGISTICS BL-7731,500.00\n'
 '2026-10-19,SHELL OIL 5544,-51.75\n'
 '2026-10-22,OFFICE DEPOT 1183,-37.48\n'
 '2026-10-28,COMCAST BUSINESS,-89.99\n'
 '2026-10-30,BANK SERVICE FEE,-12.00\n')
b = S('bank-statement')
b.call('read-bank-statements', 0, 'bank_upload', {'name': 'checking-oct', 'content': BANK}, False)
b.call('read-bank-statements', 0, 'statement_import', {'path': 'checking-oct', 'account': 'checking', 'currency': 'USD'})
b.call('read-bank-statements', 1, 'statement_summary', {'from': '2026-10-01', 'to': '2026-10-31', 'group_by': 'counterparty'})
b.call('read-bank-statements', 2, 'transactions_search', {'query': 'shell', 'from': '2026-10-01', 'to': '2026-10-31'})
