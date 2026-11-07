# S146 — conversion, distribution, and the funnel measured for the first time

Date: 2026-11-07 (UTC). Orchestrator session, autonomous.

## What was proven, not assumed

1. Checkout works. `scripts/checkout-funnel-probe.mjs` drives `/buy/ingredient-convert`
   in Chromium with a normal Chrome UA, submits the intent form and lands on a live
   `cs_live_…` Stripe Checkout session. Reproduced twice, exit 0.
   The "checkout is blocked" reading from earlier sessions was an artefact of Playwright's
   own `HeadlessChrome` UA matching `BOT_UA_RE` in `billing/src/index.js`.
   Consequence: zero paid transactions is a demand problem, not a payment problem.

2. Google shows almost nothing. Search Console, 28 days to 2026-11-05:
   - `mcp.zovo.one`: 22 impressions, 0 clicks (the entire paid catalog)
   - `mcpstamp.com`: 507 impressions, 2 clicks
   - zovo.one domain: 2,193 impressions, 55 clicks (53 of them on the home page)
   - Every sitemap reports 0 indexed; `mcpstamp.com` sitemap reported 237 URLs, all stale.
   Action taken: resubmitted both sitemaps through the service account.
   mcpstamp.com now reports 277 submitted URLs (the 40 rebuilt pages incl ingredient-convert).

3. GitHub topical distribution is finished for the whole account.
   2,248 repos scanned (the script's 20-page cap had silently truncated at 2,000);
   102 MCP projects after removing forks and archived repos; 102/102 now carry a homepage,
   101 carry all four topics (mcp, mcp-server, model-context-protocol, claude),
   the 102nd points at the hub. One write blocked: `zovo-one/mcp-ecosystem-measurements`
   returns 422 (token is not an admin of that org repo).

4. McpStamp is live with the 59th server. The project is a direct-upload Cloudflare Pages
   site (`mcp-showcase-preview`), so pushing to the repo never deploys it. Rebuilt:
   293 pages, catalog 59 servers / 538 tools, `/servers/ingredient-convert/` answers 200,
   home page reads 59 servers, sitemap carries the page.

5. Dashboard rebuilt and verified: 58/58 hostable endpoints live, 595 tools, 11/11 checks,
   0 failures.

## Blockers, named

- `claudecodeguides.com/mcp/ingredient-convert/` still 404. Its GitHub Pages build takes
  ~38 minutes for "Build with Jekyll"; the run is in flight, not stuck. Do not cancel
  before the 38-minute mark — an earlier cancel threw away a nearly finished build.
- Checkout sessions created by the probe are real Stripe objects. The probe sends
  `x-mcp-probe: 1` so it is not counted as a buyer, but each run still costs one session.

## The one thing worth doing next

Not more servers, not more listings. The 59 product pages are invisible in search
(22 impressions for the whole catalog in 28 days) while the traffic that does arrive
is bots. Everything else is downstream of that number.

## Push blocked (external)
`git push origin HEAD` on `mcp-servers` is rejected by a repository ruleset for branch
`r38-supplier-monetization`. Commit `2e1ac131` exists on disk and is verified; the push
needs the ruleset loosened or a PR from a permitted branch. Not bypassed.

## Also this session
- `claudecodeguides.com/mcp/ingredient-convert/` now returns 200 (Jekyll build took ~40 min; do not cancel).
  Title: "Ingredient Convert MCP server: install, tools and pricing". Buy link present. Page is in that site's sitemap.
- Funnel instrument, 7 days: 3,966 offer views, 294 upgrade impressions, 4 checkout handoffs, 0 purchases;
  372 successful business calls from 201 anon token/server/day cohorts.
- Google, 28 days: mcp.zovo.one 22 impressions / 0 clicks. mcpstamp.com 507 / 2. zovo.one domain 2,193 / 55.
- Resend verified live: zovo.one sending enabled, test mail accepted (id 01a1b235-1851-767d-8657-fc8f6827ade1).
