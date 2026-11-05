#!/usr/bin/env python3
"""s1106 W3: run real tools/call sequences against https://mcp.zovo.one/mcp/<id>/t/<token> (same method as s1105 W2work/w2lib.py).
The token is minted once with GET /mcp/connect?mint=1 and kept in calls/.tok (gitignored dir, mode 600). It is never printed.
Raw responses -> ~/mcp-servers/data/s1106/calls/<page>.<n>.<tool>.json ; tools/list -> calls/<server>.tools.json"""
import json, os, re, time, urllib.request, urllib.error
CALLS = os.path.expanduser('~/mcp-servers/data/s1106/calls')
TOKF = f"{CALLS}/{os.environ.get('W3_TOK', '.tok')}"
UA = 's1106-W3/1'

def mint():
    if os.path.exists(TOKF):
        t = open(TOKF).read().strip()
        if re.fullmatch(r'anon_[0-9a-f]{32}', t): return t
    html = urllib.request.urlopen(urllib.request.Request('https://mcp.zovo.one/mcp/connect?mint=1', headers={'user-agent': UA}), timeout=30).read().decode()
    m = re.search(r'anon_[0-9a-f]{32}', html)
    if not m: raise SystemExit('mint returned no token (10 per IP per hour limit?)')
    fd = os.open(TOKF, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600); os.write(fd, m.group(0).encode()); os.close(fd)
    return m.group(0)

TOK = mint()

def scrub(s):
    return re.sub(r'anon[_:][0-9a-f]*', '<token>', s) if isinstance(s, str) else s

class S:
    def __init__(self, sid_):
        self.url = f'https://mcp.zovo.one/mcp/{sid_}/t/{TOK}'; self.sess = None; self.id = 1; self.server = sid_
        self.post({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26', 'capabilities': {}, 'clientInfo': {'name': 's1106-W3', 'version': '1'}}})
        try: self.post({'jsonrpc': '2.0', 'method': 'notifications/initialized'})
        except Exception: pass
    def post(self, body):
        h = {'user-agent': UA, 'content-type': 'application/json', 'accept': 'application/json, text/event-stream', 'x-mcp-probe': '1'}
        if self.sess: h['mcp-session-id'] = self.sess
        for a in range(3):
            try:
                r = urllib.request.urlopen(urllib.request.Request(self.url, data=json.dumps(body).encode(), headers=h), timeout=90); break
            except urllib.error.URLError as e:
                if a == 2 or (getattr(e, 'code', None) or 500) < 500: raise
                time.sleep(8)
        raw = r.read().decode(); self.sess = r.headers.get('mcp-session-id') or self.sess
        if raw.lstrip().startswith('{'): return json.loads(raw)
        for line in raw.splitlines():
            if line.startswith('data:'):
                d = json.loads(line[5:])
                if 'id' in d: return d
        return {'raw': raw}
    def tools(self):
        self.id += 1
        r = self.post({'jsonrpc': '2.0', 'id': self.id, 'method': 'tools/list'})
        json.dump(r, open(f'{CALLS}/{self.server}.tools.json', 'w'), indent=1)
        return r
    def call(self, page, n, tool, args, show=True):
        self.id += 1
        r = self.post({'jsonrpc': '2.0', 'id': self.id, 'method': 'tools/call', 'params': {'name': tool, 'arguments': args}})
        short = {k: (v[:40] + '...' if isinstance(v, str) and len(v) > 200 else v) for k, v in args.items()}
        rec = {'server_id': self.server, 'url_form': '/mcp/<id>/t/<token>', 'tool': tool, 'args': short, 'run_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'response': r}
        json.dump(rec, open(f'{CALLS}/{page}.{n}.{tool}.json', 'w'), indent=1)
        txt = '\n'.join(c.get('text', '') for c in r.get('result', {}).get('content', []) if c.get('type') == 'text')
        print(f'--- {page}.{n}.{tool} err={r.get("result", {}).get("isError")}\n{scrub(txt[:2500] if show else txt[:200])}')
        return r
