#!/usr/bin/env node
// Read-only aggregate launch-page measurement. Never exports client IPs or raw UAs.
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
assert.ok(token, 'Cloudflare read credential unavailable');
const args = process.argv.slice(2);
assert.ok(args.length === 0 || (args.length === 2 && args[0] === '--end'), 'Usage: audit-matcher-launch-traffic.mjs [--end <ISO instant>]');
const start = '2026-10-16T01:20:00Z';
const end = args[1] || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
assert.ok(Date.parse(end) > Date.parse(start) && Date.parse(end) <= Date.now(), 'Invalid measurement window');
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function read(url, options = {}) {
  const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
  assert.ok(response.ok, 'Cloudflare read failed HTTP ' + response.status);
  return response.json();
}
const zones = await read('https://api.cloudflare.com/client/v4/zones?name=zovo.one');
assert.ok(zones.success && zones.result?.length === 1, 'Expected one visible zone');
const paths = {
  product: '/s/three-way-match',
  guide: '/guides/match-supplier-invoice-purchase-order-delivery-note-in-claude',
  comparison: '/compare/three-way-match',
  purchase: '/buy/three-way-match',
  downloads: '/downloads',
  monitor_control: '/health/checkout-monitor',
};
const query = `query { viewer { zones(filter: {zoneTag: ${JSON.stringify(zones.result[0].id)}}) { ${Object.entries(paths).map(([name, path]) => `${name}: httpRequestsAdaptiveGroups(limit: 10000, orderBy: [count_DESC], filter: {datetime_geq: ${JSON.stringify(start)}, datetime_leq: ${JSON.stringify(end)}, clientRequestHTTPHost: "mcp.zovo.one", clientRequestPath: ${JSON.stringify(path)}}) { count avg { sampleInterval } dimensions { userAgent edgeResponseStatus clientRefererHost } }`).join('\n')} } } }`;
const response = await read('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', body: JSON.stringify({ query }) });
assert.ok(!response.errors?.length && response.data?.viewer?.zones?.length === 1, 'Cloudflare GraphQL query failed');
const result = response.data.viewer.zones[0];
function uaCategory(ua) {
  if (/^mcp-r36|^mcp-billing|billing-release-gate|checkout-monitor/i.test(ua)) return 'named_operator_or_monitor';
  if (/bot|crawler|spider|ChatGPT|Claude|Perplexity|OAI-|Google-Inspection/i.test(ua)) return 'declared_crawler_or_assistant';
  if (/Mozilla|Chrome|Safari|Firefox|Edg\//i.test(ua)) return 'browser_style_including_operator_QA';
  return 'script_or_other';
}
function refCategory(host) {
  if (!host) return 'none';
  if (host === 'mcp.zovo.one') return 'storefront';
  if (/^(?:[^.]+\.)?(?:mcpservers\.org|glama\.ai|smithery\.ai|pulsemcp\.com|mcpi\.app|mcp\.so|registry\.modelcontextprotocol\.io)$/.test(host)) return 'registry_ecosystem';
  if (/(?:^|\.)(?:google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(host)) return 'search_engine';
  return 'other';
}
const rows = [];
for (const [name, path] of Object.entries(paths)) {
  const groups = result[name];
  assert.ok(Array.isArray(groups) && groups.length < 10000, 'Missing or saturated path grouping');
  const row = { name, path, groups_returned: groups.length, adaptive_request_count: 0, by_ua_category: {}, by_http_status: {}, by_referrer_category: {} };
  for (const group of groups) {
    assert.ok(Number.isFinite(group.count) && group.count >= 0, 'Invalid request count');
    row.adaptive_request_count += group.count;
    for (const [field, key] of [['by_ua_category', uaCategory(group.dimensions.userAgent || '')], ['by_http_status', String(group.dimensions.edgeResponseStatus)], ['by_referrer_category', refCategory(group.dimensions.clientRefererHost || '')]]) row[field][key] = (row[field][key] || 0) + group.count;
  }
  rows.push(row);
}
assert.ok(rows.find(r => r.name === 'monitor_control').adaptive_request_count > 0, 'Nonzero request-log control missing');
const report = { fetched_at: new Date().toISOString(), status: 'OK', host: 'mcp.zovo.one', window: { start, end }, method: 'Read-only Cloudflare adaptive groups, exact path/host/time filters; all six groupings below 10000-row cap', rows, query, limitations: ['Adaptive estimates may lag current time and include operator/automation requests.', 'Browser-style UA includes our known real Chrome QA; headers identifying probes are unavailable in this dataset.', 'Referrer categories do not identify people or prove interest, installs, tool success or willingness to pay.', 'Downloads is a shared catalog page; the monitor route is a positive logging control, not demand.', 'Window begins after first product deployment; zero rows are not proof of zero people.'], privacy: 'No client IPs, raw user agents, complete referrer hosts, tenant/session tokens or credentials exported.' };
writeFileSync(new URL('../data/r36_launch_traffic.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, window: report.window, rows }));
