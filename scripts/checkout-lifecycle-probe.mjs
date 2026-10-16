#!/usr/bin/env node
// Explicit operator QA only. Creates at most two tagged unpaid sessions and expires
// only this run's sessions. Never opens Stripe Checkout or submits payment details.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

export function ownsProbeSession(session, state) {
  return session?.livemode === true && /^cs_live_[A-Za-z0-9]+$/.test(session.id || '') &&
    Number.isFinite(session.created) && session.created >= state.started_unix - 5 &&
    session.metadata?.probe === '1' && session.metadata?.source === state.source &&
    session.metadata?.tenant === state.tenant && session.client_reference_id === state.tenant &&
    state.submitted.some(row => ['three-way-match', 'bundle'].includes(row.product) &&
      row.product === session.metadata?.product && row.order_token === session.metadata?.order_token);
}
export function canExpireProbeSession(session, state) {
  return ownsProbeSession(session, state) && session.status === 'open' && session.payment_status === 'unpaid';
}

const reference = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
function stripe(method, path, extra = [], allowError = false) {
  const result = spawnSync('stripe', [method, path, '--live', ...extra], { encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024 });
  let body;
  try { body = JSON.parse(result.stdout); } catch { throw Error('Stripe CLI returned no structured response'); }
  if (allowError && body.error) return body;
  if (result.error || result.status !== 0 || body.error) throw Error('Stripe API operation failed: ' + (body.error?.code || 'request_error'));
  return body;
}
async function main() {
  const args = process.argv.slice(2);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const work = join(homedir(), 'mcp-servers-work');
  const stateFile = join(work, 'r36-checkout-probe-state.json');
  if (args.length === 1 && args[0] === '--verify-expiry') {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    const reportFile = join(root, 'data/r36_checkout_lifecycle.json');
    const report = JSON.parse(readFileSync(reportFile, 'utf8'));
    const latest = stripe('get', '/v1/checkout/sessions', ['-d', 'limit=100']);
    assert.ok(!latest.has_more || latest.data.at(-1)?.created < state.started_unix - 5, 'Incomplete verification window');
    const owned = latest.data.filter(s => ownsProbeSession(s, state));
    assert.ok(report.created >= 1 && report.created <= 2);
    assert.equal(owned.length, report.created);
    if (owned.some(s => s.status === 'open')) { console.log('Marked probes still await automatic expiry at ' + report.expiry_due_at); return; }
    for (const session of owned) { assert.equal(session.status, 'expired'); assert.equal(session.payment_status, 'unpaid'); assert.equal(session.customer, null); assert.equal(session.payment_intent, null); }
    report.status = report.failure ? 'failed' : 'passed'; report.expired = owned.length; report.charged_minor = 0; report.expiry_verified_at = new Date().toISOString(); report.finished_at = report.expiry_verified_at;
    state.status = 'complete'; writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
    console.log('Verified automatic expiry for ' + owned.length + ' unpaid probe sessions; handoff status=' + report.status); return;
  }
  if (args[0] !== '--execute-unpaid-probe' || args.length !== 3 || args[1] !== '--expected-version' || !/^[a-f0-9-]{36}$/.test(args[2])) {
    console.log('Usage: checkout-lifecycle-probe.mjs --execute-unpaid-probe --expected-version <deployed UUID> | --verify-expiry\nCreates at most two marked unpaid sessions with bounded expiry; never submits payment.');
    return;
  }
  const expectedVersion = args[2];
  mkdirSync(work, { recursive: true });
  if (existsSync(stateFile) && JSON.parse(readFileSync(stateFile, 'utf8')).status !== 'complete') throw Error('An earlier probe needs scoped verification before another run');
  const state = { started_unix: Math.floor(Date.now() / 1000), source: 'probe.r36.' + randomUUID().replaceAll('-', '').slice(0, 16), tenant: 'anon_' + randomBytes(16).toString('hex'), submitted: [], status: 'active' };
  const save = () => writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  save();
  const report = { started_at: new Date().toISOString(), expected_version: expectedVersion, method: 'Real browser intent form; explicit probe header; synthetic tenant reference; Stripe page blocked; bounded expiry', rows: [], created: 0, expired: 0, charged_minor: null, payment_details_submitted: false, status: 'running' };
  let browser, profile, failure, immediateExpiry = false;
  const ids = new Set();
  try {
    // Establish cleanup write access before creating anything. This ID cannot exist.
    const permission = stripe('post', '/v1/checkout/sessions/cs_live_r36_permission_probe/expire', [], true);
    assert.ok(['resource_missing', 'more_permissions_required'].includes(permission.error?.code), 'Unexpected expiry permission response');
    immediateExpiry = permission.error.code === 'resource_missing';
    report.expiry_mode = immediateExpiry ? 'immediate' : 'automatic_31_minutes';
    const before = stripe('get', '/v1/checkout/sessions', ['-d', 'limit=100']);
    const control = before.data.find(s => s.payment_status === 'unpaid');
    assert.ok(control, 'No safe unpaid read control found');
    const origin = 'https://mcp.zovo.one';
    const headers = { 'x-mcp-probe': '1', 'user-agent': 'mcp-r36-account-control/1' };
    const accountControl = await fetch(origin + '/success?session_id=' + encodeURIComponent(control.id), { headers, signal: AbortSignal.timeout(20000) });
    assert.equal(accountControl.status, 402, 'Worker and CLI could not retrieve the same unpaid account control');
    report.account_read_control = 'Worker retrieved a CLI-visible unpaid session and refused fulfillment with 402';
    const capability = await fetch(origin + '/buy/three-way-match', { headers: { ...headers, 'x-mcp-probe-expiry': 'short' }, signal: AbortSignal.timeout(20000) });
    assert.equal(capability.headers.get('x-mcp-probe-short-expiry'), '1860', 'Deployed Worker does not advertise bounded probe expiry; nothing will be created');
    const { chromium } = await import('@playwright/test');
    const { PRODUCTS } = await import('../billing/src/index.js');
    profile = mkdtempSync(join(work, 'checkout-probe-'));
    const chrome = process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome';
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
    browser = await chromium.launchPersistentContext(profile, { executablePath: chrome, headless: true, userAgent: ua, extraHTTPHeaders: { 'x-mcp-probe': '1', 'x-mcp-probe-expiry': 'short' }, args: ['--disk-cache-size=1'] });
    await browser.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    const page = browser.pages()[0];
    for (const product of ['three-way-match', 'bundle']) {
      const url = `${origin}/buy/${product}?src=${state.source}&tenant=${state.tenant}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      const orderToken = await page.locator('form[action^="/buy/"] input[name="order_token"]').inputValue();
      state.submitted.push({ product, order_token: orderToken }); save();
      const pending = page.waitForResponse(r => r.request().method() === 'POST' && r.url() === url, { timeout: 30000 });
      // Navigation to Stripe is intentionally blocked; the real POST response is
      // the handoff assertion, even if the blocked navigation rejects the click.
      const clicked = page.locator('form[action^="/buy/"] button[type="submit"]').click({ noWaitAfter: true }).catch(() => {});
      const response = await pending;
      await clicked;
      assert.equal(response.status(), 303, 'Intent POST did not reach Stripe');
      const h = await response.allHeaders(), checkout = new URL(h.location);
      assert.equal(checkout.hostname, 'checkout.stripe.com');
      const id = checkout.pathname.split('/').find(part => /^cs_live_[A-Za-z0-9]+$/.test(part));
      assert.ok(id, 'Redirect did not contain a live Session reference'); ids.add(id);
      const session = stripe('get', '/v1/checkout/sessions/' + id);
      assert.ok(ownsProbeSession(session, state), 'Returned Session does not belong to this probe');
      assert.equal(session.metadata.worker_version, expectedVersion);
      assert.equal(session.amount_total, PRODUCTS[product].usd * 100);
      assert.equal(session.currency, 'usd'); assert.equal(session.payment_status, 'unpaid');
      assert.equal(session.customer, null); assert.equal(session.payment_intent, null);
      assert.ok(session.expires_at - session.created >= 1800 && session.expires_at - session.created <= 1865, 'Probe expiry is not bounded');
      assert.equal(h['x-mcp-probe-item'], PRODUCTS[product].name);
      const replay = await browser.request.post(url, { form: { intent: 'checkout', order_token: orderToken }, maxRedirects: 0, headers: { origin, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'user-agent': ua, 'x-mcp-probe': '1', 'x-mcp-probe-expiry': 'short' } });
      assert.equal(replay.status(), 303); assert.equal(replay.headers().location, h.location, 'Retry created another Session');
      const unpaid = await browser.request.get(origin + '/success?session_id=' + id);
      assert.equal(unpaid.status(), 402);
      report.rows.push({ product, session_reference: reference(id), amount_total_minor: session.amount_total, currency: session.currency, item_name: h['x-mcp-probe-item'], probe_tag: session.metadata.probe, order_replay_reused: true, unpaid_fulfillment_status: unpaid.status(), customer_created: false, payment_intent_created: false, expires_at: new Date(session.expires_at * 1000).toISOString() });
    }
    report.status = 'passed';
  } catch (error) { failure = error; report.status = 'failed'; report.failure = String(error.message).replace(/https:\/\/checkout\.stripe\.com\/[^\s"'<>]+/g, '[checkout URL redacted]').replace(/cs_(live|test)_[A-Za-z0-9_]+/g, '[session redacted]').slice(0, 300); }
  finally {
    try {
      if (state.submitted.length) {
        const latest = stripe('get', '/v1/checkout/sessions', ['-d', 'limit=100']);
        assert.ok(!latest.has_more || latest.data.at(-1)?.created < state.started_unix - 5, 'Cleanup query did not cover the complete probe window');
        const owned = latest.data.filter(s => ownsProbeSession(s, state));
        report.created = owned.length;
        for (const session of owned) {
          assert.ok(canExpireProbeSession(session, state), 'Owned probe not safely expirable');
          if (immediateExpiry) {
            const expired = stripe('post', '/v1/checkout/sessions/' + session.id + '/expire');
            assert.equal(expired.status, 'expired'); assert.equal(expired.payment_status, 'unpaid'); report.expired++;
          } else assert.ok(session.expires_at - session.created <= 1865, 'Automatic expiry is too far away');
        }
        assert.ok([...ids].every(id => owned.some(s => s.id === id)), 'Cleanup list missed a created probe');
        report.charged_minor = 0;
        if (!failure) assert.equal(report.created, 2);
        if (!immediateExpiry && owned.length) { report.expiry_due_at = new Date(Math.max(...owned.map(s => s.expires_at)) * 1000).toISOString(); if (!failure) report.status = 'awaiting_expiry'; }
      }
    } catch { report.status = 'failed'; report.cleanup_failure = 'Scoped expiry incomplete; private run state retained'; failure ||= Error(report.cleanup_failure); }
    await browser?.close();
    if (profile) {
      let open;
      for (let i = 0; i < 40; i++) { open = spawnSync('lsof', ['-t', '+D', profile], { encoding: 'utf8' }); if (!open.error && open.status === 1 && !open.stdout.trim()) break; await new Promise(r => setTimeout(r, 250)); }
      if (!open.error && open.status === 1 && !open.stdout.trim()) {
        const bytes = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; };
        appendFileSync(join(root, 'data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path: profile, bytes: bytes(profile), reason: 'closed isolated unpaid checkout probe', lsof: 'no open handles' }) + '\n'); rmSync(profile, { recursive: true });
      } else { report.profile_cleanup = 'deferred: open handles unknown'; failure ||= Error('Profile cleanup deferred'); report.status = 'failed'; }
    }
    state.status = report.cleanup_failure ? 'active' : report.expiry_due_at ? 'awaiting_expiry' : 'complete'; save();
    report.last_updated_at = new Date().toISOString();
    if (report.status === 'awaiting_expiry') report.submission_finished_at = report.last_updated_at;
    else report.finished_at = report.last_updated_at;
    writeFileSync(join(root, 'data/r36_checkout_lifecycle.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (failure) throw Error('Unpaid checkout probe failed; see sanitized data/r36_checkout_lifecycle.json');
  console.log(report.status === 'awaiting_expiry' ? 'PASS: marked unpaid $19/$39 handoffs, replay and refusal verified; automatic expiry awaits read-only verification at ' + report.expiry_due_at : 'PASS: both marked unpaid handoffs verified and expired');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
