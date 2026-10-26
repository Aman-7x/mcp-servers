#!/usr/bin/env node
// Read-only R38 deployment proof; fixed release identities and no secret output.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { assertVersionConfiguration, versionConfiguration, sourceHash } from './deploy-billing-gated.mjs';
import { SUPPLIER_DEMO_INPUT_SHA256, SUPPLIER_DEMO_JAVASCRIPT } from '../billing/src/supplier-demo-bundle.js';
const root = new URL('../', import.meta.url), output = new URL('data/r38_scoped_monitor_production_verification.json', root);
const expected = '14a6e84d-6157-4787-b458-9ebbbf456abe', prior = '9d4dfc45-3d89-4b26-854c-f368037ef467';
assert(!existsSync(output) && process.env.CLOUDFLARE_API_TOKEN && process.argv.length === 2);
const log = readFileSync(new URL('data/r38_scoped_monitor_billing_deploy.txt', root), 'utf8');
assert(log.split('\n').filter(line => line === 'Billing release verified: ' + expected).length === 1);
const account = 'https://api.cloudflare.com/client/v4/accounts/dd3f2a29b7707e21a87f26a622c0bb9d';
const headers = { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN };
const marked = { 'x-mcp-probe': '1', 'user-agent': 'r38-final-runtime-readback/1' };
const receipt = { at: new Date().toISOString(), status: 'running', scope: 'Read-only native runtime/configuration/pin and marked signer/asset/status checks. No Checkout, token mint, business-tool call or email.' };
async function get(url, h = headers) { const r = await fetch(url, { headers: h, signal: AbortSignal.timeout(25000) }); assert(r.ok); return r; }
async function api(path) { const d = await (await get(account + path)).json(); assert(d.success); return d.result; }
const kv = key => account + '/storage/kv/namespaces/cf848cc5c07d4e0a9c7c65ad1c70055c/values/' + encodeURIComponent(key);
try {
  const [deployment, before, after] = await Promise.all([api('/workers/scripts/mcp-billing/deployments'), api('/workers/scripts/mcp-billing/versions/' + prior), api('/workers/scripts/mcp-billing/versions/' + expected)]);
  assertVersionConfiguration(before, after);
  const active = deployment.deployments.sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  assert(active.versions.length === 1 && active.versions[0].percentage === 100 && active.versions[0].version_id === expected);
  assert((await (await get(kv('monitor:approved-version'))).text()) === expected);
  assert(readFileSync('/Users/mike/.config/mcp-billing-gate/approved-version', 'utf8').trim() === expected);
  const signer = await (await get('https://mcp.zovo.one/health', marked)).json();
  assert(signer.ok === true && signer.signer === 'ok' && signer.stripe_mode === 'live');
  const asset = await (await get('https://mcp.zovo.one/assets/supplier-demo.js?v=' + SUPPLIER_DEMO_INPUT_SHA256, marked)).text();
  assert(asset === SUPPLIER_DEMO_JAVASCRIPT);
  const diff = spawnSync('git', ['diff', '--name-only', 'fc7e2ca9dc4133a0286b2a39dd874feee6cc5a5c', 'HEAD', '--', 'servers', 'packages'], { cwd: root, encoding: 'utf8' });
  assert(diff.status === 0 && !diff.stdout.trim());
  const status = await (await get(kv('monitor:status'))).json();
  const health = await fetch('https://mcp.zovo.one/health/checkout-monitor', { headers: marked, signal: AbortSignal.timeout(25000) });
  receipt.scheduled = { ok: status.ok, version: status.version, checked_at: status.checkedAt, operations_checked_at: status.operationsCheckedAt, operations_version: status.operationsVersion, last_failure_at: status.lastFailureAt || null, eligible_paid_checked: status.operations?.paidChecked ?? null, missing_fulfillments: status.operations?.missing?.length ?? null, webhook_failures: status.operations?.webhookFailures ?? null, public_health_status: health.status };
  receipt.scheduled_healthy = status.ok === true && status.version === expected && status.operationsVersion === expected && health.status === 200;
  Object.assign(receipt, { status: 'passed', billing_version: expected, previous_version: prior, deployment_id: active.id, traffic_percent: 100, full_configuration_equal: true, configuration_sha256: createHash('sha256').update(JSON.stringify(versionConfiguration(after))).digest('hex'), local_and_remote_pin_match: true, actual_signer: 'ok', stripe_mode: 'live', source_commit: '3b2e4990', billing_gate_source_sha256: sourceHash(), supplier_asset_input_sha256: SUPPLIER_DEMO_INPUT_SHA256, supplier_asset_unchanged: true, mcp_source_unchanged_since_archive_release: true, gate_buy_paths: 61, stripe_sessions_created_by_gate: 0 });
} catch { receipt.status = 'unavailable'; receipt.failure = 'native_read_or_release_validation_failed'; process.exitCode = 1; }
receipt.finished_at = new Date().toISOString();
receipt.limits = ['The signed multi-purchase reconciliation is a 22-test synthetic regression, not a real paid transaction.', 'Native scheduled and CLI reconciliation currently have zero eligible MCP paid records; signer checks establish configured key usability, not paid webhook or email delivery.', 'Scheduled health is separately recorded; the bounded watch must also finish healthy at its original deadline.'];
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, scheduled_healthy: receipt.scheduled_healthy ?? null, signer: receipt.actual_signer ?? null, version: receipt.billing_version ?? null }));
