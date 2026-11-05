import w3lib
S = w3lib.S
o = S('onboarding')
o.call('make-an-onboarding-plan', 1, 'onboarding_template_apply', {'hire': 'Priya Shah', 'role': 'designer', 'tasks': [
  {'text': 'Laptop ready and accounts set up', 'owner': 'it', 'due_offset': 0},
  {'text': 'First-day welcome and studio tour', 'owner': 'manager', 'due_offset': 0},
  {'text': 'Payroll and tax forms filed', 'owner': 'hr', 'due_offset': 2},
  {'text': 'Shadow a client call', 'owner': 'manager', 'due_offset': 5},
  {'text': 'First design review', 'owner': 'manager', 'due_offset': 14},
  {'text': '30-day check-in', 'owner': 'manager', 'due_offset': 30}]})
o.call('make-an-onboarding-plan', 0, 'onboarding_task_done', {'hire': 'H-0001', 'task': 'K01', 'status': 'done', 'date': '2026-10-26'}, False)
o.call('make-an-onboarding-plan', 0, 'onboarding_task_done', {'hire': 'H-0001', 'task': 'K02', 'status': 'done', 'date': '2026-10-26'}, False)
o.call('make-an-onboarding-plan', 0, 'onboarding_task_done', {'hire': 'H-0001', 'task': 'K04', 'status': 'done', 'date': '2026-10-30'}, False)
o.call('make-an-onboarding-plan', 2, 'onboarding_progress', {'hire': 'H-0001'})
o.call('make-an-onboarding-plan', 3, 'onboarding_overdue', {})
