#!/usr/bin/env node
// Read-only release evidence. Never creates Checkout, tokens, business calls or mail.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { assertVersionConfiguration, versionConfiguration, sourceHash } from './deploy-billing-gated.mjs';
import { SUPPLIER_DEMO_INPUT_SHA256, SUPPLIER_DEMO_JAVASCRIPT } from '../billing/src/supplier-demo-bundle.js';
const root = new URL('../', import.meta.url), output = new URL('data/r38_supplier_csv_production_verification.json', root);
assert(!existsSync(output), 'Preserve existing release proof');
const expected = '9d4dfc45-3d89-4b26-854c-f368037ef467', prior = '718485e7-1d17-43f8-aaa4-3c638177be35';
const account = 'https://api.cloudflare.com/client/v4/accounts/dd3f2a29b7707e21a87f26a622c0bb9d';
const auth = { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN };
assert(process.env.CLOUDFLARE_API_TOKEN && process.argv.length === 2);
const receipt = { at: new Date().toISOString(), status: 'running', read_retries: [], scope: 'Native configuration/pin checks and marked public GETs after the supported deployment. No payment, token mint, business tool or email.' };
async function get(url, headers, label) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { const r = await fetch(url, { headers, signal: AbortSignal.timeout(25000) }); assert(r.ok, 'http_' + r.status); return r; }
    catch (e) { receipt.read_retries.push({ step: label, attempt, code: /^http_[0-9]+$/.test(e.message) ? e.message : 'network_or_read_failure' }); if (attempt === 3) throw Error('read_unavailable_' + label); await delay(1000); }
  }
}
async function api(path, label) { const d = await (await get(account + path, auth, label)).json(); assert(d.success === true); return d.result; }
const kv = key => account + '/storage/kv/namespaces/cf848cc5c07d4e0a9c7c65ad1c70055c/values/' + encodeURIComponent(key);
try {
  const [deployments, before, after] = await Promise.all([api('/workers/scripts/mcp-billing/deployments', 'deployment'), api('/workers/scripts/mcp-billing/versions/' + prior, 'prior_configuration'), api('/workers/scripts/mcp-billing/versions/' + expected, 'current_configuration')]);
  assertVersionConfiguration(before, after);
  const d = deployments.deployments.sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  assert(d.versions.length === 1 && d.versions[0].version_id === expected && d.versions[0].percentage === 100);
  assert((await (await get(kv('monitor:approved-version'), auth, 'approved_pin')).text()) === expected);
  assert(readFileSync('/Users/mike/.config/mcp-billing-gate/approved-version', 'utf8').trim() === expected);
  const headers = { 'x-mcp-probe': '1', 'user-agent': 'r38-csv-release-readback/1' };
  const paths = ['/downloads', '/guides/compare-supplier-statement-ap-open-items-in-claude', '/changelog', '/sitemap.xml', '/assets/supplier-demo.js?v=' + SUPPLIER_DEMO_INPUT_SHA256];
  receipt.rows = await Promise.all(paths.map(async path => {
    const r = await get('https://mcp.zovo.one' + path, headers, 'public_content'), body = await r.text();
    if (path !== '/sitemap.xml') assert(r.headers.get('last-modified') === 'Mon, 26 Oct 2026 00:00:00 GMT');
    if (path === '/downloads') assert(body.includes('rel="canonical" href="https://mcp.zovo.one/downloads"'));
    if (path === '/changelog') assert(body.includes('Current version v0.25.0'));
    if (path.startsWith('/assets/')) assert(body === SUPPLIER_DEMO_JAVASCRIPT);
    if (path === '/sitemap.xml') assert(body.includes('<lastmod>2026-10-26</lastmod>'));
    return { path, status: r.status, bytes: Buffer.byteLength(body), sha256: createHash('sha256').update(body).digest('hex'), last_modified: r.headers.get('last-modified'), etag: r.headers.get('etag'), cache_control: r.headers.get('cache-control') };
  }));
  const diff = spawnSync('git', ['diff', '--name-only', 'fc7e2ca9dc4133a0286b2a39dd874feee6cc5a5c', 'HEAD', '--', 'servers', 'packages'], { cwd: root, encoding: 'utf8' });
  assert(diff.status === 0 && !diff.stdout.trim(), 'MCP source changed from immutable archive release');
  const monitor = await (await get(kv('monitor:status'), auth, 'scheduled_monitor')).json();
  receipt.monitor = { ok: monitor.ok, version: monitor.version, checked_at: monitor.checkedAt, last_failure_at: monitor.lastFailureAt || null, operations_checked_at: monitor.operationsCheckedAt, operations_version: monitor.operationsVersion, webhook_failures: monitor.operations?.webhookFailures ?? null, missing_fulfillments: monitor.operations?.missing?.length ?? null };
  const health = await fetch('https://mcp.zovo.one/health/checkout-monitor', { headers, signal: AbortSignal.timeout(25000) });
  receipt.public_health_status = health.status;
  receipt.monitor_healthy = monitor.ok === true && monitor.version === expected && health.status === 200;
  Object.assign(receipt, { status: 'passed', billing_version: expected, prior_version: prior, deployment_id: d.id, local_and_remote_pins_match: true, full_version_configuration_equal: true, configuration_sha256: createHash('sha256').update(JSON.stringify(versionConfiguration(after))).digest('hex'), cpu_limit: 400, release_source_commit: 'e290ce3cfec0cf7c9f44e9273485473d0fea2da6', billing_gate_source_sha256: sourceHash(), supplier_asset_input_sha256: SUPPLIER_DEMO_INPUT_SHA256, core_and_archives_unchanged_from_release: true, buy_get_paths: 61, stripe_sessions_created_by_gate: 0 });
} catch (error) { receipt.status = 'unavailable'; receipt.failure = /^read_unavailable_[a-z_]+$/.test(error.message) ? error.message : 'release_validation_failed'; process.exitCode = 1; }
receipt.finished_at = new Date().toISOString();
receipt.limits = ['Code/configuration proof and current monitor health are separate fields. The original bounded watch must establish final healthy observation.', 'The native signed entitlement sequence was executed against the preceding billing version; its modules and all MCP package source are unchanged by this site follow-up.', 'Synthetic browser/operator controls do not establish buyers, paid fulfillment or ROI.'];
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, monitor_healthy: receipt.monitor_healthy ?? null, public_health: receipt.public_health_status ?? null, retry_count: receipt.read_retries.length, failure: receipt.failure || null }));
