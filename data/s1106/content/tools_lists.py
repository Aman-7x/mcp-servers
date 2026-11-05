import sys, json, w3lib
for s in sys.argv[1:]:
    try:
        r = w3lib.S(s).tools()
    except Exception as e:
        print(s, 'ERROR', str(e)[:80]); continue
    tl = r.get('result', {}).get('tools', [])
    print(s, len(tl), [t['name'] for t in tl])
