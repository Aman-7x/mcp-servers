import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ownsProbeSession, canExpireProbeSession, reference, verifyExpiryEvidence, acquireProbeLock } from '../scripts/checkout-lifecycle-probe.mjs';
const state = { started_unix: 1000, source: 'probe.unique', tenant: 'synthetic', submitted: [{ product: 'three-way-match', order_token: 'order-unique' }] };
const session = { id: 'cs_live_example123', livemode: true, created: 1001, status: 'open', payment_status: 'unpaid', client_reference_id: state.tenant, metadata: { probe: '1', source: state.source, tenant: state.tenant, product: 'three-way-match', order_token: 'order-unique' } };
test('expiry requires exact ownership and an open unpaid live session', () => {
  assert.equal(canExpireProbeSession(session, state), true);
  for (const changed of [{ status: 'complete' }, { payment_status: 'paid' }, { livemode: false }, { created: 900 }, { client_reference_id: 'foreign' }, { id: 'cs_test_example123' }]) assert.equal(canExpireProbeSession({ ...session, ...changed }, state), false);
});
test('another product, operator, order or tenant is never a cleanup target', () => {
  for (const changed of [{ probe: undefined }, { source: 'foreign' }, { tenant: 'foreign' }, { order_token: 'foreign' }, { product: 'invoice' }]) assert.equal(ownsProbeSession({ ...session, metadata: { ...session.metadata, ...changed } }, state), false);
  assert.equal(ownsProbeSession({ ...session, metadata: undefined }, state), false);
});

function evidence() {
  const run = { ...state, run_id: 'run-current', expected_version: 'version-current', submitted: [] };
  const sessions = ['three-way-match', 'bundle'].map((product, i) => {
    const id = 'cs_live_owned' + i, order_token = 'order-' + i;
    run.submitted.push({ product, order_token, session_reference: reference(id) });
    return { ...session, id, status: 'expired', expires_at: 2861,
      amount_total: i ? 3900 : 1900, currency: 'usd', customer: null, payment_intent: null,
      metadata: { ...session.metadata, product, order_token, worker_version: run.expected_version } };
  });
  const report = { run_id: run.run_id, started_unix: run.started_unix, expected_version: run.expected_version,
    source_reference: reference(run.source), tenant_reference: reference(run.tenant),
    handoff_complete: true, profile_cleanup_complete: true, submission_finished_at: '2026-10-16T01:00:00Z', created: 2, status: 'awaiting_expiry', rows: sessions.map((s, i) => ({
      product: s.metadata.product, session_reference: reference(s.id), order_reference: reference(run.submitted[i].order_token),
      amount_total_minor: s.amount_total, currency: 'usd', probe_tag: '1', order_replay_reused: true,
      unpaid_fulfillment_status: 402, customer_created: false, payment_intent_created: false,
    })) };
  return { run, report, sessions };
}

test('expiry completion is bound to this run, product orders and successful handoff evidence', () => {
  const { run, report, sessions } = evidence();
  assert.equal(verifyExpiryEvidence(run, report, sessions).report.status, 'passed');
  for (const change of [{ run_id: 'older-run' }, { started_unix: 999 }, { source_reference: 'other' }, { tenant_reference: 'other' }, { expected_version: 'older' }]) {
    assert.throws(() => verifyExpiryEvidence(run, { ...report, ...change }, sessions));
  }
  for (const mutate of [
    r => { r.handoff_complete = false; }, r => { r.rows.pop(); },
    r => { r.profile_cleanup_complete = false; }, r => { delete r.submission_finished_at; },
    r => { r.rows[0].session_reference = 'older-session'; },
    r => { r.rows[0].order_reference = 'older-order'; },
    r => { r.rows[0].order_replay_reused = false; },
    r => { r.rows[0].amount_total_minor = 1; },
  ]) {
    const incomplete = structuredClone(report); mutate(incomplete);
    const verified = verifyExpiryEvidence(run, incomplete, sessions).report;
    assert.equal(verified.status, 'failed'); assert(verified.verification_failure);
  }
});

test('expiry reads never erase prior failures or certify open, charged or missing sessions', () => {
  const { run, report, sessions } = evidence();
  for (const changed of [{ status: 'failed' }, { failure: 'handoff failed' }, { cleanup_failure: 'query incomplete' }, { profile_cleanup: 'handles unknown' }, { verification_failure: 'prior incomplete proof' }]) {
    assert.equal(verifyExpiryEvidence(run, { ...report, ...changed }, sessions).report.status, 'failed');
  }
  const pending = verifyExpiryEvidence(run, report, sessions.map(s => ({ ...s, status: 'open' })));
  assert.equal(pending.pending, true); assert.equal(pending.report.status, 'awaiting_expiry');
  assert.equal(pending.report.expiry_verified_at, undefined);
  assert.throws(() => verifyExpiryEvidence(run, report, sessions.slice(0, 1)), /Known session missing/);
  assert.throws(() => verifyExpiryEvidence(run, report, sessions.map(s => ({ ...s, payment_status: 'paid' }))));
  assert.throws(() => verifyExpiryEvidence(run, report, sessions.map(s => ({ ...s, customer: 'cus_created' }))));
  assert.throws(() => verifyExpiryEvidence(run, report, [...sessions, sessions[0]]), /bound/);
});

test('interrupted runs can verify expiry without inventing missing handoff proof', () => {
  const { run, report, sessions } = evidence();
  const interrupted = { ...report, created: 0, handoff_complete: false, rows: [], status: 'running' };
  const recovery = verifyExpiryEvidence(run, interrupted, sessions);
  assert.equal(recovery.pending, false); assert.equal(recovery.report.expired, 2);
  assert.equal(recovery.report.status, 'failed');
  const noSubmissions = { ...run, submitted: [] };
  assert.equal(verifyExpiryEvidence(noSubmissions, interrupted, []).report.status, 'failed');
});

test('OS exclusion blocks another process and automatically releases on process exit', () => {
  // Lock the existing fixture source without changing its bytes; no temporary artifacts.
  const path = fileURLToPath(import.meta.url), moduleUrl = new URL('../scripts/checkout-lifecycle-probe.mjs', import.meta.url).href;
  const child = () => spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {acquireProbeLock} from ${JSON.stringify(moduleUrl)}; acquireProbeLock(${JSON.stringify(path)});`],
    { encoding: 'utf8', timeout: 10000 });
  const release = acquireProbeLock(path);
  try {
    const blocked = child(); assert.notEqual(blocked.status, 0); assert.match(blocked.stderr, /locked by another process/);
    assert.throws(() => acquireProbeLock(path), /locked by another process/);
  } finally { release(); release(); }
  assert.equal(child().status, 0);
  // The preceding child intentionally did not call release; OS process teardown did it.
  const recovered = acquireProbeLock(path); recovered();
});
