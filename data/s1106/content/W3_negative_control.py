#!/usr/bin/env python3
"""Known-bad copy of W3-live.json must make W3_check.py fail on every planted defect (dash, !, colon, changed value, token, short meta, hype, opening)."""
import json, subprocess, os
src = os.path.expanduser('~/mcp-servers/data/s1106/content/W3-live.json')
d = json.load(open(src)); p = d['pages']
p[0]['answer'] += ' Bad: text — here!'
p[1]['example']['result'] = p[1]['example']['result'].replace('38', '39')
p[2]['faq'][0]['a'] += ' anon_' + 'ab' * 16
p[3]['meta_description'] = 'short'
p[4]['answer'] = p[4]['answer'].replace('Yes.', 'Seamless.')
out = os.path.expanduser('~/mcp-servers/data/s1106/content/_negctl.json'); json.dump(d, open(out, 'w'))
r = subprocess.run(['python3', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'W3_check.py'), out], capture_output=True, text=True)
os.remove(out)
fails = [l for l in r.stdout.splitlines() if l.startswith('FAIL')]
print('\n'.join(fails)); print('exit', r.returncode, len(fails), 'FAIL')
