# R36 revenue and organic distribution sprint

Started 2026-10-16 00:22:43 UTC. The requested four-hour observation deadline is 04:22:43 UTC. This report is updated as publication and observation finish; a live watch alone does not establish that the session is complete.

## Business conclusion

Qualified discovery is the binding constraint. In a complete seven-day MCP storefront Stripe window there are zero checkout sessions and $0 gross paid amount. Lifetime revenue is unmeasured. Google showed the exact MCP host 34 times across September 15–October 13 and generated zero clicks. Those populations and windows cannot form a conversion funnel. There is no measured revenue lift from this sprint.

The largest durable win across the work is a discoverable, verifiable path from a concrete buyer task to a useful free tool and a working paid upgrade. More registry aliases or raw crawler counts do not establish buyers. The current unprimed search trial names the estate in 9/18 answers (six first-listed), compared with zero in the original R1 instrument. Model/search conditions differ and many intervening sprints occurred: this supports improved discoverability, not a causal return-on-investment claim. Revenue remains the unresolved test.

## Work delivered and verification

- Created a local supplier-invoice three-way matcher. It compares exact SKU quantities and integer minor-unit prices against a PO, accepted/rejected receipts and explicitly supplied prior billing. Equal grand totals can conceal offsetting SKU errors; the worked example catches them. Full evidence and pagination are free; $19 Pro removes the three-saved-report cap, and the $39 bundle also unlocks it. No PDF extraction, ERP access or payment approval is claimed.
- New matcher has eight tools. Its 25-test suite, 5,000 independent arithmetic cases, and 1,022 calls against the exact standalone bundle passed. The office proxy made real matching/get/CSV calls. All 48 children initialized. Dependency-resolution guards prevented fallback to the monorepo.
- Corrected office packaging: static extraction declared 407 names while the proxy actually exposed 441. The builder now reads runtime tools/list, including collision prefixes and helper-registered tools. A repack's CRC and every file comparison passed. Final evidence is `data/r36_office_repack_verification.json`.
- Full root test rerun: 2,273 tests, 2,241 passed, 32 skipped, zero failures. It first found a real resume-directory creation race; the fix accepts concurrent EEXIST only for a real directory, rejecting files and symlinks. A deterministic interleaving test covers that distinction.
- Full estate release-check remains red: 126 failures and 28 named gaps in existing version metadata, seven older free skeletons and an expired comparison exception. The matcher row has all 30 checks green. The broad gate was not weakened. Docker execution is assigned to the added GitHub release-preflight CI because this Mac has no Docker CLI.
- Published quote-to-invoice repository metadata. In the immediate GitHub search snapshot, `mcp quote invoice` moved rank 5 to 3 and two narrower previously empty queries returned the repository. This is a single search snapshot, not search volume or buyer traffic.
- Deployed checkout corrections through the existing production gate: single-to-bundle tenant carry, cancellation continuity, accurate confirmation-page key delivery, removal of unsupported scarcity and fake popularity claims, explicit hosted-token requirements, and truthful bank CSV-to-Excel wording. First deployment is recorded in `data/r36_release.json`; 58 GET purchase routes passed without creating Stripe sessions.
- Repaired KPI collection that mixed anonymous and licensed populations and presented missing lifetime data as zero. The main HTML retains historical tabs but clearly dates old figures, marks missing/stale rows, and shows current-window evidence separately.

## Email and outreach access

Resend is already connected locally and on the Worker. The existing domain is verified and sending-enabled. No new account or key is needed. No emails were sent, and inbox delivery was not tested. Resend's acceptable-use policy requires opt-in and excludes unsolicited scraped-list campaigns. The current 18 research targets yield zero eligible email recipients.

The useful next input is an opted-in buyer/partner list with address, consent source/date and requested purpose, plus suppression records and an explicit batch instruction. For curator directories, use the invited submission/PR route. Existing GitHub and Cloudflare access already supports publication. The sender now has stable idempotency, atomic outbox/locking, suppression freshness checks, a ten-attempt cap, and dry-run behavior without network or writes. Its 30 assertions pass, and the legacy bypass was retired. See `docs/OUTREACH_RESEND_SETUP.md`.

## Measurement limits and source access

- GitHub reports 25 unique visitors over October 1–14, not 25 confirmed people. Clone counts and release downloads are not installs.
- 32 anonymous IDs have stored data, including probes. There are zero checkout-license records; five LICENSES keys are mailing-list records.
- Fresh GSC inspection found two product/workflow pages unknown or discovered-not-indexed. Six sampled URLs are not an indexing census.
- The requested `/Users/mike/Desktop/platform-analysis-2026/index.html` and adjacent COLDSTORE markers are absent on this Mac at inspection. Live primary-source research and existing project evidence were used; that missing research file was not treated as read.
- A four-hour, five-minute-interval watch observes deployment/pin consistency, cron state, public health and storefront-scoped Stripe outcomes. It generates no checkout, email or artificial tool demand. An existing forty-minute health recovery cooldown follows the repaired approved-version drift. The watcher does not bypass it.

## Release status

Matcher and corrected office artifacts are built and verified locally. Source PR/CI, public downloads, standalone mirror, two official registry names for the same capability, and the final matcher storefront deployment remain in progress. The next update will record public identifiers and exact verification results. Main dashboard: `../index.html`; live watch evidence: `../data/r36_watch.json`.
