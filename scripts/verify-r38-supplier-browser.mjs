#!/usr/bin/env node
// Actual storefront code on loopback or an explicitly chosen public origin.
// Live mode allows only marked GETs to the guide/assets, never checkout or MCP calls.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, lstatSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import worker from '../billing/src/index.js';
import { SUPPLIER_DEMO_INPUT_SHA256, SUPPLIER_DEMO_JAVASCRIPT } from '../billing/src/supplier-demo-bundle.js';
import { runSupplierCsvBrowserCases } from './r38-supplier-csv-browser-cases.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--origin' || !['https://mcp.zovo.one', 'https://mcp.zovo.one/'].includes(args[1]))) throw Error('Usage: verify-r38-supplier-browser.mjs [--origin https://mcp.zovo.one]');
const live = args.length > 0;
const guide = '/guides/compare-supplier-statement-ap-open-items-in-claude';
const receiptPath = live ? 'data/r38_supplier_csv_browser_live_verification.json' : 'data/r38_supplier_csv_browser_verification.json';
const imagePrefix = live ? 'intel/R38-supplier-csv-live' : 'intel/R38-supplier-csv';
const gifPath = live ? 'intel/R38-supplier-csv-live-demo.gif' : 'assets/demo-supplier-statement-check.gif';
const disk = execFileSync('df', ['-g', '/System/Volumes/Data'], { encoding: 'utf8' });
const available = Number(disk.trim().split('\n').at(-1).split(/\s+/)[3]);
assert(available >= 20, 'Need at least20GB per user disk safety before Chrome; run coldstore procedure first');
execFileSync(process.execPath, ['scripts/build-supplier-demo.mjs', '--check'], { cwd: root });
const base = join(homedir(), 'mcp-servers-work'); mkdirSync(base, { recursive: true });
const scope = mkdtempSync(join(base, 'r38-supplier-browser-'));
const frames = join(scope, 'frames'); mkdirSync(frames);
const evidence = { at: new Date().toISOString(), status: 'running', mode: live ? 'live_read_only' : 'local', source: live ? 'Actual public guide and generated JavaScript; marked read-only GETs in Chrome; exact deployed asset bytes checked against current source' : 'Actual billing Worker.fetch on loopback; Chrome; generated engine/UI hash verified before launch', core_ui_sha256: SUPPLIER_DEMO_INPUT_SHA256, synthetic_inputs: true, disk_available_gb: available, checks: [], frames: [], page_errors: [], blocked_external_requests: [], blocked_route_requests: [], diagnostic_requests: [], initial_local_requests: [], production_requests: 0, checkout_sessions_created: 0, emails_sent: 0 };
const recordCheck = (name, detail) => evidence.checks.push({ name, detail });
let context;
const server = createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request('https://mcp.zovo.one' + req.url, { headers: { 'x-mcp-probe': '1', 'user-agent': 'r38-local-browser-qa/1' } }), {}, { waitUntil() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('local worker error'); }
});
if (!live) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = live ? 'https://mcp.zovo.one' : `http://127.0.0.1:${server.address().port}`;
evidence.origin = origin;
const csvRows = csv => JSON.parse(execFileSync('python3', ['-c', 'import csv,io,json,sys; print(json.dumps(list(csv.DictReader(io.StringIO(sys.stdin.read())))))'], { input: csv, encoding: 'utf8' }));
const size = path => { const s = lstatSync(path); return s.isDirectory() ? readdirSync(path).reduce((n, name) => n + size(join(path, name)), 0) : s.size; };
try {
  context = await chromium.launchPersistentContext(join(scope, 'profile'), { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, acceptDownloads: true, downloadsPath: join(scope, 'downloads'), viewport: { width: 1000, height: 820 }, extraHTTPHeaders: { 'x-mcp-probe': '1' }, args: ['--disable-background-networking', '--disk-cache-size=1'] });
  await context.route('**/*', route => {
    const request = route.request(), url = request.url();
    if (url.startsWith('blob:')) return route.continue();
    if (url.startsWith(origin + '/')) {
      const path = new URL(url).pathname;
      if (request.method() !== 'GET' || ![guide, '/assets/supplier-demo.js', '/favicon.ico'].includes(path)) {
        evidence.blocked_route_requests.push({ method: request.method(), path }); return route.abort();
      }
      assert.equal(request.headers()['x-mcp-probe'], '1');
      if (live) evidence.production_requests++;
      return route.continue();
    }
    evidence.blocked_external_requests.push(url); return route.abort();
  });
  await context.addInitScript(() => {
    window.__qaStorageWrites = 0;
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function (...args) { window.__qaStorageWrites++; return write.apply(this, args); };
  });
  const page = context.pages()[0]; page.on('pageerror', error => evidence.page_errors.push(error.message));
  page.on('request', request => {
    if (['fetch', 'xhr', 'websocket', 'eventsource', 'ping'].includes(request.resourceType())) evidence.diagnostic_requests.push({ type: request.resourceType(), url: request.url() });
    else evidence.initial_local_requests.push({ type: request.resourceType(), path: new URL(request.url()).pathname });
  });
  const assetPromise = page.waitForResponse(response => response.url().startsWith(origin + '/assets/supplier-demo.js?'));
  const response = await page.goto(origin + guide); assert.equal(response.status(), 200);
  const originalGuideHtml = await response.text();
  const asset = await assetPromise; assert.equal(asset.status(), 200);
  assert.equal((await asset.body()).toString('utf8'), SUPPLIER_DEMO_JAVASCRIPT, 'Guide must load the exact freshly generated engine/UI bytes');
  assert.equal(await page.locator('script[src^="/assets/supplier-demo.js"]').getAttribute('src'), '/assets/supplier-demo.js?v=' + SUPPLIER_DEMO_INPUT_SHA256);
  await page.locator('#supplier-demo-summary').filter({ hasText: '5 statement records; 4 AP ledger records' }).waitFor();
  const getReport = async () => JSON.parse(await page.locator('#supplier-demo-output').textContent());
  const workedInput = JSON.parse(await page.locator('#supplier-demo-input').inputValue());
  const report = await getReport();
  assert.equal(report.summary.group_count, 5); assert.equal(report.summary.matched_group_count, 1); assert.equal(report.summary.review_group_count, 4);
  assert.deepEqual(['only_in_statement_group_count', 'only_in_ledger_group_count', 'discrepancy_group_count', 'ambiguous_group_count'].map(k => report.summary[k]), [1, 1, 1, 1]);
  assert.equal(report.summary.amount_mismatch_group_count, 1); assert.equal(report.summary.date_mismatch_group_count, 1);
  assert.deepEqual(report.statement_records, workedInput.statement_records); assert.deepEqual(report.ledger_records, workedInput.ledger_records);
  recordCheck('Actual worked comparison', '9 original records,5groups,1matched,4review; every original field retained, amount and date issues both present');
  await page.locator('#supplier-demo-input').evaluate(el => { el.scrollTop = el.scrollHeight; });
  assert(await page.locator('#supplier-demo-input').evaluate(el => el.scrollTop > 0));
  await page.selectOption('#supplier-demo-preset', 'agreement');
  assert.equal(await page.locator('#supplier-demo-input').evaluate(el => el.scrollTop), 0);
  await page.selectOption('#supplier-demo-preset', 'worked');
  assert.equal(await page.locator('#supplier-demo-input').evaluate(el => el.scrollTop), 0);
  recordCheck('Preset editor position', 'A scrolled editor returns to the start of each newly selected preset');
  let frameIndex = 0;
  const capture = async (label, selector) => {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(frames, `${String(frameIndex++).padStart(2, '0')}.png`) });
    evidence.frames.push({ label, summary: await page.locator('#supplier-demo-summary').innerText(), status: await page.locator('#supplier-demo-status').innerText() });
  };
  await capture('Editable synthetic exports', '#supplier-demo-input');
  await capture('Actual differences and repeated-reference evidence', '#supplier-demo-summary');
  await page.screenshot({ path: join(root, imagePrefix + '-desktop.png') });
  let downloadPromise = page.waitForEvent('download'); await page.locator('#supplier-demo-csv').click();
  let download = await downloadPromise; let csv = readFileSync(await download.path(), 'utf8'); let rows = csvRows(csv);
  assert.equal(rows.length, 9); assert.equal(new Set(rows.map(r => r.side + ':' + r.record_id)).size, 9);
  for (const [side, source] of [['statement', workedInput.statement_records], ['ledger', workedInput.ledger_records]]) {
    for (const sourceRow of source) { const actual = rows.find(r => r.side === side && r.record_id === sourceRow.record_id); assert(actual); for (const [key, value] of Object.entries(sourceRow)) assert.equal(actual[key], String(value)); }
  }
  recordCheck('Actual complete CSV download', 'Downloaded9rows, one per source-side item; original source values match independent Pythoncsv parsing');
  for (const [preset, matched, review] of [['agreement', 1, 0], ['zeros', 0, 2], ['credit', 0, 2], ['ambiguous', 0, 1]]) {
    await page.selectOption('#supplier-demo-preset', preset); const actual = await getReport();
    assert.equal(actual.summary.matched_group_count, matched); assert.equal(actual.summary.review_group_count, review);
    if (preset === 'credit') await capture('Credit notes remain separate from invoices', '#supplier-demo-summary');
    if (preset === 'zeros') await capture('Leading zeros remain significant', '#supplier-demo-summary');
    if (preset === 'ambiguous') await capture('Repeated reference remains ambiguous', '#supplier-demo-summary');
  }
  recordCheck('All preset boundaries', 'Agreement1matched; leading-zero and credit/type cases2unmatched; repeated-reference case1ambiguous, no guessed pairing');
  await page.locator('#supplier-demo-input').fill('{');
  assert.equal(await page.locator('#supplier-demo-output').textContent(), ''); assert.equal(await page.locator('#supplier-demo-groups li').count(), 0); assert(await page.locator('#supplier-demo-csv').isDisabled());
  await page.locator('#supplier-demo-form button[type=submit]').click(); assert.match(await page.locator('#supplier-demo-status').innerText(), /Invalid input/); assert.equal(await page.locator('#supplier-demo-output').textContent(), '');
  const saveInput = { ...workedInput, save: true };
  await page.locator('#supplier-demo-input').fill(JSON.stringify(saveInput)); await page.locator('#supplier-demo-form button[type=submit]').click(); assert.match(await page.locator('#supplier-demo-status').innerText(), /never saves reports/);
  recordCheck('Stale evidence and save refusal', 'Any edit immediately clears report/groups and disables CSV; invalid JSON and save:true retain no prior evidence');
  const hostile = structuredClone(workedInput); hostile.statement_records[0].document_reference = '=SUM(1,2)'; hostile.statement_records[1].document_reference = '<img src=x onerror="window.__injected=1">'; hostile.statement_records[2].document_reference = 'quote,"value';
  await page.locator('#supplier-demo-input').fill(JSON.stringify(hostile)); await page.locator('#supplier-demo-form button[type=submit]').click();
  assert.equal(await page.locator('#supplier-demo-groups img').count(), 0); assert.equal(await page.evaluate(() => window.__injected), undefined);
  assert((await page.locator('#supplier-demo-groups').innerText()).includes('<img src=x onerror="window.__injected=1">'));
  downloadPromise = page.waitForEvent('download'); await page.locator('#supplier-demo-csv').click(); download = await downloadPromise; csv = readFileSync(await download.path(), 'utf8'); rows = csvRows(csv);
  assert.equal(rows.find(r => r.side === 'statement' && r.record_id === 'S1').document_reference, "'=SUM(1,2)");
  assert.equal(rows.find(r => r.side === 'statement' && r.record_id === 'S2').document_reference, hostile.statement_records[1].document_reference);
  assert.equal(rows.find(r => r.side === 'statement' && r.record_id === 'S3').document_reference, 'quote,"value');
  recordCheck('DOM and CSV hostile strings', 'HTML-like references render as text; no img/onerror execution; formula escaped and comma/quote reference byte-preserved in actual CSV');
  await page.locator('#supplier-demo-input').fill('x'.repeat(2 * 1024 * 1024 + 1)); await page.locator('#supplier-demo-form button[type=submit]').click(); assert.match(await page.locator('#supplier-demo-status').innerText(), /at most 2 MiB/); assert(await page.locator('#supplier-demo-csv').isDisabled()); assert.equal(await page.locator('#supplier-demo-output').textContent(), '');
  recordCheck('Bounded browser input', 'Over2MiB rejected before JSON parsing; no report or export retained');
  evidence.csv_iteration = await runSupplierCsvBrowserCases({ page, context, origin, guide, originalGuideHtml, workedInput, root, frames, evidence, recordCheck, csvRows });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal guide overflow at ' + width);
    await page.locator('#supplier-demo').screenshot({ path: join(root, `${imagePrefix}-mobile-${width}.png`) });
  }
  recordCheck('Responsive guide layout', '390px and320px guide/body stay within viewport');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0); assert.equal(await page.evaluate(() => window.__qaStorageWrites), 0);
  assert.deepEqual(evidence.diagnostic_requests, []); assert.deepEqual(evidence.page_errors, []);
  const edgeChallenge = '/cdn-cgi/challenge-platform/scripts/jsd/main.js';
  assert(evidence.blocked_route_requests.every(row => live && row.method === 'GET' && row.path === edgeChallenge), 'Unexpected same-origin request beyond the separately blocked Cloudflare infrastructure script');
  evidence.infrastructure_requests_blocked = evidence.blocked_route_requests.length;
  const staticFont = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Space+Mono&display=swap';
  assert(evidence.blocked_external_requests.length <= 2 && evidence.blocked_external_requests.every(url => url === staticFont), 'Unexpected external request beyond the existing static font stylesheet on the current and preserved-old-markup pages');
  recordCheck('Privacy and execution controls', `Zero pageerrors, diagnostic fetch/XHR/beacon requests or storagewrites. Only marked GETs to the selected guide/assets were permitted. Existing static GoogleFonts stylesheet and ${evidence.infrastructure_requests_blocked} Cloudflare infrastructure script request(s) were blocked; those scripts were not executed by this isolated workflow check. No request to another host was allowed.`);
  // Code-native extension of the existing simple icon system; no borrowed raster art.
  if (!live) {
  const icon = await context.newPage(); await icon.setViewportSize({ width: 400, height: 400 });
  await icon.setContent('<!doctype html><html><body style="margin:0;background:#18232d"><svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="Two open item lists with exact match"><rect width="400" height="400" rx="48" fill="#18232d"/><g fill="#263b4a" stroke="#a0e6c3" stroke-width="6"><rect x="54" y="78" width="124" height="228" rx="12"/><rect x="222" y="78" width="124" height="228" rx="12"/></g><g stroke="#a0e6c3" stroke-width="7" stroke-linecap="round"><path d="M80 114h72M80 149h56M80 184h65M80 219h42M248 114h72M248 149h56M248 184h65M248 219h42"/></g><circle cx="200" cy="279" r="44" fill="#a0e6c3"/><path d="m178 279 15 16 30-34" fill="none" stroke="#18232d" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg></body></html>');
  await icon.screenshot({ path: join(root, 'assets/supplier-statement-check-logo.png') }); await icon.close();
  }
  evidence.browser = await context.browser().version();
  await context.close(); context = null;
  execFileSync('python3', ['-c', 'from PIL import Image\nfrom pathlib import Path\nimport sys\nframes=[Image.open(f).convert("RGB").resize((800,656)) for f in sorted(Path(sys.argv[1]).glob("*.png"))]\nassert len(frames)==5\nframes[0].save(sys.argv[2],save_all=True,append_images=frames[1:],duration=[1800,2600,2600,2600,2600],loop=0,optimize=True)\n', frames, join(root, gifPath)]);
  evidence.artifacts = [gifPath, ...(!live ? ['assets/supplier-statement-check-logo.png'] : []), imagePrefix + '-desktop.png', imagePrefix + '-mobile-390.png', imagePrefix + '-mobile-320.png'].map(path => ({ path, bytes: readFileSync(join(root, path)).length, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') }));
  evidence.status = 'passed';
} catch (error) { evidence.status = 'failed'; evidence.failure = error.message; evidence.failure_stack = error.stack; console.error(error.stack); process.exitCode = 1; }
finally {
  await context?.close(); if (server.listening) await new Promise(resolve => server.close(resolve));
  for (let i = 0; ; i++) { const handles = spawnSync('/usr/sbin/lsof', ['-t', '+D', scope], { encoding: 'utf8' }); if (handles.status === 1 && !handles.stdout.trim()) break; if (handles.error || i >= 40) { writeFileSync(join(root, receiptPath), JSON.stringify({ ...evidence, cleanup_retained: true, cleanup_scope: scope, cleanup_error: handles.error?.message || handles.stderr, cleanup_lsof_status: handles.status }, null, 2) + '\n'); throw Error('Owned browser scope retained because lsof did not prove closed: ' + scope); } await new Promise(resolve => setTimeout(resolve, 250)); }
  const bytes = size(scope); assert(bytes < 50 * 1024 * 1024, 'Owned scope exceeded50MiB; do not silently remove');
  appendFileSync(join(root, 'data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path: scope, bytes, lsof: 'no open handles', reason: 'R38 real supplier browser QA, synthetic CSV downloads and GIF source frames' }) + '\n'); rmSync(scope, { recursive: true });
  evidence.owned_scope_removed = true; evidence.finished_at = new Date().toISOString();
  writeFileSync(join(root, receiptPath), JSON.stringify(evidence, null, 2) + '\n');
}
console.log(JSON.stringify({ status: evidence.status, checks: evidence.checks.length, artifacts: evidence.artifacts, diagnostics: evidence.diagnostic_requests.length, page_errors: evidence.page_errors.length }));
