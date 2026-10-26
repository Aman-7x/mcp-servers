import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

// Run the actual side-effecting CLI with an entirely in-memory filesystem,
// credentials, signing operation and network. No production module is imported.
// An unsupported source/import change fails parsing rather than reaching Node I/O.
const cli = readFileSync(new URL('../scripts/r38-verify-hosted-entitlements.mjs', import.meta.url), 'utf8');
const imports = cli.match(/^import .*;$/gm) || [];
assert.equal(imports.length, 4, 'review sandbox imports if the CLI gains a dependency');
const rootDeclaration = "const root = new URL('../', import.meta.url);";
assert.equal(cli.split(rootDeclaration).length, 2, 'sandbox must replace exactly one filesystem root');
const source = cli.replace(/^#!.*\n/, '').replace(/^import .*;\n/gm, '')
  .replace(rootDeclaration, "const root = new URL('file:///fixture/');");

const TOKEN = 'anon_' + 'a'.repeat(32);
const OTHER = 'anon_' + 'b'.repeat(32);
const RUN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REMOTE = '11111111-1111-4111-8111-111111111111';
const BILLING = '22222222-2222-4222-8222-222222222222';
const JOURNAL = '/fixture/.scratch-distribution/r38-entitlement-probe-state.json';
const RECEIPT = '/fixture/data/r38_hosted_entitlements_live_verification.json';
const PREVIOUS = JSON.stringify({ status: 'passed', proof: 'preserve-me' });
const pathname = value => value?.pathname ?? value;

async function runProbe(mode = 'normal') {
  const files = new Map(), kv = new Map(), output = [], deleted = [], calls = [], fileReads = [];
  const cleanupOnly = ['cleanup_only', 'marker_mismatch'].includes(mode);
  const saved = { run_id: RUN, created_at: new Date().toISOString(), token: TOKEN };
  if (['existing_receipt', 'cleanup_only', 'marker_mismatch'].includes(mode)) files.set(RECEIPT, PREVIOUS);
  if (cleanupOnly || mode === 'existing_journal') files.set(JOURNAL, JSON.stringify(saved));
  if (cleanupOnly) {
    kv.set('tok:' + TOKEN, 'owned');
    kv.set('bind:' + TOKEN + ':invoice', 'owned');
    kv.set('probe:r38:entitlement:' + RUN, mode === 'marker_mismatch' ? OTHER : TOKEN);
  }
  const protectedValues = new Map([
    ['tok:' + OTHER, 'customer-token'],
    ['anon:' + OTHER.slice(5) + ':invoice', 'customer-document'],
    ['mint:shared-control', '42'],
  ]);
  for (const [key, value] of protectedValues) kv.set(key, value);

  const fs = {
    existsSync: value => files.has(pathname(value)), mkdirSync() {},
    readFileSync(value) {
      const key = pathname(value); fileReads.push(key);
      if (key === '/fixture/keys/license-private.pem') return Buffer.from('fake-in-memory-key');
      if (!files.has(key)) throw Error('ENOENT');
      return Buffer.from(files.get(key));
    },
    writeFileSync(value, contents, options = {}) {
      const key = pathname(value);
      if (options.flag === 'wx' && files.has(key)) throw Error('EEXIST');
      files.set(key, String(contents));
    },
    appendFileSync(value, contents) {
      const key = pathname(value); files.set(key, (files.get(key) || '') + String(contents));
    },
    renameSync(from, to) { files.set(pathname(to), files.get(pathname(from))); files.delete(pathname(from)); },
    unlinkSync: value => files.delete(pathname(value)),
  };
  const payload = key => {
    try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url')); } catch { return {}; }
  };
  const validFor = (key, product) => {
    const p = payload(key);
    return (p.p === '*' || p.p === product) && typeof p.exp === 'number' && p.exp > Date.now() / 1000;
  };
  let foreignListingInjected = false;
  const fetch = async (url, options = {}) => {
    const u = new URL(url), method = options.method || 'GET';
    calls.push({ path: u.pathname, method });
    if (u.hostname === 'api.cloudflare.com') {
      if (u.pathname.endsWith('/deployments')) return Response.json({ success: true, result: {
        deployments: [{ created_on: '2026-10-26', versions: [{
          version_id: u.pathname.includes('mcp-remote') ? REMOTE : BILLING, percentage: 100,
        }] }],
      } });
      if (u.pathname.endsWith('/keys')) {
        const prefix = u.searchParams.get('prefix');
        let rows = [...kv.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name }));
        // Inject at cleanup's first prefix, after the earlier binding-metadata check.
        if (mode === 'foreign_listing' && prefix.startsWith('anon:') && !foreignListingInjected) {
          foreignListingInjected = true; rows = [{ name: 'tok:' + OTHER }];
        }
        return Response.json({ success: true, result: rows, result_info: {} });
      }
      assert.ok(u.pathname.includes('/values/'), 'unexpected Cloudflare API route');
      const key = decodeURIComponent(u.pathname.split('/values/')[1]);
      if (method === 'PUT') { kv.set(key, options.body); return Response.json({ success: true }); }
      if (method === 'DELETE') {
        if (mode === 'cleanup_failure' && key.endsWith(':docx')) return Response.json({ success: false }, { status: 500 });
        deleted.push(key); kv.delete(key); return Response.json({ success: true });
      }
      assert.equal(method, 'GET');
      return kv.has(key) ? new Response(kv.get(key)) : new Response('', { status: 404 });
    }
    assert.equal(u.hostname, 'mcp.zovo.one', 'unexpected external destination');
    assert.equal(options.headers['x-mcp-probe'], '1', 'every public request is explicitly a probe');
    if (u.pathname === '/mcp/token') {
      kv.set('tok:' + TOKEN, 'owned');
      kv.set('funnel:v1:cohort:' + createHash('sha256').update(TOKEN).digest('hex'),
        JSON.stringify({ source: 'guide', cohort: 'probe' }));
      if (mode === 'ambiguous_mint') throw Error('mint_response_lost');
      return Response.json({ token: TOKEN });
    }
    if (u.pathname === '/bound') return Response.json({ bound: true, product: '*' });
    const product = u.pathname.split('/')[2], request = JSON.parse(options.body);
    const key = options.headers.Authorization?.slice(7);
    assert.ok(['license_status', 'license_activate'].includes(request.params.name), 'no business tools');
    if (key && !validFor(key, product)) return Response.json({ error: 'invalid_license' }, { status: 401 });
    if (request.params.name === 'license_activate') {
      const next = request.params.arguments.key, scope = payload(next).p, previous = kv.get('bind:' + TOKEN);
      if (previous) {
        const previousScope = payload(previous).p;
        if (previousScope !== scope && !kv.has('bind:' + TOKEN + ':' + previousScope)) {
          kv.set('bind:' + TOKEN + ':' + previousScope, previous);
        }
      }
      kv.set('bind:' + TOKEN + ':' + scope, next); kv.set('bind:' + TOKEN, next);
      return Response.json({ jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: 'Checking key' }] } });
    }
    const pro = ['bind:' + TOKEN + ':*', 'bind:' + TOKEN + ':' + product, 'bind:' + TOKEN]
      .some(slot => validFor(kv.get(slot) || '', product));
    return Response.json({ jsonrpc: '2.0', id: mode === 'wrong_rpc_id' ? request.id + 1 : request.id,
      result: { content: [{ type: 'text', text: JSON.stringify({
        product, tenant: 'anon:' + TOKEN.slice(5), tier: pro ? 'pro' : 'free',
      }) }] } });
  };
  const process = { argv: ['node', 'probe', ...(cleanupOnly ? ['--cleanup-only'] :
    ['--expected-remote', REMOTE, '--expected-billing', BILLING])],
    env: { CLOUDFLARE_API_TOKEN: 'fake-in-memory-api-token' }, exitCode: 0 };
  const context = vm.createContext({ URL, Buffer, Response, AbortSignal, Date, JSON, Set, Error, Promise,
    createHash, randomUUID: () => RUN, sign: () => Buffer.alloc(64, 1), ...fs,
    spawnSync: () => ({ status: 1, stdout: '' }), delay: async () => {}, fetch, process,
    console: { log: value => output.push(value) } });
  let exception;
  try { await new vm.Script('(async () => {\n' + source + '\n})()', { filename: 'sandboxed-probe.mjs' })
    .runInContext(context, { timeout: 2000 }); } catch (error) { exception = error; }
  for (const [key, value] of protectedValues) assert.equal(kv.get(key), value, 'unrelated customer or shared key changed');
  const receiptPath = cleanupOnly ? [...files.keys()].find(key => key.includes('r38_hosted_entitlements_cleanup_')) : RECEIPT;
  const receipt = files.has(receiptPath) ? JSON.parse(files.get(receiptPath)) : null;
  if (receipt && !['existing_receipt', 'existing_journal'].includes(mode)) {
    const publicOutput = JSON.stringify(receipt) + output.join('');
    for (const privateValue of [TOKEN, 'MCPL1.', 'fake-in-memory-key', 'fake-in-memory-api-token']) {
      assert.equal(publicOutput.includes(privateValue), false, 'private probe material reached public evidence');
    }
  }
  return { files, kv, receipt, process, exception, deleted, calls, fileReads };
}

test('normal probe validates tiers, uses only marked license calls and cleans its own state', async () => {
  const h = await runProbe(); assert.ifError(h.exception);
  assert.equal(h.receipt.status, 'passed');
  assert.equal(h.receipt.checks.length, 10); assert.equal(h.receipt.protocol_calls, 13);
  assert.equal(h.receipt.cleanup_complete, true); assert.equal(h.receipt.private_journal_retained, false);
  assert.equal(h.files.has(JOURNAL), false); assert.equal(h.process.exitCode, 0);
  assert.ok(h.deleted.length > 0);
});

test('cleanup-only preserves the prior verification receipt and writes separate completed evidence', async () => {
  const h = await runProbe('cleanup_only'); assert.ifError(h.exception);
  assert.equal(h.files.get(RECEIPT), PREVIOUS); assert.equal(h.receipt.status, 'passed');
  assert.equal(h.receipt.cleanup_complete, true); assert.equal(h.receipt.private_journal_retained, false);
  assert.equal(h.receipt.protocol_calls, 0);
});

test('refused reruns cannot overwrite prior proof or an existing private journal', async () => {
  for (const mode of ['existing_receipt', 'existing_journal']) {
    const h = await runProbe(mode);
    assert.ok(h.exception); assert.equal(h.calls.length, 0); assert.equal(h.deleted.length, 0);
    if (mode === 'existing_receipt') assert.equal(h.files.get(RECEIPT), PREVIOUS);
    else assert.equal(JSON.parse(h.files.get(JOURNAL)).token, TOKEN);
  }
});

test('a wrong JSON-RPC response ID cannot certify tier or activation success', async () => {
  const h = await runProbe('wrong_rpc_id'); assert.ifError(h.exception);
  assert.equal(h.receipt.status, 'failed'); assert.equal(h.receipt.failure, 'protocol_refused_license_status');
  assert.equal(h.receipt.checks.length, 0); assert.equal(h.receipt.cleanup_complete, true);
});

test('an out-of-prefix KV listing prevents every deletion and retains the recovery journal', async () => {
  const h = await runProbe('foreign_listing'); assert.ifError(h.exception);
  assert.equal(h.receipt.status, 'failed'); assert.equal(h.receipt.cleanup_complete, false);
  assert.equal(h.receipt.private_journal_retained, true); assert.equal(h.files.has(JOURNAL), true);
  assert.equal(h.deleted.length, 0); assert.equal(h.process.exitCode, 1);
});

test('failed owned-key deletion cannot destroy the remaining recovery journal', async () => {
  const h = await runProbe('cleanup_failure'); assert.ifError(h.exception);
  assert.equal(h.receipt.status, 'failed'); assert.equal(h.receipt.cleanup_complete, false);
  assert.equal(h.receipt.private_journal_retained, true); assert.equal(h.files.has(JOURNAL), true);
  assert.equal(h.kv.has('bind:' + TOKEN + ':docx'), true); assert.equal(h.process.exitCode, 1);
});

test('mint-started without an observed token is ambiguous and retains its private journal', async () => {
  const h = await runProbe('ambiguous_mint'); assert.ifError(h.exception);
  assert.equal(h.receipt.status, 'failed'); assert.equal(h.receipt.cleanup_complete, false);
  assert.equal(h.receipt.private_journal_retained, true); assert.equal(h.deleted.length, 0);
  const journal = JSON.parse(h.files.get(JOURNAL));
  assert.equal(journal.mint_started, true); assert.equal(journal.token, null);
  assert.equal(h.fileReads.some(path => path.endsWith('license-private.pem')), false);
  assert.equal(h.process.exitCode, 1);
});

test('a conflicting probe marker refuses cleanup before listing or deleting keys', async () => {
  const h = await runProbe('marker_mismatch'); assert.ifError(h.exception);
  assert.equal(h.receipt.status, 'failed'); assert.equal(h.receipt.cleanup_complete, false);
  assert.equal(h.receipt.private_journal_retained, true); assert.equal(h.deleted.length, 0);
  assert.equal(h.calls.some(call => call.path.endsWith('/keys')), false);
  assert.equal(h.files.get(RECEIPT), PREVIOUS);
});
