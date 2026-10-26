# R38 public distribution

Status: publication held for coordinator confirmation of public source and immutable release assets. No external repository or Registry mutation has been performed by this agent at this checkpoint.

## Verified preparation

The new Supplier Statement Check mirror was generated through `DRY_RUN=1 NO_RELEASE=1 scripts/sync-mirrors.sh supplier-statement-check` under the owned work directory. Its unpublished shared license dependency is vendored with compiled bytes, and the local package dependency is rewritten to `file:vendor/mcp-license`.

The actual generated mirror completed `npm install --no-audit --no-fund --ignore-scripts`, `npm run build`, and `npm test` using the local npm cache. It reports 32 tests: 31 passed, zero failed, one skipped. The skipped signed-single/bundle-key case needs the production private signing key, which is deliberately excluded from the public mirror. Signed licensing is separately tested by the monorepo and exact-archive gates; the mirror skip is not represented as a pass. [Preflight receipt](../data/r38_public_distribution_preflight.json), [actual mirror tests](../data/r38_public_distribution_mirror_tests.tap).

The native GitHub read API confirms the new supplier mirror is absent with HTTP404, while all three existing mirror repositories are present as public controls. [Baseline projection](../data/r38_public_distribution_repo_baseline.json). Repository existence and metadata are distribution observations, not visitors or buyers.

All four unique v0.25.0 Registry descriptors pass the native publisher's validation: supplier canonical, vendor-statement semantic alias, Office primary name and Office short alias. The vendor alias is a discovery name for the same supplier capability and archive, not an additional product or server.

## Mirror history correction

The sync script previously selected `git push --force` whenever remote `main` was absent, even for an empty new repository. A normal first push works, so force is now selected only by the explicitly requested `SQUASH=1` mode. This publication task uses `SQUASH=0` throughout.

The required `LOCAL_REMOTE` rehearsal ran the real script twice against an owned local bare repository. Between runs, an independent local client committed a marker. The second generated sync retained that marker commit as an ancestor and created a third commit; no GitHub call was made. This verifies both the new-repository normal push and preservation of existing history. [First sync](../data/r38_public_distribution_rehearsal_first.txt), [second sync](../data/r38_public_distribution_rehearsal_second.txt), [ancestry proof](../data/r38_public_distribution_preflight.json).

## Publication plan

After the coordinator confirms public `main` and byte-verified v0.25.0 assets, sync the new supplier and Office mirrors, then publish their new version tags. Sync the duplicate-invoice and three-way-match README improvements with `NO_RELEASE=1`, preserving their existing immutable version tags and archives. Publish exact v0.25.0 Registry descriptors only after their referenced public assets exist. Read back complete versioned Registry records, source repository tips, README links and metadata.

The exact browser task is `/guides/compare-supplier-statement-ap-open-items-in-claude#supplier-demo`. No hosted endpoint or published npm package is claimed for the new supplier server. Platform receipts, release downloads, search positions and automated CI do not establish qualified traffic, customers, conversion or positive ROI. No outreach messages or paid APIs are used.
