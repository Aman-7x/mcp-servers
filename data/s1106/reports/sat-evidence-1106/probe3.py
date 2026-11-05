import json, urllib.request, urllib.parse, time, sys
seeds = ["how long to cook a turkey", "turkey cooking time", "how long to thaw a turkey", "turkey cooking time per pound",
 "how much is a stamp", "stamp price 2026", "postage rates 2027", "usps price increase january 2027",
 "usps holiday shipping deadlines", "last day to ship for christmas", "ups holiday shipping deadlines", "fedex holiday shipping deadlines",
 "electricity rates by state", "average electricity cost per kwh", "propane prices", "heating oil prices",
 "gas prices by state", "national average gas price", "snap income limits", "snap benefits 2027",
 "tsa checkpoint numbers", "fsa limit 2027", "natural gas prices", "diesel prices",
 "egg prices", "average price of eggs", "price of ground beef", "food prices 2026"]
out = {}
for s in seeds:
    u = 'https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=us&q=' + urllib.parse.quote(s)
    try:
        r = json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=15).read().decode('utf-8', 'replace'))
        out[s] = r[1]
    except Exception as e:
        out[s] = ['ERR ' + str(e)[:60]]
    time.sleep(0.5)
json.dump({"fetched": time.strftime('%Y-%m-%dT%H:%M:%S%z'), "requests": len(seeds), "results": out}, open(sys.argv[1], 'w'), indent=1)
for k, v in out.items(): print(f"{k} [{len(v)}]: " + '; '.join(v))
