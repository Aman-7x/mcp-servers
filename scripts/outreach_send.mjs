#!/usr/bin/env node
// Permission-based subscriber mail only. Dry-run is the default and never writes.
import { readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DAY = 86_400_000;
export const MAX_ATTEMPTS = 10;
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw new Error(code); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const email = value => typeof value === 'string' && value.length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value) && !value.includes('..');
const normalize = value => value.trim().toLowerCase();
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function recent(value, now, age) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) && parsed <= now && now - parsed <= age;
}
function https(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

export function parseArgs(args) {
  const result = { live: false };
  let mode;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--input' && !result.input && args[i + 1] && !args[i + 1].startsWith('--')) result.input = args[++i];
    else if ((arg === '--live' || arg === '--dry-run') && !mode) { mode = arg; result.live = arg === '--live'; }
    else fail('invalid_arguments');
  }
  if (!result.input) fail('input_required');
  return result;
}

export function fileOutbox(path) {
  return {
    read() {
      try {
        const rows = JSON.parse(readFileSync(path, 'utf8'));
        if (!Array.isArray(rows)) fail('invalid_outbox');
        return rows;
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        fail('unreadable_outbox');
      }
    },
    write(rows) {
      // Same-directory rename prevents a partial outbox after interruption.
      const temp = `${path}.${randomUUID()}.pending`;
      writeFileSync(temp, JSON.stringify(rows, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      renameSync(temp, path);
    },
    lock() {
      let fd;
      try { fd = openSync(`${path}.lock`, 'wx', 0o600); } catch { fail('outbox_locked'); }
      writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      return () => { closeSync(fd); unlinkSync(`${path}.lock`); };
    },
  };
}

export async function sendResend({ apiKey, payload, idempotencyKey, fetchImpl = fetch, timeoutMs = 15_000 }) {
  const controller = new AbortController();
  let timer;
  try {
    // Race as well as abort: a broken transport must not hold the lock indefinitely.
    return await Promise.race([
      (async () => {
        const response = await fetchImpl('https://api.resend.com/emails', {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok && nonempty(data.id), status: response.status, id: typeof data.id === 'string' ? data.id : null };
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('provider_timeout')); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

function prepare(input, history, now) {
  const targets = Array.isArray(input) ? input : input?.targets;
  if (!Array.isArray(targets) || !targets.length) fail('targets_required');
  if (history.some(row => !row || typeof row !== 'object' || !nonempty(row.status))) fail('invalid_outbox');
  for (const row of history) {
    if (['dry-run', 'skipped:manual'].includes(row.status)) continue;
    const identity = /^[a-f0-9]{64}$/.test(row.recipient_hash || '') || email(row.to);
    const suppression = ['bounced', 'complained', 'suppressed', 'unsubscribed'].includes(row.status);
    if (!identity || (!suppression && !nonempty(row.campaign))) fail('invalid_outbox');
    if (!suppression && !['accepted', 'sent', 'delivered', 'pending', 'unknown', 'exception'].includes(row.status) && !/^error:\d{3}$/.test(row.status)) fail('invalid_outbox');
  }
  const ready = targets.filter(row => row?.channel === 'email' && row.status === 'ready');
  const report = { candidates: ready.length, manual: targets.filter(row => row?.channel === 'manual').length, skipped: targets.length - ready.length, eligible: 0, attempts: 0, accepted: 0, failures: 0 };
  if (!ready.length) return { selected: [], report };
  const snapshot = input.suppressions;
  if (!snapshot || !recent(snapshot.checked_at, now, DAY) || !Array.isArray(snapshot.recipients)) fail('current_suppression_snapshot_required');
  const suppressed = new Set();
  for (const row of snapshot.recipients) {
    if (!row || !email(row.email) || !nonempty(row.reason)) fail('invalid_suppression_snapshot');
    suppressed.add(hash(normalize(row.email)));
  }
  for (const row of history) {
    if (['bounced', 'complained', 'suppressed', 'unsubscribed'].includes(row.status)) {
      const recipient = row.recipient_hash || (email(row.to) ? hash(normalize(row.to)) : null);
      if (!recipient) fail('invalid_suppression_history');
      suppressed.add(recipient);
    }
  }
  const selected = [];
  const seen = new Map();
  for (const row of ready) {
    if (!email(row.to) || !nonempty(row.subject) || /[\x00-\x1f\x7f]/.test(row.subject) || row.subject.length > 998) fail('invalid_message_headers');
    if (!nonempty(row.campaign) || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(row.campaign) || !nonempty(row.purpose)) fail('campaign_and_purpose_required');
    if ((row.body != null && typeof row.body !== 'string') || (row.body_text != null && typeof row.body_text !== 'string') || (!nonempty(row.body) && !nonempty(row.body_text))) fail('message_body_required');
    if ((row.body?.length || 0) + (row.body_text?.length || 0) > 200_000) fail('message_body_too_large');
    const consent = row.consent;
    if (!consent || consent.status !== 'opted_in' || !nonempty(consent.source) || !recent(consent.at, now, Infinity) || !Array.isArray(consent.purposes) || !consent.purposes.includes(row.purpose)) fail('explicit_matching_consent_required');
    const verification = row.verification;
    if (!verification || verification.status !== 'verified' || !nonempty(verification.source) || !recent(verification.at, now, 30 * DAY)) fail('current_mailbox_verification_required');
    if (!https(row.unsubscribe_url)) fail('https_unsubscribe_url_required');
    const to = normalize(row.to);
    const recipientHash = hash(to);
    const key = `subscriber-${hash(JSON.stringify([row.campaign, to]))}`;
    const payload = { from: 'MCP Servers <hello@zovo.one>', to: [to], subject: row.subject };
    if (nonempty(row.body)) payload.html = `${row.body}\n<p><a href="${escapeHtml(row.unsubscribe_url)}">Unsubscribe</a></p>`;
    if (nonempty(row.body_text)) payload.text = `${row.body_text}\n\nUnsubscribe: ${row.unsubscribe_url}`;
    const payloadHash = hash(JSON.stringify(payload));
    if (seen.has(key) && seen.get(key) !== payloadHash) fail('conflicting_campaign_messages');
    if (seen.has(key) || suppressed.has(recipientHash)) { report.skipped++; continue; }
    seen.set(key, payloadHash);
    const previous = history.filter(entry => entry.idempotency_key === key || (entry.campaign === row.campaign && (entry.recipient_hash === recipientHash || (email(entry.to) && normalize(entry.to) === to))));
    if (previous.some(entry => ['accepted', 'sent', 'delivered'].includes(entry.status))) { report.skipped++; continue; }
    const attempts = previous.filter(entry => !['dry-run', 'skipped:manual'].includes(entry.status));
    const first = attempts[0];
    if (attempts.some(entry => entry.idempotency_key !== key || entry.payload_hash !== payloadHash)) fail('prior_attempt_requires_reconciliation');
    // Resend keys expire after 24h; leave a margin. Never automatically re-send after expiry.
    if (first && !recent(first.first_attempt_at || first.ts, now, 23 * 60 * 60 * 1000)) fail('expired_retry_requires_reconciliation');
    selected.push({ key, payload, payloadHash, campaign: row.campaign, recipientHash, verificationAt: verification.at, firstAttemptAt: first?.first_attempt_at || first?.ts });
  }
  report.eligible = selected.length;
  return { selected, report };
}

export async function runCampaign(input, { live = false, apiKey, store, now = () => Date.now(), send = sendResend, pause = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  if (!store || typeof store.read !== 'function') fail('outbox_store_required');
  if (live && (!nonempty(apiKey) || !apiKey.startsWith('re_'))) fail('live_resend_key_required');
  if (live && (typeof store.lock !== 'function' || typeof store.write !== 'function')) fail('live_outbox_lock_required');
  const unlock = live ? store.lock() : undefined;
  try {
    const history = store.read();
    if (!Array.isArray(history)) fail('invalid_outbox');
    const { selected, report } = prepare(input, history, now());
    report.mode = live ? 'live' : 'dry-run';
    report.capped = selected.length > MAX_ATTEMPTS;
    if (!live) return report;
    for (const row of selected.slice(0, MAX_ATTEMPTS)) {
      if (report.attempts) await pause(3000);
      // Check freshness again after pacing; suppressions cannot expire mid-batch.
      if (!recent(input.suppressions.checked_at, now(), DAY)) fail('suppression_snapshot_expired');
      if (!recent(row.verificationAt, now(), 30 * DAY)) fail('current_mailbox_verification_required');
      if (row.firstAttemptAt && !recent(row.firstAttemptAt, now(), 23 * 60 * 60 * 1000)) fail('expired_retry_requires_reconciliation');
      const at = new Date(now()).toISOString();
      const entry = { ts: at, first_attempt_at: row.firstAttemptAt || at, status: 'pending', campaign: row.campaign, recipient_hash: row.recipientHash, idempotency_key: row.key, payload_hash: row.payloadHash };
      history.push(entry);
      store.write(history); // Persist intent before the provider can accept anything.
      report.attempts++;
      try {
        const response = await send({ apiKey, payload: row.payload, idempotencyKey: row.key });
        if (!response || !response.ok || !nonempty(response.id)) {
          entry.status = 'unknown';
          entry.http_status = Number.isInteger(response?.status) ? response.status : null;
          report.failures++;
        } else {
          entry.status = 'accepted';
          entry.resend_id = response.id;
          report.accepted++;
        }
      } catch { entry.status = 'unknown'; report.failures++; }
      // If this write fails, durable pending intent still protects the next retry.
      store.write(history);
      if (report.failures) break;
    }
    return report;
  } finally { unlock?.(); }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    let input;
    try { input = JSON.parse(readFileSync(resolve(ROOT, args.input), 'utf8')); } catch { fail('unreadable_input'); }
    const report = await runCampaign(input, { live: args.live, apiKey: process.env.RESEND_API_KEY, store: fileOutbox(resolve(ROOT, 'data/outbox.json')) });
    console.log(JSON.stringify(report)); // Counts only; never recipients, body, credentials or provider error text.
    process.exitCode = report.failures ? 1 : 0;
  } catch (error) {
    const safe = new Set(['invalid_arguments', 'input_required', 'unreadable_input', 'targets_required', 'invalid_outbox', 'unreadable_outbox', 'outbox_locked', 'live_resend_key_required', 'current_suppression_snapshot_required', 'invalid_suppression_snapshot', 'invalid_suppression_history', 'invalid_message_headers', 'campaign_and_purpose_required', 'message_body_required', 'message_body_too_large', 'explicit_matching_consent_required', 'current_mailbox_verification_required', 'https_unsubscribe_url_required', 'conflicting_campaign_messages', 'prior_attempt_requires_reconciliation', 'expired_retry_requires_reconciliation', 'suppression_snapshot_expired']);
    console.error(`outreach_send: ${safe.has(error.message) ? error.message : 'send_aborted'}`);
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
