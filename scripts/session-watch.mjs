#!/usr/bin/env node
// Bounded, read-only production observation for the requested four-hour session.
// No tools/call, checkout creation, email, paid API, or synthetic browser traffic.
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const run = promisify(execFile);
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--session' || !/^r[0-9]+(?:-[a-z0-9]+)*$/.test(args[1]) || args[2] !== '--deadline') throw Error('Usage: session-watch.mjs --session <rN> --deadline <ISO UTC>');
const session = args[1];
const file = join(root, `data/${session}_watch.json`);
try { readFileSync(file); throw Error('Observation output already exists; inspect its original terminal handle before starting anything'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const deadline = Date.parse(args[3]);
if (!Number.isFinite(deadline) || deadline <= Date.now() || deadline > Date.now() + 4 * 3600e3) throw Error('Deadline must be within the next four hours');
if (!process.env.CLOUDFLARE_API_TOKEN) throw Error('Cloudflare read access unavailable');
const base = 'https://api.cloudflare.com/client/v4/accounts/dd3f2a29b7707e21a87f26a622c0bb9d';
const kv = `${base}/storage/kv/namespaces/cf848cc5c07d4e0a9c7c65ad1c70055c/values/`;
const headers = { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` };
const state = { schema: 1, session, pid: process.pid, status: 'running', started_at: new Date().toISOString(), deadline_at: new Date(deadline).toISOString(), interval_seconds: 300, purpose: 'Verify release/pin/cron recovery and observe storefront-scoped payments without generating demand', snapshots: [] };
function save() {
  const pending = file + '.pending';
  writeFileSync(pending, JSON.stringify(state, null, 2) + '\n'); renameSync(pending, file);
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw Error(`read failed HTTP ${response.status}`);
  return response;
}
async function deployment() {
  const data = await (await request(`${base}/workers/scripts/mcp-billing/deployments`, { headers })).json();
  if (!data.success || !Array.isArray(data.result?.deployments)) throw Error('invalid deployments response');
  const current = [...data.result.deployments].sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
  if (current?.versions?.length !== 1 || current.versions[0].percentage !== 100) throw Error('deployment is not one sole version');
  return current.versions[0].version_id;
}
async function monitor() {
  const data = await (await request(kv + 'monitor:status', { headers })).json();
  return { ok: data.ok, version: data.version, checked_at: data.checkedAt, operations_checked_at: data.operationsCheckedAt, last_failure_at: data.lastFailureAt || null, operations_version: data.operationsVersion, webhook_failures: data.operations?.webhookFailures ?? null, missing_fulfillments: data.operations?.missing?.length ?? null };
}
async function stripe() {
  const { stdout } = await run('stripe', ['checkout', 'sessions', 'list', '--live', '--limit', '100'], { cwd: root, timeout: 45_000, maxBuffer: 8 * 1024 * 1024 });
  const data = JSON.parse(stdout);
  if (!Array.isArray(data.data) || typeof data.has_more !== 'boolean') throw Error('invalid Stripe list');
  const now = Date.now(), since = now / 1000 - 7 * 86400;
  const covered = !data.has_more || (data.data.length && data.data.at(-1).created < since);
  if (!covered) return { covered_7d: false, sessions_7d: null, paid_7d: null, gross_paid_minor_by_currency: null };
  const rows = data.data.filter(s => s.created >= since && s.created <= now / 1000 && String(s.success_url || '').startsWith('https://mcp.zovo.one/') && s.metadata?.probe !== '1');
  const paid = rows.filter(s => s.payment_status === 'paid');
  const amounts = {};
  for (const row of paid) { if (!Number.isSafeInteger(row.amount_total) || !row.currency) throw Error('invalid paid amount'); amounts[row.currency] = (amounts[row.currency] || 0) + row.amount_total; }
  return { covered_7d: true, window: { start: new Date(since * 1000).toISOString(), end: new Date(now).toISOString() }, sessions_7d: rows.length, paid_7d: paid.length, gross_paid_minor_by_currency: amounts, note: 'Untagged sessions are not verified people. Gross checkout amount, not lifetime or net revenue.' };
}
async function tick() {
  const jobs = [deployment(), request(kv + 'monitor:approved-version', { headers }).then(r => r.text()), monitor(), fetch('https://mcp.zovo.one/health/checkout-monitor', { headers: { 'user-agent': `mcp-${session}-watch/1`, 'x-mcp-probe': '1' }, signal: AbortSignal.timeout(20_000) }).then(r => r.status), stripe()];
  const labels = ['deployed_version', 'approved_version', 'cron', 'public_health_status', 'stripe'];
  const results = await Promise.allSettled(jobs);
  const sample = { at: new Date().toISOString(), errors: [] };
  results.forEach((result, i) => { if (result.status === 'fulfilled') sample[labels[i]] = result.value; else sample.errors.push(`${labels[i]} unavailable (${result.reason?.message || 'read error'})`); });
  sample.pin_matches = sample.deployed_version && sample.approved_version ? sample.deployed_version === sample.approved_version.trim() : null;
  if (sample.cron?.last_failure_at && sample.cron.ok && sample.public_health_status === 503 && Date.now() - Date.parse(sample.cron.last_failure_at) < 40 * 60e3) sample.health_note = 'Cron passed; public health is in its existing forty-minute recovery cooldown';
  state.snapshots.push(sample); state.last_observed_at = sample.at; save();
  // Dashboard generation is local; a failure is recorded without hiding observations.
  try { await run(process.execPath, [join(root, 'scripts/render-main.mjs')], { cwd: root, timeout: 30_000, maxBuffer: 1024 * 1024 }); }
  catch { state.dashboard_error = 'dashboard regeneration failed'; save(); }
  console.log(JSON.stringify({ at: sample.at, observations: state.snapshots.length, pin_matches: sample.pin_matches, cron_ok: sample.cron?.ok ?? null, public_health: sample.public_health_status ?? null, paid_7d: sample.stripe?.paid_7d ?? null, read_errors: sample.errors.length }));
}
save();
await tick();
while (Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, Math.min(300_000, deadline - Date.now())));
  await tick();
}
state.status = 'finished'; state.finished_at = new Date().toISOString();
const last = state.snapshots.at(-1);
state.final_checks_pass = last.pin_matches === true && last.cron?.ok === true && last.public_health_status === 200 && last.errors.length === 0 && last.stripe?.covered_7d === true;
save();
await run(process.execPath, [join(root, 'scripts/render-main.mjs')], { cwd: root, timeout: 30_000 }).catch(() => {});
spawn('/usr/bin/afplay', ['/System/Library/Sounds/Glass.aiff'], { stdio: 'ignore' }).on('error', () => {});
console.log(`Observation loop finished; final_checks_pass=${state.final_checks_pass}`);
