#!/usr/bin/env node
// Browser QA only: marked GET requests, synthetic records, no checkout or email.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import worker from '../billing/src/index.js';
import { CSV_REQUIRED_COLUMNS, CSV_TEMPLATE, CSV_MAX_FILE_BYTES } from '../billing/browser/duplicate-csv.mjs';

const baseWork = join(homedir(), 'mcp-servers-work'); mkdirSync(baseWork, { recursive: true });
const profile = mkdtempSync(join(baseWork, 'r37-duplicate-browser-'));
const chrome = process.env.MCP_TEST_CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Set MCP_TEST_CHROME to an installed Chrome executable');
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const response = await worker.fetch(new Request('https://mcp.zovo.one' + req.url, { headers: { 'x-mcp-probe': '1', 'user-agent': 'mcp-r37-browser-qa/1' } }), {}, { waitUntil() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Local QA bridge failed'); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const live = process.argv.includes('--live');
const csvMode = process.argv.includes('--csv');
const rolloutCheck = process.argv.includes('--rollout-check');
const origin = live ? 'https://mcp.zovo.one' : 'http://127.0.0.1:' + server.address().port;
let browser;
const errors = [], requests = [], cases = [];
try {
  browser = await chromium.launchPersistentContext(profile, { executablePath: chrome, headless: true, userAgent: 'mcp-r37-browser-qa/1', extraHTTPHeaders: { 'x-mcp-probe': '1' }, viewport: { width: 1280, height: 1000 }, args: ['--disable-dev-shm-usage', '--disk-cache-size=1'] });
  await browser.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await browser.addInitScript(() => {
    window.__storageAttempts = [];
    for (const method of ['setItem', 'removeItem', 'clear']) Storage.prototype[method] = function () { window.__storageAttempts.push(method); throw Error('Storage write attempted during QA'); };
    indexedDB.open = () => { window.__storageAttempts.push('indexedDB.open'); throw Error('IndexedDB attempted during QA'); };
  });
  const page = browser.pages()[0]; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  await page.goto(origin + '/s/duplicate-invoice-check', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Try duplicate-reference review in this browser', exact: true }).click();
  await page.waitForLoadState('networkidle');
  const status = page.locator('#duplicate-demo-status'), groups = page.locator('#duplicate-demo-groups');
  const result = () => page.locator('#duplicate-demo-output').textContent().then(JSON.parse);
  const preset = name => page.selectOption('#duplicate-demo-preset', name);
  await status.waitFor();
  const initial = await result();
  assert.deepEqual(initial.summary, { record_count: 4, candidate_record_count: 4, unflagged_record_count: 0, group_count: 3, group_memberships: 8 });
  assert.equal(await page.locator('#duplicate-demo-records tr').count(), 4);
  cases.push('overlapping reason groups count each candidate record once');
  const requestCount = requests.length;
  await preset('conflict');
  let report = await result();
  assert.deepEqual(report.groups.map(g => g.rule).sort(), ['exact_reference', 'normalized_reference']);
  assert.ok(report.groups.every(g => g.conflicting_fields.includes('total_minor') && g.conflicting_fields.includes('invoice_date')));
  cases.push('identical reference retained with conflicting total and date');
  await preset('formatting'); report = await result();
  assert.deepEqual(report.groups.map(g => g.rule), ['normalized_reference']);
  assert.equal(report.groups[0].match_key, 'INV001');
  cases.push('only explicit reference formatting normalizes');
  await preset('zeros'); report = await result();
  assert.equal(report.groups.length, 0); assert.equal(report.status, 'no_candidates_in_supplied_batch');
  assert.match(await status.textContent(), /does not establish uniqueness or approval to pay/);
  cases.push('leading zeros retained; negative output carries supplied-batch limit');
  await preset('boundaries'); report = await result();
  assert.equal(report.summary.record_count, 5); assert.equal(report.groups.length, 0);
  cases.push('exact entity supplier currency and document-type boundaries');
  await preset('legitimate'); report = await result();
  assert.deepEqual(report.groups.map(g => g.rule), ['same_amount_date']);
  assert.match(await groups.textContent(), /legitimate invoices/);
  cases.push('equal amount/date produces review evidence for potentially legitimate bills');
  const edit = async obj => { await page.fill('#duplicate-demo-input', JSON.stringify(obj)); await page.click('#duplicate-demo-form button'); };
  const record = report.records[0];
  await edit({ records: [{ ...record, record_id: 'XSS', invoice_number: '<img src="/must-not-request" onerror="alert(1)">' }], save: false });
  assert.equal(await page.locator('#duplicate-demo-records img').count(), 0);
  assert.match(await page.locator('#duplicate-demo-records').textContent(), /<img/);
  cases.push('untrusted reference remains text without markup execution');
  await edit({ records: [record, record], save: false });
  assert.match(await status.textContent(), /^Invalid input:.*record_id/);
  assert.equal(await page.locator('#duplicate-demo-records tr').count(), 0);
  assert.equal(await groups.locator('li').count(), 0);
  cases.push('duplicate record IDs rejected and stale evidence cleared');
  await edit({ records: [{ ...record, invoice_date: '2026-02-30' }], save: false });
  assert.match(await status.textContent(), /^Invalid input:/);
  await edit({ records: [{ ...record, total_minor: 1.5 }], save: false });
  assert.match(await status.textContent(), /^Invalid input:/);
  await edit({ records: [{ ...record, total_minor: 9007199254740992 }], save: false });
  assert.match(await status.textContent(), /^Invalid input:/);
  cases.push('invalid calendar dates fractional totals and unsafe integers rejected');
  await edit({ records: [record], save: true });
  assert.match(await status.textContent(), /does not save reports/);
  cases.push('browser rejects save requests instead of implying persistence');
  await edit({ records: Array.from({ length: 1001 }, (_, i) => ({ ...record, record_id: 'BOUND-' + i })), save: false });
  assert.match(await status.textContent(), /^Invalid input:.*1000/);
  await page.locator('#duplicate-demo-input').evaluate(el => { el.value = 'é'.repeat(1024 * 1024 + 1); });
  await page.click('#duplicate-demo-form button');
  assert.match(await status.textContent(), /at most 2 MiB/);
  cases.push('1001 records and more than 2 MiB UTF-8 JSON text rejected');
  await preset('worked');
  const baselineCaseCount = cases.length;
  if (csvMode) {
    const csvFile = page.locator('#duplicate-demo-csv-file');
    const csvStatus = page.locator('#duplicate-demo-csv-status');
    const importFile = async (text, name = 'synthetic.csv') => {
      await csvFile.setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.isBuffer(text) ? text : Buffer.from(text) });
    };
    const imported = () => page.waitForFunction(() => document.getElementById('duplicate-demo-csv-status').textContent.startsWith('Imported'));
    const rejected = () => page.waitForFunction(() => document.getElementById('duplicate-demo-csv-status').textContent.startsWith('CSV import rejected'));
    const quoted = value => '"' + String(value).replaceAll('"', '""') + '"';
    const asCsv = (records, columns = CSV_REQUIRED_COLUMNS) => columns.join(',') + '\r\n' + records.map(r => columns.map(c => quoted(r[c] ?? '')).join(',')).join('\r\n') + '\r\n';
    const base = JSON.parse(await page.locator('#duplicate-demo-input').inputValue()).records[0];
    await page.locator('#duplicate-demo .csv-import summary').click();
    await page.click('#duplicate-demo-csv-sample');
    assert.deepEqual((await result()).summary, initial.summary);
    assert.equal(await page.locator('#duplicate-demo-preset').inputValue(), 'custom');
    cases.push('copyable sample CSV imports the complete four-record diagnosis locally');
    const reference = '000é, "réf"';
    const source = [{ ...base, record_id: '0001', entity_id: '001', supplier_id: 'Supplier "é", SA', invoice_number: reference }, { ...base, record_id: '0002', entity_id: '001', supplier_id: 'Supplier "é", SA', invoice_number: reference, total_minor: 15000, invoice_date: '2026-10-17' }];
    await importFile('\uFEFF' + asCsv(source)); await imported();
    report = await result(); assert.deepEqual(report.records, source);
    assert.deepEqual(report.groups.map(g => g.rule).sort(), ['exact_reference', 'normalized_reference']);
    assert.deepEqual(JSON.parse(await page.locator('#duplicate-demo-input').inputValue()), { records: source, save: false });
    cases.push('actual UTF-8 CSV file preserves quoted comma quote Unicode leading-zero IDs and conflicting evidence');
    await importFile(asCsv([{ ...base, invoice_number: '<img src="/csv-must-not-request" onerror="alert(1)">' }])); await imported();
    assert.equal(await page.locator('#duplicate-demo-records img').count(), 0);
    assert.match(await page.locator('#duplicate-demo-records').textContent(), /<img/);
    cases.push('CSV source reference remains inert text');
    for (const text of [CSV_TEMPLATE.replace('record_id,', 'unknown,'), '\uFEFF\uFEFF' + CSV_TEMPLATE, CSV_TEMPLATE + '\n', asCsv([base, base]), asCsv([{ ...base, total_minor: 0 }]), asCsv([{ ...base, invoice_date: '2026-02-30' }]), asCsv([{ ...base, invoice_number: 'broken\nreference' }])]) {
      await importFile(text); await rejected();
      assert.equal(await page.locator('#duplicate-demo-output').textContent(), '');
      assert.equal(await page.locator('#duplicate-demo-records tr').count(), 0);
      assert.equal(await page.locator('#duplicate-demo-input').inputValue(), '');
    }
    cases.push('bad CSV headers blank rows duplicate IDs money dates and controls reject the whole batch and clear stale results');
    await page.evaluate(() => {
      window.__csvOriginalRead = File.prototype.arrayBuffer; window.__csvReads = 0;
      File.prototype.arrayBuffer = function () { window.__csvReads++; return window.__csvOriginalRead.call(this); };
    });
    await importFile(Buffer.alloc(CSV_MAX_FILE_BYTES + 1, 97), 'oversize.csv'); await rejected();
    assert.equal(await page.evaluate(() => window.__csvReads), 0);
    await importFile(Buffer.alloc(0), 'empty.csv'); await rejected();
    assert.equal(await page.evaluate(() => window.__csvReads), 0);
    cases.push('oversized and empty CSV files rejected before any file read');
    await importFile(Buffer.from([0xc3, 0x28]), 'invalid-utf8.csv'); await rejected();
    assert.equal(await page.locator('#duplicate-demo-output').textContent(), '');
    cases.push('invalid UTF-8 rejected instead of replacing source characters');
    await importFile(asCsv(Array.from({ length: 1001 }, (_, i) => ({ ...base, record_id: 'CSV-' + i })))); await rejected();
    assert.match(await status.textContent(), /1,000-record limit/);
    cases.push('CSV 1001-record batch rejected without partial acceptance');
    await page.evaluate(() => {
      window.__csvPending = [];
      File.prototype.arrayBuffer = function () {
        if (this.name.startsWith('deferred-')) return new Promise((resolve, reject) => window.__csvPending.push({ resolve, reject, file: this }));
        return window.__csvOriginalRead.call(this);
      };
    });
    const releaseOldRead = async (reject = false) => {
      await page.evaluate(async reject => { const pending = window.__csvPending.shift(); if (reject) pending.reject(Error('Older read failed')); else pending.resolve(await window.__csvOriginalRead.call(pending.file)); }, reject);
      await page.waitForTimeout(30);
    };
    await importFile(asCsv([{ ...base, invoice_number: 'OLD-CSV' }]), 'deferred-first.csv');
    assert.equal(await page.locator('#duplicate-demo-output').textContent(), '');
    await importFile(asCsv([{ ...base, invoice_number: 'NEW-CSV' }]), 'newer.csv'); await imported();
    await releaseOldRead(); assert.equal((await result()).records[0].invoice_number, 'NEW-CSV');
    cases.push('an older file read cannot overwrite a newer CSV diagnosis');
    await importFile(asCsv([{ ...base, invoice_number: 'OLD-CSV' }]), 'deferred-preset.csv');
    await preset('zeros'); await releaseOldRead();
    assert.equal((await result()).status, 'no_candidates_in_supplied_batch');
    assert.notEqual((await result()).records[0].invoice_number, 'OLD-CSV');
    cases.push('preset changes discard pending CSV completions');
    await importFile(asCsv([{ ...base, invoice_number: 'OLD-CSV' }]), 'deferred-edit.csv');
    const manual = { records: [{ ...base, invoice_number: 'MANUAL-JSON' }], save: false };
    await page.fill('#duplicate-demo-input', JSON.stringify(manual)); await releaseOldRead();
    assert.equal(await page.locator('#duplicate-demo-output').textContent(), '');
    assert.deepEqual(JSON.parse(await page.locator('#duplicate-demo-input').inputValue()), manual);
    await page.click('#duplicate-demo-form button');
    assert.equal((await result()).records[0].invoice_number, 'MANUAL-JSON');
    cases.push('manual edits discard pending CSV reads and require a new explicit check');
    await importFile(asCsv([{ ...base, invoice_number: 'OLD-CSV' }]), 'deferred-submit.csv');
    await page.locator('#duplicate-demo-input').evaluate((el, value) => { el.value = value; }, JSON.stringify(manual));
    await page.click('#duplicate-demo-form button'); await releaseOldRead(true);
    assert.equal((await result()).records[0].invoice_number, 'MANUAL-JSON');
    assert.doesNotMatch(await csvStatus.textContent(), /rejected|Older read failed/);
    cases.push('manual submit discards an older read rejection without replacing current evidence');
    await csvFile.setInputFiles([]);
    assert.equal(await page.locator('#duplicate-demo-output').textContent(), '');
    cases.push('clearing file selection clears previous evidence');
    await page.evaluate(() => { File.prototype.arrayBuffer = window.__csvOriginalRead; });
    await page.click('#duplicate-demo-csv-sample');
    await page.locator('#duplicate-demo-input').evaluate(el => { el.scrollTop = 0; });
  }
  await page.waitForTimeout(100);
  assert.equal(requests.length, requestCount, 'Editing/running diagnostics caused a network request');
  assert.deepEqual(await page.evaluate(() => window.__storageAttempts), []);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []);
  const screenshots = [];
  if (process.argv.includes('--screenshots')) {
    const prefix = rolloutCheck ? 'intel/R37-csv-rollout-current' : csvMode ? (live ? 'intel/R37-csv-demo-live' : 'intel/R37-csv-demo') : (live ? 'intel/R37-duplicate-demo-live' : 'intel/R37-duplicate-demo');
    screenshots.push(prefix + '-desktop.png', prefix + '-mobile.png');
    await page.locator('#duplicate-demo').screenshot({ path: screenshots[0] });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows horizontally');
    await page.locator('#duplicate-demo').screenshot({ path: screenshots[1] });
  }
  const evidence = { at: new Date().toISOString(), origin: live ? 'https://mcp.zovo.one (marked synthetic GET probes)' : 'local read-only Worker bridge', browser: await browser.browser().version(), cases, passed: cases.length, ...(csvMode ? { baseline_cases_passed: baselineCaseCount, csv_cases_passed: cases.length - baselineCaseCount } : {}), diagnostic_network_requests: requests.length - requestCount, browser_storage_writes: 0, field_values_uploaded: false, page_errors: errors, screenshots };
  const evidenceFile = rolloutCheck ? 'data/r37_csv_rollout_current_browser_verification.json' : csvMode ? (live ? 'data/r37_csv_browser_live_verification.json' : 'data/r37_csv_browser_verification.json') : (live ? 'data/r37_duplicate_browser_live_verification.json' : 'data/r37_duplicate_browser_verification.json');
  writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + '\n');
  console.log(`PASS: ${cases.length} browser cases; zero diagnostic requests, storage writes or page errors`);
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  let open;
  for (let attempt = 0; attempt < 40; attempt++) {
    open = spawnSync('lsof', ['-t', '+D', profile], { encoding: 'utf8' });
    if (!open.error && open.status === 1 && !open.stdout.trim()) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (open.error || open.status !== 1 || open.stdout.trim()) throw Error('Browser profile cleanup deferred: open handles unknown');
  const bytes = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; };
  const size = bytes(profile);
  appendFileSync('data/build-deletions.jsonl', JSON.stringify({ at: new Date().toISOString(), path: profile, bytes: size, reason: 'completed isolated R37 duplicate browser QA profile', lsof: 'no open handles' }) + '\n');
  rmSync(profile, { recursive: true });
}
