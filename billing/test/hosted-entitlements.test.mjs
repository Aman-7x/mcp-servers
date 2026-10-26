import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign } from 'node:crypto';
import { registerHooks } from 'node:module';
import { build } from 'esbuild';
import { bindingSlot, readBinding, writeBinding } from '../src/hosted-bindings.js';

// Ephemeral signing key: this suite runs in CI without any production secrets.
// Replace only public-key bytes; verification algorithms and handlers stay intact.
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const fixturePublic = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('base64');
const licenseUrl = new URL('../src/license.js', import.meta.url).href;
const originalPublic = readFileSync(new URL(licenseUrl), 'utf8').match(/export const PUBLIC_KEY_B64 = "([^"]+)";/)[1];
registerHooks({ load(url, context, next) {
  const loaded = next(url, context);
  return url === licenseUrl ? { ...loaded, source: loaded.source.toString().replace(originalPublic, fixturePublic) } : loaded;
} });
const { default: worker } = await import('../src/index.js');
const { verifyLicenseKey } = await import('../src/license.js');
const { acceptFulfillmentJob, processFulfillment } = await import('../src/fulfillment-engine.js');

// Execute the actual hosted authentication and protocol handlers. Bundle in memory
// solely to resolve the Worker's .js-to-.ts imports under Node; no fixture files.
const source = readFileSync(new URL('../../remote/src/index.ts', import.meta.url), 'utf8').replaceAll(originalPublic, fixturePublic);
const compiled = await build({ stdin: { contents: source + '\nexport { authenticate };',
  resolveDir: new URL('../../remote/src/', import.meta.url).pathname, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent',
  banner: { js: `import { createRequire } from 'node:module'; const require=createRequire(${JSON.stringify(import.meta.url)});` } });
const remote = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const tenant = 'anon_' + 'd'.repeat(32);
const verify = async (key, scope) => {
  const result = await verifyLicenseKey(key, scope === '*' ? null : scope);
  return { ...result, p: result.payload?.p };
};
function license(product, id = product.replace('*', 'bundle'), exp) {
  const payload = { v: 1, p: product, id, iat: 1788352878, ...(exp ? { exp } : {}) };
  return signed(payload);
}
function signed(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `MCPL1.${body}.${sign(null, Buffer.from(body), privateKey).toString('base64url')}`;
}
function fixture() {
  const values = new Map([[`tok:${tenant}`, '1']]);
  const expires = new Map();
  let now = Date.now();
  const kv = { get: async key => expires.has(key) && expires.get(key) <= now ? null : values.get(key) ?? null,
    put: async (key, value, options) => {
      values.set(key, value);
      if (options?.expirationTtl) expires.set(key, now + options.expirationTtl * 1000);
      else expires.delete(key);
    } };
  const env = { REMOTE_DATA: kv, LICENSES: kv };
  const auth = product => remote.authenticate(new Request('https://mcp.zovo.one/mcp/' + product,
    { headers: { authorization: `Bearer ${tenant}` } }), env, product);
  return { values, kv, env, auth, advance: ms => { now += ms; } };
}
async function activate(f, product, key) {
  const pending = [];
  const response = await remote.default.fetch(new Request(`https://mcp.zovo.one/mcp/${product}/t/${tenant}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'license_activate', arguments: { key } } })
  }), f.env, { waitUntil: value => pending.push(value) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(!result.error && !result.result?.isError, JSON.stringify(result));
  await Promise.all(pending);
  return result;
}
async function fulfill(f, product, key = license(product === 'bundle' ? '*' : product)) {
  const jobs = new Map();
  const storage = { get: async key => structuredClone(jobs.get(key)),
    put: async (key, value) => { jobs.set(key, structuredClone(value)); },
    setAlarm: async () => {}, deleteAlarm: async () => {} };
  const accepted = await acceptFulfillmentJob(storage, {
    sessionId: `cs_live_unit_${product.replaceAll('-', '_')}`, product, key, tenant });
  assert.ok(accepted.job);
  const result = await processFulfillment(storage, f.env, accepted.job);
  return { storage, job: accepted.job, result };
}

test('a second paid single retains both entitlements on the same anonymous documents', async () => {
  const f = fixture();
  await fulfill(f, 'invoice');
  await fulfill(f, 'docx');
  for (const product of ['invoice', 'docx']) {
    const auth = await f.auth(product);
    assert.equal(auth.isPro, true);
    assert.equal(auth.tenant, `anon:${tenant.slice(5)}`);
  }
  assert.equal((await f.auth('spreadsheet')).isPro, false);
});

test('a valid legacy purchase is preserved when a different single replaces its old slot', async () => {
  const f = fixture();
  f.values.set(`bind:${tenant}`, license('invoice'));
  await fulfill(f, 'docx');
  assert.equal((await f.auth('invoice')).isPro, true);
  assert.equal((await f.auth('docx')).isPro, true);
});

test('bundle wins after another single purchase and replay of an older paid session', async () => {
  const f = fixture();
  const first = await fulfill(f, 'invoice');
  await fulfill(f, 'bundle');
  await fulfill(f, 'docx');
  await processFulfillment(first.storage, f.env, first.job);
  for (const product of ['invoice', 'docx', 'spreadsheet']) assert.equal((await f.auth(product)).isPro, true);
  const bound = await worker.fetch(new Request(`https://mcp.zovo.one/bound?tenant=${tenant}`), f.env);
  assert.deepEqual(await bound.json(), { bound: true, product: '*' });
});

test('concurrent purchases write independent scoped entitlements', async () => {
  const f = fixture();
  await Promise.all([fulfill(f, 'invoice'), fulfill(f, 'docx')]);
  assert.equal((await f.auth('invoice')).isPro, true);
  assert.equal((await f.auth('docx')).isPro, true);
});

test('signed expired, tampered and mismatched scoped keys grant no access', async () => {
  for (const key of [license('invoice', 'expired', 1), license('docx'), license('invoice') + 'x']) {
    const f = fixture();
    f.values.set(bindingSlot(tenant, 'invoice'), key);
    assert.equal((await f.auth('invoice')).isPro, false);
  }
  const f = fixture();
  f.values.set(bindingSlot(tenant, '*'), license('*', 'expired', 1));
  await writeBinding(f.kv, tenant, license('invoice'), 'invoice', verify);
  assert.equal((await f.auth('invoice')).isPro, true);
  assert.equal((await f.auth('docx')).isPro, false);
});

test('a failed legacy compatibility write retries without dropping scoped purchases', async () => {
  const f = fixture();
  await fulfill(f, 'invoice');
  const put = f.kv.put;
  let fail = true;
  f.kv.put = async (key, value) => {
    if (fail && key === `bind:${tenant}`) throw new Error('simulated compatibility write outage');
    return put(key, value);
  };
  const pending = await fulfill(f, 'docx');
  assert.equal(pending.result.complete, false);
  assert.equal((await f.auth('invoice')).isPro, true);
  assert.equal((await f.auth('docx')).isPro, true);
  fail = false;
  assert.equal((await processFulfillment(pending.storage, f.env, pending.job)).complete, true);
});

test('actual license_activate tools/call retains earlier purchases and bundle precedence', async () => {
  const f = fixture();
  f.values.set(`bind:${tenant}`, license('invoice'));
  await activate(f, 'docx', license('docx'));
  assert.equal((await f.auth('invoice')).isPro, true);
  assert.equal((await f.auth('docx')).isPro, true);
  await activate(f, 'invoice', license('*'));
  await activate(f, 'docx', license('docx', 'anotherdocx'));
  assert.equal((await f.auth('spreadsheet')).isPro, true);
});

test('/bound checks the requested product and never returns license material', async () => {
  const f = fixture();
  await fulfill(f, 'invoice');
  await fulfill(f, 'docx');
  const response = await worker.fetch(new Request(`https://mcp.zovo.one/bound?tenant=${tenant}&product=invoice`), f.env);
  assert.deepEqual(await response.json(), { bound: true, product: 'invoice' });
  assert.equal((await worker.fetch(new Request(`https://mcp.zovo.one/bound?tenant=${tenant}&product=not-a-product`), f.env)).status, 400);
  await f.kv.put(`bind:${tenant}`, 'not-a-valid-key');
  assert.equal((await readBinding(f.kv, tenant, 'invoice', verify)).ok, true);
});

test('activation keeps lifetime purchases after an active anonymous token outlives 30 days', async () => {
  const f = fixture();
  f.values.set(`bind:${tenant}`, license('invoice'));
  await activate(f, 'docx', license('docx'));
  f.advance(31 * 86_400_000);
  // The token remains active; only binding TTL is under test, not token renewal.
  await f.kv.put(`tok:${tenant}`, 'refreshed');
  assert.equal((await f.auth('invoice')).isPro, true);
  assert.equal((await f.auth('docx')).isPro, true);
});

test('migration recovers a valid legacy purchase over a rejected scoped copy', async () => {
  for (const stale of [license('invoice', 'expired', 1), license('docx'), 'corrupt']) {
    const f = fixture();
    f.values.set(bindingSlot(tenant, 'invoice'), stale);
    f.values.set(`bind:${tenant}`, license('invoice', 'valid-legacy'));
    await fulfill(f, 'docx');
    assert.equal((await f.auth('invoice')).isPro, true);
    assert.equal((await f.auth('docx')).isPro, true);
  }
});

test('other tenants and unknown anonymous tokens cannot consume a scoped purchase', async () => {
  const f = fixture();
  const other = 'anon_' + 'e'.repeat(32);
  f.values.set(bindingSlot(other, '*'), license('*'));
  assert.equal((await f.auth('invoice')).isPro, false);
  await fulfill(f, 'invoice');
  f.values.delete(`tok:${tenant}`);
  const denied = await f.auth('invoice');
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error, 'unknown_token');
});

test('hosted authentication rejects signed malformed expiry and payload fields', async () => {
  for (const changes of [{ exp: 'never' }, { exp: -1 }, { exp: 1.5 }, { iat: 'today' }, { id: '' }, { p: '' }]) {
    const f = fixture();
    const key = signed({ v: 1, p: 'invoice', id: 'invoice', iat: 1788352878, ...changes });
    f.values.set(bindingSlot(tenant, 'invoice'), key);
    assert.equal((await f.auth('invoice')).isPro, false, JSON.stringify(changes));
    assert.equal((await verifyLicenseKey(key, 'invoice')).ok, false);
  }
});
