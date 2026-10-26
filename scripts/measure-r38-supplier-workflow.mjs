#!/usr/bin/env node
// Frozen synthetic operator tasks through the actual stdio transport, not a buyer study.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const artifact = path => new URL(path, root);
if (existsSync(artifact('data/user_value_r47.json'))) throw Error('Preserve the existing round; inspect before starting another');
const record = (record_id, changes = {}) => ({ record_id, entity_id: 'ENTITY-1', supplier_id: 'SUPPLIER-1', currency: 'USD', document_type: 'invoice', document_reference: 'INV-001', document_date: '2026-10-01', outstanding_minor: 10000, ...changes });
const input = (statement_records, ledger_records, save = false) => ({ as_of: '2026-10-26', statement_records, ledger_records, save });
const tasks = [
  { id: 'supplier1', prompt: 'Compare this supplier statement invoice with its AP open item. Preserve both original amounts and dates when the same exact reference disagrees.', args: input([record('S1')], [record('L1', { outstanding_minor: 12000, document_date: '2026-10-02' })]), expected: { review: 1, matched: 0, groups: 1, status: 'discrepancy', issues: ['amount_mismatch', 'date_mismatch'] } },
  { id: 'supplier2', prompt: 'Find which exact invoice references appear only on the supplier statement or only in the AP ledger, retaining every source item.', args: input([record('S1')], [record('L2', { document_reference: 'INV-002' })]), expected: { review: 2, matched: 0, groups: 2, statement_only: 1, ledger_only: 1 } },
  { id: 'supplier3', prompt: 'The supplier statement repeats the same invoice reference twice. Keep all three source items and do not guess which statement row matches the ledger.', args: input([record('S1'), record('S2')], [record('L1')]), expected: { review: 1, matched: 0, groups: 1, status: 'ambiguous_reference', members: ['S1', 'S2', 'L1'] } },
  { id: 'supplier4', prompt: 'Keep invoices, credit notes, currencies and leading-zero references separate even when their displayed amounts are equal.', args: input([record('S1'), record('S2', { document_type: 'credit_note' }), record('S3', { currency: 'EUR' }), record('S4', { document_reference: 'INV-1' })], [record('L1')]), expected: { review: 3, matched: 1, groups: 4 } },
  { id: 'supplier5', prompt: 'Save three checks, keep full free diagnosis and CSV when the fourth cannot be saved, then delete the snapshots and confirm a slot can be reused.', args: input([record('S1')], [record('L1')], true), expected: { saved_limit: 3, refused_save: 4, free_rows: 2, saved_after_cleanup: 0 } },
];
const frozen = { at: new Date().toISOString(), method: 'Expected inputs and outcomes written before this actual stdio run. Not a blind model trial or evidence of customer demand.', tasks };
writeFileSync(artifact('data/r38_supplier_tasks_frozen.json'), JSON.stringify(frozen, null, 2) + '\n', { flag: 'wx' });
const base = join(homedir(), 'mcp-servers-work'); mkdirSync(base, { recursive: true });
const scope = mkdtempSync(join(base, 'r38-supplier-operator-'));
const client = new Client({ name: 'r38-synthetic-operator', version: '1.0.0' });
const evidence = { at: new Date().toISOString(), method: 'MCP SDK Client + StdioClientTransport against actual dist/index.js; fixed structured inputs, synthetic records, isolated local data/config.', calls: [], cases: [], buyer_trials: 0, payments: 0 };
const scenarios = [];
let connected = false;
try {
  const transport = new StdioClientTransport({ command: process.execPath, args: [artifact('servers/supplier-statement-check/dist/index.js').pathname], env: { PATH: process.env.PATH || '', HOME: homedir(), TMPDIR: scope, XDG_DATA_HOME: join(scope, 'data'), XDG_CONFIG_HOME: join(scope, 'config'), MCP_LICENSE_KEY: '' }, stderr: 'pipe' });
  await client.connect(transport); connected = true;
  assert.equal(client.getServerVersion().version, '0.25.0');
  const tools = await client.listTools(); assert.equal(tools.tools.length, 8);
  const call = async (name, args = {}) => {
    const started = performance.now(); const response = await client.callTool({ name, arguments: args });
    assert.notEqual(response.isError, true, 'MCP tool refused ' + name);
    const value = JSON.parse(response.content.find(c => c.type === 'text').text);
    evidence.calls.push({ tool: name, seconds: (performance.now() - started) / 1000, accepted: true });
    return value;
  };
  assert.equal((await call('license_status')).tier, 'free');
  for (const task of tasks) {
    const started = performance.now(), before = evidence.calls.length;
    if (task.id !== 'supplier5') {
      const value = await call('supplier_statement_check', task.args), report = value.report, s = report.summary, e = task.expected;
      assert.equal(value.saved, false); assert.equal(s.review_group_count, e.review); assert.equal(s.matched_group_count, e.matched); assert.equal(s.group_count, e.groups);
      assert.deepEqual(report.statement_records, task.args.statement_records); assert.deepEqual(report.ledger_records, task.args.ledger_records);
      if (e.status) assert.equal(report.groups[0].status, e.status);
      if (e.issues) assert.deepEqual(report.groups[0].issues, e.issues);
      if (e.statement_only) { assert.equal(s.only_in_statement_group_count, e.statement_only); assert.equal(s.only_in_ledger_group_count, e.ledger_only); }
      if (e.members) assert.deepEqual([...report.groups[0].statement_record_ids, ...report.groups[0].ledger_record_ids], e.members);
      const note = `Actual stdio returned ${s.group_count} exact-key groups, ${s.matched_group_count} matching and ${s.review_group_count} requiring review, retaining all ${s.statement_record_count + s.ledger_record_count} original source items. Synthetic fixed arguments, not a model translation or buyer trial.`;
      scenarios.push({ server: 'supplier-statement-check', id: task.id, prompt: task.prompt, score: 3, tool_calls: evidence.calls.length - before, seconds: (performance.now() - started) / 1000, note });
    } else {
      const ids = [];
      for (let i = 0; i < 3; i++) { const saved = await call('supplier_statement_check', task.args); assert.equal(saved.saved, true); ids.push(saved.id); }
      const fourth = await call('supplier_statement_check', task.args); assert.equal(fourth.saved, false); assert.equal(fourth.save_error, 'free_saved_report_cap'); assert.equal(fourth.report.summary.matched_group_count, 1);
      const csv = await call('report_export_csv', { id: fourth.report.retrieval.report_id }); assert.equal(csv.total_rows, 2); assert.equal(csv.returned, 2); assert.equal(csv.next_offset, null); assert.match(csv.csv, /"S1"/); assert.match(csv.csv, /"L1"/);
      assert.equal((await call('report_list')).total, 3);
      for (const id of ids) await call('report_delete', { id });
      const again = await call('supplier_statement_check', task.args); assert.equal(again.saved, true); await call('report_delete', { id: again.id }); assert.equal((await call('report_list')).total, 0);
      scenarios.push({ server: 'supplier-statement-check', id: task.id, prompt: task.prompt, score: 3, tool_calls: evidence.calls.length - before, seconds: (performance.now() - started) / 1000, note: 'Three saves succeeded; fourth retained full free diagnostics and a complete two-row CSV. Deletion freed a slot, the retry saved successfully, and all four owned snapshots were removed. Synthetic operator workflow, not a paid outcome.' });
    }
    evidence.cases.push({ id: task.id, expected: task.expected, passed: true });
  }
  evidence.version = client.getServerVersion(); evidence.tools = tools.tools.map(t => t.name); evidence.status = 'passed';
} finally {
  if (connected) await client.close();
  const handles = spawnSync('/usr/sbin/lsof', ['-t', '+D', scope], { encoding: 'utf8' });
  if (handles.status !== 1 || handles.stdout.trim()) throw Error('Operator scope retained; lsof did not prove zero open handles');
  const bytes = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; };
  appendFileSync(artifact('data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path: scope, bytes: bytes(scope), lsof: 'no open handles', reason: 'Completed isolated R38 synthetic MCP operator workflow' }) + '\n');
  rmSync(scope, { recursive: true });
}
writeFileSync(artifact('data/r38_supplier_task_evidence.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
const round = { server: 'supplier-statement-check', round: 47, at: evidence.at, scenarios, totals: { scenarios: scenarios.length, passed: scenarios.length, avg_seconds: scenarios.reduce((n, s) => n + s.seconds, 0) / scenarios.length }, measurement_kind: 'fixed_structured_operator', method: frozen.method, score_definition: '3 only when every frozen outcome assertion passes through actual MCP stdio; no subjective preference or customer-value inference.', frozen_source: 'data/r38_supplier_tasks_frozen.json', evidence: 'data/r38_supplier_task_evidence.json', bottom_line: 'Five fixed synthetic tasks passed. No model translation, client install timing, buyer, time-saving or revenue inference.' };
writeFileSync(artifact('data/user_value_r47.json'), JSON.stringify(round, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: evidence.status, scenarios: scenarios.length, actual_stdio_calls: evidence.calls.length, version: evidence.version.version, buyers: 0, payments: 0 }));
