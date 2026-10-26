#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash, sign } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = new URL('../', import.meta.url).pathname;
const receipt = { at: new Date().toISOString(), method: 'All immutable ZIP bytes compared with tested self-contained packaged tree, then actual MCP stdio calls with isolated XDG directories and no external credentials', synthetic_operator_checks: true, real_payment_created: false, archives: [], calls: 0 };
const work = join(homedir(), 'mcp-servers-work'); mkdirSync(work, { recursive: true });
const scope = mkdtempSync(join(work, 'r38-archive-readback-'));
const json = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
const base = { entity_id: 'E', supplier_id: 'S', currency: 'USD', document_type: 'invoice', document_reference: 'report_get', document_date: '2026-10-01', outstanding_minor: 10000 };
const input = { as_of: '2026-10-26', statement_records: [{ ...base, record_id: 'S1' }], ledger_records: [{ ...base, record_id: 'L1', outstanding_minor: 11000 }], save: true };
const key = product => {
  const payload = Buffer.from(JSON.stringify({ v: 1, p: product, id: 'r38-packaging-offline-proof', iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  return 'MCPL1.' + payload + '.' + sign(null, Buffer.from(payload), readFileSync(join(root, 'keys/license-private.pem'))).toString('base64url');
};
async function run(name) {
  const output = 'bundles/' + name;
  const archive = output + '.mcpb';
  const bytes = JSON.parse(execFileSync('python3', [join(root, 'scripts/r38-archive-members.py'), join(root, archive), join(root, output)], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }));
  const manifest = json(output + '/manifest.json'), pkg = json(output + '/server/package.json');
  assert.equal(manifest.version, '0.25.0'); assert.equal(pkg.version, '0.25.0');
  const client = new Client({ name: 'r38-exact-archive-readback', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root, output, manifest.server.entry_point)], cwd: join(root, output), stderr: 'pipe',
    env: { PATH: process.env.PATH || '', XDG_DATA_HOME: join(scope, name, 'data'), XDG_CONFIG_HOME: join(scope, name, 'config'), TMPDIR: scope, MCP_LICENSE_KEY: '' } });
  let stderr = '';
  transport.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-24000); });
  const checks = [];
  try {
    await client.connect(transport); assert.equal(client.getServerVersion().version, '0.25.0');
    const tools = [];
    let cursor;
    do { const page = await client.listTools(cursor ? { cursor } : {}); tools.push(...page.tools); cursor = page.nextCursor; } while (cursor);
    assert.deepEqual(tools.map(t => ({ name: t.name, description: t.description || '' })), manifest.tools);
    assert.equal(tools.length, name === 'office-suite' ? 453 : 8);
    checks.push('Handshake, complete tools/list and exact manifest names/descriptions agree');
    const prefix = name === 'office-suite' ? 'supplier-statement-check_' : '';
    const call = async (tool, args = {}, expectError = false) => {
      const r = await client.callTool({ name: tool, arguments: args }); receipt.calls++;
      assert.equal(r.isError === true, expectError, r.content?.[0]?.text);
      return expectError ? r : tool === 'license_activate' ? { activation_text: r.content[0].text } : JSON.parse(r.content[0].text);
    };
    const saved = await call('supplier_statement_check', input);
    assert(saved.saved); assert.equal(saved.report.summary.discrepancy_group_count, 1);
    assert.equal(saved.report.statement_records[0].document_reference, 'report_get');
    assert.equal(saved.report.retrieval.page_tool, prefix + 'report_page');
    assert.equal(saved.report.retrieval.export_tool, prefix + 'report_export_csv');
    const got = await call(prefix + 'report_get', { id: saved.id });
    assert.equal(got.report.ledger_records[0].outstanding_minor, 11000);
    const page = await call(prefix + 'report_page', { id: saved.id, section: 'statement_records', limit: 1 });
    assert.equal(page.rows[0].document_reference, 'report_get');
    const csv = await call(prefix + 'report_export_csv', { id: saved.id });
    assert.equal(csv.total_rows, 2); assert.match(csv.csv, /"report_get"/);
    assert(!csv.csv.includes('supplier-statement-check_report_get'));
    checks.push('Actual comparison, saved retrieval, free paging and CSV preserve original source values');
    await call('supplier_statement_check', input); await call('supplier_statement_check', input);
    const capped = await call('supplier_statement_check', input);
    assert.equal(capped.saved, false); assert.equal(capped.save_error, 'free_saved_report_cap');
    assert.equal(capped.report.summary.discrepancy_group_count, 1);
    assert.equal(capped.payment.product, 'supplier-statement-check');
    assert.equal(capped.payment.price.amount, '19.00'); assert.equal(capped.payment.alternative.amount, '39.00');
    assert.match(capped.payment.alternative.grants, /49 servers/);
    const previewCsv = await call(prefix + 'report_export_csv', { id: capped.report.retrieval.report_id });
    assert.equal(previewCsv.total_rows, 2);
    checks.push('Fourth save retains free complete diagnosis/CSV and truthful $19/$39 payment descriptor');
    await call('supplier_statement_check', { ...input, as_of: '2026-02-30' }, true);
    await call('supplier_statement_check', { ...input, ledger_records: [{ ...input.ledger_records[0], outstanding_minor: Number.MAX_SAFE_INTEGER + 1 }] }, true);
    checks.push('Invalid calendar date and unsafe integer return MCP errors');
    if (name === 'supplier-statement-check') {
      const activated = await call('license_activate', { key: key('supplier-statement-check') });
      assert.match(activated.activation_text, /^Activated Pro for supplier-statement-check\./);
      const proSaved = await call('supplier_statement_check', input); assert.equal(proSaved.saved, true);
      const status = await call('license_status'); assert.equal(status.tier, 'pro');
      const list = await call('report_list'); assert.equal(list.total, 4);
      checks.push('Actual offline signed single-product activation lifts only the three-report cap');
    } else {
      const map = JSON.parse((await client.readResource({ uri: 'office://tools_map' })).contents[0].text);
      const supplier = map.tools.filter(t => t.child.startsWith('supplier-statement-check.'));
      assert.equal(supplier.length, 6);
      assert.equal(supplier.find(t => t.child.endsWith('.report_get')).exposed, 'supplier-statement-check_report_get');
      assert(map.tools.some(t => t.exposed === 'duplicate-invoice-check_report_get'));
      assert(map.tools.some(t => t.exposed === 'three-way-match_report_get'));
      checks.push('Office resource map retains the existing invoice namespaces and exposes six supplier tools');
    }
    assert(!/failed to (?:connect|start)|unable to start|optional child .*not found, skipping/i.test(stderr), stderr);
    receipt.archives.push({ id: name, ...bytes, version: manifest.version, tool_count: tools.length, checks });
  } finally { await client.close(); }
}
try {
  await run('supplier-statement-check'); await run('office-suite');
  assert.equal(sha('bundles/releases/v0.22.9/office-suite.mcpb'), '0555833c1465b2a5583179eab963d8f068888077cc6410d3008254dbc469c300');
  receipt.prior_office_archive_unchanged = true; receipt.status = 'passed';
} finally {
  const deadline = Date.now() + 10000;
  while (true) {
    const handles = spawnSync('/usr/sbin/lsof', ['-t', '+D', scope], { encoding: 'utf8' });
    if (!handles.error && handles.status === 1 && !handles.stdout.trim()) break;
    if (handles.error || ![0, 1].includes(handles.status) || Date.now() >= deadline) throw Error('Archive QA scope retained: open or unknown handles');
    await delay(100);
  }
  const size = path => { const s = lstatSync(path); return s.isDirectory() ? readdirSync(path).reduce((n, child) => n + size(join(path, child)), 0) : s.size; };
  const bytes = size(scope); assert(bytes < 50_000_000);
  appendFileSync(join(root, 'data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path: scope, bytes, lsof: 'no open handles', reason: 'Completed exact-archive MCP operator readbacks; no full archive extraction fixture created' }) + '\n');
  rmSync(scope, { recursive: true }); assert(!existsSync(scope));
  receipt.fixture_removed = true;
}
receipt.finished_at = new Date().toISOString();
writeFileSync(join(root, 'data/r38_packaging_archive_verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, calls: receipt.calls, archives: receipt.archives.map(a => ({ id: a.id, sha256: a.sha256, tools: a.tool_count, members: a.members_verified })) }));
