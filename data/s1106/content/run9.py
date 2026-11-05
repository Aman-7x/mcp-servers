import w3lib
S = w3lib.S
o = S('onboarding')
o.call('make-an-onboarding-plan', 0, 'onboarding_hire_add', {'name': 'Priya Shah', 'role': 'designer', 'start_date': '2026-10-26'}, False)
o.call('make-an-onboarding-plan', 1, 'onboarding_template_apply', {'hire': 'Priya Shah', 'role': 'designer', 'tasks': [
  {'text': 'Send offer letter and W-4 form', 'owner': 'hr', 'due_offset': -7},
  {'text': 'Order laptop and set up accounts', 'owner': 'it', 'due_offset': -2},
  {'text': 'First-day welcome and studio tour', 'owner': 'manager', 'due_offset': 0},
  {'text': 'Collect I-9 documents', 'owner': 'hr', 'due_offset': 3},
  {'text': 'Shadow a client call', 'owner': 'manager', 'due_offset': 5},
  {'text': '30-day check-in', 'owner': 'manager', 'due_offset': 30}]})
