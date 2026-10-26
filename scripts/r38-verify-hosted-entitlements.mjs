#!/usr/bin/env node
// Explicit operator checks only: one marked tenant, short-lived signed probe keys,
// no business tool calls, Checkout creation, payment, email or customer data.
import { createHash, randomUUID, sign } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const root = new URL('../', import.meta.url);
const path = name => new URL(name, root);
const args = process.argv.slice(2);
const cleanupOnly = args.length === 1 && args[0] === '--cleanup-only';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
if (!cleanupOnly && (args.length !== 4 || args[0] !== '--expected-remote' || args[2] !== '--expected-billing' || !uuid.test(args[1]) || !uuid.test(args[3]))) throw Error('Use --expected-remote UUID --expected-billing UUID, or --cleanup-only');
const account = 'https://api.cloudflare.com/client/v4/accounts/dd3f2a29b7707e21a87f26a622c0bb9d';
const namespace = account + '/storage/kv/namespaces/cf848cc5c07d4e0a9c7c65ad1c70055c';
if (!process.env.CLOUDFLARE_API_TOKEN) throw Error('Cloudflare access unavailable');
const auth = { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN };
const headers = { 'x-mcp-probe': '1', 'user-agent': 'mcp-r38-operator-entitlement-check/1', 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
const journal = path('.scratch-distribution/r38-entitlement-probe-state.json');
const pendingJournal = path('.scratch-distribution/r38-entitlement-probe-state.json.pending');
const receiptPath = path(cleanupOnly ? 'data/r38_hosted_entitlements_cleanup_' + Date.now() + '.json' : 'data/r38_hosted_entitlements_live_verification.json');
// Refuse before entering the receipt-writing finally block: a repeated invocation
// must not replace the evidence from a prior run merely because startup was refused.
if (existsSync(receiptPath)) throw Error('existing_receipt_requires_review');
if (cleanupOnly ? !existsSync(journal) && !existsSync(pendingJournal) : existsSync(journal) || existsSync(pendingJournal)) throw Error('existing_probe_requires_review_or_cleanup');
mkdirSync(path('.scratch-distribution'), { recursive: true });
let state;
const receipt = { started_at: new Date().toISOString(), status: 'running', checks: [], protocol_calls: 0, payments: 0, checkout_sessions_created: 0, business_tool_calls: 0, cohort: 'explicit operator probe', cleanup: [] };
function save() {
  if (!existsSync(journal)) writeFileSync(journal, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
  else {
    const saved = JSON.parse(readFileSync(journal));
    need(saved.run_id === state.run_id && (!saved.token || saved.token === state.token), 'journal_writer_identity_conflict');
    writeFileSync(pendingJournal, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    renameSync(pendingJournal, journal);
  }
}
function need(ok, code) { if (!ok) throw Error(code); }
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: auth, body, signal: AbortSignal.timeout(25000) });
  const text = await response.text();
  if (response.status === 404) return null;
  need(response.ok, 'cloudflare_' + response.status);
  if (method === 'PUT' || method === 'DELETE' || !url.includes('/values/')) {
    const result = JSON.parse(text); need(result.success === true, 'cloudflare_rejected'); return result;
  }
  return text;
}
const valueUrl = key => namespace + '/values/' + encodeURIComponent(key);
const put = (key, value, ttl) => api(valueUrl(key) + (ttl ? '?expiration_ttl=' + ttl : ''), 'PUT', value);
async function current(script) {
  const result = await api(account + '/workers/scripts/' + script + '/deployments');
  const d = result.result.deployments.sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  need(d.versions.length === 1 && d.versions[0].percentage === 100, 'split_deployment');
  return d.versions[0].version_id;
}
async function rpc(product, name, arguments_ = {}, key = null, expectedHttp = 200) {
  need(['license_status', 'license_activate'].includes(name), 'nonlicense_probe_refused');
  const id = ++receipt.protocol_calls;
  const url = 'https://mcp.zovo.one/mcp/' + product + (key ? '' : '/t/' + state.token);
  const response = await fetch(url, { method: 'POST', headers: { ...headers, ...(key ? { Authorization: 'Bearer ' + key } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: arguments_ } }), signal: AbortSignal.timeout(25000) });
  need(response.status === expectedHttp, 'protocol_http_' + product + '_' + response.status);
  const body = await response.json();
  if (expectedHttp !== 200) { need(body.error === 'invalid_license', 'unexpected_authentication_refusal'); return null; }
  need(body.jsonrpc === '2.0' && body.id === id && !('error' in body) && body.result &&
    Array.isArray(body.result.content) && body.result.isError !== true, 'protocol_refused_' + name);
  return body.result;
}
async function tier(label, product, expected) {
  const began = Date.now(); let actual;
  for (let attempt = 0; attempt < 25; attempt++) {
    const response = await rpc(product, 'license_status');
    const status = JSON.parse(response.content.find(c => c.type === 'text' && typeof c.text === 'string').text);
    need(status.product === product && status.tenant === 'anon:' + state.token.slice(5) &&
      ['free', 'pro'].includes(status.tier), 'unexpected_license_status_identity');
    actual = status.tier;
    if (actual === expected) { receipt.checks.push({ name: label, product, expected, observed: actual, seconds: (Date.now() - began) / 1000 }); return; }
    await delay(5000);
  }
  throw Error('tier_did_not_converge_' + product);
}
async function keys(prefix) {
  let cursor; const out = [], seen = new Set();
  do {
    const result = await api(namespace + '/keys?prefix=' + encodeURIComponent(prefix) + '&limit=100' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
    need(Array.isArray(result.result) && result.result.every(row => typeof row.name === 'string' && row.name.startsWith(prefix)), 'unexpected_probe_key_scope');
    out.push(...result.result); need(out.length < 100, 'unexpected_probe_key_count'); cursor = result.result_info?.cursor;
    if (cursor) { need(typeof cursor === 'string' && !seen.has(cursor) && seen.size < 10, 'probe_pagination_stalled'); seen.add(cursor); }
  } while (cursor);
  return out;
}
async function cleanup() {
  need(uuid.test(state.run_id) && Number.isFinite(Date.parse(state.created_at)), 'invalid_recovery_scope');
  if (!state.token) { receipt.cleanup_complete = state.mint_started !== true; return; }
  need(/^anon_[a-f0-9]{32}$/.test(state.token), 'invalid_recovery_scope');
  const marker = 'probe:r38:entitlement:' + state.run_id;
  const proof = await api(valueUrl(marker));
  need(proof === null || proof === state.token, 'probe_ownership_mismatch');
  const id = state.token.slice(5), digest = createHash('sha256').update(state.token).digest('hex');
  const targets = new Set([`tok:${state.token}`, marker, `bind:${state.token}`, `bind:${state.token}:invoice`, `bind:${state.token}:docx`, `bind:${state.token}:*`, `meta:anon:${id}`, `funnel:v1:cohort:${digest}`, `rl:anon:${id}:${Math.floor(Date.now() / 3600000)}`, `rl:anon:${id}:${Math.floor(Date.parse(state.created_at) / 3600000)}`]);
  for (const prefix of [`anon:${id}:`, `rl:anon:${id}:`, `bind:${state.token}:`]) for (const row of await keys(prefix)) targets.add(row.name);
  for (const key of targets) {
    const value = await api(valueUrl(key));
    if (value === null) continue;
    await api(valueUrl(key), 'DELETE');
    const kind = key.startsWith('bind:') ? 'owned entitlement binding' : key.startsWith('tok:') ? 'owned probe token' : key.startsWith('anon:') ? 'owned probe document' : 'owned probe metadata';
    receipt.cleanup.push({ kind, key_sha256: createHash('sha256').update(key).digest('hex'), bytes: Buffer.byteLength(value), deleted: true });
  }
  // Keep the private journal until every owned key is authoritatively absent,
  // including paginated scope prefixes. Token absence alone is insufficient.
  let absent = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const remaining = await Promise.all([...targets].map(key => api(valueUrl(key))));
    const listed = await Promise.all([`anon:${id}:`, `rl:anon:${id}:`, `bind:${state.token}:`].map(keys));
    if (remaining.every(value => value === null) && listed.every(rows => rows.length === 0)) { absent = true; break; }
    await delay(5000);
  }
  need(absent, 'probe_cleanup_unconfirmed');
  receipt.cleanup_complete = true;
}
let failure;
try {
  if (cleanupOnly) {
    const saved = existsSync(journal) ? JSON.parse(readFileSync(journal)) : null;
    const pending = existsSync(pendingJournal) ? JSON.parse(readFileSync(pendingJournal)) : null;
    need(!saved || !pending || (saved.run_id === pending.run_id && saved.created_at === pending.created_at &&
      (!saved.token || !pending.token || saved.token === pending.token)), 'recovery_journal_identity_conflict');
    state = pending || saved;
  }
  else {
    receipt.expected_remote_version = args[1]; receipt.expected_billing_version = args[3];
    need(await current('mcp-remote') === args[1] && await current('mcp-billing') === args[3], 'deployment_changed_before_probe');
    state = { run_id: randomUUID(), created_at: receipt.started_at, token: null, mint_started: true }; save();
    const minted = await fetch('https://mcp.zovo.one/mcp/token?acq=guide', { headers, signal: AbortSignal.timeout(25000) });
    need(minted.ok, 'mint_http_' + minted.status); const data = await minted.json();
    need(/^anon_[a-f0-9]{32}$/.test(data.token), 'mint_invalid_token'); state.token = data.token; save();
    await put('probe:r38:entitlement:' + state.run_id, state.token, 1800);
    const privateKey = readFileSync(path('keys/license-private.pem'));
    const now = Math.floor(Date.now() / 1000);
    const license = (product, exp = now + 900) => {
      const payload = Buffer.from(JSON.stringify({ v: 1, p: product, id: 'r38-operator-' + state.run_id + '-' + (product === '*' ? 'bundle' : product), iat: now, exp })).toString('base64url');
      return 'MCPL1.' + payload + '.' + sign(null, Buffer.from(payload), privateKey).toString('base64url');
    };
    const invoice = license('invoice'), docx = license('docx'), bundle = license('*');
    // Simulate a valid pre-upgrade legacy binding without a purchase or payment.
    await put('bind:' + state.token, invoice);
    await tier('Valid legacy single recognized', 'invoice', 'pro');
    await tier('Other product starts free', 'docx', 'free');
    await rpc('docx', 'license_activate', { key: docx });
    await tier('Second single activated', 'docx', 'pro');
    await tier('First single retained after second activation', 'invoice', 'pro');
    const bindings = await keys('bind:' + state.token + ':');
    need(bindings.some(k => k.name.endsWith(':invoice') && !k.expiration) && bindings.some(k => k.name.endsWith(':docx') && !k.expiration), 'scoped_bindings_have_token_ttl');
    receipt.checks.push({ name: 'Independent migrated and activated scopes have no KV token expiry', passed: true });
    await rpc('invoice', 'license_activate', { key: bundle });
    await tier('Bundle activates a third endpoint', 'pdf', 'pro');
    await rpc('invoice', 'license_activate', { key: invoice });
    await tier('Older single replay retains bundle access', 'pdf', 'pro');
    await tier('Older single replay retains the second product', 'docx', 'pro');
    await rpc('invoice', 'license_status', {}, docx, 401);
    await rpc('invoice', 'license_status', {}, license('invoice', now - 1), 401);
    await rpc('invoice', 'license_status', {}, license('invoice', String(now + 900)), 401);
    receipt.checks.push({ name: 'Wrong-scope, expired and malformed signed expiry tokens rejected by actual edge authentication', passed: true });
    for (const product of ['invoice', 'docx', 'pdf']) {
      const response = await fetch('https://mcp.zovo.one/bound?tenant=' + state.token + '&product=' + product, { headers, signal: AbortSignal.timeout(25000) });
      const bound = await response.json(); need(response.ok && bound.bound === true && bound.product === '*' &&
        !JSON.stringify(bound).includes('MCPL1.'), 'bound_scope_' + product);
    }
    receipt.checks.push({ name: 'Billing product-specific binding status agrees across all three endpoints', passed: true });
    need(await current('mcp-remote') === args[1] && await current('mcp-billing') === args[3], 'deployment_changed_during_probe');
    receipt.status = 'passed';
  }
} catch (error) { failure = error; receipt.status = 'failed'; receipt.failure = /^[a-z0-9_]+$/.test(error.message) ? error.message : 'verification_or_read_failed'; }
finally {
  if (state) {
    try { await delay(2000); await cleanup(); if (cleanupOnly && receipt.cleanup_complete) receipt.status = 'passed'; }
    catch { receipt.cleanup_complete = false; receipt.status = 'failed'; failure ||= Error('cleanup_requires_private_journal'); }
    if (receipt.cleanup_complete) {
      for (const file of [journal, pendingJournal]) if (existsSync(file)) {
        const handles = spawnSync('/usr/sbin/lsof', ['-t', '--', file.pathname], { encoding: 'utf8' });
        if (handles.status === 1 && !handles.stdout.trim()) {
          const size = readFileSync(file).length;
          appendFileSync(path('data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path: file.pathname, bytes: size, lsof: 'no open handles', reason: 'Completed owned marked native entitlement probe private journal cleanup' }) + '\n');
          unlinkSync(file);
        }
      }
    }
    receipt.private_journal_retained = existsSync(journal) || existsSync(pendingJournal);
    if (receipt.cleanup_complete && receipt.private_journal_retained) { receipt.status = 'failed'; failure ||= Error('private_journal_cleanup_unconfirmed'); }
  }
  receipt.finished_at = new Date().toISOString();
  if (failure && !receipt.failure) receipt.failure = /^[a-z0-9_]+$/.test(failure.message) ? failure.message : 'verification_or_read_failed';
  receipt.limits = ['Synthetic short-lived signed operator keys, not a real paid transaction or email delivery.', 'KV metadata and actual edge responses inspected; long-term retention is additionally covered by the 31-day simulated signed-key regression.', 'Only this run’s token, scoped keys and documents are removed; shared mint counters remain untouched. KV edge caches may outlive an authoritative deletion briefly.'];
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ status: receipt.status, checks: receipt.checks.length, protocol_calls: receipt.protocol_calls, cleanup_complete: receipt.cleanup_complete, failure: receipt.failure || null }));
if (failure) process.exitCode = 1;
