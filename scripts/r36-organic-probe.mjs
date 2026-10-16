#!/usr/bin/env node
// Read-only GitHub distribution probe. No publish calls, paid API, or file mutation.
// Example: node scripts/r36-organic-probe.mjs > intel/r36-organic-before.json
import { execFileSync } from 'node:child_process';
const query = (q, n = 10) => JSON.parse(execFileSync('gh', [
  'api', '-X', 'GET', 'search/repositories', '-f', `q=${q}`, '-F', `per_page=${n}`,
], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
const control = query('modelcontextprotocol', 3);
if (!control.total_count || !control.items?.length || control.incomplete_results) {
  throw new Error('positive control incomplete or empty; no visibility measurements emitted');
}
const definitions = [
  ['mcp quote estimate proposal', 'theluckystrike/mcp-quotes'],
  ['mcp quote invoice', 'theluckystrike/mcp-quotes'],
  ['mcp quote conversion', 'theluckystrike/mcp-quotes'],
  ['mcp convert quote invoice', 'theluckystrike/mcp-quotes'],
  ['mcp work order field service', 'theluckystrike/mcp-work-order'],
  ['mcp accounts receivable aging', 'theluckystrike/mcp-statement-of-account'],
  ['mcp three way matching', null],
  ['mcp supplier invoice matching', null],
];
const rows = [];
for (const [q, target] of definitions) {
  await new Promise(resolve => setTimeout(resolve, 2200));
  const result = query(q);
  if (result.incomplete_results) throw new Error(`incomplete results for ${q}`);
  const rank = target ? result.items.findIndex(item => item.full_name === target) + 1 : 0;
  rows.push({ query: q, total: result.total_count, target, rank: rank || null,
    top: result.items.map(item => ({ repo: item.full_name, stars: item.stargazers_count,
      description: item.description })) });
}
console.log(JSON.stringify({ measured_at: new Date().toISOString(), top_n: 10,
  positive_control: { query: 'modelcontextprotocol', total: control.total_count,
    first: control.items[0].full_name }, rows }, null, 2));
