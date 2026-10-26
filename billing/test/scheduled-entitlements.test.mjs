import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { registerHooks } from 'node:module';

// Ephemeral signer only. Keep production verification code; substitute its public
// key at module load. No production private key, network, or fixture files.
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const rawPublic = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
const licenseUrl = new URL('../src/license.js', import.meta.url).href;
const originalPublic = readFileSync(new URL(licenseUrl), 'utf8').match(/export const PUBLIC_KEY_B64 = "([^"]+)";/)[1];
registerHooks({ load(url, context, next) {
  const result = next(url, context);
  return url === licenseUrl ? { ...result, source: result.source.toString().replace(originalPublic, rawPublic) } : result;
} });
const { runScheduledMonitor, paidSessionEntitlementIssue } = await import('../src/scheduled-monitor.js');
const { paidSessionFindings } = await import('../../scripts/billing-operations-monitor.mjs');

const now = Math.floor(Date.now() / 1000);
const tenant = 'anon_' + 'c'.repeat(32);
const version = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function key(product, id = product, extra = {}) {
  const body = Buffer.from(JSON.stringify({ v: 1, p: product, id, iat: now - 7200, ...extra })).toString('base64url');
  return 'MCPL1.' + body + '.' + sign(null, Buffer.from(body), privateKey).toString('base64url');
}
const invoice = key('invoice'), docx = key('docx'), bundle = key('*');
const session = (product = 'invoice', id = product) => ({ id: 'cs_live_synthetic_' + id,
  livemode: true, status: 'complete', payment_status: 'paid', created: now - 3600,
  metadata: { site: 'mcp.zovo.one', product, tenant } });
function kv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, get: async name => values.get(name) ?? null,
    put: async (name, value) => { values.set(name, value); },
    list: async ({ prefix }) => ({ keys: [...values.keys()].filter(name => name.startsWith(prefix)).map(name => ({ name })), list_complete: true }) };
}
const scope = (product, value) => ({ ['bind:' + tenant + ':' + product]: value });
const endpoints = [{ url: 'https://mcp.zovo.one/webhook', status: 'enabled',
  enabled_events: ['checkout.session.completed', 'checkout.session.async_payment_succeeded'] }];
async function scheduled(sessions, issued, bindings) {
  const remote = kv({ 'monitor:approved-version': version, ...bindings });
  const env = { REMOTE_DATA: remote, LICENSES: kv(issued), CF_VERSION_METADATA: { id: version }, STRIPE_SECRET_KEY: 'fake-read-key' };
  const originalFetch = globalThis.fetch, originalLog = console.log, originalError = console.error;
  const logs = [], reads = [];
  console.log = console.error = value => logs.push(String(value));
  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(url); assert.equal(target.hostname, 'api.stripe.com');
    assert.equal(options.method || 'GET', 'GET'); reads.push(target.pathname);
    const data = target.pathname === '/v1/webhook_endpoints' ? endpoints :
      target.pathname === '/v1/checkout/sessions' && target.searchParams.get('status') === 'complete' ? sessions : [];
    return Response.json({ object: 'list', data, has_more: false });
  };
  const route = async () => new Response('<form method="post"><input name="intent" value="checkout"></form>',
    { headers: { 'content-type': 'text/html', 'x-mcp-buy': 'checkout-intent-required' } });
  let report, error;
  try { report = await runScheduledMonitor(env, Date.now(), {}, route); }
  catch (failure) { error = failure; }
  finally { globalThis.fetch = originalFetch; console.log = originalLog; console.error = originalError; }
  for (const secret of [...Object.values(issued), ...Object.values(bindings)]) {
    if (typeof secret === 'string' && secret.startsWith('MCPL1.')) assert.equal(logs.join('').includes(secret), false);
  }
  return { report, error, env, reads, logs };
}

test('actual old scheduled function falsely rejects the first of two fulfilled paid singles', async () => {
  // Frozen pre-fix source, not a restatement of the equality condition. Root CI
  // checks out full history. No checkout, file mutation, or network is performed.
  const old = execFileSync('git', ['show', 'e290ce3cfec0cf7c9f44e9273485473d0fea2da6:billing/src/scheduled-monitor.js'],
    { cwd: new URL('../../', import.meta.url), encoding: 'utf8' });
  const start = old.indexOf('async function checkOperations(env, now) {');
  const end = old.indexOf('\nexport async function runScheduledMonitor', start);
  assert.ok(start > 0 && end > start);
  const sessions = [session('invoice'), session('docx')];
  const issued = { ['session:' + sessions[0].id]: invoice, ['session:' + sessions[1].id]: docx };
  const bindings = { ...scope('invoice', invoice), ...scope('docx', docx), ['bind:' + tenant]: docx };
  const env = { LICENSES: kv(issued), REMOTE_DATA: kv(bindings) };
  const list = async (_env, path, params) => path === '/v1/webhook_endpoints' ? endpoints :
    path === '/v1/checkout/sessions' && params.some(([name, value]) => name === 'status' && value === 'complete') ? sessions : [];
  const reference = id => createHash('sha256').update('mcp-session-log-v1:' + id).digest('hex').slice(0, 12);
  const oldCheck = new Function('stripeList', 'isMcpSession', 'sessionRef', 'listWebhookStatuses', 'SETTLE_SECONDS', 'WEBHOOK', 'assert',
    'return (' + old.slice(start, end).trim() + ');')(list, row => row.metadata.site === 'mcp.zovo.one', reference,
    async () => ({ failed: 0, inspected: 0 }), 900, endpoints[0].url, assert);
  await assert.rejects(() => oldCheck(env, now), error => error.message.includes(reference(sessions[0].id) + ':binding'));
  const fixed = await scheduled(sessions, issued, bindings);
  assert.ifError(fixed.error); assert.equal(fixed.report.operations.paidChecked, 2);
  assert.deepEqual(fixed.report.operations.missing, []);
  const native = await paidSessionFindings(sessions, (binding, name) =>
    (binding === 'LICENSES' ? env.LICENSES : env.REMOTE_DATA).get(name), now);
  assert.equal(native.checked, 2); assert.deepEqual(native.findings, []);
});

test('current bundle and replacement keys cover historical singles without byte equality', async () => {
  for (const bindings of [scope('*', bundle), scope('invoice', key('invoice', 'replacement')),
    { ...scope('*', 'corrupt'), ...scope('invoice', invoice) }, { ['bind:' + tenant]: bundle }]) {
    assert.equal(await paidSessionEntitlementIssue(session(), invoice, kv(bindings)), null);
  }
});

test('paid bundle and known bundle aliases require a verified wildcard, never a single', async () => {
  for (const product of ['bundle', 'office-suite', 'hourly-rate']) {
    assert.equal(await paidSessionEntitlementIssue(session(product), bundle, kv(scope('*', bundle))), null);
    assert.equal(await paidSessionEntitlementIssue(session(product), bundle, kv({ ['bind:' + tenant]: invoice })), 'binding');
    assert.equal(await paidSessionEntitlementIssue(session(product), bundle, kv(scope('*', invoice))), 'binding');
  }
});

test('missing, corrupt, expired and wrong-scope effective bindings remain alerts', async () => {
  for (const bindings of [{}, scope('invoice', 'corrupt'), scope('invoice', key('invoice', 'expired', { exp: 1 })), scope('invoice', docx)]) {
    assert.equal(await paidSessionEntitlementIssue(session(), invoice, kv(bindings)), 'binding');
  }
  assert.equal(await paidSessionEntitlementIssue(session(), invoice, kv({ ['bind:' + tenant]: invoice })), null);
});

test('issued key signature and paid scope are independent fulfillment evidence', async () => {
  for (const issued of [null, 'corrupt', invoice + 'x', docx, key('invoice', 'expired-before-payment', { exp: 1 })]) {
    assert.equal(await paidSessionEntitlementIssue(session(), issued, kv(scope('*', bundle))), 'license');
  }
  assert.equal(await paidSessionEntitlementIssue(session('bundle'), invoice, kv(scope('*', bundle))), 'license');
});

test('historically valid issued expiry is accepted only with valid current coverage', async () => {
  const issued = key('invoice', 'historical', { exp: now - 600 });
  assert.equal(await paidSessionEntitlementIssue(session(), issued, kv(scope('*', bundle))), null);
  assert.equal(await paidSessionEntitlementIssue(session(), issued, kv(scope('invoice', issued))), 'binding');
});

test('unresolved paid metadata, prototype names and malformed tenants fail closed', async () => {
  for (const product of [undefined, null, {}, ['invoice'], '__proto__', 'constructor', 'toString', '*', 'INVOICE', ' invoice', 'unknown']) {
    const invalid = session(); invalid.metadata.product = product;
    assert.equal(await paidSessionEntitlementIssue(invalid, invoice, kv(scope('*', bundle))), 'binding_product');
  }
  const badTenant = session(); badTenant.metadata.tenant = 'not-anonymous';
  assert.equal(await paidSessionEntitlementIssue(badTenant, invoice, kv(scope('*', bundle))), 'binding_tenant');
});

test('local paid purchases require a valid issued key without a hosted binding', async () => {
  const local = session(); delete local.metadata.tenant;
  assert.equal(await paidSessionEntitlementIssue(local, invoice, kv()), null);
  assert.equal(await paidSessionEntitlementIssue(local, 'corrupt', kv()), 'license');
});
