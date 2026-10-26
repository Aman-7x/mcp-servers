#!/usr/bin/env node
// Read-only interpretation of instrument-3 navigation; never invent buyer attribution.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const count = value => Number.isSafeInteger(value) && value >= 0;
const unavailable = reason => ({ status: 'unavailable', reason, known_dead_product_navigation_7d: null, other_guard_passing_navigation_7d: null, verified_valid_product_navigation_7d: null, verified_buyers: null });

export function summarizeNavigation(stats) {
  if (!stats || stats.status === 'UNAVAILABLE' || stats.status === 'unavailable') return unavailable('Source aggregate is unavailable; do not replace it with zero.');
  if (stats.instrument !== 3) return unavailable('Only instrument 3 is covered by this interpreter.');
  if (!stats.by_src || typeof stats.by_src !== 'object' || Array.isArray(stats.by_src)) return unavailable('Source buckets are missing.');
  if (!count(stats.total_clicks) || !count(stats.clicks_7d)) return unavailable('Source totals must be nonnegative safe integers.');
  let sumTotal = 0, sumRecent = 0, deadTotal = 0, deadRecent = 0;
  for (const [src, bucket] of Object.entries(stats.by_src)) {
    if (!bucket || !count(bucket.total) || !count(bucket.last7d)) return unavailable('Source buckets must contain nonnegative safe integers.');
    // The public totals exclude unattributed.* and legacy; preserve that population.
    if (src.startsWith('unattributed.')) continue;
    sumTotal += bucket.total; sumRecent += bucket.last7d;
    if (!count(sumTotal) || !count(sumRecent)) return unavailable('Source aggregate exceeds the safe integer range.');
    if (src === 'buy.unknown-product') { deadTotal += bucket.total; deadRecent += bucket.last7d; }
  }
  if (sumTotal !== stats.total_clicks || sumRecent !== stats.clicks_7d) return unavailable('Source totals and included buckets disagree; a consistent snapshot is required.');
  const remaining = sumRecent - deadRecent;
  return {
    status: 'interpreted', instrument: 3, generated_at: stats.generated_at ?? null,
    guard_passing_navigation_total: sumTotal,
    guard_passing_navigation_7d: sumRecent,
    known_dead_product_navigation_total: deadTotal,
    known_dead_product_navigation_7d: deadRecent,
    other_guard_passing_navigation_total: sumTotal - deadTotal,
    other_guard_passing_navigation_7d: remaining,
    // If every included observation is known dead, there are zero counted valid
    // navigations in this population. With a remainder, validity is indeterminate:
    // an unknown /buy/ route can retain a source copied from a working offer.
    verified_valid_product_navigation_7d: remaining === 0 ? 0 : null,
    verified_buyers: null,
    interpretation: 'Known dead-route observations are a minimum: unknown-product requests can retain a supplied source. The remainder is not verified valid-product intent, people, successful jobs or purchases. Zero remaining observations applies only to the counted population, not all traffic.',
    window: 'Seven UTC dates in the source instrument; current UTC date is partial. Lifetime counters have a different window.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1) throw Error('Usage: node scripts/r38-commercial-kpis.mjs <aggregate-audit.json>');
  const input = JSON.parse(readFileSync(args[0], 'utf8'));
  const output = summarizeNavigation(input.upgrade_clicks ?? input);
  console.log(JSON.stringify(output, null, 2));
  if (output.status !== 'interpreted') process.exitCode = 1;
}
