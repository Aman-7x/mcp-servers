# S144 conversion and distribution result

Measured at 2026-11-06T17:05Z to 18:05Z. Everything below is a command output, not an
inference.

## Fleet state

59 servers in servers/, 59 listed in the store, 58 hostable endpoints, 58 live, 0 dead,
office-suite unhosted by design because it spawns local child processes.

    python3 scripts/build_mcp_dashboard.py     live=58/58 tools=595
    python3 ~/mcp-servers-work/verify_dash.py  11 of 11 checks pass
    python3 scripts/measure.py                 58/58 live, dead 0
    billing tests 244/0, remote tests 112/0 (Node 22 binary)

npm: 58 of 59 packages published, 10,650 downloads per week across the fleet, measured from
the registry this render. ingredient-convert is the one unpublished package, blocked by a 401
from registry.npmjs.org (token expired, human action).

## What shipped

Ingredient Convert, a new server. Seven tools, a per-ingredient density table for 30
ingredients, recipe scaling and fraction helpers. It is deployed three ways and each was
verified by request, not by claim.

    https://ingredient-convert-mcp.lipmichal.workers.dev   200, 1 cup AP flour = 125 g
    https://mcp.zovo.one/mcp/ingredient-convert            200, brand route, 7 tools listed
    https://mcp.zovo.one/s/ingredient-convert             200, 35,864 bytes, store page

Distribution surfaces updated for it: the hub page at claudecodeguides.com/mcp/ingredient-convert/
(commit bd82ac4, Pages build in flight at the time of writing), llms.txt (8 mentions), the
downloads catalog (listed as pending, source install path instead of a dead link), the MCP
dashboard, and the official-list PRs below.

## Distribution

Sagargupta16/awesome-mcp-servers PR #320, sixteen data servers, merged 17:12:08Z six minutes
after opening. All seven gates passed. The list now carries 38 theluckystrike rows, verified
with git show against the merged head, up from 22.

punkpeye/awesome-mcp-servers PR #18778, twelve servers, on a list with 97,375 stars where the
fleet had zero rows. check-submission SUCCESS, MERGEABLE, opened with the 🤖🤖🤖 agent marker
the maintainers use to fast-track. The older two-server PR #18737 was superseded and closed so
there is one PR to review.

Still open and not moving: mcpHQ #695, cline/marketplace #413, mcp.so #6845. The pattern is
that the list with a CI gate merges and the lists without one do not.

## Money

    GET  https://mcp.zovo.one/buy/bundle        200, $39 intent page
    POST with a real browser                    lands on checkout.stripe.com cs_live_...
    Playwright probe                            landedOnStripe true, title Stripe Checkout

So the checkout handoff works in production. What has never happened is a completed payment,
which means the webhook to licence to email path is built and unit tested but unproven against
a real transaction. That is the single largest unknown in the funnel and it needs one $39
purchase with a real card.

## Blocked, with the exact reason

npm publish, 401 Unauthorized from registry.npmjs.org. Needs a fresh token.
Official MCP registry publish, mcp-publisher token expired, needs `mcp-publisher login github`.
Payment proof, needs a human card.
Telegram update, no bot token or channel id for a Zovo destination exists on this machine, so
the message was written, humanized and scanner-clean, and deliberately not posted.

## Defects found and fixed on the way

The dashboard probe reported 27 of 58 endpoints alive mid-session. Re-probing clean gave 58 of
58: the first run was measuring Cloudflare throttling during a saturated build, not dead
servers. The builder now classifies a throttled endpoint as unknown, not dead.

build-vendor.mjs rewrote two registerTool anchors that a typed-alias refactor had renamed to
regTool, which broke the vendored build silently until the deploy exited non-zero. Both
anchors now accept either shape.

scripts/measure.py counted office-suite as a permanently dead endpoint. It is now excluded and
reported as unhosted by design, so the KPI reads 58/58 rather than 57/58 with a standing lie.

Adding a 59th server to a 58-server estate broke five invariants in three places: the store home
page paste-in URL count, llms.txt, the download catalog, the hosted server set and the hosted
server instruction map. Each was fixed where the invariant lives, and each fix is covered by the
test that caught it.
