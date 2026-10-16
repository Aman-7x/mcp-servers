#!/usr/bin/env node
// Read-only, aggregate-only audit. No raw customer/session objects are persisted.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const started = new Date().toISOString();
const seen = new Set();
const counts = { completed_sessions: 0, paid_sessions: 0, mcp_completed_sessions: 0, mcp_tagged_probes: 0, mcp_untagged_completed_sessions: 0, mcp_untagged_paid_sessions: 0 };
const gross = {};
let cursor, pages = 0, complete = false, oldest = null, newest = null;
for (; pages < 50 && !complete;) {
  const args = ['get', '/v1/checkout/sessions', '--live', '-d', 'status=complete', '-d', 'limit=100'];
  if (cursor) args.push('-d', 'starting_after=' + cursor);
  const response = spawnSync('stripe', args, { encoding: 'utf8', timeout: 45000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(response.status, 0, 'Read-only Stripe request failed');
  const page = JSON.parse(response.stdout);
  assert.ok(!page.error && Array.isArray(page.data), 'Malformed Stripe page');
  pages++;
  for (const s of page.data) {
    assert.equal(s.status, 'complete'); assert.equal(s.livemode, true);
    assert.ok(s.id && !seen.has(s.id), 'Cursor repeated a session'); seen.add(s.id);
    counts.completed_sessions++;
    const at = new Date(s.created * 1000).toISOString();
    oldest = oldest === null || at < oldest ? at : oldest;
    newest = newest === null || at > newest ? at : newest;
    if (s.payment_status === 'paid') counts.paid_sessions++;
    let host; try { host = new URL(s.success_url).hostname; } catch { continue; }
    if (host !== 'mcp.zovo.one') continue;
    counts.mcp_completed_sessions++;
    if (s.metadata?.probe === '1') { counts.mcp_tagged_probes++; continue; }
    counts.mcp_untagged_completed_sessions++;
    if (s.payment_status !== 'paid') continue;
    counts.mcp_untagged_paid_sessions++;
    assert.ok(/^[a-z]{3}$/.test(s.currency) && Number.isSafeInteger(s.amount_total) && s.amount_total >= 0);
    gross[s.currency] = (gross[s.currency] || 0) + s.amount_total;
  }
  complete = page.has_more === false;
  assert.ok(complete || page.data.length > 0, 'Empty nonterminal page');
  cursor = page.data.at(-1)?.id;
}
assert.ok(complete, 'Completed-session pagination exceeded 50 pages; no complete-history claim');
const report = { started_at: started, fetched_at: new Date().toISOString(), status: 'OK', method: 'Stripe live GET /v1/checkout/sessions?status=complete&limit=100, cursor pagination until has_more=false', documentation: 'https://docs.stripe.com/api/checkout/sessions/list', pages, complete_history_of_matching_sessions: complete, oldest_completed_session: oldest, newest_completed_session: newest, counts, mcp_untagged_paid_checkout_gross_minor_by_currency: gross, scope: 'Success URL hostname exactly mcp.zovo.one; metadata.probe=1 excluded from commercial totals', limitations: ['All available completed Checkout Sessions at the snapshot, not all Stripe payment channels or business revenue.', 'Paid checkout gross amount precedes refunds, fees, disputes and taxes; no net revenue or profit claim.', 'Complete sessions can still be unpaid; payment_status=paid is separately required.', 'Untagged activity is not independently verified as human.'], privacy: 'Only aggregates persisted. No raw session IDs, customer identities, payment intents, checkout URLs or credentials exported.' };
writeFileSync(new URL('../data/r36_completed_checkout_audit.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
