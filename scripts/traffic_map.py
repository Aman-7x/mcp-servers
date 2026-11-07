#!/usr/bin/env python3
"""Where does zovo.one traffic actually go? Per host, per path, last 7 days.

The dashboard kept saying "traffic is zero" while the zone served millions of
requests. Both statements were true because nobody had split the zone by host.
This writes data/traffic_map.json so the dashboard can show the split instead of
arguing from impressions alone.

Read-only: two Cloudflare GraphQL queries. No writes, no deletes.
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZONE = "f16be0fc9bae2ff3786d91eb7a90c023"  # zovo.one
OUT = os.path.join(ROOT, "data", "traffic_map.json")


def gql(query, variables):
    body = json.dumps({"query": query, "variables": variables})
    tmp = "/tmp/_traffic_gql.json"
    with open(tmp, "w") as f:
        f.write(body)
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not token:
        sys.exit("CLOUDFLARE_API_TOKEN is not set")
    out = subprocess.run(
        ["curl", "-s", "-X", "POST",
         "https://api.cloudflare.com/client/v4/graphql",
         "-H", "Authorization: Bearer " + token,
         "-H", "Content-Type: application/json",
         "--data", "@" + tmp],
        capture_output=True, text=True, timeout=120).stdout
    d = json.loads(out)
    if d.get("errors"):
        sys.exit("graphql error: " + json.dumps(d["errors"])[:400])
    return d["data"]["viewer"]["zones"][0]


def main():
    now = datetime.now(timezone.utc)
    since = (now - timedelta(days=7)).strftime("%Y-%m-%dT%H:00:00Z")

    start_day = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    totals = gql(
        """query($z:String!,$d:Date!){viewer{zones(filter:{zoneTag:$z}){
        httpRequests1dGroups(limit:10,filter:{date_geq:$d}){
        sum{requests pageViews} uniq{uniques}}}}}""", {"z": ZONE, "d": start_day})
    req = sum(g["sum"]["requests"] for g in totals["httpRequests1dGroups"])
    pv = sum(g["sum"]["pageViews"] for g in totals["httpRequests1dGroups"])
    uniq = sum(g["uniq"]["uniques"] for g in totals["httpRequests1dGroups"])

    hosts = gql(
        """query($z:String!,$a:Time!){viewer{zones(filter:{zoneTag:$z}){
        httpRequestsAdaptiveGroups(limit:25,filter:{datetime_geq:$a},
        orderBy:[count_DESC]){count dimensions{clientRequestHTTPHost}}}}}""",
        {"z": ZONE, "a": since})

    rows = []
    for g in hosts["httpRequestsAdaptiveGroups"]:
        rows.append({"host": g["dimensions"]["clientRequestHTTPHost"],
                     "requests": g["count"]})

    apex = next((r["requests"] for r in rows if r["host"] == "zovo.one"), 0)

    payload = {
        "at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "window_days": 7,
        "zone": "zovo.one",
        "requests": req,
        "pageviews": pv,
        "uniques": uniq,
        "apex_requests": apex,
        "subdomain_requests": req - apex,
        "hosts": rows,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=1)

    print(json.dumps({k: payload[k] for k in
                      ("at", "requests", "pageviews", "uniques",
                       "apex_requests", "subdomain_requests")}, indent=1))
    print("top hosts:")
    for r in rows[:12]:
        print(f"  {r['requests']:9,d}  {r['host']}")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
