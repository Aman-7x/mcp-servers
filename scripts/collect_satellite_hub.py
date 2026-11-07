#!/usr/bin/env python3
"""Collect live facts for the free data satellites into data/satellite_hub.json.

build_hub.py reads that file (offline) and emits one claudecodeguides.com/mcp/<repo>/
page per satellite plus the "Free live-data MCP servers (no key)" hub section.

What it records per satellite (nothing is typed in by hand except the example arguments):
  - repo, hosted URL, version, description: satellites/<repo>/server.json + the lane result json
  - "what it knows that your model does not": the README section of that name, verbatim
  - tools: a live tools/list against the hosted URL, no token
  - example: a live tools/call against the hosted URL, no token, run when this script runs
  - mcpstamp /free-servers/<repo>/ and /can-claude/<x>/ pages: read from the live mcpstamp sitemap
    and the live /can-claude/ pages (a page counts only if it links /free-servers/<repo>/)

Usage: python3 -I scripts/collect_satellite_hub.py [--out data/satellite_hub.json]
A satellite with no example arguments, no lane json, or a failing live call is skipped and
listed under "skipped" with the reason, never emitted with made-up content.
"""
import argparse
import datetime
import glob
import json
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "s1103-ccg-hub-collector/1"
STAMP = "https://www.mcpstamp.com"

# Arguments for the one example tools/call shown on each page. Values only; every output is live.
EXAMPLES = {
    "ab-test-sample-size-calculator-mcp": ("calculate_sample_size", {"baseline_rate": 0.04, "mde": 0.1},
        "My checkout converts at 4%. How many users per variant do I need to detect a 10% relative lift?"),
    "aca-premium-tax-credit-calculator-mcp": ("calculate_premium_tax_credit", {"household_income": 68000, "household_size": 2, "state": "TX", "benchmark_premium": 1150, "year": 2026, "premium_period": "monthly"},
        "A couple in Texas earns $68,000 and the benchmark plan is $1,150 a month. What is their 2026 premium tax credit?"),
    "ap-score-distributions-mcp": ("get_ap_score_distribution", {"exam": "AP Calculus AB", "year": 2026},
        "What were the AP Calculus AB score distributions in 2026?"),
    "car-loan-interest-deduction-calculator-mcp": ("calculate_car_loan_interest_deduction", {"filing_status": "single", "magi": 85000, "tax_year": 2025, "interest_paid": 2400, "loan_origination_date": "2025-03-15", "new_vehicle": True, "us_final_assembly": True, "personal_use": True},
        "I paid $2,400 of interest in 2025 on a loan for a new US-assembled car bought in March 2025. Single, MAGI $85,000. How much can I deduct?"),
    "cpi-inflation-calculator-mcp": ("calculate_inflation", {"amount": 1000, "from": "2000-01", "to": "latest"},
        "What is $1,000 from January 2000 worth today, using official CPI data?"),
    "cups-to-grams-mcp": ("convert_ingredient", {"amount": 1, "from_unit": "cup", "to_unit": "g", "ingredient": "all-purpose flour"},
        "How many grams is 1 cup of all-purpose flour?"),
    "dscr-loan-calculator-mcp": ("calculate_dscr", {"monthly_rent": 2400, "purchase_price": 300000, "down_payment_pct": 25, "annual_rate_pct": 7.25, "term_years": 30, "annual_property_tax": 3600, "annual_insurance": 1500, "vacancy_pct": 5},
        "Rent is $2,400 on a $300,000 rental with 25% down at 7.25%. What is the DSCR?"),
    "estate-gift-tax-exemption-calculator-mcp": ("calculate_estate_tax", {"gross_estate": 20000000},
        "How much federal estate tax is due on a $20 million estate for a death in 2026?"),
    "gold-price-per-gram-mcp": ("get_gold_price_per_gram", {"currency": "USD"},
        "What is the gold price per gram right now, by karat?"),
    "irs-mileage-rate-per-diem-mcp": ("get_mileage_rate", {"year": 2026},
        "What is the IRS standard mileage rate for 2026?"),
    "lake-level-mcp": ("get_lake_level", {"lake": "Lake Travis"},
        "What is the water level of Lake Travis right now?"),
    "minimum-wage-mcp": ("get_minimum_wage", {"state": "CA"},
        "What is the minimum wage in California today?"),
    "no-tax-on-overtime-mcp": ("calculate_overtime_deduction", {"filing_status": "single", "magi": 68000, "tax_year": 2025, "hourly_rate": 24, "overtime_hours": 300, "multiplier": 1.5},
        "I earn $24 an hour and worked 300 overtime hours at time and a half in 2025. Single, MAGI $68,000. What is my no tax on overtime deduction?"),
    "paycheck-calculator-mcp": ("calculate_take_home_pay", {"state": "NC", "filing_status": "single", "tax_year": 2026, "gross_annual": 92000, "pay_frequency": "biweekly", "pretax_401k_percent": 6},
        "What is my 2026 take-home pay on $92,000 in North Carolina, paid every two weeks, with 6% to a 401(k)?"),
    "raw-to-cooked-weight-mcp": ("convert_raw_to_cooked", {"food": "chicken breast", "method": "roast", "raw_weight": 1, "unit": "lb"},
        "How much does 1 lb of raw chicken breast weigh after roasting?"),
    "recipe-nutrition-calculator-mcp": ("calculate_recipe_nutrition", {"lines": ["2 cups all-purpose flour", "1/2 cup butter", "1 cup sugar", "2 large eggs", "1 cup milk", "2 tsp baking powder"], "servings": 12},
        "What are the calories per serving of this 12-serving cake recipe?"),
    "retirement-contribution-limits-2027-mcp": ("get_contribution_limits", {"year": 2027},
        "What are the 401(k), IRA and HSA contribution limits for 2027?"),
    "river-level-mcp": ("get_river_level", {"site": "07010000"},
        "What is the Mississippi River level at St. Louis right now?"),
    "sat-score-percentiles-mcp": ("get_sat_percentile", {"score": 1350, "section": "total"},
        "What percentile is a 1350 on the SAT?"),
    "section-179-deduction-calculator-mcp": ("calculate_section_179", {"tax_year": 2026, "total_section_179_property_cost": 180000, "business_taxable_income": 250000},
        "I bought $180,000 of equipment in 2026 and my business income is $250,000. How much can I expense under Section 179?"),
    "silver-price-per-gram-mcp": ("get_silver_price_per_gram", {},
        "What is the silver price per gram right now?"),
    "student-loan-repayment-assistance-plan-calculator-mcp": ("compare_rap_vs_standard", {"balance": 38000, "rate": 6.5, "agi": 52000, "dependents": 1},
        "I owe $38,000 at 6.5%, AGI $52,000, one dependent. What would I pay on RAP compared with the standard plan?"),
    "subdomain-finder-mcp": ("find_subdomains", {"domain": "zovo.one", "limit": 20},
        "Which subdomains of zovo.one show up in certificate transparency logs?"),
    "uk-income-tax-salary-mcp": ("calculate_uk_take_home", {"gross_salary": 45000, "tax_year": "2026/27"},
        "What is my take-home pay on a 45,000 pound salary in England for 2026/27?"),
    "uk-statutory-sick-pay-maternity-pay-calculator-mcp": ("calculate_statutory_sick_pay", {"average_weekly_earnings": 400, "qualifying_days": 5, "days_off": 10, "start_date": "2026-05-04"},
        "An employee on 400 pounds a week is off sick for 10 working days from 4 May 2026. How much Statutory Sick Pay is due?"),
    "us-federal-holidays-business-days-mcp": ("count_business_days", {"start_date": "2026-12-01", "end_date": "2027-01-15"},
        "How many business days are there from December 1, 2026 to January 15, 2027, excluding US federal holidays?"),
    "vegetable-yield-percentage-mcp": ("calculate_amount_to_buy", {"food": "onion", "amount": 3, "measure": "cup chopped"},
        "How many onions do I need to buy for 3 cups chopped?"),
}


def http(url, body=None, sid=None, timeout=60):
    h = {"user-agent": UA}
    if body is not None:
        h.update({"content-type": "application/json", "accept": "application/json, text/event-stream"})
        if sid:
            h["mcp-session-id"] = sid
        req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=h)
    else:
        req = urllib.request.Request(url, headers=h)
    r = urllib.request.urlopen(req, timeout=timeout)
    return r.read().decode("utf-8", "replace"), r.headers.get("mcp-session-id"), r.status


def rpc(url, body, sid=None):
    raw, s, _ = http(url, body, sid)
    if raw.lstrip().startswith("{"):
        return json.loads(raw), s
    for line in raw.splitlines():
        if line.startswith("data:"):
            d = json.loads(line[5:])
            if "id" in d:
                return d, s
    return {}, s


def mcp(url, method, params=None):
    _, sid = rpc(url, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
        "protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": UA, "version": "1"}}})
    try:
        rpc(url, {"jsonrpc": "2.0", "method": "notifications/initialized"}, sid)
    except Exception:  # noqa: BLE001 - stateless servers may answer 202 with no body
        pass
    d, _ = rpc(url, {"jsonrpc": "2.0", "id": 2, "method": method, "params": params or {}}, sid)
    return d


def readme_knows(path):
    """Bullets of the README section whose heading says what the model does not know."""
    out, on = [], False
    for line in open(path, encoding="utf-8"):
        if line.startswith("## "):
            if on:
                break
            low = line.lower()
            on = "knows" in low or "model does not" in low
            continue
        if on and line.startswith("- "):
            out.append(line[2:].strip())
        elif on and out and line.startswith("  ") and line.strip():
            out[-1] += " " + line.strip()
    return out


def lane_json(repo):
    for d in ("s1030", "s1102", "s1103", "s1104"):
        p = os.path.join(ROOT, "data", d, repo + ".json")
        if os.path.exists(p):
            return p
    return None


def stamp_pages():
    sm, _, _ = http(STAMP + "/sitemap.xml")
    locs = re.findall(r"<loc>([^<]+)</loc>", sm)
    free = {u.rstrip("/").rsplit("/", 1)[-1] for u in locs if "/free-servers/" in u and u.rstrip("/").endswith("-mcp")}
    can = {}
    for u in locs:
        if re.search(r"/can-claude/[a-z0-9-]+/$", u):
            try:
                page, _, _ = http(u, timeout=30)
            except Exception:  # noqa: BLE001
                continue
            m = re.search(r"(?is)<h1[^>]*>(.*?)</h1>", page)
            h1 = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else None
            for repo in set(re.findall(r"/free-servers/([a-z0-9-]+-mcp)/", page)):
                can.setdefault(repo, []).append({"url": u, "h1": h1})
    return free, can


def summary_of(text):
    i = text.find("\n\n{")
    return (text[:i] if i > 0 else text).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "satellite_hub.json"))
    args = ap.parse_args()
    free, can = stamp_pages()
    sats, skipped = [], []
    for d in sorted(glob.glob(os.path.join(ROOT, "satellites", "*-mcp"))):
        repo = os.path.basename(d)
        lj = lane_json(repo)
        if not lj:
            skipped.append({"repo": repo, "why": "no lane result json"}); continue
        if repo not in EXAMPLES:
            skipped.append({"repo": repo, "why": "no example arguments in EXAMPLES"}); continue
        L = json.load(open(lj, encoding="utf-8"))
        S = json.load(open(os.path.join(d, "server.json"), encoding="utf-8"))
        url = L.get("hosted_url") or "https://%s.lipmichal.workers.dev/mcp" % repo
        try:
            tl = mcp(url, "tools/list")["result"]["tools"]
            tool, targs, prompt = EXAMPLES[repo]
            call = mcp(url, "tools/call", {"name": tool, "arguments": targs})
            res = call["result"]
            if res.get("isError"):
                raise RuntimeError("tool returned isError")
            text = res["content"][0]["text"]
        except Exception as e:  # noqa: BLE001
            skipped.append({"repo": repo, "why": "live call failed: %s" % e}); continue
        sc = res.get("structuredContent") or {}
        sats.append({
            "repo": repo,
            "repo_url": "https://github.com/theluckystrike/" + repo,
            "hosted_url": url,
            "version": S.get("version"),
            "description": S.get("description"),
            "license": "MIT" if "MIT License" in open(os.path.join(d, "LICENSE"), encoding="utf-8").read() else None,
            "knows": readme_knows(os.path.join(d, "README.md")),
            "tools": [{"name": t["name"], "description": t.get("description", "")} for t in tl],
            "example": {
                "prompt": prompt, "tool": tool, "arguments": targs,
                "summary": summary_of(text),
                "as_of": sc.get("as_of"), "source": sc.get("source"), "more": sc.get("more"),
                "called_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
            "npx_github_ok": L.get("npx_github_ok"),
            "lane_json": os.path.relpath(lj, ROOT),
            "stamp_free_server": (STAMP + "/free-servers/%s/" % repo) if repo in free else None,
            "stamp_can_claude": sorted(can.get(repo, []), key=lambda c: c["url"]),
        })
        print("ok", repo, len(tl), "tools")
    out = {"generated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
           "count": len(sats), "satellites": sats, "skipped": skipped}
    json.dump(out, open(args.out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("wrote %d satellites, skipped %d -> %s" % (len(sats), len(skipped), args.out))


if __name__ == "__main__":
    main()
