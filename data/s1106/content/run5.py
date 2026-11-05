import w3lib
S = w3lib.S
sa = S('statement-of-account')
sa.call('track-accounts-receivable', 1, 'statement_aging', {'as_of': '2026-11-06'})
sa.call('track-accounts-receivable', 2, 'statement_text', {'client': 'Harbor Dental', 'from': '2026-10-01', 'to': '2026-11-06', 'as_of': '2026-11-06'})
