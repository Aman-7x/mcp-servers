#!/usr/bin/env node
// CI-only Docker check. Synthetic records, no payment or external service.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const client = new Client({ name: 'duplicate-container-check', version: '1' });
const transport = new StdioClientTransport({ command: 'docker', args: ['run', '--rm', '-i', 'mcp-duplicate-invoice-check:ci'], stderr: 'pipe' });
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, `container tool failed: ${name}`);
  return JSON.parse(result.content[0].text);
};
try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 8);
  assert.equal((await call('license_status')).tier, 'free');
  const common = { entity_id: 'buyer', supplier_id: 'supplier', document_type: 'invoice', invoice_date: '2026-10-16', currency: 'USD', total_minor: 1000 };
  const result = await call('duplicate_invoice_check', { records: [
    { ...common, record_id: 'first', invoice_number: 'INV-001' },
    { ...common, record_id: 'second', invoice_number: 'inv / 001', total_minor: 1200 },
  ], save: true });
  assert.equal(result.saved, true);
  assert.equal(result.report.summary.candidate_record_count, 2);
  assert.equal(result.report.groups[0].rule, 'normalized_reference');
  assert.ok(result.report.groups[0].conflicting_fields.includes('total_minor'));
  assert.equal((await call('report_get', { id: result.id })).report.summary.record_count, 2);
  assert.equal((await call('report_export_csv', { id: result.id })).total_rows, 2);
  console.log('PASS: container exposes eight tools, reviews formatting candidates with conflicting totals, saves and retrieves full evidence');
} finally { await client.close(); }
