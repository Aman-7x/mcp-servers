#!/usr/bin/env node
// Local reporting only. API receipts retain their original windows and timestamps.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const load = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
const save = (name, value) => writeFileSync(new URL(name, root), JSON.stringify(value, null, 2) + '\n');
for (const [from, to] of [['data/current_session.json', 'data/r37_completed_session.json'], ['data/revenue_review.json', 'data/revenue_review_2026-10-17.json']]) {
  if (!existsSync(new URL(to, root))) save(to, load(from));
}
const finalSnapshot = existsSync(new URL('data/r38_kpi_final_audit.json', root)) && existsSync(new URL('data/r38_kpi_final_summary.json', root));
const source = finalSnapshot ? 'data/r38_kpi_final_audit.json' : 'data/r38_kpi_audit.json';
const summarySource = finalSnapshot ? 'data/r38_kpi_final_summary.json' : 'data/r38_kpi_summary.json';
const audit = load(source);
const summary = load(summarySource);
const run = load('data/r38_session.json');
const oldReview = load('data/revenue_review_2026-10-17.json');
if (summary.audit !== source) throw Error('Audit and summary must describe the same snapshot');
const h = summary.headline;
const f = summary.funnel.ordinary;
const dead = h.unknown_product_route_clicks_7_utc_dates, other = h.other_guard_passing_clicks_7_utc_dates;
const g = audit.search_console;
const s = audit.stripe_28d;
const metric = (value, label, window, note, evidence = source) => ({ value, label, window, note, source: evidence });
const window = value => `${value.start} to ${value.end}`;
const gross = Object.entries(audit.stripe_completed.mcp_untagged_paid_checkout_gross_minor_by_currency);
if (audit.status !== 'OK' || gross.length || h.mcp_paid_completed_checkout_sessions !== 0) throw Error('Review requires a fresh commercial reassessment; do not reuse the zero-sales diagnosis');
const metrics = [
  metric('$0', 'MCP paid Checkout gross', `Available completed history read ${audit.stripe_completed.fetched_at}`, `${audit.stripe_completed.counts.account_paid} paid shared-account read controls; no MCP paid matches by host, price or product metadata. Gross is not profit.`),
  metric(s.mcp_untagged_sessions, 'Untagged MCP Checkouts; none paid', window(s.window), `${s.mcp_tagged_probes} tagged probes excluded. Full 28-day window covered; Sessions do not establish buyers.`),
  metric(`${g.mcp.impressions} / ${g.mcp.clicks}`, 'Google impressions / clicks', window(g.window), '28 finalized reporting dates, exact storefront host; no product or guide page row returned.'),
  metric(h.hosted_ordinary_protocol_successes, 'Unmarked successful hosted responses', window(summary.funnel.window), `${h.hosted_first_anon_token_server_day_observations} first token/server/day observations. All unattributed; neither count is people or completed buyer jobs.`, summarySource),
  metric(`${dead} / ${other}`, 'Known dead-route clicks / other clicks', `Seven UTC dates ending ${audit.upgrade_clicks.fetched_at}`, `${dead} observations are known dead routes; ${other} others remain unverified. Source labels do not establish valid product intent.`, summarySource),
];
const review = {
  ...oldReview, review_date_local: '2026-10-26', date_label: '26 October 2026 ICT', updated_at: audit.finished_at,
  audit: source, report: 'intel/R38-kpi.md', title: 'Why MCP revenue is still zero',
  conclusion: `The payment and distribution assets exist, but qualified buyer discovery and the reason to buy Pro remain unvalidated. Google delivered ${g.mcp.clicks} measured clicks; hosted usage records ${h.hosted_ordinary_protocol_successes} unmarked successful responses and ${h.hosted_ordinary_checkout_handoffs} checkout handoffs.`,
  accountability: 'Server counts, tests, directory listings, clones and synthetic probes are supply or reliability evidence. They are not sales, customers or demonstrated return on investment. The current server experiment is a bounded test of a documented workflow, not proof of demand.',
  metrics,
  findings: [
    { title: 'Qualified discovery remains the limiting evidence', status: `${g.mcp.impressions} Google impressions, ${g.mcp.clicks} clicks; task URL rows retain their dated source`, evidence: `Finalized ${g.window.start} through ${g.window.end}; homepage and protocol routes receive the impressions. GitHub reports ${audit.github.views} views and ${audit.github.unique_visitors} clients in its separate window.`, implication: 'Send existing relevant distribution traffic directly to an exact free task. Measure trials and repeat use before broad catalogue expansion.', source: 'intel/R38-kpi.md' },
    { title: 'Some hosted protocol use is now visible', status: `${h.hosted_ordinary_protocol_successes} unmarked successes; ${h.hosted_first_anon_token_server_day_observations} first token/server/day observations`, evidence: `The counters pool all servers. Source declarations are not verified attribution. There are ${f.offer_view} unmarked offer views and ${f.checkout_handoff} unmarked handoffs in the same seven-date instrument window.`, implication: 'Keep the useful free workflows and source attribution. Do not treat automation-inclusive counters as a person-level conversion funnel.', source: summarySource },
    { title: 'Revenue is still unproven', status: 'Zero paid MCP Checkout Sessions across available completed history', evidence: 'Two exhausted pages contain 186 completed paid account records as positive controls; exact host, known price and metadata independently find no MCP paid match.', implication: 'A tested payment path is necessary. Buyer willingness to pay and actual net ROI still require independent receipts and attributable costs.', source },
    { title: 'Separate dead-route clicks from unresolved navigation', status: `${dead} known dead-route observations; ${other} other guard-passing clicks`, evidence: 'The unknown-product branch returns HTTP 404 and preserves a valid supplied source label when present. Other source buckets alone cannot certify valid-product interest.', implication: 'Preserve dead-link diagnostics separately and keep unresolved clicks unresolved. Do not present these observations as buyers considering Pro.', source: summarySource },
  ],
  decision: 'Repair paid-access reliability, publish one narrow supplier-statement experiment with a useful free tier, and direct existing distribution to demonstrated workflows. Treat any expansion as an experiment until qualified repeat use and an independent payment are observed.',
  indexation: { source: summary.canonical_index_inspection, measured_at: audit.finished_at, summary: 'Exact URL indexed-version observations retain their dated receipt. Sitemap submission does not establish indexing; coverage changes alone do not prove removal.', urls: [] },
  limits: ['No person-level conversion rate or net-profit claim.', 'Historical audit and prior sprint files are preserved.', 'No outreach email or live purchase was created by this review.', 'Deployment, artifact tests and production observation are separately dated evidence.'],
};
save('data/revenue_review.json', review);
const current = {
  title: 'R38 — monetization, supplier workflow and organic distribution, 26 October 2026',
  active: run.status !== 'complete', updated_at: new Date().toISOString(),
  status_note: `Four-hour session started ${run.started_at}; deadline ${run.deadline_at}. ${run.status_note || 'Implementation and verification in progress.'}`,
  conclusion: run.conclusion || 'Fresh revenue and acquisition audit is complete. Existing billing monitor approval was recovered after a 60-path checkout guard passed. Paid-access fixes and the new supplier-statement experiment are under review; publication is not yet claimed.',
  metrics, shipped: run.delivered || [
    'Refreshed scoped Stripe, Google Search, hosted funnel and GitHub data with positive controls; prior receipts preserved.',
    'Recovered billing approved-version alignment after verifying 60 live GET purchase paths created zero Stripe Sessions. Scheduled checks resumed; public-health cooldown remains separately observed.',
    'Improved focus server source READMEs with exact browser-proof and companion-workflow links; local edits await publication.',
  ],
  next_levers: run.next_levers || ['Publish the independently reviewed additive hosted entitlement fix, remote readers before billing writers.', 'Finish and adversarially verify the supplier statement open-item comparison server, then publish its actual archive and distribution routes.', 'Use existing permitted audience routes for qualified trials; Resend is already connected and does not supply buyers.'],
  report: 'intel/R38-session.md', watch_path: 'data/r38_watch.json', previous_session_path: 'data/r37_completed_session.json',
  known_limits: run.known_limits || 'New server demand is unvalidated. Wider estate is not release-green. A paid transaction and inbox delivery remain untested. Old lost hosted entitlements require valid-key reactivation; the fix cannot reconstruct missing purchase history.',
};
save('data/current_session.json', current);
const kpi = load('data/kpi.json');
for (const row of kpi.kpis) {
  row.stale = true;
  row.stale_reason = 'Historical observation retained; not remeasured by the current R38 native audit.';
}
function set(name, value, channel, note, unit) {
  let row = kpi.kpis.find(x => x.name === name);
  if (!row) { row = { name, cat: 'Monetization', target: null }; kpi.kpis.push(row); }
  const evidence = audit[channel];
  Object.assign(row, { value, unit, how: note, measured_at: evidence.fetched_at, window: evidence.window || { scope: 'Available completed Checkout history' }, stale: false, status: value === null ? 'unmeasured' : value === 0 ? 'zero' : 'measured', source_artifact: source });
  delete row.stale_reason;
}
set('Recorded MCP paid Checkout gross (available completed history)', 0, 'stripe_completed', 'All available completed Checkout records exhausted; exact MCP host/known-price/metadata tests and paid-account read control. Gross, not net profit.', 'USD gross');
set('Untagged MCP checkout sessions (7d)', audit.stripe_7d.mcp_untagged_sessions, 'stripe_7d', 'Fully covered seven-day window; exact MCP host, probe=1 excluded, untagged not human.', 'Sessions');
set('Paid MCP checkout sessions (7d)', audit.stripe_7d.mcp_untagged_paid_sessions, 'stripe_7d', 'Same fully covered window and paid-only criterion.', 'paid Sessions');
set('Untagged MCP checkout sessions (28d)', s.mcp_untagged_sessions, 'stripe_28d', 'Fully covered 28-day window; tagged probes excluded.', 'Sessions');
set('Google impressions, storefront', g.mcp.impressions, 'search_console', 'Exact host, finalized 28-date page rows and parent-host positive control.', 'impressions');
set('Google clicks, storefront', g.mcp.clicks, 'search_console', 'Exact host, finalized 28-date page rows and parent-host positive control.', 'clicks');
set('GitHub unique visitors', audit.github.unique_visitors, 'github', 'Platform-reported clients in the API window; not confirmed people or installs.', 'reported clients');
set('Guard-passing upgrade clicks (7d)', audit.upgrade_clicks.clicks_7d, 'upgrade_clicks', `Legacy metric includes ${dead} known dead-route observations; ${other} other navigations do not establish valid intent.`, 'unmarked navigations');
set('Known unknown-product route clicks (7d)', h.unknown_product_route_clicks_7_utc_dates, 'upgrade_clicks', 'Known dead-route minimum only; invalid products with a supplied valid src may be unresolved in historical data.', 'dead-route navigations');
set('Click to checkout-session ratio', null, 'stripe_7d', 'Unmeasured: unrelated populations/windows and no verified qualified-visit denominator.', 'unmeasured');
kpi.generated_at = new Date().toISOString(); kpi.audit_source = source;
kpi.windows = { ...kpi.windows, stripe: audit.stripe_7d.window, github: audit.github.window, search: g.window };
save('data/kpi.json', kpi);
execFileSync(process.execPath, [new URL('scripts/render-main.mjs', root).pathname], { cwd: root, stdio: 'inherit' });
console.log('R38 dashboard refreshed from immutable native receipts; historical observations preserved.');
