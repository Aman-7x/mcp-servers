#!/usr/bin/env python3
"""S1106 sat3: build sat3-live.json (can-claude-live shape) and sat3-free-servers.json (free-servers shape).
Example results are copied from the live remote tools/call responses in reports/sat-evidence-1106/<repo>-remote.json.
Tool name, title and description are copied from the live tools/list in the same files."""
import json, os

BASE = os.path.expanduser('~/mcp-servers/data/s1106')
EV = os.path.join(BASE, 'reports/sat-evidence-1106')
SRC = os.path.expanduser('~/mcp-servers/satellites')
OUT = os.path.join(BASE, 'content')
RUN = '2026-11-05'


def load(repo):
    return json.load(open(os.path.join(EV, f'{repo}-remote.json')))


def summary(ev, key):
    """Verbatim text the hosted server returned, up to the JSON block (equals its summary field)."""
    res = ev['tools_calls'][key]['response']['result']
    text = res['content'][0]['text']
    head = text.split('\n\n{')[0]
    js = json.loads(text[text.index('\n\n{') + 2:])
    assert js['summary'] == head, key
    return head, bool(res.get('isError', False)), ev['tools_calls'][key]['arguments']


def example(ev, key, prompt, note=''):
    result, is_error, args = summary(ev, key)
    return {'prompt': prompt, 'tool': key.split('#')[0], 'args': args, 'result': result,
            'note': note, 'is_error': is_error, 'run': RUN}


def tools(ev, repo):
    out = []
    src = open(os.path.join(SRC, repo, 'src/tools.ts')).read()
    for t in ev['tools_list']['result']['tools']:
        assert t['name'] in src and t['title'] in src, (repo, t['name'])
        out.append({'name': t['name'], 'title': t['title'], 'description': t['description']})
    return out


usps, heat, post = (load(r) for r in ('usps-holiday-shipping-deadlines-mcp', 'heating-oil-propane-prices-mcp', 'postage-stamp-price-mcp'))

pages = [
    {
        'slug': 'check-usps-holiday-shipping-deadlines',
        'repo': 'usps-holiday-shipping-deadlines-mcp',
        'h1': 'Can Claude check USPS holiday shipping deadlines?',
        'title': 'Can Claude check USPS holiday shipping deadlines? 2026 send-by dates',
        'query': 'usps holiday shipping deadlines',
        'answer': "Yes with web search, with one caution. USPS posts new send-by dates every fall, so from training data alone Claude may give last year's dates. With web search on, Claude can find the USPS page, but you still have to check that it read the 2026 table and the right row for your destination. Connect the free USPS Holiday Shipping Deadlines server and Claude reads the USPS holiday shipping dates page when you ask. It gives the send-by date for each mail class to the lower 48, Alaska, Hawaii, other countries and APO/FPO/DPO ZIP codes, counts the days left in US Eastern time and names the slowest service that still makes December 25. These are USPS recommendations, not guarantees. UPS and FedEx are not covered.",
        'native': [
            'Explains the USPS mail classes and how long each one usually takes.',
            'Finds the USPS holiday dates page when web search is on.',
        ],
        'needs': [
            "This year's USPS send-by date for each mail class, read from usps.com at call time.",
            'The days left from today in US Eastern time for your destination.',
            'The slowest service that still arrives by December 25, including APO/FPO/DPO mail.',
        ],
        'example': example(usps, 'get_usps_holiday_shipping_deadlines', 'When is the last day to ship with USPS for Christmas?',
                           'Run on 2026-11-05 in US Eastern time. The days left change every day, and the server counts them again each time you ask.'),
        'example2': example(usps, 'check_holiday_ship_by_date', 'If I mail a gift to Germany on December 10, will it arrive by Christmas?'),
        'faq': [
            {'q': 'Is the send-by date a guarantee?',
             'a': 'No. USPS calls these dates recommendations. Weather, volume and customs can delay a package. Ship a few days early when you can.'},
            {'q': 'Does it cover UPS and FedEx?',
             'a': 'No. It covers USPS only. UPS and FedEx publish their own holiday dates on their sites.'},
        ],
    },
    {
        'slug': 'check-heating-oil-and-propane-prices',
        'repo': 'heating-oil-propane-prices-mcp',
        'h1': 'Can Claude check heating oil and propane prices?',
        'title': 'Can Claude check heating oil and propane prices? EIA weekly state averages',
        'query': 'heating oil prices',
        'answer': "Yes with web search, with one caution. Prices change every week in the heating season, so from training data alone Claude does not have this week's number. With web search on, Claude can find a price, but news stories and dealer pages often show a different number from the official state average, sometimes without the date. Connect the free Heating Oil and Propane Prices server and Claude reads the U.S. Energy Information Administration (EIA) weekly survey when you ask. It gives the price per gallon for the US or a surveyed state, the change from last week and a year ago, and the cost of a delivery, and it compares heating oil and propane per million Btu. These are state averages, not a quote from your dealer. For a state EIA does not survey, it says so.",
        'native': [
            'Explains how heating oil, propane, gas and electric heat compare.',
            'Finds a price on a web page when web search is on.',
        ],
        'needs': [
            "This week's EIA residential heating oil and propane price for your state, with the week date.",
            'The change from last week and from a year ago, and weekly history between two dates.',
            'The cost of a fill at the state average and the cost per million Btu.',
        ],
        'example': example(heat, 'get_heating_oil_propane_prices#1', 'What are heating oil and propane prices in Maine this week?',
                           'Run on 2026-11-05 with the EIA release of 2026-11-04. EIA publishes new prices on Wednesdays from October to March, and the server reads the newest week each time you ask.'),
        'example2': example(heat, 'estimate_heating_fuel_cost', 'What does 200 gallons of heating oil cost in Connecticut right now?'),
        'faq': [
            {'q': 'Is this the price my dealer will charge?',
             'a': 'No. EIA reports a state average of residential prices with taxes. Your dealer price depends on the company, the amount you buy and any contract. Give the server your own price to work out a delivery.'},
            {'q': 'Why is there no price in summer?',
             'a': 'EIA runs the residential heating oil and propane survey from October to March. Outside those months the server returns the last week EIA published.'},
        ],
    },
    {
        'slug': 'tell-me-how-much-a-stamp-costs',
        'repo': 'postage-stamp-price-mcp',
        'h1': 'Can Claude tell me how much a stamp costs?',
        'title': 'Can Claude tell me how much a stamp costs? USPS price list today',
        'query': 'how much is a stamp',
        'answer': "Yes with web search, with one caution. USPS changes prices once or twice a year, so from training data alone Claude may give an older stamp price. With web search on, Claude can look it up, but articles about past price changes rank well and are easy to repeat. Connect the free Postage Stamp Price server and Claude reads USPS Notice 123, the official retail price list, when you ask, with its effective date. It gives the Forever stamp price, the extra ounce, postcards, large envelopes, the surcharge for square cards and the Global Forever price, works out postage for a stack of holiday cards and lists flat rate prices.",
        'native': [
            'Explains Forever stamps, ounces and the surcharge for square cards.',
            'Finds a stamp price on a web page when web search is on.',
        ],
        'needs': [
            'The Forever stamp price from the USPS price list in force today, with its effective date.',
            'Postage for a letter, postcard or large envelope by weight, to the US or another country.',
            'The total for a stack of cards and how many Forever stamps each one needs.',
        ],
        'example': example(post, 'get_stamp_price', 'How much is a stamp right now?',
                           'Run on 2026-11-05. The server reads Notice 123 each time you ask, so a new USPS price shows up with its new effective date.'),
        'example2': example(post, 'calculate_letter_postage', 'What postage do 40 square holiday cards weighing 1.2 oz each need?'),
        'faq': [
            {'q': 'Is a Forever stamp still good after a price increase?',
             'a': 'Yes. A Forever stamp is always worth the current 1 oz First-Class Mail letter price, whatever you paid for it.'},
            {'q': 'Why do square cards cost more?',
             'a': 'Square, rigid or lumpy letters cannot go through the sorting machines, so USPS adds a nonmachinable surcharge to each one.'},
        ],
    },
]

servers = [
    {
        'repo': 'usps-holiday-shipping-deadlines-mcp',
        'topic': 'USPS holiday shipping deadlines',
        'name': 'USPS Holiday Shipping Deadlines',
        'tagline': 'The USPS send-by dates for Christmas delivery this year by mail class and destination, with the days left from today.',
        'knows': [
            'The 2026 USPS recommended send-by dates for delivery by December 25 for Ground Advantage, First-Class Mail, Priority Mail and Priority Mail Express to the lower 48, Alaska, Hawaii, Puerto Rico and territories.',
            'International send-by dates by USPS world region and APO/FPO/DPO military dates by ZIP group.',
            'The days left from today in US Eastern time and the slowest service still on time. USPS calls these recommendations, not guarantees. UPS and FedEx are not covered.',
        ],
        'sources': 'USPS holiday shipping dates page (usps.com/holiday/holiday-shipping-dates.htm), read at call time, with a built-in copy of the 2026 table as the fallback.',
        'hosted_url': 'https://usps-holiday-shipping-deadlines-mcp.lipmichal.workers.dev/mcp',
        'repo_url': 'https://github.com/theluckystrike/usps-holiday-shipping-deadlines-mcp',
        'npm': None,
        'tools_checked': '2026-11-05',
        'added': '2026-11-06',
        'money_site': None,
        'prompts': [
            'When is the last day to ship with USPS for Christmas?',
            'If I mail a gift to Germany on December 10, will it arrive by Christmas?',
            'What is the holiday mailing deadline for APO 09021?',
        ],
        'tools': tools(usps, 'usps-holiday-shipping-deadlines-mcp'),
    },
    {
        'repo': 'heating-oil-propane-prices-mcp',
        'topic': 'Heating oil and propane prices',
        'name': 'Heating Oil and Propane Prices',
        'tagline': "This week's EIA average residential heating oil and propane price per gallon for the US or your state, and what a delivery costs.",
        'knows': [
            'The latest EIA weekly residential heating oil and propane price per gallon for the US, an EIA region or a surveyed state, with the week date, the change from last week and the price a year ago.',
            'Weekly price history between two dates, with the high, low and average.',
            'The cost of a delivery at the state average or your own price, and heating oil against propane per million Btu. These are state averages, not a dealer quote.',
        ],
        'sources': 'U.S. Energy Information Administration (EIA) weekly heating oil and propane survey tables and weekly history pages (eia.gov), read at call time, and EIA heat contents for the Btu comparison.',
        'hosted_url': 'https://heating-oil-propane-prices-mcp.lipmichal.workers.dev/mcp',
        'repo_url': 'https://github.com/theluckystrike/heating-oil-propane-prices-mcp',
        'npm': None,
        'tools_checked': '2026-11-05',
        'added': '2026-11-06',
        'money_site': None,
        'prompts': [
            'What are heating oil and propane prices in Maine this week?',
            'How have propane prices in Minnesota changed over the last year?',
            'What does 200 gallons of heating oil cost in Connecticut right now?',
        ],
        'tools': tools(heat, 'heating-oil-propane-prices-mcp'),
    },
    {
        'repo': 'postage-stamp-price-mcp',
        'topic': 'Postage stamp price',
        'name': 'Postage Stamp Price',
        'tagline': 'The current USPS Forever stamp price and letter, postcard and flat rate postage from the official USPS price list.',
        'knows': [
            'The Forever stamp price from USPS Notice 123 with its effective date ($0.82 from October 4, 2026), plus the extra ounce, postcard, large envelope and Global Forever prices.',
            'Postage for a letter, postcard or large envelope by weight to the US or another country, with the surcharge for square cards and the total for a quantity.',
            'Retail Priority Mail and Priority Mail Express flat rate envelope and box prices.',
        ],
        'sources': 'USPS Notice 123, the official retail price list on Postal Explorer (pe.usps.com/text/dmm300/Notice123.htm), read at call time with its effective date.',
        'hosted_url': 'https://postage-stamp-price-mcp.lipmichal.workers.dev/mcp',
        'repo_url': 'https://github.com/theluckystrike/postage-stamp-price-mcp',
        'npm': None,
        'tools_checked': '2026-11-05',
        'added': '2026-11-06',
        'money_site': None,
        'prompts': [
            'How much is a stamp right now?',
            'What postage do 40 square holiday cards weighing 1.2 oz each need?',
            'What does a Large Flat Rate Box cost?',
        ],
        'tools': tools(post, 'postage-stamp-price-mcp'),
    },
]

json.dump({'pages': pages}, open(os.path.join(OUT, 'sat3-live.json'), 'w'), indent=1, ensure_ascii=False)
open(os.path.join(OUT, 'sat3-live.json'), 'a').write('\n')
json.dump({'servers': servers}, open(os.path.join(OUT, 'sat3-free-servers.json'), 'w'), indent=1, ensure_ascii=False)
open(os.path.join(OUT, 'sat3-free-servers.json'), 'a').write('\n')
print('ok')
