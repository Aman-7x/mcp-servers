import json, sys, re, pathlib
T = pathlib.Path.home() / 'mcp-servers/satellites/mortgage-rates-today-mcp'
S = json.load(open(sys.argv[1]))
for n, c in S.items():
    d = pathlib.Path.home() / 'mcp-servers-work/sat3' / n
    pkg = json.load(open(T / 'package.json'))
    pkg['name'] = n; pkg['description'] = c['pkg_desc']; pkg['mcpName'] = f'io.github.theluckystrike/{n}'
    pkg['repository']['url'] = f'https://github.com/theluckystrike/{n}'; pkg['bin'] = {n: 'dist/stdio.js'}
    pkg['keywords'] = ['mcp', 'mcp-server', 'model-context-protocol', 'claude'] + c['keywords']
    json.dump(pkg, open(d / 'package.json', 'w'), indent=2); open(d / 'package.json', 'a').write('\n')
    lock = (T / 'package-lock.json').read_text().replace('"mortgage-rates-today-mcp"', f'"{n}"')
    lock = lock.replace('"bin": {\n        "mortgage-rates-today-mcp"', f'"bin": {{\n        "{n}"')
    (d / 'package-lock.json').write_text(lock)
    srv = {"$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json", "name": f"io.github.theluckystrike/{n}",
           "title": c['title'], "description": c['server_desc'], "version": "1.0.0",
           "repository": {"url": f"https://github.com/theluckystrike/{n}", "source": "github"},
           "remotes": [{"type": "streamable-http", "url": f"https://{n}.lipmichal.workers.dev/mcp"}]}
    assert len(c['server_desc']) <= 100, (n, len(c['server_desc']))
    json.dump(srv, open(d / 'server.json', 'w'), indent=2); open(d / 'server.json', 'a').write('\n')
    (d / 'wrangler.toml').write_text((T / 'wrangler.toml').read_text().replace('mortgage-rates-today-mcp', n))
    w = (T / 'src/worker.ts').read_text()
    w = w.replace("so repeat calls do not reach Freddie Mac.", f"so repeat calls do not reach {c['upstream']}.")
    w = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{c["meta"]}">', w)
    w = re.sub(r'<p>Mortgage rates today for AI assistants[^<]*</p>', f'<p>{c["intro"]} No key, no sign-up. Version ${{VERSION}}.</p>', w)
    w = w.replace('claude mcp add --transport http mortgage-rates', f'claude mcp add --transport http {c["short"]}')
    w = w.replace('cacheTtl (30 minutes)', 'cacheTtl')
    assert 'mortgage' not in w.lower() and 'freddie' not in w.lower(), n
    (d / 'src/worker.ts').write_text(w)
    print('ok', n)
