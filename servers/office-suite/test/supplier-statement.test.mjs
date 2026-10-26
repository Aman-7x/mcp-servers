import './_tmp-scope.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from './_tmp-scope.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('office proxy preserves supplier open-item evidence and exposes correct report navigation', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'office-supplier-statements-'));
  const client = new Client({ name: 'office-supplier-statement-integration', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [fileURLToPath(new URL('../dist/index.js', import.meta.url))], stderr: 'pipe',
    env: { ...process.env, XDG_DATA_HOME: join(dir, 'data'), XDG_CONFIG_HOME: join(dir, 'config'), MCP_LICENSE_KEY: '' } });
  let stderr = '';
  transport.stderr.on('data', data => { stderr += data.toString(); });
  try {
    await client.connect(transport);
    assert.equal(client.getServerVersion().version, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
    const tools = (await client.listTools()).tools.map(t => t.name);
    assert(tools.includes('supplier_statement_check'));
    assert(tools.includes('supplier-statement-check_report_get'));
    assert(tools.includes('duplicate-invoice-check_report_get'));
    const call = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      assert(!result.isError, result.content?.[0]?.text);
      return { result, value: JSON.parse(result.content[0].text) };
    };
    const common = { entity_id: 'E', supplier_id: 'S', currency: 'USD', document_type: 'invoice', document_reference: 'report_get', document_date: '2026-10-01', outstanding_minor: 10000 };
    const input = { as_of: '2026-10-26', statement_records: [{ ...common, record_id: 'S1' }], ledger_records: [{ ...common, record_id: 'L1', outstanding_minor: 12000 }], save: true };
    const { value: saved, result } = await call('supplier_statement_check', input);
    assert(saved.saved); assert.equal(saved.report.summary.discrepancy_group_count, 1);
    assert.equal(saved.report.statement_records[0].document_reference, 'report_get');
    assert.equal(saved.report.groups[0].key.document_reference, 'report_get');
    assert.equal(saved.report.retrieval.page_tool, 'supplier-statement-check_report_page');
    assert.equal(saved.report.retrieval.export_tool, 'supplier-statement-check_report_export_csv');
    assert.equal(result._meta['office-suite/tool-names'].report_get, 'supplier-statement-check_report_get');
    const fetched = (await call('supplier-statement-check_report_get', { id: saved.id })).value;
    assert.equal(fetched.report.statement_records[0].document_reference, 'report_get');
    assert.equal(fetched.report.retrieval.page_tool, 'supplier-statement-check_report_page');
    const csv = (await call('supplier-statement-check_report_export_csv', { id: saved.id })).value;
    assert.equal(csv.total_rows, 2); assert.match(csv.csv, /"report_get"/);
    assert(!csv.csv.includes('supplier-statement-check_report_get'));
    const page = (await call('supplier-statement-check_report_page', { id: saved.id, section: 'statement_records', limit: 1 })).value;
    assert.equal(page.rows[0].document_reference, 'report_get');
    await call('supplier_statement_check', input); await call('supplier_statement_check', input);
    const capped = (await call('supplier_statement_check', input)).value;
    assert.equal(capped.saved, false); assert.equal(capped.save_error, 'free_saved_report_cap');
    assert.equal(capped.report.summary.discrepancy_group_count, 1);
    assert.equal(capped.payment.product, 'supplier-statement-check');
    assert(!/failed to (connect|start)|optional child .*not found, skipping/.test(stderr), stderr);
  } finally {
    await client.close();
    const deadline = Date.now() + 5000;
    while (existsSync(dir)) {
      const open = spawnSync(process.platform === 'darwin' ? '/usr/sbin/lsof' : 'lsof', ['-t', '+D', dir], { encoding: 'utf8' });
      if (open.status === 1 && !open.stdout.trim()) removeTree(dir);
      else if (open.error || open.status !== 0) throw Error('Cannot prove fixture has no open handles');
      if (existsSync(dir)) { assert(Date.now() < deadline, 'Fixture retained with open child handles'); await delay(100); }
    }
  }
});
