import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { summarizeNavigation } from '../scripts/r38-commercial-kpis.mjs';

const source = (by_src, extra = {}) => ({ instrument: 3, total_clicks: Object.entries(by_src).reduce((n, [s, v]) => n + (s.startsWith('unattributed.') ? 0 : v.total), 0), clicks_7d: Object.entries(by_src).reduce((n, [s, v]) => n + (s.startsWith('unattributed.') ? 0 : v.last7d), 0), by_src, ...extra });

test('actual R38 snapshot keeps all three dead routes out of remaining offer navigation', () => {
  const audit = JSON.parse(readFileSync(new URL('../data/r38_kpi_audit.json', import.meta.url), 'utf8'));
  const result = summarizeNavigation(audit.upgrade_clicks);
  assert.equal(result.status, 'interpreted');
  assert.equal(result.guard_passing_navigation_7d, 3);
  assert.equal(result.known_dead_product_navigation_7d, 3);
  assert.equal(result.other_guard_passing_navigation_7d, 0);
  assert.equal(result.verified_valid_product_navigation_7d, 0);
  assert.equal(result.verified_buyers, null);
});

test('a valid-looking source does not prove a valid product route or buyer', () => {
  const result = summarizeNavigation(source({ 'store.s.invoice': { total: 7, last7d: 2 }, 'buy.unknown-product': { total: 1, last7d: 1 } }));
  assert.equal(result.other_guard_passing_navigation_7d, 2);
  assert.equal(result.verified_valid_product_navigation_7d, null);
  assert.equal(result.verified_buyers, null);
  assert.match(result.interpretation, /retain a supplied source/);
});

test('unattributed and legacy rows never enter the interpreted population', () => {
  const result = summarizeNavigation(source({ 'unattributed.buy.invoice': { total: 999, last7d: 999 }, 'store.bundle': { total: 1, last7d: 1 } }, { legacy: { total_clicks: 2000, clicks_7d: 2000 } }));
  assert.equal(result.guard_passing_navigation_7d, 1);
  assert.equal(result.guard_passing_navigation_total, 1);
});

test('missing, unavailable, unsupported, malformed and inconsistent snapshots stay unavailable', () => {
  for (const value of [null, { status: 'UNAVAILABLE' }, source({}, { instrument: 4 }), source({}, { by_src: null }), source({}, { total_clicks: -1 }), source({}, { clicks_7d: NaN }), source({ 'store.bundle': { total: 1, last7d: 1 } }, { clicks_7d: 0 }), source({ 'store.bundle': { total: 1, last7d: 1.5 } }), source({ a: { total: Number.MAX_SAFE_INTEGER, last7d: 0 }, b: { total: 1, last7d: 0 } })]) {
    const result = summarizeNavigation(value);
    assert.equal(result.status, 'unavailable');
    assert.equal(result.known_dead_product_navigation_7d, null);
    assert.equal(result.verified_valid_product_navigation_7d, null);
  }
});

test('an empty consistent instrument has zero counted observations but unknown buyers', () => {
  const result = summarizeNavigation(source({}));
  assert.equal(result.guard_passing_navigation_7d, 0);
  assert.equal(result.verified_valid_product_navigation_7d, 0);
  assert.equal(result.verified_buyers, null);
});
