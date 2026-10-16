#!/usr/bin/env node
// Bounded read-only R37 end snapshot. Never creates Sessions, calls MCP tools or sends email.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash, createSign } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);
const path = p => join(root, p);
const load = p => JSON.parse(readFileSync(path(p), 'utf8'));
const iso = () => new Date().toISOString();
const hash = p => createHash('sha256').update(readFileSync(path(p))).digest('hex');
const output = 'data/r37_kpi_final.json';
const report = 'intel/R37-kpi-final.md';
const schedulePath = 'data/r37_kpi_final_schedule.json';
function save(p, data) {
  const target = path(p), pending = target + '.pending-' + process.pid;
  writeFileSync(pending, JSON.stringify(data, null, 2) + '\n');
  renameSync(pending, target);
}
function exactHost(s) { try { return new URL(s.success_url).hostname === 'mcp.zovo.one'; } catch { return false; } }
function amounts(rows) {
  const out = {};
  for (const s of rows) {
    assert.ok(Number.isSafeInteger(s.amount_total) && s.amount_total >= 0 && /^[a-z]{3}$/.test(s.currency));
    out[s.currency] = (out[s.currency] || 0) + s.amount_total;
    assert.ok(Number.isSafeInteger(out[s.currency]));
  }
  return out;
}
function classify(rows, start, end) {
  const matching = rows.filter(s => s.created * 1000 >= start && s.created * 1000 <= end && exactHost(s));
  const ordinary = matching.filter(s => s.metadata?.probe !== '1');
  const paid = ordinary.filter(s => s.payment_status === 'paid');
  return { mcp_total_sessions: matching.length, mcp_tagged_probes: matching.length - ordinary.length, mcp_untagged_sessions: ordinary.length, mcp_untagged_paid_sessions: paid.length, mcp_untagged_paid_checkout_gross_minor_by_currency: amounts(paid) };
}
async function stripePage(args) {
  const { stdout } = await run('stripe', args, { cwd: root, timeout: 45000, maxBuffer: 16 * 1024 * 1024 });
  const j = JSON.parse(stdout);
  assert.ok(!j.error && Array.isArray(j.data) && typeof j.has_more === 'boolean');
  return j;
}
async function rolling() {
  const end = Date.now(), start = end - 7 * 86400e3, rows = [], seen = new Set();
  let cursor;
  for (let pages = 1; pages <= 50; pages++) {
    const j = await stripePage(['checkout', 'sessions', 'list', '--live', '--limit', '100', ...(cursor ? ['--starting-after', cursor] : [])]);
    for (const s of j.data) { assert.ok(s.livemode && s.id && !seen.has(s.id)); seen.add(s.id); rows.push(s); }
    const oldest = j.data.at(-1);
    if (!j.has_more || (oldest && oldest.created * 1000 < start)) return {
      status: 'OK', fetched_at: iso(), window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
      method: 'stripe checkout sessions list --live --limit 100; paginate until exhausted or oldest record predates window',
      pages, records_read: rows.length, oldest_record_at: oldest ? new Date(oldest.created * 1000).toISOString() : null,
      entire_window_covered: true, nonzero_account_read_control: rows.length > 0, ...classify(rows, start, end),
      limitations: ['Untagged does not establish a person.', 'Explicit probe=1 Sessions excluded from commercial totals; expected four earlier probes are not hardcoded into results.'],
    };
    assert.ok(oldest); cursor = oldest.id;
  }
  throw Error('pagination_guard');
}
async function completed() {
  const seen = new Set(), counts = { account_completed: 0, account_paid: 0, mcp_completed: 0, mcp_tagged_probes: 0, mcp_untagged_completed: 0, mcp_untagged_paid: 0 };
  const paid = []; let cursor, oldest = null, newest = null;
  for (let pages = 1; pages <= 50; pages++) {
    const j = await stripePage(['get', '/v1/checkout/sessions', '--live', '-d', 'status=complete', '-d', 'limit=100', ...(cursor ? ['-d', 'starting_after=' + cursor] : [])]);
    for (const s of j.data) {
      assert.ok(s.livemode && s.status === 'complete' && s.id && !seen.has(s.id)); seen.add(s.id); counts.account_completed++;
      const at = new Date(s.created * 1000).toISOString(); oldest = !oldest || at < oldest ? at : oldest; newest = !newest || at > newest ? at : newest;
      if (s.payment_status === 'paid') counts.account_paid++;
      if (!exactHost(s)) continue;
      counts.mcp_completed++;
      if (s.metadata?.probe === '1') { counts.mcp_tagged_probes++; continue; }
      counts.mcp_untagged_completed++;
      if (s.payment_status === 'paid') { counts.mcp_untagged_paid++; paid.push(s); }
    }
    if (!j.has_more) return {
      status: 'OK', fetched_at: iso(), method: 'stripe get /v1/checkout/sessions --live -d status=complete -d limit=100; cursor pagination to has_more=false',
      pages, complete_history_of_completed_sessions: true, counts, oldest_account_completed_at: oldest, newest_account_completed_at: newest,
      paid_account_positive_control: counts.account_paid > 0, mcp_untagged_paid_checkout_gross_minor_by_currency: amounts(paid),
      limitations: ['All available completed Checkout Sessions, not every Stripe payment channel.', 'Gross before fees/refunds/disputes/taxes; not net revenue or profit.', 'Other-storefront counts are read controls; unrelated amounts omitted.'],
    };
    assert.ok(j.data.length); cursor = j.data.at(-1).id;
  }
  throw Error('pagination_guard');
}
async function github() {
  const base = 'repos/theluckystrike/mcp-servers';
  const j = await Promise.all(['/traffic/views', '/traffic/clones', '/traffic/popular/referrers', ''].map(async suffix => JSON.parse((await run('gh', ['api', base + suffix], { timeout: 45000, maxBuffer: 2 * 1024 * 1024 })).stdout)));
  const [v, c, referrers, r] = j; assert.ok(Array.isArray(v.views) && v.views.length && Array.isArray(c.clones) && Array.isArray(referrers));
  const days = rows => rows.map(x => ({ date: x.timestamp.slice(0, 10), count: x.count, uniques: x.uniques }));
  return { status: 'OK', fetched_at: iso(), method: 'gh api repos/theluckystrike/mcp-servers/traffic/{views,clones,popular/referrers}; repository GET', window: { start: v.views[0].timestamp.slice(0, 10), end: v.views.at(-1).timestamp.slice(0, 10) }, views: v.count, unique_visitors: v.uniques, views_daily: days(v.views), clones: c.count, clone_unique_clients: c.uniques, clones_daily: days(c.clones), referrers, stars: r.stargazers_count, forks: r.forks_count, nonzero_read_control: v.count > 0 && c.count > 0, limitations: ['Platform-reported clients, not proven people, installs or successful jobs.', 'Rolling dataset can lag; daily unique clients are not additive.'] };
}
async function jsonGet(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const j = await r.json(); assert.ok(r.ok && !j.error); return j;
}
async function searchConsole() {
  const k = JSON.parse(readFileSync('/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json', 'utf8'));
  const b64 = s => Buffer.from(s).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const claim = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300 }));
  const signer = createSign('RSA-SHA256'); signer.update(claim); signer.end();
  const assertion = claim + '.' + signer.sign(k.private_key).toString('base64url');
  const auth = await jsonGet('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  assert.ok(auth.access_token);
  const old = load('data/r37_kpi_baseline.json').search_console;
  const window = { start: old.startDate, end: old.endDate };
  async function one(host) {
    const body = { startDate: window.start, endDate: window.end, dimensions: ['page'], rowLimit: 25000, dataState: 'final', dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: '//' + host + '/' }] }] };
    const j = await jsonGet('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Azovo.one/searchAnalytics/query', { method: 'POST', headers: { Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const rows = j.rows || []; assert.ok(Array.isArray(rows) && rows.length < 25000);
    const exact = rows.filter(r => { try { return new URL(r.keys[0]).hostname === host; } catch { return false; } });
    const out = { host, rows_returned: rows.length, exact_host_page_rows: exact.length, clicks: 0, impressions: 0 };
    for (const r of exact) { assert.ok(Number.isFinite(r.clicks) && r.clicks >= 0 && Number.isFinite(r.impressions) && r.impressions >= 0); out.clicks += r.clicks; out.impressions += r.impressions; }
    return out;
  }
  const [mcp, control] = await Promise.all([one('mcp.zovo.one'), one('zovo.one')]);
  assert.ok(control.impressions > 0);
  return { status: 'OK', fetched_at: iso(), method: 'Read-only service-account OAuth; GSC searchAnalytics/query, finalized page rows, contains-host prefilter then URL.hostname exact check; row cap checked', window, data_state: 'final', mcp, positive_control: control, query_row_limit: 25000, limitations: ['Frozen 29-date prelaunch window; refresh is not current-day or postlaunch search evidence.', 'Search Console excludes some data; page totals are not indexed-page counts.'] };
}
async function resend() {
  assert.ok(process.env.RESEND_API_KEY);
  const j = await jsonGet('https://api.resend.com/domains', { headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY } });
  assert.ok(Array.isArray(j.data)); const d = j.data.find(x => x.name === 'zovo.one'); assert.ok(d);
  return { status: 'OK', fetched_at: iso(), method: 'GET https://api.resend.com/domains; no send or key-management operation', project_domain: { name: d.name, status: d.status, capabilities: d.capabilities || null }, nonzero_read_control: j.data.length > 0, delivery_verified: false, emails_sent: 0, limitations: ['Configuration only, not send acceptance or inbox delivery; exact key scope untested.'] };
}
function grossValue(a) {
  const rows = Object.entries(a.mcp_untagged_paid_checkout_gross_minor_by_currency);
  return rows.length ? rows.map(([c, n]) => c.toUpperCase() + ' ' + n + ' minor units').join('; ') : 0;
}
function updateKpis(a) {
  const k = load('data/kpi.json');
  function set(channel, name, value, unit, how, window, extra = {}) {
    let r = k.kpis.find(x => x.name === name); if (!r) { r = { name, cat: name.startsWith('Google') ? 'Discovery' : 'Monetization', target: null }; k.kpis.push(r); }
    const result = a[channel];
    if (result.status !== 'OK') { r.stale = true; r.stale_reason = 'R37 final channel unavailable; prior observation retained with original date/window.'; return; }
    Object.assign(r, { value, unit, how, measured_at: result.fetched_at, window, stale: false, status: value === null ? 'unmeasured' : value === 0 ? 'zero' : 'measured', source_artifact: output, ...extra }); delete r.stale_reason;
  }
  const s = a.stripe_7d, c = a.stripe_completed, g = a.github, q = a.search_console;
  set('stripe_7d', 'Untagged MCP checkout sessions (7d)', s.mcp_untagged_sessions, 'sessions, 7d', 'Stripe live fully covered seven-day window; exact MCP success_url hostname; tagged probes excluded; untagged is not verified human.', s.window);
  set('stripe_7d', 'Paid MCP checkout sessions (7d)', s.mcp_untagged_paid_sessions, 'paid sessions, 7d', 'Same fully covered Stripe window; payment_status=paid, exact MCP success_url hostname, metadata.probe!=1.', s.window);
  set('stripe_completed', 'Recorded MCP paid Checkout gross (available completed history)', c.status === 'OK' ? grossValue(c) : null, 'paid Checkout gross; available completed history', 'Stripe completed-Session pagination exhausted; shared-account paid count is positive read control. Not all payment channels, net revenue or profit.', { scope: 'All available completed Checkout Sessions at this snapshot' }, { currency_totals_minor: c.mcp_untagged_paid_checkout_gross_minor_by_currency || {} });
  set('github', 'GitHub unique visitors', g.unique_visitors, 'GitHub uniques, rolling source dates', 'GitHub traffic/views API; platform-reported clients, not proven people or successful jobs.', g.window);
  set('search_console', 'Google impressions, storefront', q.mcp?.impressions, 'impressions, 29 frozen dates', 'GSC finalized page rows, exact MCP URL.hostname check, parent-host nonzero positive control; frozen prelaunch window.', q.window);
  set('search_console', 'Google clicks, storefront', q.mcp?.clicks, 'clicks, 29 frozen dates', 'Same finalized GSC exact-host rows and frozen window; no postlaunch outcome claim.', q.window);
  const ratio = k.kpis.find(x => x.name === 'Click to checkout-session ratio');
  if (ratio) Object.assign(ratio, { value: null, status: 'unmeasured', stale: false, measured_at: a.finished_at, source_artifact: output, how: 'Undefined: no verified aligned-window buyer/click denominator. No cross-window or person-level conversion claim.', window: s.status === 'OK' ? s.window : null });
  k.generated_at = iso(); k.audit_source = output; k.audit_sources = { ...k.audit_sources, current: output, initial_r37: 'data/r37_kpi_baseline.json' };
  k.windows = { ...k.windows, ...(s.status === 'OK' ? { stripe: s.window } : {}), ...(g.status === 'OK' ? { github: g.window } : {}), ...(q.status === 'OK' ? { search: q.window } : {}) };
  k.raw = { ...k.raw, r37_final: { source: output, stripe_7d: s, stripe_completed: c, github: g, search_console: q } };
  save('data/kpi.json', k);
}
function markdown(a) {
  const state = key => a[key].status === 'OK' ? 'verified' : 'unavailable; prior KPI row retained stale';
  const c = a.stripe_completed, s = a.stripe_7d, g = a.github, q = a.search_console, r = a.resend;
  return `# R37 final KPI snapshot\n\nRead-only collection started ${a.started_at}, finished ${a.finished_at}. This is an end-of-session KPI snapshot; the four-hour session remains active until its separately monitored deadline. The initial baseline and its windows remain unchanged.\n\n| Channel | Result | Window / qualification |\n| --- | --- | --- |\n| Completed Checkout history | ${c.status === 'OK' ? `${c.counts.mcp_untagged_paid} MCP paid Sessions; ${grossValue(c)} recorded gross; ${c.pages} pages exhausted; ${c.counts.account_paid} shared-account paid read controls` : state('stripe_completed')} | All available completed Checkout Sessions; not every payment channel, net revenue or profit |\n| Rolling Stripe | ${s.status === 'OK' ? `${s.mcp_untagged_sessions} untagged, ${s.mcp_untagged_paid_sessions} paid; ${s.mcp_tagged_probes} tagged probes excluded` : state('stripe_7d')} | ${s.status === 'OK' ? `${s.window.start} through ${s.window.end}; full coverage proven` : 'Window unverified'} |\n| GitHub | ${g.status === 'OK' ? `${g.views} views / ${g.unique_visitors} platform uniques; ${g.clones} clones / ${g.clone_unique_clients} clients; ${g.stars} stars` : state('github')} | ${g.status === 'OK' ? `${g.window.start} through ${g.window.end}` : 'Unavailable'}; not people, installs or successful jobs |\n| Finalized GSC | ${q.status === 'OK' ? `${q.mcp.impressions} MCP impressions / ${q.mcp.clicks} clicks; parent control ${q.positive_control.impressions} / ${q.positive_control.clicks}` : state('search_console')} | ${q.status === 'OK' ? `${q.window.start} through ${q.window.end}` : 'Unavailable'}; frozen 29-date prelaunch period, not current-day performance |\n| Resend | ${r.status === 'OK' ? `zovo.one ${r.project_domain.status}; sending ${r.project_domain.capabilities?.sending || 'unavailable'}` : state('resend')} | Configuration only; zero emails sent; inbox delivery untested |\n\n${a.baseline_unchanged ? 'SHA-256 confirms the initial baseline is unchanged.' : '**Initial baseline preservation check failed; investigate before using this result.**'} API errors remain unavailable instead of becoming zeros. Retained Cloudflare, activation and upgrade-click measurements preserve their earlier timestamps and windows; no broad traffic scan was repeated. No ratio is computed across different windows or unverified populations.\n\nThe next useful commercial observation is qualified buyer discovery followed by a successful workflow and an ordinary Checkout outcome. Existing requests, clones, platform unique clients and documentary recommendations cannot establish willingness to pay or ROI.\n\n[Aggregate evidence](../data/r37_kpi_final.json) contains command/API methods, read timestamps, coverage checks, currency-separated MCP totals and limitations. Credentials and raw customer/session identifiers stayed in memory. No Sessions, payments, accounts, keys, emails or MCP tool calls were created.\n`;
}
async function snapshot() {
  const initialHash = scheduledBaselineHash;
  const a = { schema: 1, sprint: 'R37', scheduled_for: scheduledAt, started_at: iso(), initial_baseline: 'data/r37_kpi_baseline.json', initial_baseline_sha256_at_schedule: initialHash, scope: 'Native read-only CLI/API aggregate snapshot; no live checkout creation, payment, email, account/key changes or MCP tool calls.' };
  const keys = ['stripe_7d', 'stripe_completed', 'github', 'search_console', 'resend'];
  const results = await Promise.allSettled([rolling(), completed(), github(), searchConsole(), resend()]);
  for (let i = 0; i < keys.length; i++) {
    const result = results[i];
    a[keys[i]] = result.status === 'fulfilled' ? result.value : { status: 'UNAVAILABLE', fetched_at: iso(), error_code: result.reason?.message === 'pagination_guard' ? 'pagination_guard' : 'read_or_validation_failed', limitation: 'No zero or current-data claim; previous KPI row remains stale with original provenance.' };
  }
  a.finished_at = iso(); a.baseline_unchanged = initialHash === hash('data/r37_kpi_baseline.json');
  a.status = a.baseline_unchanged && keys.every(key => a[key].status === 'OK') ? 'OK' : 'PARTIAL';
  a.privacy = 'Aggregate-only: no raw session/customer/payment IDs, email addresses, OAuth assertions, credentials, domain IDs or DNS values persisted.';
  save(output, a); writeFileSync(path(report), markdown(a)); updateKpis(a);
  return a;
}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--self-test') {
  const row = (host, probe, amount = 1900) => ({ success_url: 'https://' + host + '/success', created: 100, metadata: probe ? { probe: '1' } : {}, payment_status: 'paid', amount_total: amount, currency: 'usd' });
  const s = classify([row('mcp.zovo.one', false), row('mcp.zovo.one', true), row('mcp.zovo.one.attacker.invalid', false), row('other.zovo.one', false)], 0, 200000);
  assert.equal(s.mcp_total_sessions, 2); assert.equal(s.mcp_tagged_probes, 1); assert.equal(s.mcp_untagged_paid_sessions, 1); assert.equal(s.mcp_untagged_paid_checkout_gross_minor_by_currency.usd, 1900);
  assert.equal(classify([row('mcp.zovo.one', false)], 100001, 200000).mcp_total_sessions, 0);
  assert.throws(() => amounts([row('mcp.zovo.one', false, NaN)]));
  assert.throws(() => amounts([row('mcp.zovo.one', false, -1)]));
  assert.throws(() => amounts([{ ...row('mcp.zovo.one', false), currency: 'invalid' }]));
  assert.equal(grossValue({ mcp_untagged_paid_checkout_gross_minor_by_currency: {} }), 0);
  console.log('Read-only aggregation controls passed: exact hostname, probes, dates, paid amounts and currencies. No network or writes.');
  process.exit(0);
}
if (args.length !== 2 || args[0] !== '--at') throw Error('Usage: r37-final-kpi-refresh.mjs --at <UTC ISO timestamp> | --self-test');
const target = Date.parse(args[1]), scheduledAt = new Date(target).toISOString();
assert.ok(Number.isFinite(target) && target > Date.now() && target < Date.now() + 4 * 3600e3, 'Schedule must be within next four hours');
const scheduledBaselineHash = hash('data/r37_kpi_baseline.json');
const schedule = { schema: 1, status: 'waiting', pid: process.pid, launched_at: iso(), scheduled_for: scheduledAt, initial_baseline_sha256: scheduledBaselineHash, outputs: [output, report, 'data/kpi.json'], purpose: 'One bounded read-only KPI refresh; existing four-hour monitor remains authoritative for session completion.' };
save(schedulePath, schedule); console.log(JSON.stringify(schedule));
while (Date.now() < target) await new Promise(resolve => setTimeout(resolve, Math.min(60000, target - Date.now())));
schedule.status = 'collecting'; schedule.executed_at = iso(); save(schedulePath, schedule);
console.log(JSON.stringify({ status: 'collecting', at: schedule.executed_at }));
try {
  const result = await snapshot(); schedule.status = 'finished'; schedule.result = result.status; schedule.finished_at = iso(); save(schedulePath, schedule);
  console.log(JSON.stringify({ status: schedule.status, result: result.status, started_at: result.started_at, finished_at: result.finished_at, baseline_unchanged: result.baseline_unchanged }));
} catch {
  schedule.status = 'failed'; schedule.error_code = 'local_snapshot_write_or_validation_failed'; schedule.finished_at = iso(); save(schedulePath, schedule); console.error(JSON.stringify(schedule)); process.exitCode = 1;
}
