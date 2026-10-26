#!/usr/bin/env node
// Verify the actual standalone generated mirror, with no monorepo sibling fallback.
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--directory') throw Error('Use --directory <generated Office mirror>');
const mirror = resolve(args[1]);
const root = new URL('../', import.meta.url);
const work = join(homedir(), 'mcp-servers-work'); mkdirSync(work, { recursive: true });
assert(mirror.startsWith(work + '/mirror-office-suite.'), 'Use an owned standalone mirror directory');
const scope = mkdtempSync(join(work, 'r38-office-mirror-runtime-'));
const expected = JSON.parse(readFileSync(new URL('bundles/office-suite/manifest.json', root)));
const client = new Client({ name: 'r38-independent-mirror-readback', version: '1' });
const transport = new StdioClientTransport({ command: process.execPath, args: [join(mirror, 'dist/index.js')], cwd: mirror, stderr: 'pipe',
  env: { PATH: process.env.PATH || '', HOME: scope, TMPDIR: scope, XDG_DATA_HOME: join(scope, 'data'), XDG_CONFIG_HOME: join(scope, 'config'), MCP_LICENSE_KEY: '', NODE_PATH: '' } });
let stderr = ''; transport.stderr.on('data', value => { stderr += value.toString(); });
const receipt = { at: new Date().toISOString(), mirror, method: 'Actual standalone mirror stdio; compare complete runtime names/descriptions against exact byte-verified Office archive manifest', tools: null, calls: 0, buyers: 0, payments: 0, checks: [] };
try {
  await client.connect(transport); assert.equal(client.getServerVersion().version, '0.25.0');
  const tools = []; let cursor;
  do { const page = await client.listTools(cursor ? { cursor } : {}); tools.push(...page.tools); cursor = page.nextCursor; } while (cursor);
  assert.deepEqual(tools.map(t => ({ name: t.name, description: t.description || '' })), expected.tools);
  assert.equal(tools.length, 453); receipt.tools = tools.length;
  receipt.checks.push('All 453 actual mirror tool names and descriptions match the tested archive; no partial capability tree');
  const call = async (name, arguments_) => { const r = await client.callTool({ name, arguments: arguments_ }); receipt.calls++; assert(!r.isError, r.content?.[0]?.text); return JSON.parse(r.content[0].text); };
  const common = { entity_id: 'ENTITY', supplier_id: 'SUPPLIER', currency: 'USD', document_type: 'invoice', document_reference: 'report_get', document_date: '2026-10-01', outstanding_minor: 10000 };
  const input = { as_of: '2026-10-26', statement_records: [{ ...common, record_id: 'S1' }], ledger_records: [{ ...common, record_id: 'L1', outstanding_minor: 11000 }], save: false };
  const check = await call('supplier_statement_check', input); assert.equal(check.report.summary.discrepancy_group_count, 1);
  assert.equal(check.report.statement_records[0].document_reference, 'report_get');
  assert.equal(check.report.retrieval.page_tool, 'supplier-statement-check_report_page');
  assert.equal(check.report.retrieval.export_tool, 'supplier-statement-check_report_export_csv');
  const csv = await call('supplier-statement-check_report_export_csv', { id: check.report.retrieval.report_id });
  assert.equal(csv.total_rows, 2); assert.match(csv.csv, /"report_get"/); assert(!csv.csv.includes('supplier-statement-check_report_get'));
  const page = await call('supplier-statement-check_report_page', { id: check.report.retrieval.report_id, section: 'statement_records', limit: 1 });
  assert.equal(page.rows[0].document_reference, 'report_get');
  receipt.checks.push('Actual comparison, prefixed retrieval hints, complete free CSV and source-page values survive the standalone proxy');
  const resource = await client.readResource({ uri: 'office://tools_map' });
  assert(resource.contents.some(c => c.text?.includes('supplier-statement-check_report_get')));
  assert(!/failed to (?:connect|start)|optional child .*not found, skipping/.test(stderr), 'Mirror contains unavailable children');
  receipt.checks.push('Authoritative tool-map resource includes new names; no child initialization failure or missing-child warning');
  receipt.status = 'passed';
} finally {
  await client.close();
  const deadline = Date.now() + 10000;
  while (true) {
    const open = spawnSync(process.platform === 'darwin' ? '/usr/sbin/lsof' : 'lsof', ['-t', '+D', scope], { encoding: 'utf8' });
    if (open.status === 1 && !open.stdout.trim()) break;
    if (open.error || Date.now() > deadline) throw Error('Retained Office mirror runtime scope with open or uncertain handles');
    await delay(100);
  }
  const bytes = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; };
  appendFileSync(new URL('data/build-deletions.jsonl', root), JSON.stringify({ at: new Date().toISOString(), path: scope, bytes: bytes(scope), lsof: 'no open handles', reason: 'Completed actual standalone Office mirror readback' }) + '\n');
  rmSync(scope, { recursive: true }); assert(!existsSync(scope));
}
receipt.finished_at = new Date().toISOString();
writeFileSync(new URL('data/r38_public_distribution_office_runtime.json', root), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
