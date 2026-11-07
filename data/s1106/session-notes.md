# Session notes 2026-11-06 — findings worth keeping

## Measurement
- GSC, 30d to 2026-11-04, full property totals (no dimension cap): 60 unique domains,
  798,592 impressions, 3,040 clicks. Query-level attribution covers only ~41% of
  impressions (GSC anonymisation), so brand/non-brand splits are a lower bound.
- The earlier "111 queries / 1,546 impressions / 50 clicks, demand is zero" figure was an
  artifact of a `dimensions: ["query"], rowLimit: 5` pull — it summed each property's top
  five queries. Retracted in the dashboard and in data/s1106/demand-2026-11-06.md.
- mcp.zovo.one itself: 33 impressions, 0 clicks, 30d.

## Supply vs wiring
- 36 satellites in ~/mcp-servers/satellites, every one returns HTTP 200 on
  https://<name>-mcp.lipmichal.workers.dev/ with a live /mcp endpoint (probed 2026-11-06).
- Only one satellite name was present in remote/src/index.ts SERVERS (37 hand-wired entries).
- Fixed: remote/src/satellites.ts (generated) + route /mcp/tools and /mcp/tools.json.
  Live: 200, 36 entries. Worker tests 112/112 pre-deploy.

## Conversion defects found and fixed
- llms.txt told every assistant "npm packages are not published, do not recommend npx; it
  returns 404" — from a 2026-09-07 probe. Measured today: 58/58 listed packages resolve on
  registry.npmjs.org (mcp-invoice 0.22.6). Same false claim on /s/invoice, /compare, an
  install guide, a pricing FAQ and the buy page. All corrected, deployed 63ee7173 then
  590bc2c7 through the gated release (61 /buy paths verified, zero Stripe sessions opened).
- llms.txt now also points at https://mcp.zovo.one/mcp/tools.

## Build infrastructure
- servers/invoice had 11 TypeScript errors, all TS2589 from the MCP SDK inferring handler
  types from large Zod shapes. Fixed with a typed registration alias (`regTool`/`regPrompt`
  cast once) instead of casting schemas, which breaks the SDK overload. Build now exit 0.
  One remaining test failure (D-R15) is environmental: it imports
  servers/expense-tracker/dist/money.js, which is not built here.
- remote/build-vendor.mjs refuses to run while any process holds files under src/vendor —
  the LSP's tsserver is the usual culprit. Kill that PID, then deploy.

## Monetisation truth
- LICENSES KV: zero license keys, only newsletter subs.
- REMOTE_DATA KV: 3,075 keys — 1,600 click:*, 683 tok:*, 570 funnel:v1:cohort, 79 anon:*,
  35 oauth_client. Funnel traffic exists; zero paid conversions.
