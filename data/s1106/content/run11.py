import w3lib
S = w3lib.S
w = S('work-order')
w.call('create-work-orders', 1, 'work_order_create', {'client': 'Maple Street Bakery', 'client_address': '18 Maple St, Boulder, CO 80302', 'site_address': '18 Maple St, Boulder, CO 80302, back kitchen', 'requested_date': '2026-11-02', 'description': 'Walk-in cooler door does not seal. Replace gasket and adjust hinge', 'priority': 'high', 'currency': 'USD'})
w.call('create-work-orders', 0, 'work_order_status', {'work_order': 'WO-2026-0001', 'status': 'scheduled', 'date': '2026-11-03', 'note': 'Booked for Wednesday 7am before opening'}, False)
w.call('create-work-orders', 0, 'work_order_status', {'work_order': 'WO-2026-0001', 'status': 'in_progress', 'date': '2026-11-04'}, False)
w.call('create-work-orders', 0, 'work_order_add_line', {'work_order': 'WO-2026-0001', 'kind': 'parts', 'description': 'Door gasket, 30 x 78 in', 'quantity': 1, 'unit_cost_minor': 8600, 'markup_percent': 20, 'date': '2026-11-04'}, False)
w.call('create-work-orders', 0, 'work_order_add_line', {'work_order': 'WO-2026-0001', 'kind': 'parts', 'description': 'Hinge shim kit', 'quantity': 2, 'unit_cost_minor': 1250, 'markup_percent': 20, 'date': '2026-11-04'}, False)
w.call('create-work-orders', 0, 'work_order_add_line', {'work_order': 'WO-2026-0001', 'kind': 'labour', 'description': 'Fit gasket, adjust hinge, test seal', 'hours': 1.5, 'rate_minor': 9500, 'date': '2026-11-04'}, False)
w.call('create-work-orders', 0, 'work_order_status', {'work_order': 'WO-2026-0001', 'status': 'done', 'date': '2026-11-04', 'note': 'Seal tested, cooler holding 36F'}, False)
w.call('create-work-orders', 2, 'completion_report_text', {'work_order': 'WO-2026-0001'})
