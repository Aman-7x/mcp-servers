#!/usr/bin/env python3
"""Generate the public MCP hub (58 server pages + index + index.json) for the
claudecodeguides.com Jekyll site.

Why this site: mcp.zovo.one cannot be deployed (no valid Cloudflare token), and it has
2/289 URLs indexed. claudecodeguides.com is a Jekyll site on GitHub Pages with a custom
domain, ~1,950 URLs already in its sitemap and a real crawl history, so it is the only
surface in the estate that can be updated today AND is already crawled.

Usage:
  git clone --depth 1 https://github.com/theluckystrike/claude-skills-guide.git csg
  python3 scripts/build_hub.py --site /path/to/csg
"""
import argparse
import html
import json
import os
import re
import sys

CATEGORIES = [
    ("Invoicing and billing", [
        "invoice", "quotes", "recurring", "credit-note", "dunning-letters",
        "statement-of-account", "duplicate-invoice-check", "bill-of-sale",
        "change-order", "deposits", "stripe-billing", "billing-docs", "office-suite",
    ]),
    ("Documents and files", [
        "pdf", "docx", "spreadsheet", "image", "zip", "barcode", "catalogue",
        "packing-list", "resume", "clauses", "service-agreement", "checklist",
    ]),
    ("Money and accounting", [
        "amortization", "asset-register", "bank-statement", "budget", "cash-book",
        "currency", "expense-tracker", "goods-receipt", "loan-calculator", "payroll",
        "petty-cash", "receipts", "tax-calc", "three-way-match",
        "supplier-statement-check", "purchase-requisition", "mileage-log",
        "per-diem", "hourly-rate",
    ]),
    ("Time and operations", [
        "time-tracker", "kanban", "job-card", "work-order", "leave", "pomodoro",
        "maintenance-log", "calendar", "timezone", "delivery-schedule", "onboarding",
        "supplier-list", "price-tracker",
    ]),
    ("Web and SEO", ["backlink-checker"]),
    ("Cooking and recipes", ["ingredient-convert"]),
]

VERBS = {
    "create": "Create", "add": "Add", "list": "List", "get": "Get", "set": "Set",
    "update": "Update", "delete": "Delete", "remove": "Remove", "report": "Report",
    "generate": "Generate", "calc": "Calculate", "calculate": "Calculate",
    "export": "Export", "import": "Import", "find": "Find", "search": "Search",
    "check": "Check", "render": "Render", "build": "Build", "parse": "Parse",
    "convert": "Convert", "send": "Send", "mark": "Mark", "record": "Record",
    "render_pdf": "Render PDF", "summary": "Summarise", "verify": "Verify",
    "validate": "Validate", "preview": "Preview", "merge": "Merge", "split": "Split",
}
NOT_VERBS = {"loans", "loan", "asset", "invoice", "expense", "time", "tax", "payroll"}


def humanise_tool(tool):
    parts = tool.split("_")
    if len(parts) >= 2 and parts[0] in VERBS and parts[0] not in NOT_VERBS:
        return VERBS[parts[0]] + " " + " ".join(parts[1:])
    return None


def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def clean_long(desc, long_desc):
    """README first paragraphs are sometimes install notes, not prose."""
    bad = ("npm publish", "one-click", "```", "|", "<", "http")
    if not long_desc or len(long_desc) < 90 or long_desc.lower().startswith(bad):
        return desc
    if any(long_desc.lower().startswith(b) for b in bad):
        return desc
    return long_desc


def meta_desc(text, limit=150):
    """Frontmatter description: cut on a word boundary, never mid-word."""
    t = (text or "").replace('"', "'").strip()
    if len(t) <= limit:
        return t
    cut = t[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:")
    return cut + "…"


GUIDE_FOR = {
    "bank-statement": "convert-bank-statement-to-csv",
    "purchase-requisition": "create-purchase-order-chatgpt",
    "spreadsheet": "edit-excel-file-claude",
    "docx": "fill-word-template-ai",
    "invoice": "generate-invoice-pdf-claude",
    "quotes": "generate-quote-pdf-cursor",
    "currency": "mcp-server-currency-conversion",
    "expense-tracker": "mcp-server-expense-tracking",
    "time-tracker": "mcp-server-time-tracking",
    "mileage-log": "track-mileage-ai-assistant",
}


# Free live-data satellites (data/satellite_hub.json, written by collect_satellite_hub.py).
# Editorial copy only: a short name, the search phrase that follows "MCP server", and the
# back-office server pages that should link to the satellite. Every fact on a satellite page
# comes from the json (README, live tools/list, live tools/call), never from this table.
SATELLITE_COPY = {
    "ab-test-sample-size-calculator-mcp": ("A/B test sample size calculator", "that calculates A/B test sample size and significance", []),
    "aca-premium-tax-credit-calculator-mcp": ("ACA premium tax credit calculator", "for the 2026 ACA premium tax credit", ["tax-calc"]),
    "address-to-census-tract-mcp": ("Address to census tract", "that finds the census tract for a US address", []),
    "ap-score-distributions-mcp": ("AP score distributions", "with the 2026 AP score distributions", []),
    "car-loan-interest-deduction-calculator-mcp": ("Car loan interest deduction calculator", "that calculates the new car loan interest deduction", ["tax-calc", "loan-calculator"]),
    "cpi-inflation-calculator-mcp": ("CPI inflation calculator", "that adjusts a dollar amount for inflation with official CPI data", ["currency"]),
    "cups-to-grams-mcp": ("Cups to grams converter", "that converts cups to grams by ingredient", []),
    "drug-shortage-list-mcp": ("FDA drug shortage list", "that checks the FDA drug shortage list", []),
    "dscr-loan-calculator-mcp": ("DSCR loan calculator", "that calculates DSCR for a rental property loan", ["amortization", "loan-calculator"]),
    "estate-gift-tax-exemption-calculator-mcp": ("Estate and gift tax exemption calculator", "that knows the 2026 estate and gift tax exemption", ["tax-calc"]),
    "gold-price-per-gram-mcp": ("Gold price per gram", "for the current gold price per gram", ["currency", "price-tracker"]),
    "i-bond-rate-mcp": ("I bond rate", "for the current I bond rate", []),
    "irs-mileage-rate-per-diem-mcp": ("IRS mileage rate and per diem", "for the 2026 IRS mileage rate and current per diem rates", ["mileage-log", "per-diem", "expense-tracker"]),
    "lake-level-mcp": ("Lake level", "for current lake and reservoir water levels", []),
    "minimum-wage-mcp": ("Minimum wage", "that looks up the minimum wage for a US state", ["payroll", "hourly-rate"]),
    "mortgage-rates-today-mcp": ("Mortgage rates today", "for mortgage rates today from Freddie Mac", ["amortization", "loan-calculator"]),
    "no-tax-on-overtime-mcp": ("No tax on overtime calculator", "that calculates the no tax on overtime deduction", ["payroll", "tax-calc"]),
    "paycheck-calculator-mcp": ("Paycheck calculator", "that calculates take-home pay after federal and state tax", ["payroll", "hourly-rate"]),
    "raw-to-cooked-weight-mcp": ("Raw to cooked weight", "that converts raw meat weight to cooked weight", []),
    "recipe-nutrition-calculator-mcp": ("Recipe nutrition calculator", "that calculates recipe nutrition per serving", []),
    "retirement-contribution-limits-2027-mcp": ("Retirement contribution limits", "that knows the current 401(k) contribution limits", ["payroll"]),
    "river-level-mcp": ("River level", "for the current water level of a river", []),
    "sat-score-percentiles-mcp": ("SAT score percentiles", "that looks up SAT score percentiles", []),
    "section-179-deduction-calculator-mcp": ("Section 179 deduction calculator", "that calculates the Section 179 deduction for 2026", ["asset-register", "tax-calc"]),
    "silver-price-per-gram-mcp": ("Silver price per gram", "for the current silver price per gram", ["currency", "price-tracker"]),
    "social-security-cola-2027-mcp": ("Social Security COLA 2027", "for the 2027 Social Security COLA and full retirement age", []),
    "student-loan-repayment-assistance-plan-calculator-mcp": ("Student loan RAP calculator", "that calculates the new RAP student loan payment", []),
    "subdomain-finder-mcp": ("Subdomain finder", "that finds subdomains from certificate transparency logs", ["backlink-checker"]),
    "uk-income-tax-salary-mcp": ("UK income tax and salary", "that calculates UK take-home pay for 2026/27", ["payroll"]),
    "uk-statutory-sick-pay-maternity-pay-calculator-mcp": ("UK Statutory Sick Pay and Maternity Pay", "that calculates UK Statutory Sick Pay under the April 2026 rules", ["leave"]),
    "us-federal-holidays-business-days-mcp": ("US federal holidays and business days", "that counts business days excluding US federal holidays", ["calendar", "recurring", "invoice"]),
    "uv-index-today-mcp": ("UV index today", "for the UV index today by ZIP code", []),
    "vegetable-yield-percentage-mcp": ("Vegetable yield percentage", "for vegetable yield and trim loss", []),
}
SAT_SECTION_ANCHOR = "free-live-data-mcp-servers-no-key"


def sat_copy(sat):
    name, phrase, related = SATELLITE_COPY.get(
        sat["repo"], (sat["repo"][:-4].replace("-", " ").capitalize(), "for " + sat["repo"][:-4].replace("-", " "), []))
    return name, phrase, related


def hub_link(url, repo):
    """The satellite's own money-site link, re-tagged so hub clicks are told apart from tool results."""
    if not url:
        return None
    u = re.sub(r"[?&]utm_[a-z]+=[^&]*", "", url).rstrip("?&")
    return u + ("&" if "?" in u else "?") + "utm_source=claudecodeguides&utm_medium=mcp-hub&utm_campaign=" + repo


def first_sentence(text, limit=170):
    t = re.sub(r"\s+", " ", text or "").strip()
    # split only after a lowercase word, digit or ")" so "U.S." and "e.g." stay whole
    m = re.match(r"(.+?[a-z0-9)][.!?])(?:\s+(?=[A-Z])|$)", t)
    t = m.group(1) if m else t
    if len(t) > limit:
        t = t[: limit - 1].rsplit(" ", 1)[0].rstrip(" ,;:") + "..."
    return t.replace("|", "/")


def load_satellites(path):
    if not path or not os.path.exists(path):
        return []
    return json.load(open(path, encoding="utf-8")).get("satellites", [])


def satellite_page(sat, sats, by_id, base="https://claudecodeguides.com", layout="default", canonical_base=""):
    repo = sat["repo"]
    name, phrase, related_ids = sat_copy(sat)
    short = repo[:-4]
    url = sat["hosted_url"]
    ex = sat["example"]
    question = "Is there an MCP server %s?" % phrase
    money = hub_link(ex.get("more"), repo)
    money_host = re.sub(r"^https?://(www\.)?", "", money).split("/")[0] if money else None
    called = (ex.get("called_at") or "")[:10]
    tools_md = "| Tool | What it does |\n| --- | --- |\n" + "\n".join(
        "| `%s` | %s |" % (t["name"], first_sentence(t["description"])) for t in sat["tools"])
    knows_md = "\n".join("%d. %s" % (i + 1, k) for i, k in enumerate(sat["knows"]))
    stamp_free = sat.get("stamp_free_server") or "https://www.mcpstamp.com/free-servers/"
    can = sat.get("stamp_can_claude") or []
    can_md = "".join(
        "\n- [%s](%s) on mcpstamp.com, the plain-English answer with a live call" % (
            html.unescape(c.get("h1") or "Can Claude " + c["url"].rstrip("/").rsplit("/", 1)[-1].replace("-", " ") + "?"),
            c["url"])
        for c in can)
    links_md = (
        "- [github.com/theluckystrike/%s](%s), source, README and data sources (MIT)\n"
        "- [%s](%s) on the mcpstamp.com free server list%s" % (repo, sat["repo_url"], stamp_free.replace("https://", ""), stamp_free, can_md)
    )
    if money:
        links_md += "\n- [%s](%s), the companion site this server's results link to" % (money_host, money)
    sib = [x for x in sats if x["repo"] != repo]
    # three neighbours in the alphabetical list, wrapping, so every page gets distinct links
    i = [x["repo"] for x in sats].index(repo)
    neigh = [sats[(i + k) % len(sats)] for k in (1, 2, 3) if sats[(i + k) % len(sats)]["repo"] != repo][:3]
    rel_lines = ["- [%s MCP server](/mcp/%s/). %s" % (sat_copy(x)[0], x["repo"], first_sentence(x["description"], 200)) for x in neigh]
    rel_lines += ["- [%s MCP server](/mcp/%s/) from the back-office collection" % (by_id[r]["human"], by_id[r]["slug"])
                  for r in related_ids if r in by_id]
    rel_md = "\n".join(rel_lines[:5])
    desc = sat["description"].rstrip(".") + "."
    lead = (
        "Looking for an MCP server %s? `%s` is free, MIT licensed and needs no API key and no "
        "account. Paste %s into any MCP client that takes a remote server URL. %s"
        % (phrase, repo, url, desc)
    )
    faq = [
        (question,
         "Yes. %s (%s) is a free MCP server. %s It is hosted at %s with no token, and it also runs "
         "locally with npx -y github:theluckystrike/%s." % (name, repo, desc, url, repo)),
        ("Does the %s MCP server need an API key?" % name,
         "No. The hosted endpoint answers tools/list and tools/call without a token or sign-up. "
         "The example on this page was called that way on %s." % called),
        ("Is it free?",
         "Yes. The code is MIT licensed and the hosted endpoint is free to call. This server has no paid tier "
         "at all."),
        ("Where do the numbers come from?",
         "Each result carries an as_of date and a source. In the live call on this page the source "
         "was %s. The full source list is in DATA_SOURCES.md in the repository."
         % (ex.get("source") or "listed in the result")),
    ]
    faq_md = "\n".join("### %s\n\n%s\n" % (q, a) for q, a in faq)
    page_url = base + "/mcp/%s/" % repo
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "name": "%s MCP server" % name,
                "alternateName": repo,
                "applicationCategory": "DeveloperApplication",
                "operatingSystem": "macOS, Windows, Linux, any MCP client over Streamable HTTP",
                "description": desc,
                "softwareVersion": sat.get("version") or "1.0.0",
                "url": page_url,
                "codeRepository": sat["repo_url"],
                "license": "https://opensource.org/licenses/MIT",
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD",
                           "description": "Free. Hosted endpoint with no API key, or run locally with npx."},
                "isPartOf": {"@type": "ItemList", "name": "Free live-data MCP servers (no key)",
                             "url": base + "/mcp/#" + SAT_SECTION_ANCHOR},
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                    for q, a in faq
                ],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": base + "/"},
                    {"@type": "ListItem", "position": 2, "name": "MCP servers", "item": base + "/mcp/"},
                    {"@type": "ListItem", "position": 3, "name": name, "item": page_url},
                ],
            },
        ],
    }
    canon = ("canonical_url: %s/mcp/%s/\ncanonical: %s/mcp/%s/\n" % (canonical_base, repo, canonical_base, repo)
             ) if canonical_base else ""
    return """---
layout: %(layout)s
title: "%(name)s MCP server (free, no API key)"
description: "%(meta)s"
permalink: /mcp/%(repo)s/
%(canon)sdate: %(date)s
---

# %(name)s MCP server (free, no API key)

<script type="application/ld+json">
%(ld)s
</script>

%(lead)s

Tools %(ntools)d, version %(ver)s, licence MIT. Part of the [free live-data MCP servers](/mcp/#%(anchor)s) on this hub.

## What it answers that a model cannot answer alone

A language model answers from training data that is months old and does arithmetic from memory. This server returns the current figure with its source. In the words of its README, it knows these things that your model does not.

%(knows)s

## Connect it with no key

Hosted URL for Claude.ai custom connectors, ChatGPT developer mode and any client that takes a remote MCP server. Paste it as is. No token, no sign-up.

```
%(url)s
```

Claude Code, hosted or local:

```
claude mcp add --transport http %(short)s %(url)s
claude mcp add %(short)s -- npx -y github:theluckystrike/%(repo)s
```

Claude Desktop (`claude_desktop_config.json`), runs locally with Node 20 or newer:

```json
{
  "mcpServers": {
    "%(short)s": { "command": "npx", "args": ["-y", "github:theluckystrike/%(repo)s"] }
  }
}
```

Cursor (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "%(short)s": { "url": "%(url)s" }
  }
}
```

## Tools it exposes

%(tools)s

## Example output from a live call

Called on %(called)s against the hosted URL above, with no token. The prompt was "%(prompt)s" and the client sent this call.

```json
{"name": "%(tool)s", "arguments": %(args)s}
```

The server answered with this plain-English summary (the structured JSON that follows it in the result is left out here).

```text
%(summary)s
```

Data as of `%(as_of)s`. The result also returns the source URL and a link for more detail.

## Questions people actually ask

%(faq)s

## Links

%(links)s

## More free live-data servers

%(related)s

---

[All MCP servers on this hub](/mcp/) &middot; [free live-data servers with no key](/mcp/#%(anchor)s)
""" % {
        "layout": layout,
        "name": name,
        "meta": meta_desc("Free MCP server %s. No API key: paste the hosted URL. %s" % (phrase, desc)),
        "repo": repo,
        "canon": canon,
        "date": called or "2026-11-03",
        "ld": json.dumps(ld, indent=1, ensure_ascii=False),
        "lead": lead,
        "ntools": len(sat["tools"]),
        "ver": sat.get("version") or "1.0.0",
        "anchor": SAT_SECTION_ANCHOR,
        "knows": knows_md,
        "url": url,
        "short": short,
        "tools": tools_md,
        "called": called,
        "prompt": ex["prompt"].replace('"', "'"),
        "tool": ex["tool"],
        "args": json.dumps(ex["arguments"], ensure_ascii=False),
        "summary": ex["summary"],
        "as_of": ex.get("as_of") or "see result",
        "faq": faq_md,
        "links": links_md,
        "related": rel_md,
    }


def satellite_index_section(sats):
    if not sats:
        return ""
    rows = ["| Server | Ask it | Hosted URL (no key) |", "| --- | --- | --- |"]
    for x in sats:
        name, phrase, _ = sat_copy(x)
        rows.append("| [%s](/mcp/%s/) | Is there an MCP server %s? Yes, this one. | `%s` |"
                    % (name, x["repo"], phrase, x["hosted_url"]))
    return """
## Free live-data MCP servers (no key)

These %(n)d servers answer what a model cannot answer from training data alone: today's prices and
water levels, tax rules and limits that changed in 2025 and 2026, and exact calendar and table
lookups. Each one is free, MIT licensed and hosted with no API key, so you can paste the URL into
Claude.ai, ChatGPT developer mode, Cursor or Claude Code. Each page shows a real call made against
the hosted URL.

%(table)s
""" % {"n": len(sats), "table": "\n".join(rows)}


def page_body(s, cat, siblings, total=58, base="https://claudecodeguides.com", layout="default",
              canonical_base="", sat_links=None):
    tools = s["tools"]
    rows = []
    for t in tools:
        gloss = humanise_tool(t)
        rows.append("| `%s` | %s |" % (t, gloss) if gloss else "| `%s` | see tool reference |" % t)
    tool_table = (
        "| Tool | What it does |\n| --- | --- |\n" + "\n".join(rows)
        if rows
        else "_The tool list is published in the server manifest (`server.json`) and the repository README._"
    )
    host = "https://mcp.zovo.one/mcp/" + s["id"]
    hosted_live = bool(s.get("hosted_live"))
    hosted_n = sum(1 for x in siblings if x.get("hosted_live"))
    if hosted_live:
        install_hosted = (
            "- **Hosted, nothing to install:** open https://mcp.zovo.one/mcp/connect - it mints "
            "a free token and prints a ready URL, `%s/t/<token>`. Paste that into your client. "
            "The bare `%s` hands out the tool list but answers tool calls with HTTP 401, which is "
            "why the tokenised URL is the one to use." % (host, host)
        )
    else:
        install_hosted = (
            "- **Hosted endpoint:** not open for this server yet - use the `.mcpb` bundle "
            "or build from source below. The other %d servers in the suite are already hosted."
            % hosted_n
        )
    guide_slug = GUIDE_FOR.get(s["id"])
    guide_md = ""
    if guide_slug:
        gp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                          "content", "aeo", guide_slug + ".md")
        m = re.search(r'^title:\s*"?([^"\n]+)', open(gp, encoding="utf-8").read(), re.M) if os.path.exists(gp) else None
        label = m.group(1).strip() if m else "step-by-step guide"
        guide_md = "\n- **Walk-through with real output:** [%s](/mcp/guides/%s/)" % (label, guide_slug)
    related = [x for x in siblings if x["id"] != s["id"]][:4]
    rel_md = "\n".join(
        "- [%s MCP server](/mcp/%s/) — %s" % (r["human"], r["slug"], r["description"][:110])
        for r in related
    )
    if sat_links:
        rel_md += "\n\n## Free live-data servers that pair with this one\n\n" + "\n".join(
            "- [%s MCP server](/mcp/%s/), free with no API key. %s" % (n, r, d) for n, r, d in sat_links
        )
    mcpb_line = (
        "- **Claude Desktop, one click:** [download the `.mcpb` bundle](%s)"
        % s["mcpb"]
        if s["mcpb"]
        else "- **Claude Desktop:** build from the repository and add it to `claude_desktop_config.json`."
    )
    faq = [
        (
            "Is the %s MCP server free?" % s["human"],
            "Yes. Running %s locally is free and unlimited, and the code is MIT licensed. "
            "%s"
            " No subscription and no account are required."
            % (
                s["human"],
                (
                    "There is a one-time $%d Pro licence for the hosted endpoint, which removes "
                    "the saved-report cap." % s["price_usd"]
                    if hosted_live
                    else "This server is local-only today, so there is nothing to pay for."
                ),
            ),
        ),
        (
            "Does %s need an API key?" % s["human"],
            "No. The server works offline against local files."
            + (
                " If you use the hosted endpoint, the connection is authenticated with a "
                "scoped token instead of a per-tool API key."
                if hosted_live
                else ""
            ),
        ),
        (
            "Where does the data go?",
            "Local installs keep everything on your machine. The hosted endpoint stores records in "
            "an isolated per-tenant namespace, and only for servers you actually call.",
        ),
        (
            "Which clients can use it?",
            "Any MCP client: Claude Desktop (via the .mcpb bundle), Claude Code, Cursor, Windsurf, "
            "VS Code with an MCP extension, or your own agent over the Streamable HTTP transport.",
        ),
    ]
    faq_md = "\n".join(
        "### %s\n\n%s\n" % (q, a) for q, a in faq
    )
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "SoftwareApplication",
                "name": "%s MCP server" % s["human"],
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "macOS, Windows, Linux",
                "description": s["description"],
                "softwareVersion": s["version"],
                "url": base + "/mcp/%s/" % s["slug"],
                "codeRepository": "https://github.com/theluckystrike/mcp-servers/tree/main/servers/%s" % s["id"],
                "license": "https://opensource.org/licenses/MIT",
                "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD",
                    "description": (
                        "Free tier: unlimited local use. Optional one-time Pro licence for the hosted endpoint."
                        if hosted_live
                        else "Free: unlimited local use, MIT licensed. No hosted tier for this server yet."
                    ),
                },
                "isPartOf": {
                    "@type": "ItemList",
                    "name": "Back-office MCP server collection",
                    "url": base + "/mcp/",
                },
            },
            {
                "@type": "FAQPage",
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {"@type": "Answer", "text": a},
                    }
                    for q, a in faq
                ],
            },
            {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Home", "item": base + "/"},
                    {"@type": "ListItem", "position": 2, "name": "MCP servers", "item": base + "/mcp/"},
                    {"@type": "ListItem", "position": 3, "name": s["human"], "item": base + "/mcp/%s/" % s["slug"]},
                ],
            },
        ],
    }
    return """---
layout: %(layout)s
title: "%(title)s MCP server: install, tools and pricing"
description: "%(descshort)s"
permalink: /mcp/%(slug)s/
%(canon)sdate: 2026-10-28
---

# %(human)s MCP server

<script type="application/ld+json">
%(ld)s
</script>

%(long)s

**Category:** %(cat)s &middot; **Tools:** %(ntools)d &middot; **Version:** %(ver)s &middot; **Licence:** MIT

## Install it

%(install_hosted)s
%(mcpb)s%(guide)s
- **From source:** `git clone https://github.com/theluckystrike/mcp-servers` then build `servers/%(sid)s`.
- **npm:** the package `%(npm)s` is staged and publishes shortly; the `.mcpb` bundle is the supported install until then.

## Tools it exposes

%(tools)s

## Pricing

Free to run locally, forever. The **Pro licence is $%(price)d, one time, lifetime** — it changes only the
hosted endpoint's saved-report cap, never the tools. All %(total)d servers together are
[$%(bundle)d as a bundle](/mcp/#pricing) instead of $%(full)d bought one at a time.

[Buy the %(human)s Pro licence — $%(price)d](%(buy)s?src=hub.%(slug)s)

## Questions people actually ask

%(faq)s

## Related servers in the same category

%(related)s

---

[All %(total)d back-office MCP servers](/mcp/) &middot; [how the collection is organised](/mcp/#how-it-fits-together)
""" % {
        "title": s["human"],
        "descshort": meta_desc(s["description"]),
        "slug": s["slug"],
        "ld": json.dumps(ld, indent=1, ensure_ascii=False),
        "human": s["human"],
        "long": clean_long(s["description"], s["long_description"]),
        "cat": cat,
        "ntools": len(tools),
        "ver": s["version"],
        "host": host,
        "install_hosted": install_hosted,
        "mcpb": mcpb_line,
        "sid": s["id"],
        "npm": s["npm"],
        "tools": tool_table,
        "price": s["price_usd"],
        "buy": s["buy_url"],
        "faq": faq_md,
        "related": rel_md,
        "guide": guide_md,
        "canon": (
            "canonical_url: %s/mcp/%s/\ncanonical: %s/mcp/%s/\n"
            % (canonical_base, s["slug"], canonical_base, s["slug"])
        ) if canonical_base else "",
        "total": total,
        "layout": layout,
        "bundle": 39,
        "full": 58 * 19,
    }


def index_page(cat_map, total, bundle, base="https://claudecodeguides.com", layout="default", sats=None):
    sections = []
    for cat, rows in cat_map:
        lines = ["### " + cat, "", "| Server | Tools | What it does | Price |", "| --- | --- | --- | --- |"]
        for s in rows:
            lines.append(
                "| [%s](/mcp/%s/) | %d | %s | [Pro $%d](%s?src=hub.table.%s) |"
                % (
                    s["human"],
                    s["slug"],
                    len(s["tools"]),
                    (s["description"] or "")[:120].replace("|", "/"),
                    s["price_usd"],
                    s["buy_url"],
                    s["slug"],
                )
            )
        sections.append("\n".join(lines))
    table = "\n\n".join(sections)
    ld = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Back-office MCP servers",
        "numberOfItems": total,
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": s["human"] + " MCP server",
                "url": base + "/mcp/%s/" % s["slug"],
            }
            for i, s in enumerate([s for _, rows in cat_map for s in rows])
        ],
    }
    if sats:
        ld = {
            "@context": "https://schema.org",
            "@graph": [
                {k: v for k, v in ld.items() if k != "@context"},
                {
                    "@type": "ItemList",
                    "name": "Free live-data MCP servers (no key)",
                    "url": base + "/mcp/#" + SAT_SECTION_ANCHOR,
                    "numberOfItems": len(sats),
                    "itemListElement": [
                        {"@type": "ListItem", "position": i + 1,
                         "name": sat_copy(x)[0] + " MCP server", "url": base + "/mcp/%s/" % x["repo"]}
                        for i, x in enumerate(sats)
                    ],
                },
            ],
        }
    return """---
layout: %(layout)s
title: "%(total)d MCP servers for invoicing, documents and back-office work"
description: "Complete map of %(total)d MIT-licensed MCP servers for Claude, Cursor and Claude Code: invoices, VAT, PDFs, spreadsheets, time tracking, expenses. Free locally, $%(bundle)d one-time for all of them hosted."
permalink: /mcp/
date: 2026-10-28
---

<script type="application/ld+json">
%(ld)s
</script>

# %(total)d MCP servers for back-office work

Every back-office server on this page is MIT licensed, runs against local files, and speaks the Model
Context Protocol, so Claude Desktop, Claude Code, Cursor, Windsurf and your own agent can all
use the same tool. Nothing here needs an account to try.%(satintro)s

**The map:** pick the row for your task, open the server page for the exact tool names and
install steps. Prices are one-time; there is no subscription anywhere in this collection.

%(table)s
%(satsec)s
## Pricing

| What you get | Price | Notes |
| --- | --- | --- |
| Any single server, local | Free | MIT, unlimited, offline |
| Any single server, hosted + Pro | $%(price)d one time | Removes the saved-report cap on the hosted endpoint |
| All %(total)d servers | **$%(bundle)d one time** | The bundle, lifetime, every future server included |

[Buy all %(total)d servers for $%(bundle)d](https://mcp.zovo.one/buy/bundle?src=csg.mcp.index.pricing)
&middot; [Browse a single server first](#the-map)

## How it fits together

The collection is deliberately boring: one process per job, one SQLite/JSON store per server,
no shared cloud. That is why a 3-person company can run it on a laptop and a 300-person company
can run the hosted endpoints without a data-processing agreement — the data does not leave
the tenant you choose.

Servers fall into five groups: **invoicing and billing**, **documents and files**, **money and
accounting**, **time and operations**, and **web/SEO**. They are designed to be combined: an
invoice server writes the PDF, a spreadsheet server reads the export, a time-tracker server
supplies the billable hours.

## Questions people actually ask

### Are these official Anthropic MCP servers?

No. They are independent, MIT-licensed servers published on the official MCP registry
(`io.github.theluckystrike/*`) and on GitHub. Anthropic does not maintain or endorse them.

### Do I need a paid Claude plan?

No. Any MCP-capable client works, including the free Claude Desktop app, Claude Code, Cursor,
Cline and VS Code with an MCP extension. The servers are standard stdio or Streamable HTTP.

### What is actually paid, then?

Only the hosted endpoint. Local use of every server is free forever. The Pro licence is
$%(price)d one time per server (or $%(bundle)d for all %(total)d) and exists to pay for the
hosting, not to unlock tools.

### Where is the source?

[github.com/theluckystrike/mcp-servers](https://github.com/theluckystrike/mcp-servers) — one
directory per server, MIT licensed, with the registry manifest next to the code.
""" % {"total": total, "bundle": bundle, "price": 19, "table": table, "layout": layout,
       "ld": json.dumps(ld, indent=1, ensure_ascii=False), "satsec": satellite_index_section(sats or []),
       "satintro": ("\n\nLooking for live data instead, such as a gold or silver price per gram, a river level or "
                    "the 2026 IRS mileage rate? See the [%d free live-data MCP servers with no key](#%s)."
                    % (len(sats), SAT_SECTION_ANCHOR)) if sats else ""}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", required=True, help="path to a clone of claude-skills-guide")
    ap.add_argument("--base-url", default="https://claudecodeguides.com")
    ap.add_argument("--canonical-base", default="",
                    help="emit canonical: <base>/mcp/<slug>/ so a weaker mirror does not compete")
    ap.add_argument("--layout", default="default")
    ap.add_argument("--satellites", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "satellite_hub.json"),
                    help="data/satellite_hub.json from collect_satellite_hub.py; pass '' to skip satellite pages")
    ap.add_argument("--catalog", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "mcp_catalog.json"))
    args = ap.parse_args()

    cat = json.load(open(args.catalog, encoding="utf-8"))
    servers = cat["servers"]
    by_id = {s["id"]: s for s in servers}
    total = len(servers)

    out_dir = os.path.join(args.site, "mcp")
    os.makedirs(out_dir, exist_ok=True)

    placed, cat_map = set(), []
    for name, ids in CATEGORIES:
        rows = [by_id[i] for i in ids if i in by_id]
        placed.update(r["id"] for r in rows)
        if rows:
            cat_map.append((name, rows))
    leftover = [s for s in servers if s["id"] not in placed]
    if leftover:
        cat_map.append(("More servers", leftover))

    sats = sorted(load_satellites(args.satellites), key=lambda x: x["repo"])
    pair = {}
    for x in sats:
        for rid in sat_copy(x)[2]:
            pair.setdefault(rid, []).append((sat_copy(x)[0], x["repo"], first_sentence(x["description"], 200)))

    written = 0
    for name, rows in cat_map:
        for s in rows:
            body = page_body(s, name, [x for _, rs in cat_map for x in rs], total, args.base_url, args.layout,
                             args.canonical_base, pair.get(s["id"]))
            p = os.path.join(out_dir, s["slug"] + ".md")
            open(p, "w", encoding="utf-8").write(body)
            written += 1
    # fix the "%(total)d" placeholders that survived inside prose
    open(os.path.join(out_dir, "index.md"), "w", encoding="utf-8").write(
        index_page(cat_map, total, cat["bundle_price_usd"], args.base_url, args.layout, sats)
    )
    for x in sats:
        open(os.path.join(out_dir, x["repo"] + ".md"), "w", encoding="utf-8").write(
            satellite_page(x, sats, by_id, args.base_url, args.layout, args.canonical_base))
    json.dump(cat, open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    print("wrote %d server pages + %d satellite pages + index.md + index.json into %s" % (written, len(sats), out_dir))
    print("categories:", [(n, len(r)) for n, r in cat_map])


if __name__ == "__main__":
    sys.exit(main())
