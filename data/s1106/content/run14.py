import w3lib
S = w3lib.S
l = S('leave')
l.call('track-employee-leave', 0, 'leave_approve', {'request': 'LV-0001'})
l.call('track-employee-leave', 2, 'leave_balance', {'employee': 'Sam Lee'})
l.call('track-employee-leave', 3, 'leave_out_range', {'start': '2026-12-21', 'end': '2026-12-24'}, False)
