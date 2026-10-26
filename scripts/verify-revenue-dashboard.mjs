// Offline QA through the owner's exact DASHBOARD.html entry point.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const base = join(homedir(), 'mcp-servers-work');
mkdirSync(base, { recursive: true });
const profile = mkdtempSync(join(base, 'revenue-review-browser-'));
const errors = [], external = [], checks = [];
const bytes = p => readdirSync(p, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? bytes(join(p, e.name)) : lstatSync(join(p, e.name)).size), 0);
let browser;
try {
  browser = await chromium.launchPersistentContext(profile, {
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, viewport: { width: 1280, height: 1000 },
    args: ['--disable-dev-shm-usage', '--disk-cache-size=1'],
  });
  await browser.route('**/*', route => {
    if (route.request().url().startsWith('file:')) return route.continue();
    external.push(route.request().url()); return route.abort();
  });
  const page = browser.pages()[0];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(new URL('DASHBOARD.html', root).href);
  await page.waitForURL(new URL('index.html', root).href);
  await assert.doesNotReject(() => page.locator('#revenue-review').waitFor({ state: 'visible' }));
  assert.match(await page.locator('#revenue-review-title').innerText(), /revenue is still zero/);
  assert.match(await page.locator('.review-callout').innerText(), /\$4\.99 subscriptions/);
  assert.equal(await page.locator('#previous-session').getAttribute('open'), null);
  checks.push('Exact legacy entry redirects to current revenue review; historical sprint is separate; sales correction visible');

  await page.locator('#revenue-scenario summary').click();
  const output = id => page.locator('#scenario-' + id).innerText();
  assert.equal(await output('gross'), '$38.00');
  assert.equal(await output('sales'), '53');
  assert.equal(await output('visits'), '2,650');
  assert.equal(await output('net'), 'Costs unknown');
  checks.push('Single-price example is correct; missing costs stay unknown');
  await page.locator('#scenario-price').selectOption('39');
  assert.equal(await output('gross'), '$78.00');
  assert.equal(await output('sales'), '26');
  assert.equal(await output('visits'), '1,300');
  await page.locator('#scenario-cost').fill('100');
  assert.equal(await output('net'), '-$22.00');
  checks.push('Bundle whole-sale target and entered-cost surplus are correct');
  await page.locator('#scenario-rate').fill('0');
  assert.equal(await output('gross'), '$0.00');
  assert.equal(await output('visits'), 'Unreachable at 0%');
  await page.locator('#scenario-target').fill('0');
  assert.equal(await output('sales'), '0');
  assert.equal(await output('visits'), '0');
  await page.locator('#scenario-traffic').fill('-1');
  assert.equal(await output('gross'), 'Check inputs');
  await page.locator('#scenario-traffic').fill('');
  assert.equal(await output('gross'), 'Check inputs');
  checks.push('Zero-rate, zero-target, negative and missing inputs produce bounded honest results');
  await page.locator('#scenario-traffic').fill('100');
  await page.locator('#scenario-rate').fill('2');
  await page.locator('#scenario-target').fill('1000');
  await page.locator('#scenario-cost').fill('');
  await page.locator('#scenario-price').selectOption('19');
  await page.locator('#revenue-scenario').screenshot({ path: new URL('intel/REVENUE-REVIEW-calculator.png', root).pathname });
  await page.locator('#revenue-scenario summary').click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: new URL('intel/REVENUE-REVIEW-desktop.png', root).pathname });

  for (const tab of ['overview', 'servers', 'validation', 'promotion', 'uservalue', 'organic', 'sprints', 'kpi', 'truth']) {
    await page.locator(`button[data-tab="${tab}"]`).click();
    assert.equal(await page.locator('#tab-' + tab).evaluate(el => getComputedStyle(el).display !== 'none'), true);
  }
  checks.push('All nine existing dashboard tabs still work');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow at ' + width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: new URL('intel/REVENUE-REVIEW-mobile.png', root).pathname });
  checks.push('390px and320px layouts have no horizontal page overflow');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  checks.push('No page errors, external requests or browser storage writes');
} finally {
  await browser?.close();
  // Chrome may finish flushing its own profile just after context.close resolves.
  let handles;
  for (let attempt = 0; attempt < 10; attempt++) {
    handles = spawnSync('lsof', ['+D', profile], { encoding: 'utf8' });
    if (handles.status === 1 && !handles.stdout) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (handles.status !== 1 || handles.stdout) throw Error('Open profile handles or lsof failure; profile retained');
  appendFileSync(new URL('data/build-deletions.jsonl', root), JSON.stringify({
    at: new Date().toISOString(), path: profile, bytes: bytes(profile), lsof_clear: true,
    reason: 'Completed owned revenue dashboard QA; browser closed',
  }) + '\n');
  rmSync(profile, { recursive: true });
}
const receipt = { at: new Date().toISOString(), status: 'passed', scope: 'Offline Chrome, actual DASHBOARD.html redirect and generated HTML; no production actions', checks, page_errors: errors, external_requests: external.length, profile_removed: true };
writeFileSync(new URL('data/revenue_dashboard_verification.json', root), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt));
