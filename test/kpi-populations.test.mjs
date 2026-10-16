import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kvPopulation, stripePopulation, paidProTenants, latestBlindInstrument, blindKpiRows } from '../scripts/kpi-populations.mjs';

test('KV distinguishes expiring token records from per-server data and email rows', () => {
  assert.deepEqual(kvPopulation([
    'tok:anon_' + 'a'.repeat(32), 'anon:person:invoice', 'anon:person:profile',
    'anon:second:invoice', 'lic:probe:invoice', 'lic:probe:pdf', 'sub:email',
  ]), { liveTokens: 1, anonymousDocuments: 3, anonymousTenants: 2, licenseIds: ['probe'], downloads: 0 });
  assert.equal(kvPopulation(null), null);
});

test('Stripe excludes other storefronts and tagged probes and uses a bounded seven-day window', () => {
  const now = Date.UTC(2026, 9, 16), created = now / 1000 - 86400;
  const mcp = { success_url: 'https://mcp.zovo.one/success', created, payment_status: 'paid' };
  assert.deepEqual(stripePopulation([
    { ...mcp, id: 'real' }, { ...mcp, id: 'probe', metadata: { probe: '1' } },
    { ...mcp, id: 'other', success_url: 'https://zovo.one/success' },
    { ...mcp, id: 'older', created: created - 8 * 86400, payment_status: 'unpaid' },
  ], now), { mcpSessions: 3, untaggedSessions: 2, untaggedSessions7d: 1, paid: 1, paid7d: 1, paidSessionIds: ['real'] });
});

test('signed probes and bindings without a paid checkout never become paid Pro tenants', () => {
  assert.equal(paidProTenants(['lic:probe:invoice', 'lic:paid:invoice', 'lic:paid:pdf'], new Set(['paid']), ['probe', 'paid']), 1);
  assert.equal(paidProTenants(['lic:probe:invoice'], new Set(), ['probe']), 0);
});

const frozen = JSON.parse(readFileSync(new URL('../data/blind_questions.json', import.meta.url)));
const r8 = JSON.parse(readFileSync(new URL('../data/blind_recommendation_r8.json', import.meta.url)));
const candidate = record => ({ source: 'data/blind_recommendation_r8.json', record });

test('latest comparable blind instrument selects explicit estate scores and raw-host presence', () => {
  const older = structuredClone(r8); older.measured_at = '2026-09-01T00:00:00Z';
  const selected = latestBlindInstrument([candidate(older), candidate(r8)], frozen);
  assert.equal(selected.named, 9); assert.equal(selected.questions, 18);
  assert.equal(selected.host_raw, 15); assert.equal(selected.first_listed, 6);
  const rows = blindKpiRows(selected);
  assert.equal(rows[0].value, 9); assert.equal(rows[1].value, 15);
  assert(rows.every(r => r.target === 18 && r.stale === false && r.measured_at === r8.measured_at));
  assert.match(rows[1].why, /not recommendation citations/);
  assert.match(rows[0].how, /post hoc/); assert.match(rows[0].how, /no runtime certification/);
});

test('blind selector rejects primed, unknown estate scores, and mismatched frozen questions', () => {
  for (const mutate of [
    r => { r.primed = true; },
    r => { r.provenance = { primed: true }; },
    r => { r.provenance = { primed: false, fork_turns: 'all' }; },
    r => { delete r.summary.named_ours_in_answer; r.scores = { named_by_blind_assistant: 12 }; },
    r => { r.method = 'unknown context'; delete r.primed; delete r.provenance; },
    r => { r.questions[0].q += ' revised'; },
    r => { [r.questions[0], r.questions[1]] = [r.questions[1], r.questions[0]]; },
    r => { r.summary.host_appeared_count = 18; },
    r => { r.identity_evaluation.named_questions.push(1); },
    r => { r.questions[0].results = []; },
  ]) {
    const invalid = structuredClone(r8); mutate(invalid);
    assert.equal(latestBlindInstrument([candidate(invalid)], frozen), null);
  }
  assert.equal(blindKpiRows(null)[0].value, null);
});

test('R7 all-server count is never manufactured into estate wins', () => {
  const r7 = JSON.parse(readFileSync(new URL('../data/blind_recommendation_r7.json', import.meta.url)));
  assert.equal(r7.scores.named_by_blind_assistant, 12);
  assert.equal(latestBlindInstrument([{ source: 'r7', record: r7 }], frozen), null);
  assert.equal(latestBlindInstrument([{ source: 'r7', record: r7 }, candidate(r8)], frozen).named, 9);
});
