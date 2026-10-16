import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runCampaign, parseArgs, sendResend, fileOutbox } from '../scripts/outreach_send.mjs';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const iso = offset => new Date(NOW + offset).toISOString();
const row = (overrides = {}) => ({ channel: 'email', status: 'ready', to: 'subscriber@example.com', campaign: 'setup-1', purpose: 'setup', subject: 'Your requested MCP setup', body_text: 'Here is the setup you requested.', unsubscribe_url: 'https://mcp.zovo.one/unsubscribe?token=example', consent: { status: 'opted_in', source: 'form submission receipt 123', at: iso(-1000), purposes: ['setup'] }, verification: { status: 'verified', source: 'confirmed subscription link receipt 456', at: iso(-1000) }, ...overrides });
const input = (rows = [row()], suppressions = []) => ({ targets: rows, suppressions: { checked_at: iso(-1000), recipients: suppressions } });
function memory(initial = []) {
  let rows = structuredClone(initial), locked = false;
  return { writes: 0, locks: 0, read: () => structuredClone(rows), write(value) { this.writes++; rows = structuredClone(value); }, lock() { if (locked) throw new Error('outbox_locked'); locked = true; this.locks++; return () => { locked = false; }; } };
}
const options = store => ({ live: true, apiKey: 're_test_not_real', store, now: () => NOW, pause: async () => {}, send: async () => ({ ok: true, id: 'accepted-test' }) });

test('dry-run requires no secret, does not write or lock, and returns no personal data', async () => {
  const store = memory();
  const report = await runCampaign(input(), { store, now: () => NOW, send: () => assert.fail('dry-run called provider') });
  assert.equal(report.eligible, 1);
  assert.equal(report.attempts, 0);
  assert.equal(store.writes, 0);
  assert.equal(store.locks, 0);
  assert.ok(!JSON.stringify(report).includes('subscriber@example.com'));
});

test('manual research remains skipped without suppression or consent fields', async () => {
  const report = await runCampaign({ targets: [{ channel: 'manual', status: 'ready', to: 'public@example.com' }] }, { store: memory() });
  assert.equal(report.manual, 1);
  assert.equal(report.eligible, 0);
});

test('all consent, verification, message and opt-out gates run before first send', async t => {
  const cases = [
    ['public email is not consent', { consent: undefined }, 'explicit_matching_consent_required'],
    ['consent for different purpose', { purpose: 'sales' }, 'explicit_matching_consent_required'],
    ['withdrawn consent', { consent: { ...row().consent, status: 'withdrawn' } }, 'explicit_matching_consent_required'],
    ['missing consent evidence', { consent: { ...row().consent, source: '' } }, 'explicit_matching_consent_required'],
    ['future consent', { consent: { ...row().consent, at: iso(1) } }, 'explicit_matching_consent_required'],
    ['old mailbox check', { verification: { ...row().verification, at: iso(-31 * 86400000) } }, 'current_mailbox_verification_required'],
    ['unverified mailbox', { verification: { ...row().verification, status: 'unknown' } }, 'current_mailbox_verification_required'],
    ['header injection', { subject: 'Hi\r\nBcc: victim@example.com' }, 'invalid_message_headers'],
    ['multiple recipients', { to: 'a@example.com,b@example.com' }, 'invalid_message_headers'],
    ['blank body', { body_text: '  ' }, 'message_body_required'],
    ['no unsubscribe', { unsubscribe_url: undefined }, 'https_unsubscribe_url_required'],
    ['invalid campaign', { campaign: '' }, 'campaign_and_purpose_required'],
  ];
  for (const [name, change, code] of cases) await t.test(name, async () => {
    const store = memory();
    await assert.rejects(runCampaign(input([row(), row({ to: 'second@example.com', ...change })]), { ...options(store), send: () => assert.fail('unsafe batch sent') }), { message: code });
    assert.equal(store.writes, 0);
  });
});

test('missing or stale suppression reconciliation blocks sending', async () => {
  for (const snapshot of [undefined, { checked_at: iso(-86400001), recipients: [] }, { checked_at: iso(-1000), recipients: [{ email: 'bad', reason: 'bounce' }] }]) {
    const batch = input(); batch.suppressions = snapshot;
    await assert.rejects(runCampaign(batch, { ...options(memory()), send: () => assert.fail('sent without suppression check') }));
  }
});

test('suppression and historical complaints override otherwise valid rows in any campaign', async () => {
  const recipientHash = createHash('sha256').update('subscriber@example.com').digest('hex');
  for (const [batch, history] of [[input([row()], [{ email: 'SUBSCRIBER@example.com', reason: 'unsubscribe' }]), []], [input(), [{ status: 'complained', recipient_hash: recipientHash }]], [input(), [{ status: 'bounced', to: 'subscriber@example.com' }]]]) {
    const report = await runCampaign(batch, { ...options(memory(history)), send: () => assert.fail('suppressed recipient sent') });
    assert.equal(report.eligible, 0);
  }
});

test('recipient normalization prevents duplicate sends within batch and across runs', async () => {
  const store = memory();
  let calls = 0;
  const opts = { ...options(store), send: async ({ payload }) => { calls++; assert.ok(payload.text.includes('Unsubscribe: https://')); return { ok: true, id: 'test-1' }; } };
  const batch = input([row(), row({ to: 'SUBSCRIBER@example.com' })]);
  assert.equal((await runCampaign(batch, opts)).accepted, 1);
  assert.equal((await runCampaign(batch, opts)).eligible, 0);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(store.read()).includes('subscriber@example.com'));
});

test('legacy sent history prevents duplicate while legacy dry-run permits a real attempt', async () => {
  for (const status of ['sent', 'dry-run']) {
    const report = await runCampaign(input(), options(memory([{ ts: iso(-1000), campaign: 'setup-1', to: 'subscriber@example.com', status }])));
    assert.equal(report.accepted, status === 'sent' ? 0 : 1);
  }
});

test('changed messages for the same recipient/campaign fail before any network action', async () => {
  await assert.rejects(runCampaign(input([row(), row({ body_text: 'Different content' })]), options(memory())), { message: 'conflicting_campaign_messages' });
});

test('provider failure fails fast; retries use the same key and payload', async () => {
  const store = memory();
  const requests = [];
  const batch = input([row(), row({ to: 'second@example.com' })]);
  const first = await runCampaign(batch, { ...options(store), send: async request => { requests.push(request); throw new Error('secret or recipient may be in provider text'); } });
  assert.equal(first.attempts, 1);
  assert.equal(first.failures, 1);
  assert.equal(store.read()[0].status, 'unknown');
  assert.ok(!JSON.stringify(store.read()).includes('secret or recipient'));
  const retry = await runCampaign(input(), { ...options(store), send: async request => { requests.push(request); return { ok: true, id: 'retry-id' }; } });
  assert.equal(retry.accepted, 1);
  assert.equal(requests[0].idempotencyKey, requests[1].idempotencyKey);
  assert.deepEqual(requests[0].payload, requests[1].payload);
});

test('rate limit and malformed success responses fail fast and report failure', async () => {
  for (const response of [{ ok: false, status: 429 }, { ok: true, status: 200 }]) {
    const report = await runCampaign(input([row(), row({ to: 'second@example.com' })]), { ...options(memory()), send: async () => response });
    assert.equal(report.attempts, 1);
    assert.equal(report.failures, 1);
    assert.equal(report.accepted, 0);
  }
});

test('intent is persisted before send; failed final persistence retains safe retry identity', async () => {
  const store = memory();
  const write = store.write.bind(store);
  store.write = rows => { if (store.writes === 1) throw new Error('disk full'); write(rows); };
  await assert.rejects(runCampaign(input(), { ...options(store), send: async request => {
    const intent = store.read()[0];
    assert.equal(intent.status, 'pending');
    assert.equal(intent.idempotency_key, request.idempotencyKey);
    return { ok: true, id: 'accepted-but-not-recorded' };
  } }), /disk full/);
  assert.equal(store.read()[0].status, 'pending');
  store.write = write;
  assert.equal((await runCampaign(input(), options(store))).accepted, 1);
});

test('unsafe altered or expired uncertain retries require reconciliation', async () => {
  const store = memory();
  await runCampaign(input(), { ...options(store), send: async () => { throw new Error('timeout'); } });
  await assert.rejects(runCampaign(input([row({ body_text: 'changed after timeout' })]), options(store)), { message: 'prior_attempt_requires_reconciliation' });
  const later = NOW + 24 * 86400000;
  const batch = input(); batch.suppressions.checked_at = new Date(later).toISOString();
  await assert.rejects(runCampaign(batch, { ...options(store), now: () => later }), { message: 'expired_retry_requires_reconciliation' });
});

test('cap counts provider attempts, with no more than ten requests', async () => {
  const rows = Array.from({ length: 12 }, (_, i) => row({ to: `person${i}@example.com` }));
  let calls = 0;
  const report = await runCampaign(input(rows), { ...options(memory()), send: async () => ({ ok: true, id: `test-${++calls}` }) });
  assert.equal(calls, 10);
  assert.equal(report.attempts, 10);
  assert.equal(report.capped, true);
});

test('concurrent live callers cannot reach the provider under an active lock', async () => {
  const store = memory();
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  const first = runCampaign(input(), { ...options(store), send: async () => { await blocked; return { ok: true, id: 'first' }; } });
  await assert.rejects(runCampaign(input(), options(store)), { message: 'outbox_locked' });
  release();
  await first;
  assert.equal((await runCampaign(input(), options(store))).eligible, 0);
});

test('malformed outbox never becomes an empty history', async () => {
  await assert.rejects(runCampaign(input(), options(memory([null]))), { message: 'invalid_outbox' });
  await assert.rejects(runCampaign(input(), options(memory([{ status: 'accepted' }]))), { message: 'invalid_outbox' });
  // Read a known non-JSON source; no fixtures or filesystem writes needed.
  assert.throws(() => fileOutbox(new URL('../scripts/outreach_send.mjs', import.meta.url)).read(), { message: 'unreadable_outbox' });
});

test('transport passes stable idempotency and aborts even an unresponsive adapter', async () => {
  let observed;
  const response = await sendResend({ apiKey: 're_test', payload: { subject: 'test' }, idempotencyKey: 'stable', fetchImpl: async (_, options) => { observed = options; return { ok: true, status: 200, json: async () => ({ id: 'test' }) }; } });
  assert.equal(response.id, 'test');
  assert.equal(observed.headers['Idempotency-Key'], 'stable');
  let signal;
  await assert.rejects(sendResend({ apiKey: 're_test', payload: {}, idempotencyKey: 'stable', timeoutMs: 5, fetchImpl: async (_, options) => { signal = options.signal; return new Promise(() => {}); } }), { message: 'provider_timeout' });
  assert.equal(signal.aborted, true);
});

test('strict arguments reject ambiguous live flags and missing values', () => {
  assert.deepEqual(parseArgs(['--input', 'targets.json']), { live: false, input: 'targets.json' });
  for (const args of [[], ['--input'], ['--input', '--live'], ['--input', 'x', '--live', '--dry-run'], ['--input', 'x', '--force'], ['--input', 'x', '--input', 'y']]) assert.throws(() => parseArgs(args));
});

test('CLI dry-run of current manual queue needs no key and preserves outbox exactly', () => {
  const before = readFileSync(new URL('../data/outbox.json', import.meta.url), 'utf8');
  const env = { ...process.env }; delete env.RESEND_API_KEY;
  const result = spawnSync(process.execPath, ['scripts/outreach_send.mjs', '--input', 'data/outreach_targets.json', '--dry-run'], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).manual, 18);
  assert.equal(readFileSync(new URL('../data/outbox.json', import.meta.url), 'utf8'), before);
  const bad = spawnSync(process.execPath, ['scripts/outreach_send.mjs', '--input', 'data/outreach_targets.json', '--live', '--dry-run'], { cwd: new URL('..', import.meta.url), env, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.ok(!bad.stderr.includes('re_test'));
});
