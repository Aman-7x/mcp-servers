"""Live remote evidence: initialize, tools/list and tools/call through the public Worker URL. usage: remote_evidence.py <repo> <calls.json> <out.json>"""
import json, sys, urllib.request, datetime
def post(url, body, sid=None):
    h = {'user-agent': 's1106-sat3-evidence/1', 'content-type': 'application/json', 'accept': 'application/json, text/event-stream'}
    if sid: h['mcp-session-id'] = sid
    r = urllib.request.urlopen(urllib.request.Request(url, data=json.dumps(body).encode(), headers=h), timeout=60)
    raw = r.read().decode(); s = r.headers.get('mcp-session-id')
    if raw.lstrip().startswith('{'): return r.status, json.loads(raw), s
    for line in raw.splitlines():
        if line.startswith('data:'):
            d = json.loads(line[5:])
            if 'id' in d: return r.status, d, s
    return r.status, {'raw': raw}, s
repo, calls, out = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
url = f'https://{repo}.lipmichal.workers.dev/mcp'
ev = {'url': url, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'commands': [f'POST initialize to {url}', 'POST tools/list'] + [f"POST tools/call {n} {json.dumps(a)}" for n, a in calls]}
st, init, sid = post(url, {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26', 'capabilities': {}, 'clientInfo': {'name': 's1106-sat3', 'version': '1'}}})
ev['initialize'] = {'http_status': st, 'mcp_session_id': sid, 'body': init}
_, ev['tools_list'], _ = post(url, {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'}, sid)
ev['tools_calls'] = {}; ok = 0
for i, (n, a) in enumerate(calls):
    _, r, _ = post(url, {'jsonrpc': '2.0', 'id': 10 + i, 'method': 'tools/call', 'params': {'name': n, 'arguments': a}}, sid)
    key = n if n not in ev['tools_calls'] else f'{n}#{i}'
    ev['tools_calls'][key] = {'arguments': a, 'response': r}
    good = 'result' in r and not r['result'].get('isError'); ok += good
    print(f"{'ok ' if good else 'ERR'} {n} {json.dumps(a)}: {(r.get('result') or {}).get('content', [{}])[0].get('text', json.dumps(r))[:420].split(chr(10))[0]}")
ev['calls_ok'] = f'{ok}/{len(calls)}'
json.dump(ev, open(out, 'w'), indent=1)
print('initialize', st, 'tools', len(ev['tools_list'].get('result', {}).get('tools', [])), 'calls_ok', ev['calls_ok'])
