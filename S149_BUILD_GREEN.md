# S149 — The artifact builds, the fleet is green, one contract bug is live-fixed

Date: 2026-11-07 (UTC; Mac clock is ahead of UTC)
Commits: `d36c6083` (build/test), `9f5e247f` (dashboard build 18)
Deployed: hub worker `ec25a6aa-2dab-4f3a-8a00-fa7529b572ba`

## What was broken

`npm run build:dist` aborted on the first unbuilt package. Diagnosis, in order:

1. `asset-register` tsc → `TS2589 type instantiation is excessively deep`, then OOM past 4 GB
   after 137 s. Casting schemas, then hoisting them, changed which line failed; nothing fixed it.
2. `npm ls zod` → **two majors**: root `zod@4.6.7` (installed for
   `@modelcontextprotocol/sdk`) while all 58 workspaces pin `zod ^3.25`, each with a nested
   `zod@3.25.76`. The SDK's `ZodTypeAny` came from zod 4; our schemas from zod 3.
3. Root `overrides: { "zod": "^3.25.76" }` + `npm install` → same compile in **1.1 s**, no errors.

## What was hiding behind it

- `scripts/pretest-dist.mjs` only built a workspace when a *test* imported its `dist`.
  `quotes` and `asset-register` have no such test, so they were skipped and `amortization`
  and `billing-docs` failed on `@theluckystrike/mcp-quotes/lib`. Now it walks transitive
  workspace dependencies of every missing dist.
- A bare `tsc` never copies `src/tables/*.json`. `--assets` refreshes them; this was the
  ENOENT behind 40 failing tests in `asset-register`.

## Measured result

- 43/43 workspaces build, exit 0.
- Root `npm test`: **exit 0, 58 workspaces, 2,384 pass / 0 fail** (was 6 red workspaces).
  - goods-receipt: server.json description had drifted from package.json (24/0)
  - ingredient-convert: two text blocks → not JSON.parse-able, plus 5 descriptions over its
    own 100-char contract (27/0)
  - invoice: stale dist (54/0) · office-suite: load flake, no code change (10/0)
  - recurring: test guessed a skip date instead of reading a real occurrence (39/0)
  - onboarding: no `remotes.json` for the honest hosted registration (55/0)
- Hub worker tests 112/112, vendor regeneration byte-identical, deployed `ec25a6aa`.
- Live proof: `POST /mcp/ingredient-convert` → 7 tools; `common_conversions` → one text block
  of parseable JSON (`summary`, `count: 22`), plus the free-tier upsell block carrying
  `/buy/bundle?tenant=anon_…&src=ingredient-convert.success`.

## Honest scope

- The published `@theluckystrike/mcp-asset-register@0.22.6` tarball **did** contain
  `dist/tables/`. npm users were never served a broken package; the local artifact was.
- `npm publish` is still 401 (no registry credential) — this fix makes publishing *possible*,
  it does not publish anything.
- `git push` is still refused by the `r38-supplier-monetization` ruleset: 45 commits local.

## Why it matters for money

Every hosted tool response is the conversion surface. A response the client cannot parse is a
dead upsell: 600-call free tier, then a buy link that never arrives in a machine-readable form.
That is now fixed on the live endpoint for `ingredient-convert`, and the same class of defect
(two blocks, stale dist) is measurable fleet-wide by running the suite that now passes.
