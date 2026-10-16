#!/usr/bin/env node
// CI-only Docker runtime check. No payment, external API or production credentials.
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const client = new Client({ name: 'matcher-container-check', version: '1' });
const transport = new StdioClientTransport({ command: 'docker', args: ['run', '--rm', '-i', 'mcp-three-way-match:ci'], stderr: 'pipe' });
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, `container tool failed: ${name}`);
  return JSON.parse(result.content[0].text);
};
try {
  await client.connect(transport);
  assert.equal((await client.listTools()).tools.length, 8);
  assert.equal((await call('license_status')).tier, 'free');
  const lines = [{ sku: 'A', quantity: 10, unit_price_minor: 100 }, { sku: 'B', quantity: 10, unit_price_minor: 100 }];
  const result = await call('three_way_match', {
    po: { reference: 'PO-1', supplier: 'Example', currency: 'USD', lines },
    receipts: [{ reference: 'GR-1', po_reference: 'PO-1', supplier: 'Example', date: '2026-10-16', lines: [{ sku: 'A', accepted_quantity: 5, rejected_quantity: 0 }, { sku: 'B', accepted_quantity: 15, rejected_quantity: 0 }] }],
    invoice: { reference: 'INV-1', po_reference: 'PO-1', supplier: 'Example', currency: 'USD', lines, total_minor: 2000 },
    prior_invoiced: [], save: true,
  });
  assert.equal(result.report.status, 'exceptions');
  assert.ok(result.report.lines.find(x => x.sku === 'A').issue_codes.includes('invoiced_above_accepted'));
  assert.ok(result.report.lines.find(x => x.sku === 'B').issue_codes.includes('accepted_above_order'));
  assert.equal(result.saved, true);
  assert.equal((await call('report_get', { id: result.id })).report.totals.invoice_lines_total_minor, 2000);
  console.log('PASS: container initializes, exposes eight tools, catches offsetting SKU errors and reads saved evidence');
} finally { await client.close(); }
