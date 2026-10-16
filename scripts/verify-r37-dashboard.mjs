#!/usr/bin/env node
// Offline visual/interaction QA of the actual local dashboard; own blank profile only.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, readdirSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
const root = new URL('../', import.meta.url);
const base = join(homedir(), 'mcp-servers-work'); mkdirSync(base, { recursive: true });
const profile = mkdtempSync(join(base, 'r37-dashboard-browser-'));
const errors = [], checks = []; let browser;
const bytes = p => readdirSync(p, { withFileTypes: true }).reduce((n,e) => n + (e.isDirectory() ? bytes(join(p,e.name)) : lstatSync(join(p,e.name)).size),0);
try {
 browser = await chromium.launchPersistentContext(profile, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, viewport: { width: 1280, height: 1000 }, args: ['--disable-dev-shm-usage','--disk-cache-size=1'] });
 await browser.route('**/*', route => route.request().url().startsWith('file:') ? route.continue() : route.abort());
 const page = browser.pages()[0]; page.on('pageerror', e => errors.push(e.message));
 await page.goto(new URL('index.html', root).href);
 assert.match(await page.locator('#current-session').innerText(), /R37/); checks.push('Current session is R37');
 assert.equal(await page.getByRole('link', { name: 'Observation evidence', exact: true }).getAttribute('href'), 'data/r37_watch.json'); checks.push('Observation evidence links to R37');
 assert.equal(await page.locator('#current-session .kpi').count(),5); checks.push('Five explicitly scoped current metrics');
 await page.screenshot({ path: new URL('intel/R37-dashboard-desktop.png',root).pathname });
 for(const tab of ['overview','servers','validation','promotion','uservalue','organic','sprints','kpi','truth']) {
  await page.locator(`button[data-tab="${tab}"]`).click();
  assert.equal(await page.locator(`#tab-${tab}`).evaluate(el => getComputedStyle(el).display !== 'none'),true);
 } checks.push('All nine tab interactions');
 await page.setViewportSize({ width: 390, height: 844 });
 assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Dashboard mobile overflow'); checks.push('390px viewport has no horizontal page overflow');
 await page.screenshot({ path: new URL('intel/R37-dashboard-mobile.png',root).pathname });
 assert.equal(errors.length,0); checks.push('No browser page errors; external requests blocked');
} finally {
 await browser?.close();
 const check=spawnSync('lsof',['+D',profile],{encoding:'utf8'});
 if(check.status!==1||check.stdout)throw Error('Dashboard profile still open; preserved for safe cleanup');
 const record={at:new Date().toISOString(),session:'r37',path:profile,bytes:bytes(profile),lsof_clear:true,reason:'Completed owned dashboard browser QA'};
 appendFileSync(new URL('data/build-deletions.jsonl',root),JSON.stringify(record)+'\n'); rmSync(profile,{recursive:true});
}
const result={at:new Date().toISOString(),status:'passed',scope:'Actual offline local HTML in Chrome; no deployment, login or business actions',checks,page_errors:errors,profile_removed:true};
writeFileSync(new URL('data/r37_dashboard_verification.json',root),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
