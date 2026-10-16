#!/usr/bin/env node
// Real browser QA over a local read-only Worker bridge. Never submits checkout/email.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import worker from '../billing/src/index.js';

const baseWork = join(homedir(), 'mcp-servers-work'); mkdirSync(baseWork, { recursive: true });
const profile = mkdtempSync(join(baseWork, 'browser-demo-'));
const chrome = process.env.MCP_TEST_CHROME || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
assert.ok(existsSync(chrome), 'Set MCP_TEST_CHROME to an installed Chrome executable');
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    const response = await worker.fetch(new Request('https://mcp.zovo.one' + req.url, { headers: { 'x-mcp-probe': '1', 'user-agent': 'mcp-browser-qa/1' } }), {}, { waitUntil() {} });
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('Local QA bridge failed'); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
const failures = [], requests = [];
try {
  browser = await chromium.launchPersistentContext(profile, { executablePath: chrome, headless: true, viewport: { width: 1280, height: 1000 }, args: ['--disable-dev-shm-usage', '--disk-cache-size=1'] });
  await browser.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
  const page = browser.pages()[0]; page.on('pageerror', error => failures.push(error.message)); page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  await page.goto(origin + '/guides/match-supplier-invoice-purchase-order-delivery-note-in-claude', { waitUntil: 'networkidle' });
  const status = page.locator('#matcher-demo-status'), issues = page.locator('#matcher-demo-issues');
  await status.waitFor();
  assert.match(await status.textContent(), /Exceptions found: 2 issues/);
  assert.match(await issues.textContent(), /A: invoiced_above_accepted/);
  assert.match(await issues.textContent(), /B: accepted_above_order/);
  const requestCount = requests.length;
  await page.selectOption('#matcher-demo-preset', 'price');
  assert.match(await issues.textContent(), /A: unit_price_mismatch/);
  assert.match(await issues.textContent(), /B: unit_price_mismatch/);
  assert.match(await page.locator('#matcher-demo-totals').textContent(), /PO total: 2000 minor units. Invoice lines: 2000/);
  await page.selectOption('#matcher-demo-preset', 'partial');
  assert.match(await status.textContent(), /^Matched:/);
  assert.equal(await page.locator('#matcher-demo-issues li').count(), 0);
  await page.fill('[name="prior_a"]', '2'); await page.click('#matcher-demo-form button');
  assert.match(await issues.textContent(), /invoiced_above_accepted/);
  await page.fill('[name="accepted_a"]', '1.5');
  assert.equal(await page.locator('[name="accepted_a"]').evaluate(input => input.checkValidity()), false);
  await page.selectOption('#matcher-demo-preset', 'partial');
  await page.fill('[name="price_a"]', '9007199254740991'); await page.click('#matcher-demo-form button');
  assert.match(await status.textContent(), /^Invalid input:/);
  await page.selectOption('#matcher-demo-preset', 'quantity');
  await page.waitForTimeout(100);
  assert.equal(requests.length, requestCount, 'Editing/running diagnostics made a network request');
  assert.deepEqual(failures, [], 'Browser JavaScript error');
  if (process.argv.includes('--screenshots')) {
    await page.locator('#matcher-demo').screenshot({ path: 'intel/R36-browser-demo-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile page overflows');
    await page.locator('#matcher-demo').screenshot({ path: 'intel/R36-browser-demo-mobile.png' });
  }
  const report = { at: new Date().toISOString(), origin: 'local read-only Worker bridge', browser: await browser.browser().version(), cases: ['offsetting receipt quantities', 'offsetting unit prices', 'valid partial with rejected units', 'prior billing exceeds accepted', 'fractional input rejected', 'unsafe invoice money rejected'], passed: 6, diagnostic_network_requests: requests.length - requestCount, page_errors: failures, field_values_uploaded: false, screenshots: process.argv.includes('--screenshots') ? ['intel/R36-browser-demo-desktop.png', 'intel/R36-browser-demo-mobile.png'] : [] };
  writeFileSync('data/r36_browser_demo_verification.json', JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: six browser scenarios, zero diagnostic network requests, zero page errors');
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  // Chrome may release helper handles just after its close promise resolves.
  let open;
  for (let attempt = 0; attempt < 40; attempt++) {
    open = spawnSync('lsof', ['-t', '+D', profile], { encoding: 'utf8' });
    if (!open.error && open.status === 1 && !open.stdout.trim()) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (open.error || open.status !== 1 || open.stdout.trim()) throw Error('Browser profile cleanup deferred: open handles unknown');
  const bytes = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; };
  const size = bytes(profile);
  appendFileSync('data/build-deletions.jsonl', JSON.stringify({ at: new Date().toISOString(), path: profile, bytes: size, reason: 'completed isolated browser QA profile', lsof: 'no open handles' }) + '\n');
  rmSync(profile, { recursive: true });
}
