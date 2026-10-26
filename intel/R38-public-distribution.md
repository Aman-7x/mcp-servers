# R38 public distribution

Status: published and publicly verified on 2026-10-26 after coordinator GO. Four focus mirrors and four unique v0.25.0 Registry rows are live. This delivers one new supplier capability and an updated Office proxy; discovery aliases are not additional servers. [Aggregate receipt](../data/r38_public_distribution_publication.json).

## Verified preparation

The new Supplier Statement Check mirror was generated through `DRY_RUN=1 NO_RELEASE=1 scripts/sync-mirrors.sh supplier-statement-check` under the owned work directory. Its unpublished shared license dependency is vendored with compiled bytes, and the local package dependency is rewritten to `file:vendor/mcp-license`.

The actual generated mirror completed `npm install --no-audit --no-fund --ignore-scripts`, `npm run build`, and `npm test` using the local npm cache. It reports 32 tests: 31 passed, zero failed, one skipped. The skipped signed-single/bundle-key case needs the production private signing key, which is deliberately excluded from the public mirror. Signed licensing is separately tested by the monorepo and exact-archive gates; the mirror skip is not represented as a pass. [Preflight receipt](../data/r38_public_distribution_preflight.json), [actual mirror tests](../data/r38_public_distribution_mirror_tests.tap).

Before publication, the native GitHub read API confirmed the new supplier mirror was absent with HTTP404, while all three existing mirror repositories were present as public controls. [Baseline projection](../data/r38_public_distribution_repo_baseline.json). Repository existence and metadata are distribution observations, not visitors or buyers.

All four unique v0.25.0 Registry descriptors pass the native publisher's validation: supplier canonical, vendor-statement semantic alias, Office primary name and Office short alias. The vendor alias is a discovery name for the same supplier capability and archive, not an additional product or server.

## Mirror history correction

The sync script previously selected `git push --force` whenever remote `main` was absent, even for an empty new repository. A normal first push works, so force is now selected only by the explicitly requested `SQUASH=1` mode. This publication task uses `SQUASH=0` throughout.

The required `LOCAL_REMOTE` rehearsal ran the real script twice against an owned local bare repository. Between runs, an independent local client committed a marker. The second generated sync retained that marker commit as an ancestor and created a third commit; no GitHub call was made. This verifies both the new-repository normal push and preservation of existing history. [First sync](../data/r38_public_distribution_rehearsal_first.txt), [second sync](../data/r38_public_distribution_rehearsal_second.txt), [ancestry proof](../data/r38_public_distribution_preflight.json).

## Office standalone packaging proof

The additional Office clean-mirror test exposed a real packaging defect: its generated dependency closure followed the partial source `package.json`, while the authoritative proxy declared 50 children. A fresh clone initialized only 14 children and 133 tools, skipping 36 optional children. The actual supplier integration test failed instead of accepting a partial proxy. This does not affect the separately verified 453-tool MCPB archive, whose builder already uses the full child list.

Mirror generation now derives every Office child from the source `CHILDREN` declaration, verifies each package identity and existing compiled entry, augments only the generated mirror's dependency map, and vendors that complete closure. No Office source package version, runtime code or release archive bytes changed. Three focused regression controls pass, covering omitted optional children, bad or missing builds, and empty/duplicate declarations. [Negative control and fix](../data/r38_public_distribution_office_closure_fix.json), [controls](../data/r38_public_distribution_closure_tests.tap). The fixed mirror installed and built, but the final Mac suite never started: the disk guard exited 75 while below 20 GB. The subsequent independent CI supplies the actual 453-tool mirror runtime proof below.

The key-independent `Office mirror preflight` workflow performs the full proof on its independent Linux runner: timezone bootstrap; full license/timezone builds in the explicit cycle-breaking order; dependency-ordered builds for the remaining source children and Office; actual mirror generation outside the monorepo; fresh install/build/tests; and actual stdio names/descriptions against the retained archive manifest, source-value CSV and tool-map controls. No production key, account sign-in, repository publishing or paid API is required.

[CI run 40277599771](https://github.com/theluckystrike/mcp-servers/actions/runs/40277599771) passed on head `016619f4`, with merge-ref checkout `596f02f0`. Its downloaded evidence proves 52 package builds, all 50 children vendored, and an actual standalone v0.25.0 proxy exposing all 453 names/descriptions identically to the tested archive manifest. Three real tool calls preserve comparison results, qualified retrieval hints and original CSV/page values; the tool-map resource and absence of missing-child warnings are checked. The mirror suite reports 10 tests: six passed, zero failed, four monorepo-source fixture skips. Those skips are explicit; independent complete-child registration/runtime checks cover the packaging guarantee. The completed CI mirror workspace was removed only after lsof and deletion-manifest checks. [Verified CI receipt](../data/r38_public_distribution_ci_verification.json), [actual runtime receipt](../data/r38_public_distribution_ci_proof/runtime.json), [complete command evidence](../data/r38_public_distribution_ci_proof/receipt.json).

Available disk briefly fell below 20 GB. Required coldstore plans found zero eligible candidates. Only completed owned rehearsal trees were removed after lsof and deletion-manifest checks; unrelated data was retained. The actual host-wide `/Users/mike/bin/buildslot` queues heavy checks until the 20 GB threshold is met. No threshold was lowered. [Disk recovery receipt](../data/r38_public_distribution_disk_recovery.json).

## Published results

The coordinator confirmed public main, anonymous exact archive hashes and live product/guide/client paths before GO. The real sync script published these four own mirrors with `SQUASH=0`; no force push was used:

| Mirror | Public version / exact main prefix | Public CI |
| --- | --- | --- |
| [Supplier Statement Check](https://github.com/theluckystrike/mcp-supplier-statement-check) | 0.25.0 / `ddce2b97` | [passed](https://github.com/theluckystrike/mcp-supplier-statement-check/actions/runs/40283156119) |
| [Office Suite](https://github.com/theluckystrike/mcp-office-suite) | 0.25.0 / `f5e57dfb` | [passed](https://github.com/theluckystrike/mcp-office-suite/actions/runs/40281707989) |
| [Duplicate Invoice Check](https://github.com/theluckystrike/mcp-duplicate-invoice-check) | 0.22.8 / `814fc449` | [passed](https://github.com/theluckystrike/mcp-duplicate-invoice-check/actions/runs/40281787894) |
| [Three Way Match](https://github.com/theluckystrike/mcp-three-way-match) | 0.22.8 / `bbfbaa67` | [passed](https://github.com/theluckystrike/mcp-three-way-match/actions/runs/40281816971) |

The supplier and Office mirrors have new v0.25.0 releases. Existing focus syncs used `NO_RELEASE=1`. Native tag-ref comparison proves both v0.22.8 focus tags and the old Office v0.22.9 tag are unchanged. Public package/README/metadata readbacks confirm accurate versions, free browser proof links and all 50 Office child dependencies. Each listed CI success matches the exact newly published main commit. [Mirror verification](../data/r38_public_distribution_mirror_verification.json), [CI verification](../data/r38_public_distribution_mirror_ci.json).

Native `mcp-publisher` accepted four unique records: `io.github.theluckystrike/supplier-statement-check`, `io.github.theluckystrike/vendor-statement-open-items`, `io.github.theluckystrike/office-suite-time-invoice-expense-excel-price`, and `io.github.theluckystrike/office-suite`. Anonymous exact-version and latest GETs return 0.25.0 and the exact supplied archive URLs, SHA256 values, repository/product links and local stdio transport. Registry serialization omits optional `isRequired:false`; comparison applies only the official schema's false default. The first supplier publication had already succeeded, so it was read back without republishing that immutable version. [Registry receipt](../data/r38_public_distribution_registry_publication.json).

All four owned publication staging trees were removed after lsof found no open handles; exact sizes and paths are in the deletion manifest and [cleanup receipt](../data/r38_public_distribution_publish_cleanup.json). No unrelated work was removed.

## Search observations and bounded additional route

The exact six frozen queries were repeated through the native GitHub API with complete result projections. The supplier mirror appears first of two for supplier statement, first of one for vendor statement, third of four for supplier reconciliation, and fourth of six for statement reconciliation. The first post-publication readback missed the literal accounts-payable metadata query (17 results), because the description used AP and the qualifier excludes topics. A measured metadata-only follow-up expanded that phrase to “supplied accounts payable ledger” (333/350 characters). Supplier-only sync advanced normally with one README line changed; the v0.25.0 tag stayed unchanged and exact-tip CI passed. One subsequent readback of the unchanged frozen query finds the supplier mirror at 12 of 18 results. [Metadata iteration receipt](../data/r38_supplier_metadata_iteration.json). The three-way-match positive-control query still returns 11 results. These observations establish repository metadata indexing, not volume, visitors, buyers or causal ranking gains. [Search readback](../data/r38_public_distribution_search_after.json).

A fresh bounded Smithery check confirms installed CLI 4.11.1 and its documented local MCPB publish command. The [official publication guide](https://smithery.ai/docs/build/publish) and [release API](https://smithery.ai/docs/api-reference/servers/publish-a-server) support bundle distribution. Native `smithery --json auth whoami` exits 1 and instructs `Run 'smithery auth login' to authenticate`. Existing authentication is absent; no login, new account, browser, package installation, configuration search or publish was attempted. No free-publication claim is made without an authenticated flow. [Feasibility receipt](../data/r38_smithery_publication_feasibility.json).

The exact browser task is `/guides/compare-supplier-statement-ap-open-items-in-claude#supplier-demo`. No hosted endpoint or published npm package is claimed for the new supplier server. Platform receipts, release downloads, search positions and automated CI do not establish qualified traffic, customers, conversion or positive ROI. No outreach messages or paid APIs are used.
