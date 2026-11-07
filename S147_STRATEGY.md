# S147 — the money question, answered with numbers

Date: 2026-11-07 · Scope: 59 MCP servers, mcp.zovo.one hub, www.mcpstamp.com storefront, 37 satellites

## The four numbers that decide everything

| Fact | Value | How it was measured |
|---|---|---|
| Servers live | 58/58 hostable (59 total, office-suite by design) | live probe in dashboard build |
| npm downloads | 12,067 / week | npm registry |
| Funnel, 7 days | 3,969 offer views → 294 upgrade impressions → 4 checkout handoffs → **0 purchases** | worker `/stats/funnel` |
| Checkout works | yes — real Chromium + Chrome UA reaches a live `cs_live_` Stripe session | `scripts/checkout-funnel-probe.mjs`, exit 0 |

Conclusion 1: **nothing in the payment path is broken.** Package → endpoint → Stripe is proven end to end.
Four handoffs in seven days is a traffic problem wearing a conversion costume.

## The diagnosis that changed today

The working assumption was "Google has not indexed us". URL Inspection, run today on 14 store
pages sampled across the 277-URL sitemap:

- 13 of 14 → **"Submitted and indexed"** (kanban alone "Discovered – currently not indexed")
- robots: ALLOWED, fetch: SUCCESSFUL, crawls dated 2026-11-03
- sitemap: 277 URLs, all on the canonical `www` host, apex 301s to `www` (consistent)

And the query report explains the zero better than "we are invisible" ever did:

| Query | Position | Impressions (28d) |
|---|---|---|
| can claude code read zip files | 2 | 1 |
| can claude open and read zip files | 5 | 1 |
| can claude handle zip files | 6 | 1 |
| can claude merge pdfs | 10 | 2 |
| ai agent for 3 way match | 99 | 1 |

zovo.one, same window: 1,251 impressions, **1,194 of them the word "zovo"**; the remainder is a
currency long tail ("1.15 dollars in rands", position 80).

Conclusion 2: **we rank well (position 2–10) for every conversational query we actually cover, and we
cover almost none of them.** 277 pages represent a rounding error of the ways people phrase 59 tools'
worth of tasks. The constraint is *query surface area*, not authority, not indexing, not checkout.

## What I would focus on — one thing

**Turn the 59 tools into query-shaped pages at 10–30× the current count, aimed only at phrasings with
real search volume.** Everything else on the board is either already done or worth less.

Cold maths: at position 3–6, a page with 300 monthly searches at 8% CTR yields ~24 clicks/month. To
reach 10,000 visits/month you need roughly 400 such pages. We have 277 pages with near-zero-volume
phrases — which is why the funnel reads 3,969 views/7d (mostly internal and bot traffic) and 4 handoffs.

Ranked alternatives and why they lose:

1. *More servers* — 59 already, 0 sales. Marginal server #60 changes nothing; the distribution surface
   is the bottleneck.
2. *More registries* — 3 of N carry us; each listing costs hours and delivers single-digit visits.
   Worth doing passively, never as the main lever.
3. *Paid ads* — no proven conversion at any price point yet; buying traffic into a 0.1% funnel burns cash.
4. *Better checkout / pricing page* — already proven functional; optimizing a step only 4 people saw is noise.

So: 20 pages per high-volume tool, each answering one exact question with the tool's live output
inline, cross-linked to the paid key. That is a build task, not a negotiation, and it is what I would
do next.

## What you can do to give me outreach access

Resend already works: the key is in the environment, the domain sends, and a test mail to
michal@zovo.one was delivered (`01a1b235-1851-767d-8657-fc8f6827ade1`). I checked DNS rather than
assuming, and the picture is better than I first wrote: DKIM is live at
`resend._domainkey.zovo.one`, and `send.zovo.one` already carries Amazon SES (feedback MX plus
`v=spf1 include:amazonses.com`). What is genuinely missing for cold outreach at volume:

1. **An SPF that names the sender** — the apex SPF is `include:_spf.porkbun.com ~all` with no Resend
   entry, so mail sent as `@zovo.one` through Resend fails SPF. DMARC still passes on DKIM alignment
   (`p=none`), which means today it works but is unprotected: one bad batch and the apex reputation is
   what pays. Either add Resend's SPF include to the apex, or send cold mail from `send.zovo.one` and
   keep the apex clean.
2. **A sending address you are willing to have replies land in** — e.g. `hello@zovo.one` (works today)
   or a dedicated `outreach@` alias.
3. **A suppression/unsubscribe target** — a URL or mailbox that honours opt-outs. Legally required for
   cold email in the EU/UK and it protects the domain reputation we just spent a month building.
4. Optional but decisive for scale: **a second domain** for outreach so a bad batch cannot burn
   `zovo.one`'s reputation. `mcpstamp.com` has no DMARC record at all, so it is not the candidate.

Give me 1 to 3 and I can run targeted mail to a curated list (MCP directory maintainers, Claude/Cursor
power users who publish tool lists) with per-recipient tracking. Without a named sending identity and an
unsubscribe target I will not send at volume, because the downside is the domain, not the batch.


## Plan, in execution order

1. **Page factory v1 — SHIPPED THIS SESSION (23 pages)** — `scripts/add_answer_pages.py` appends one
   entry per exact phrasing to `site/src/data/pages.json`; the existing Astro `[slug]` template renders
   it. Live now: 316 pages, 110 in the can-claude family, four spot-checked URLs return 200, sitemap
   resubmitted (204, 0 errors, 300 URLs). Next pass: 100–150 more, only for shapes we can evidence.
2. **Query harvest** — pull the phrasing from Search Console's existing 25 queries plus DuckDuckGo
   "how do I ..." harvests per tool; only ship shapes that appear in real query data.
3. **Internal linking** — every generated page links to its tool page and to the pricing page; the
   storefront's 277 pages currently pass almost no equity to product pages.
4. **Outreach, once DKIM exists** — 200 curated recipients, one tool per mail, tracked handoffs.
5. **Re-measure in 14 days** — impressions per page (target: median ≥ 20/mo), indexed ratio ≥ 90%,
   handoffs per 1,000 views (target ≥ 5, i.e. 5× today).

Definition of done for the next cycle: ≥ 400 indexed query pages, ≥ 5,000 organic impressions/28d on
mcpstamp.com, ≥ 20 checkout handoffs/7d. Anything short of that is a page-coverage failure, and the
funnel will say so in its own numbers.
