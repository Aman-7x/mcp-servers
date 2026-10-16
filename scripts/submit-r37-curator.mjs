#!/usr/bin/env node
// Explicit R37 publication: one free invited directory submission, no sign-in or payment.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, lstatSync, readdirSync, appendFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const args = process.argv.slice(2);
const retry = args.length === 2 && args[1] === '--retry-client-transport-block';
assert.deepEqual(args, retry ? ['--submit-free-listing', '--retry-client-transport-block'] : ['--submit-free-listing']);
const receipt = 'data/r37_directory_submission.json';
if (existsSync(receipt)) {
  const previous = JSON.parse(readFileSync(receipt));
  assert.ok(retry && previous.status === 'submitted_awaiting_receipt' && previous.submission_attempts === 1 && previous.failure?.includes('Timeout'), 'Receipt does not permit this scoped retry');
  assert.ok(readFileSync('data/r37_directory_diagnosis2.json', 'utf8').includes('/_serverFn/62b9fa2877951ac582b1d0a4835a88ab4b119b1d5fd1a39a67a6a9faadcbc72d'), 'Read-only current frontend endpoint proof is required');
  assert.ok(!existsSync('data/r37_directory_submission_attempt1.json'), 'First attempt was already archived');
  writeFileSync('data/r37_directory_submission_attempt1.json', JSON.stringify(previous, null, 2) + '\n');
} else assert.ok(!retry, 'No prior attempt exists to retry');
const prepared = JSON.parse(readFileSync('data/r37_curator_preparation.json')).submission;
assert.equal(prepared.fee_usd, 0); assert.equal(prepared.fields.plan, 'free');
const work = join(homedir(), 'mcp-servers-work'); mkdirSync(work, { recursive: true });
const scope = mkdtempSync(join(work, 'r37-curator-submit-'));
const out = { at: new Date().toISOString(), directory: prepared.directory, method: 'Ordinary free public form via Chrome', fields: prepared.fields, fee_usd: 0, status: 'started', listing_verified: false, submission_attempts: 0, form_post_requests: 0, blocked_post_paths: [], ...(retry ? { prior_attempt: 'data/r37_directory_submission_attempt1.json', retry_basis: 'Current public frontend posts to /_serverFn/; the first client allowed only POST /submit. Transport block inferred from source and policy; no first-run network log exists.' } : {}) };
writeFileSync(receipt, JSON.stringify(out, null, 2) + '\n');
let browser;
try {
  browser = await chromium.launchPersistentContext(join(scope, 'profile'), { headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', viewport: { width: 1100, height: 1000 }, args: ['--disable-background-networking'] });
  await browser.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (['GET', 'HEAD'].includes(request.method())) return route.continue();
    if (request.method() === 'POST' && url.origin === 'https://mcpservers.org') {
      if (url.pathname.startsWith('/cdn-cgi/challenge-platform/')) return route.continue(); // Ordinary browser security traffic.
      if (url.pathname === '/_serverFn/62b9fa2877951ac582b1d0a4835a88ab4b119b1d5fd1a39a67a6a9faadcbc72d' && out.submission_attempts === 1 && out.form_post_requests === 0) { out.form_post_requests++; return route.continue(); }
    }
    out.blocked_post_paths.push(url.origin + url.pathname);
    return route.abort();
  });
  const page = browser.pages()[0];
  page.on('response', response => { const request = response.request(); if (request.method() === 'POST' && request.url().includes('/_serverFn/')) out.form_response_status = response.status(); });
  await page.goto(prepared.directory, { waitUntil: 'domcontentloaded', timeout: 45000 });
  const form = page.locator('form').first();
  for (const [name, value] of Object.entries(prepared.fields)) {
    const input = form.locator(`[name="${name}"]`);
    if (!(await input.count()) || await input.first().getAttribute('type') === 'hidden') continue;
    if (await input.first().evaluate(e => e.tagName) === 'SELECT') await input.selectOption(value);
    else if (typeof value === 'string') await input.fill(value);
  }
  await page.locator('#free-submit').check(); await page.locator('#has-remote').setChecked(false);
  const actual = await form.evaluate(f => ({ values: Object.fromEntries(new FormData(f)), valid: f.checkValidity() }));
  assert.equal(actual.valid, true);
  for (const [name, expected] of Object.entries(prepared.fields)) assert.equal(actual.values[name], String(expected));
  out.submission_attempts = 1; out.status = 'submitted_awaiting_receipt'; writeFileSync(receipt, JSON.stringify(out, null, 2) + '\n');
  await form.getByRole('button', { name: 'Submit', exact: false }).click();
  await page.getByRole('heading', { name: 'Submission Successful!', exact: true }).waitFor({ timeout: 45000 });
  out.status = 'received_pending_review'; out.confirmation_heading = 'Submission Successful!'; out.final_url = page.url(); out.review_estimate_days = 14; out.screenshot = 'intel/R37-directory-submission.png'; out.finished_at = new Date().toISOString();
  await page.screenshot({ path: out.screenshot, fullPage: true });
} catch (error) { out.failure = String(error.message).slice(0, 300); const page = browser?.pages()[0]; if (page) { out.failure_screenshot = 'intel/R37-directory-submission-failure.png'; await page.screenshot({ path: out.failure_screenshot, fullPage: true }).catch(() => {}); } throw error; }
finally {
  await browser?.close();
  for (let i = 0; ; i++) {
    const open = spawnSync('lsof', ['-t', '+D', scope], { encoding: 'utf8' });
    if (!open.error && open.status === 1 && !open.stdout.trim()) break;
    if (i >= 40) throw Error('Owned submission profile retained because handles remain');
    await delay(250);
  }
  const size = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + size(join(p, f)), 0) : s.size; };
  appendFileSync('data/build-deletions.jsonl', JSON.stringify({ at: new Date().toISOString(), path: scope, bytes: size(scope), lsof: 'no open handles', reason: 'R37 completed free curator form submission' }) + '\n'); rmSync(scope, { recursive: true });
  out.profile_cleanup_complete = true; writeFileSync(receipt, JSON.stringify(out, null, 2) + '\n');
}
console.log(JSON.stringify({ status: out.status, fee_usd: out.fee_usd, attempts: out.submission_attempts, listing_verified: false, screenshot: out.screenshot }));
