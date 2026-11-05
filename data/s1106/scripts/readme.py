import json, pathlib
H = pathlib.Path.home() / 'mcp-servers-work/sat3'
R = {
"usps-holiday-shipping-deadlines-mcp": dict(
 short="usps-holiday-deadlines",
 lead="USPS holiday shipping deadlines for AI assistants. Ask \"is it too late to ship for Christmas?\" and get the USPS recommended send-by date for each mail class, the days left from today, and which service still makes December 25.",
 what="It reads the USPS holiday shipping dates page at call time. It needs no API key. If usps.com cannot be read, it answers from a built-in copy of the 2026 table and says so in `data_source` and `live_check`.",
 tools=[("get_usps_holiday_shipping_deadlines","Every 2026 USPS send-by date for delivery before December 25: lower 48, Alaska, Hawaii, Puerto Rico and territories, nine international regions and APO/FPO/DPO ZIP groups, with days left from today (US Eastern)."),
        ("check_holiday_ship_by_date","For a ship date (default today) and a destination (\"lower48\", a state or territory, a country, a USPS region or an APO ZIP), each service with its send-by date, days left and whether it is still on time, plus the slowest service still on time."),
        ("get_military_mail_deadline","Send-by dates for one APO/FPO/DPO ZIP code (090-099, 340, 962-966).")],
 knows=["This year's dates. USPS publishes new send-by dates every fall, so a model's remembered dates are last year's.","Today's date in US Eastern time, so \"how many days do I have\" is exact.","The fine print. Ground Advantage to Alaska and Hawaii has no single date (USPS gives a 10-day or more service expectation), and Priority Mail Express Military is not offered to APO ZIP 093."],
 prompts=["Is it too late to ship a package for Christmas?","What is the last day to mail Christmas cards with USPS this year?","I'm mailing a gift to Germany on December 10. Which USPS service still gets there by Christmas?","When do I need to ship to APO 09021 for Christmas?","What are the USPS holiday shipping deadlines for Hawaii?"],
 sources=["[USPS 2026 Holiday Shipping Deadlines](https://www.usps.com/holiday/holiday-shipping-dates.htm), read at call time.","[USPS service commitments](https://postcalc.usps.com/ServiceCommitments) for ZIP-to-ZIP estimates (linked, not read)."],
 limits=["USPS dates are recommendations for expected delivery, not guarantees.","USPS only. UPS and FedEx publish their own holiday dates; their pages block automated reads, so they are not included.","Country to region mapping covers about 120 common countries. Others can be given as a USPS region name (\"Europe\", \"Middle East\").","The hosted server caches the USPS page for up to 6 hours."],
 dev="node scripts/stdio-transcript.mjs     # live stdio round trip, writes .live/stdio-transcript.jsonl",
 ds=[("2026 holiday send-by dates (lower 48, Alaska and Hawaii, international, military)","https://www.usps.com/holiday/holiday-shipping-dates.htm","Read at call time, cached 6 hours. Parsed after removing HTML comments (the page keeps an old APO row inside a comment). Lower 48: Ground Advantage and First-Class Mail Thursday Dec. 17, Priority Mail Friday Dec. 18, Priority Mail Express Saturday Dec. 19. International: Dec. 9, Dec. 9, Dec. 16 for every region. Military Ground Advantage Wednesday Nov. 4. A built-in copy of this table (checked 2026-11-06) answers if the page cannot be read."),
     ("Landing page (cross-check)","https://www.usps.com/holiday/","\"DEC 17 Last Day to Ship First Class Mail & USPS Ground Advantage, DEC 18 Priority Mail, DEC 19 Priority Mail Express\".")],
 fixture="The test fixture in `test/fixtures/` is the holiday shipping dates page downloaded on 2026-11-06."),
"heating-oil-propane-prices-mcp": dict(
 short="heating-fuel-prices",
 lead="Heating oil and propane prices for AI assistants. Ask for this week's price per gallon in your state and get the U.S. Energy Information Administration (EIA) average, the change from last week and a year ago, and what a tank fill costs.",
 what="It reads the EIA weekly residential heating oil and propane survey at call time. It needs no API key.",
 tools=[("get_heating_oil_propane_prices","This week's EIA average residential heating oil and propane price per gallon (taxes included) for the US, an EIA region or a surveyed state, the change from last week, the last five survey weeks, the price a year ago and the next release date."),
        ("get_heating_fuel_price_history","Weekly prices for a fuel and area between two dates (most series start in 1990), with high, low and average."),
        ("estimate_heating_fuel_cost","Cost of a delivery at this week's state average (or your price), cost per million Btu, and heating oil vs propane per million Btu, optionally against your electricity or natural gas rate.")],
 knows=["This week's price. EIA publishes new prices every Wednesday from October to March, so a remembered number is stale.","Which states EIA surveys. Heating oil covers 21 Northeast and Midwest states; propane covers 38. Other states get the covered list, not a made-up number.","Real year-over-year change from the EIA history file."],
 prompts=["What are heating oil prices this week?","How much is propane in Maine right now, and how does it compare with last year?","What will 200 gallons of heating oil cost me in Connecticut?","Is propane or heating oil cheaper per Btu in Pennsylvania?","Show me propane prices in Minnesota over the last year."],
 sources=["[EIA weekly residential heating oil prices](https://www.eia.gov/dnav/pet/pet_pri_wfr_a_EPD2F_prs_dpgal_w.htm) and [propane prices](https://www.eia.gov/dnav/pet/pet_pri_wfr_a_EPLLPA_prs_dpgal_w.htm), read at call time.","EIA weekly history pages (LeafHandler) for year-ago and history.","[EIA heat content](https://www.eia.gov/energyexplained/units-and-calculators/british-thermal-units.php): heating oil 138,500 Btu per gallon, propane 91,452 Btu per gallon."],
 limits=["State averages from a dealer survey, not a quote. Dealer price, delivery fees, volume and contracts vary.","From April to September EIA collects one price a month.","Not every state is surveyed (no heating oil price for Texas, for example).","The hosted server caches EIA pages for up to an hour."],
 dev="node scripts/stdio-transcript.mjs     # live stdio round trip, writes .live/stdio-transcript.jsonl",
 ds=[("Weekly residential heating oil prices","https://www.eia.gov/dnav/pet/pet_pri_wfr_a_EPD2F_prs_dpgal_w.htm","Release 11/4/2026, latest week 11/02/26: U.S. 6.138, Connecticut 5.991, Maine 5.984. Read at call time, cached 1 hour. Keyless, public domain."),
     ("Weekly residential propane prices","https://www.eia.gov/dnav/pet/pet_pri_wfr_a_EPLLPA_prs_dpgal_w.htm","Latest week 11/02/26: U.S. 2.820, Maine 3.691, Texas 3.216. Next release 11/12/2026."),
     ("Weekly history per series","https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=W_EPD2F_PRS_NUS_DPG&f=W","Series ID taken from each table row's History link. U.S. heating oil 3.632 on 11/03/2025."),
     ("Summary page (cross-check)","https://www.eia.gov/petroleum/heatingoilpropane/","U.S. heating oil 6.138, week -0.092, year +2.506; U.S. propane 2.820, week +0.089, year +0.375."),
     ("Heat content","https://www.eia.gov/energyexplained/units-and-calculators/british-thermal-units.php","Heating oil 1 gallon = 138,500 Btu; propane 1 gallon = 91,452 Btu; electricity 1 kWh = 3,412 Btu; natural gas 1 therm = 100,000 Btu.")],
 fixture="The test fixtures in `test/fixtures/` are the EIA pages downloaded on 2026-11-06."),
"postage-stamp-price-mcp": dict(
 short="stamp-price",
 lead="How much is a stamp, for AI assistants. Ask what a Forever stamp costs, what it takes to mail 40 square holiday cards, or what a letter to Germany costs, and get the current USPS price with its effective date.",
 what="It reads USPS Notice 123, the official retail price list on Postal Explorer, at call time. Prices are matched by the USPS SKU on each price cell. It needs no API key.",
 tools=[("get_stamp_price","The current Forever stamp price (1 oz First-Class Mail letter), 2, 3 and 3.5 oz prices, metered prices, postcard, 1 oz large envelope, nonmachinable surcharge and the 1 oz international letter (Global Forever) price, with the effective date."),
        ("calculate_letter_postage","Postage for a letter, postcard or large envelope by weight, to the US, Canada, Mexico or another country, with the nonmachinable surcharge, a total for a quantity and the number of Forever stamps per piece."),
        ("get_flat_rate_prices","Retail Priority Mail and Priority Mail Express flat rate envelope and box prices.")],
 knows=["The price in force today. USPS changes prices once or twice a year, so a remembered stamp price is often wrong.","The effective date of the price list, so the answer can say when the price started.","Surcharges and weight steps, so \"two stamps or one?\" has an exact answer."],
 prompts=["How much is a stamp right now?","How much postage do I need for 40 square Christmas cards that weigh 1.2 oz?","How much does it cost to mail a letter to Germany?","How much is a medium flat rate box?","How much is a postcard stamp?"],
 sources=["[USPS Notice 123 Price List](https://pe.usps.com/text/dmm300/Notice123.htm), read at call time."],
 limits=["Retail prices at the Post Office. Commercial, metered and Click-N-Ship prices can be lower; metered letter prices are included.","Packages (Ground Advantage, Priority Mail by zone) are not covered beyond flat rate. Use https://postcalc.usps.com/ for those.","International large envelopes are not covered yet.","The hosted server caches the price list for up to 6 hours."],
 dev="node scripts/stdio-transcript.mjs     # live stdio round trip, writes .live/stdio-transcript.jsonl",
 ds=[("Retail price list","https://pe.usps.com/text/dmm300/Notice123.htm","\"Notice 123 • Effective October 04, 2026\". Stamped letter 1 oz $0.82, 2 oz 1.11, 3 oz 1.40, 3.5 oz 1.69; metered 1 oz $0.78; postcard $0.65; large envelope 1 oz $1.69; nonmachinable surcharge $0.49; First-Class Mail International letter 1 oz $1.75; flat rate envelope $13.90, small box $14.65, medium $25.80, large $36.10. Read at call time, cached 6 hours."),
     ("Cross-check","https://www.usps.com/ship/first-class-mail.htm","\"Forever stamps cost $0.82 (the current 1 oz price)\", postcards $0.65, large envelopes $1.69, square envelopes $1.31."),
     ("Cross-check","https://www.usps.com/business/prices.htm","Letter stamps from $0.82, postcard stamps from $0.65, Global Forever from $1.75, Priority Mail Flat Rate Envelope $13.90, Priority Mail Express Flat Rate Envelope $38.25.")],
 fixture="The test fixture in `test/fixtures/` is Notice 123 downloaded on 2026-11-06 (gzip)."),
}
for n, c in R.items():
    url = f"https://{n}.lipmichal.workers.dev/mcp"; utm = f"https://www.mcpstamp.com/servers/?utm_source=mcp&utm_medium={n}"
    tools = "\n".join(f"| `{t}` | {d} |" for t, d in c['tools'])
    md = f"""# {n}

{c['lead']}

This is a Model Context Protocol (MCP) server. {c['what']}

## Tools

| Tool | What it returns |
| --- | --- |
{tools}

Every result has structured JSON, a one-paragraph summary, `as_of`, `source` and `more` (a page on [mcpstamp.com]({utm})).

## What it knows that your model does not

""" + "\n".join(f"- {k}" for k in c['knows']) + f"""

## Install

### Hosted (Claude.ai custom connector, ChatGPT developer mode)

Paste this URL. No token, no sign-up. It works now.

```
{url}
```

### Claude Code

```
claude mcp add --transport http {c['short']} {url}
```

### Claude Desktop

Claude Desktop adds remote servers under Settings, Connectors, Add custom connector. Paste the URL above.

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{{
  "mcpServers": {{
    "{c['short']}": {{ "url": "{url}" }}
  }}
}}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{{
  "servers": {{
    "{c['short']}": {{ "type": "http", "url": "{url}" }}
  }}
}}
```

### Local stdio (after npm release)

The npm package is not published yet. After it is, run it locally with Node 20 or newer:

```
claude mcp add {c['short']} -- npx -y {n}
```

## Example prompts

""" + "\n".join(f"- \"{p}\"" for p in c['prompts']) + """

## Data sources

Full list with fetch dates in [DATA_SOURCES.md](DATA_SOURCES.md).

""" + "\n".join(f"- {s}" for s in c['sources']) + """

## Limitations

""" + "\n".join(f"- {l}" for l in c['limits']) + f"""

## More

More MCP servers that answer questions your assistant cannot answer alone are on [mcpstamp.com]({utm}).

Part of the Zovo MCP collection: https://mcp.zovo.one

Built by [theluckystrike](https://github.com/theluckystrike).

## Development

```
npm install
npm test                              # builds, then runs the fixture tests and an offline stdio test
{c['dev']}
```

## License

MIT
"""
    (H / n / 'README.md').write_text(md)
    ds = "# Data sources\n\nAll sources below were fetched on 2026-11-06 while building version 1.0.0.\n\n| Data | URL | Notes |\n|---|---|---|\n" + "\n".join(f"| {a} | {b} | {d} |" for a, b, d in c['ds']) + f"\n\n{c['fixture']}\n"
    (H / n / 'DATA_SOURCES.md').write_text(ds)
    print('ok', n)
