# S148 — Where the humans actually are

Measured 2026-11-06/07 UTC. Every number below is re-derivable: `scripts/traffic_map.py`,
`~/mcp-servers-work/dist_readback.py`, `~/mcp-servers-work/readme_cta_audit.py`,
worker `/stats/funnel`, Cloudflare GraphQL `httpRequestsAdaptiveGroups`.

## The four numbers

| Surface | Humans / week | Can we edit it today |
|---|---|---|
| zovo.one zone, total | 3,268,793 requests · 112,863 page views · 71,905 uniques | partly |
| `mcp.zovo.one` | 1,312,741 requests — MCP clients, **not people** | yes |
| tool subdomains (statement-converter 95k, doubles-mixer 50k, pdf-to-excel 40k, …) | ~1.78M requests, real product pages | **no source locally** |
| `www.mcpstamp.com` storefront | 172 impressions / 28 days, best page | yes |

Funnel, 7 days: 3,969 offer views → 294 upgrade impressions → 4 checkout handoffs → **0 purchases**.

## Why the funnel is empty — the actual mechanism

The upgrade line is appended to the JSON body of a tool response (`sendMessage`). An **agent** reads
that JSON. A **human** never does. So "offer views" counts machines, and the humans are on a different
host — statement-converter and friends — where no page mentions that the same work runs inside Claude
or Cursor, and no page links the paid tier.

That is not a copy problem, a checkout problem or an indexation problem. It is a placement problem
between two assets we already own.

## Ranked by expected value

0. **Cross-sell the tool subdomains.** 1.78M requests/wk reaching product pages that convert
   bank-statement PDFs and mix doubles. A footer card with `?src=<tool>` on the top ten hosts is one
   file per site. Blocked only by: no local source for the `pf-*` Workers, and the CF token lacks
   zone Workers Routes permission (so no injecting route can be created from here).
1. **npm publish.** 41 packages, 12k downloads/wk in bursts. The README is the only human surface at
   scale and it is frozen at the last publish. `npm publish` returns 401 — token expired.
2. **Cold outreach.** Built, humanised, scan-clean draft; blocked on sending identity, reply address
   and an unsubscribe mailbox. 300 targeted prospects/week is a realistic ramp.
3. **More answer pages / more awesome-lists.** Diminishing: 11 merged PRs produced 4 real domain
   citations, and the marginal new answer page draws 1–2 impressions. Stop here until 0–2 move.

## The one-sentence conclusion

The estate is not short of servers, pages, tests or checkout — it is short of a doorway from the
traffic it already has to the thing it sells. Three quarters of the traffic sits behind a deploy path
this session cannot reach, and the other quarter sits behind an npm credential.
