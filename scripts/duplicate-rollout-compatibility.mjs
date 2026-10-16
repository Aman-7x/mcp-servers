#!/usr/bin/env node
// Read-only historical DOM/current-asset rollout control. No production requests.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import { DUPLICATE_DEMO_JAVASCRIPT, DUPLICATE_DEMO_INPUT_SHA256 } from '../billing/src/duplicate-demo-bundle.js';
const sha = value => createHash('sha256').update(value).digest('hex');
const gitSource = path => {
  const result = spawnSync('git', ['show', path], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  assert.equal(result.status, 0, 'Historical source unavailable'); return result.stdout;
};
const moduleFromText = text => import('data:text/javascript;base64,' + Buffer.from(text).toString('base64'));
const legacySource = gitSource('d6da6293:billing/src/duplicate-demo-markup.js');
const legacy = await moduleFromText(legacySource.replace("'./figures.js'", JSON.stringify(new URL('../billing/src/figures.js', import.meta.url).href)));
const before = await moduleFromText(gitSource('f5fb8522:billing/src/duplicate-demo-bundle.js'));
assert.equal(sha(before.DUPLICATE_DEMO_JAVASCRIPT), '00131aed63f83fdc24766ec7ae065fbfec7e7b902ff7c639e06e115e6fbca5cb');
const root = join(homedir(), 'mcp-servers-work'); mkdirSync(root, { recursive: true });
const profile = mkdtempSync(join(root, 'r37-rollout-compat-'));
const redOnly = process.argv.includes('--red-only');
const evidence = { at: new Date().toISOString(), legacy_markup_commit: 'd6da6293', legacy_markup_sha256: sha(legacy.DUPLICATE_DEMO_HTML), pre_compatibility_asset_commit: 'f5fb8522', pre_compatibility_asset_sha256: sha(before.DUPLICATE_DEMO_JAVASCRIPT), final_asset_sha256: sha(DUPLICATE_DEMO_JAVASCRIPT), final_asset_bytes: Buffer.byteLength(DUPLICATE_DEMO_JAVASCRIPT), final_input_sha256: DUPLICATE_DEMO_INPUT_SHA256, origin: 'local historical markup bridge; no production calls', status: 'running' };
const server = createServer((req, res) => {
  if (req.url === '/legacy-pre' || req.url === '/legacy-final') {
    const asset = req.url === '/legacy-pre' ? '/pre.js' : '/final.js';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><html><body>' + legacy.DUPLICATE_DEMO_HTML.replace('src="/assets/duplicate-demo.js"', `src="${asset}"`) + '</body></html>');
  } else if (req.url === '/pre.js' || req.url === '/final.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); res.end(req.url === '/pre.js' ? before.DUPLICATE_DEMO_JAVASCRIPT : DUPLICATE_DEMO_JAVASCRIPT);
  } else { res.writeHead(404); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launchPersistentContext(profile, { executablePath: process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome', headless: true, args: ['--disk-cache-size=1'] });
  await browser.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  await browser.addInitScript(() => {
    window.__writes = [];
    for (const method of ['setItem', 'removeItem', 'clear']) Storage.prototype[method] = function () { window.__writes.push(method); throw Error('Unexpected storage write'); };
    indexedDB.open = () => { window.__writes.push('indexedDB.open'); throw Error('Unexpected IndexedDB'); };
  });
  const red = browser.pages()[0], redErrors = [];
  red.on('pageerror', error => redErrors.push(error.message));
  await red.goto(origin + '/legacy-pre', { waitUntil: 'networkidle' });
  assert.equal(await red.locator('#duplicate-demo-csv-file').count(), 0);
  assert.equal(await red.locator('#duplicate-demo-output').textContent(), '');
  assert.ok(redErrors.some(error => /null.*addEventListener|addEventListener.*null/.test(error)), 'Negative control did not reproduce the original absent-control failure');
  evidence.red_control = { at: new Date().toISOString(), reproduced: true, page_errors: redErrors, initial_report_empty: true };
  await red.close();
  if (!redOnly) {
    const page = await browser.newPage(), errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url()));
    await page.goto(origin + '/legacy-final', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('#duplicate-demo-csv-file').count(), 0);
    const read = () => page.locator('#duplicate-demo-output').textContent().then(JSON.parse);
    assert.equal((await read()).summary.candidate_record_count, 4);
    const count = requests.length;
    await page.selectOption('#duplicate-demo-preset', 'zeros');
    assert.equal((await read()).status, 'no_candidates_in_supplied_batch');
    await page.selectOption('#duplicate-demo-preset', 'formatting');
    assert.deepEqual((await read()).groups.map(g => g.rule), ['normalized_reference']);
    const record = (await read()).records[0];
    await page.fill('#duplicate-demo-input', JSON.stringify({ records: [{ ...record, invoice_number: 'MANUAL-001' }], save: false }));
    assert.equal(await page.locator('#duplicate-demo-output').textContent(), '');
    await page.click('#duplicate-demo-form button');
    assert.equal((await read()).records[0].invoice_number, 'MANUAL-001');
    await page.selectOption('#duplicate-demo-preset', 'conflict');
    assert.equal((await read()).groups.length, 2);
    assert.deepEqual(errors, []); assert.equal(requests.length, count); assert.deepEqual(await page.evaluate(() => window.__writes), []);
    evidence.green_control = { passed: true, cases: ['actual old markup has no CSV controls', 'initial complete JSON diagnosis', 'zero-preserving preset', 'normalized reference preset', 'manual edit clears stale result', 'manual JSON submit works', 'preset still works after manual edit'], page_errors: errors, diagnostic_network_requests: requests.length - count, browser_storage_writes: 0 };
    evidence.status = 'passed'; await page.close();
  } else evidence.status = 'red_control_verified_final_pending';
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  let open;
  for (let attempt = 0; attempt < 40; attempt++) {
    open = spawnSync('lsof', ['-t', '+D', profile], { encoding: 'utf8' });
    if (!open.error && open.status === 1 && !open.stdout.trim()) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(!open.error && open.status === 1 && !open.stdout.trim(), 'Browser profile still has open handles');
  const bytes = path => { const s = lstatSync(path); return s.isDirectory() ? readdirSync(path).reduce((n, name) => n + bytes(join(path, name)), 0) : s.size; };
  appendFileSync('data/build-deletions.jsonl', JSON.stringify({ at: new Date().toISOString(), path: profile, bytes: bytes(profile), reason: 'completed R37 legacy markup rollout regression', lsof: 'no open handles' }) + '\n');
  rmSync(profile, { recursive: true }); assert.equal(existsSync(profile), false); evidence.profile_cleanup = { closed: true, lsof: 'no open handles', removed: true };
  writeFileSync(redOnly ? 'data/r37_csv_rollout_red_control.json' : 'data/r37_csv_rollout_compatibility.json', JSON.stringify(evidence, null, 2) + '\n');
}
console.log('PASS: ' + evidence.status);
