#!/usr/bin/env node
// Derive the final reporting snapshot without changing the initial audit/summary.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { summarizeNavigation } from './r38-commercial-kpis.mjs';
const root = new URL('../', import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root)));
const output = 'data/r38_kpi_final_summary.json';
assert(!existsSync(new URL(output, root)), 'Preserve the completed final summary');
const audit = read('data/r38_kpi_final_audit.json'), baseline = read('data/r38_kpi_audit.json');
assert(audit.status === 'OK' && audit.previous_evidence_unchanged === true);
const nav = summarizeNavigation(audit.upgrade_clicks); assert(nav.status === 'interpreted');
const f = audit.funnel, s = audit.stripe_completed, g = audit.search_console, github = audit.github;
const summary = {
  schema: 1, collected_until: audit.finished_at, audit: 'data/r38_kpi_final_audit.json',
  canonical_index_inspection: 'data/r38_kpi_final_index_inspection.json',
  scope: 'End-of-session native snapshot. MCP gross is not net profit; unmarked responses, reported clients and submissions are not people or buyers.',
  headline: {
    mcp_paid_completed_checkout_sessions: s.counts.mcp_untagged_paid,
    mcp_checkout_gross_minor_by_currency: s.mcp_untagged_paid_checkout_gross_minor_by_currency,
    mcp_finalized_gsc_impressions: g.mcp.impressions, mcp_finalized_gsc_clicks: g.mcp.clicks,
    hosted_ordinary_protocol_successes: f.ordinary.successful_business_call,
    hosted_first_anon_token_server_day_observations: f.ordinary.first_successful_anon_token_server_day,
    hosted_ordinary_checkout_handoffs: f.ordinary.checkout_handoff,
    guard_passing_clicks_7_utc_dates: nav.guard_passing_navigation_7d,
    unknown_product_route_clicks_7_utc_dates: nav.known_dead_product_navigation_7d,
    other_guard_passing_clicks_7_utc_dates: nav.other_guard_passing_navigation_7d,
  },
  comparisons: {
    baseline: 'data/r38_kpi_audit.json', caution: 'Overlapping windows and a short observation period; descriptive changes cannot establish causation or SEO impact.',
    mcp_paid_completed_sessions: { previous: baseline.stripe_completed.counts.mcp_untagged_paid, current: s.counts.mcp_untagged_paid },
    account_completed_paid_positive_control: { previous: baseline.stripe_completed.counts.account_paid, current: s.counts.account_paid },
    stripe_28d_untagged_sessions: { previous: baseline.stripe_28d.mcp_untagged_sessions, current: audit.stripe_28d.mcp_untagged_sessions, previous_window: baseline.stripe_28d.window, current_window: audit.stripe_28d.window },
    github: { previous_window: baseline.github.window, current_window: github.window, previous_views: baseline.github.views, current_views: github.views, previous_unique_clients: baseline.github.unique_visitors, current_unique_clients: github.unique_visitors, previous_clones: baseline.github.clones, current_clones: github.clones, previous_clone_clients: baseline.github.clone_unique_clients, current_clone_clients: github.clone_unique_clients },
  },
  funnel: {
    window: f.window, ordinary: f.ordinary, probe: f.probe,
    success_sources: [...new Set(f.rows.filter(r => r.cohort === 'ordinary' && r.event === 'successful_business_call' && r.count > 0).map(r => r.source))],
    per_server_breakdown_available: false,
    observed_success_days: f.window.utc_dates.map(day => ({ day, successful_responses: f.rows.filter(r => r.day === day && r.cohort === 'ordinary' && r.event === 'successful_business_call').reduce((n, r) => n + r.count, 0) })),
    limits: ['Ordinary means unmarked, not human.', 'Success is a returned response shape, not a verified buyer outcome.', 'Separate Stripe, Google, GitHub and hosted windows cannot be combined into a conversion rate.', 'GitHub traffic may include operator work and automated systems.'],
  },
  controls: { stripe_paid_account: s.paid_account_positive_control, stripe_full_completed_history: s.complete_history_of_completed_sessions, stripe_all_line_items: s.all_line_items_covered, stripe_7d_coverage: audit.stripe_7d.entire_window_covered, stripe_28d_coverage: audit.stripe_28d.entire_window_covered, gsc_parent_impressions: g.positive_control.impressions, gsc_parent_clicks: g.positive_control.clicks, funnel_bounded_read_complete: f.complete, prior_evidence_unchanged: audit.previous_evidence_unchanged },
  navigation: nav,
  limits: ['Marked operator checkout, browser and licensing probes are reliability checks, not customers or revenue.', 'No paid API spending or outreach sends; agent and hosting costs are unreconciled.', 'Indexing inspection is an indexed-version observation, not a live test or a removal request.'],
};
const inspections = { at: g.fetched_at, source: 'data/r38_kpi_final_audit.json', urls: g.inspections, scope: 'Exact canonical URLs and new supplier routes; read-only indexed-version inspection, no per-URL indexing request.' };
for (const [path, value] of [['data/r38_kpi_final_index_inspection.json', inspections], [output, summary]]) writeFileSync(new URL(path, root), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output, paid: summary.headline.mcp_paid_completed_checkout_sessions, google_clicks: g.mcp.clicks, hosted_successes: f.ordinary.successful_business_call }));
