# sat3 other site edits (S1106, 2026-11-06)

Nothing was edited on the site. This file lists what a merge needs.

## Files that must change

Deploys come from ~/mcp-site-2026-10-30/repo (see ~/mcp-servers/CLAUDE.md trap 11). Edit the repo copy. The copy in ~/mcp-site-2026-10-30/data/content is the same file today (`diff -q` empty), so mirror it there too.

1. repo/data/content/free-servers.json. Append the 3 objects in sat3-free-servers.json `servers` to the end of the `servers` array, after mortgage-rates-today-mcp. Order in the file is order on the site.

2. repo/data/content/can-claude-live.json. Append the 3 objects in sat3-live.json `pages` to the end of `pages`. Also append this line to `_readme`, in the same style as the s1105 lines.

```
"s1106 sat3: 3 pages (USPS holiday shipping deadlines, heating oil and propane prices, postage stamp price). Raw call responses ~/mcp-servers/data/s1106/reports/sat-evidence-1106/<repo>-remote.json, generator ~/mcp-servers/data/s1106/content/make_sat3_live.py."
```

The free-servers.json entries must land in the same commit as the can-claude-live.json entries. canClaudeLive.ts skips a page whose `repo` has no free-servers entry.

## Files that do not need a change

How mortgage-rates-today-mcp reaches the site. `/usr/bin/grep -rl mortgage-rates-today` in ~/mcp-site-2026-10-30 (without node_modules, dist, .astro, build-out) finds only the two JSON files above and their repo copies. Commit a413290 (sat2) changed only those 2 files.

Everything else reads the two files.
- /free-servers/ and /free-servers/<repo>/ pages, home page count and list (site/src/pages/free-servers, site/src/pages/index.astro, components/FreeServerList.astro)
- /can-claude/<slug>/ pages and the /can-claude/ index (site/src/pages/can-claude)
- llms.txt (site/src/pages/llms.txt.ts)
- sitemap (site/src/data/routes.ts)

Slug check. None of the 3 slugs is in can-claude-live.json or in a `path` in site/src/data/pages.json (no /can-claude/ path with stamp, usps, propane, heating, shipping or postage).

## Optional

site/src/data/routes.ts gives every live answer page the fixed sitemap lastmod '2026-11-03' (lines 29 and 30). The new pages will show that date. This was the same for the s1105 pages, so it is left as it is.

`added` is 2026-11-06 (the day the entries were written), `tools_checked` is 2026-11-05 (the day of the live tools/list). Change `added` to the merge date if the merge is later.
