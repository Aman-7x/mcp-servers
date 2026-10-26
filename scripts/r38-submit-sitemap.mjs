#!/usr/bin/env node
// One owned sitemap submission, after its new public product/guide routes exist.
// Submission is not an indexing request, crawl, click or traffic receipt.
import assert from 'node:assert/strict';
import { createHash, createSign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const output = new URL('../data/r38_sitemap_submission.json', import.meta.url);
assert(process.argv.length === 3 && process.argv[2] === '--submit-once');
assert(!existsSync(output), 'Preserve the prior submission receipt; do not repeat a sitemap ping');
const origin = 'https://mcp.zovo.one', sitemap = origin + '/sitemap.xml';
const paths = ['/s/supplier-statement-check', '/guides/compare-supplier-statement-ap-open-items-in-claude'];
const headers = { 'x-mcp-probe': '1', 'user-agent': 'r38-owned-sitemap-release/1' };
const receipt = { started_at: new Date().toISOString(), status: 'running', sitemap, scope: 'One owned sitemap resubmission only. No per-URL indexing API, messages, payments or accounts.', submissions: 0 };
async function get(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(25000) });
  assert(response.ok, 'Read or validation failed with HTTP ' + response.status);
  return response;
}
try {
  const [map, robots, ...pages] = await Promise.all(['/sitemap.xml', '/robots.txt', ...paths].map(p => get(origin + p, { headers })));
  const xml = await map.text(), robotsText = await robots.text();
  assert(xml.startsWith('<?xml') && xml.includes('<urlset') && paths.every(p => xml.includes('<loc>' + origin + p + '</loc>')));
  assert(robotsText.includes('Sitemap: ' + sitemap));
  for (const [i, page] of pages.entries()) assert((await page.text()).includes('href="' + origin + paths[i] + '"'));
  receipt.public_route_count = pages.length; receipt.sitemap_sha256 = createHash('sha256').update(xml).digest('hex');
  const credential = JSON.parse(readFileSync('/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json'));
  const now = Math.floor(Date.now() / 1000), b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const claim = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: credential.client_email, scope: 'https://www.googleapis.com/auth/webmasters', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 });
  const signer = createSign('RSA-SHA256'); signer.update(claim); signer.end();
  const tokenResponse = await get('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: claim + '.' + signer.sign(credential.private_key).toString('base64url') }) });
  const token = (await tokenResponse.json()).access_token; assert(token);
  const api = 'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent('sc-domain:zovo.one') + '/sitemaps';
  const auth = { Authorization: 'Bearer ' + token };
  const row = async () => ((await (await get(api, { headers: auth })).json()).sitemap || []).find(r => r.path === sitemap) || null;
  receipt.before = await row();
  if (Date.parse(receipt.before?.lastSubmitted || '') >= Date.parse('2026-10-26T06:39:16Z')) receipt.action = 'Already submitted after this public release; duplicate submission skipped';
  else {
    const submitted = await get(api + '/' + encodeURIComponent(sitemap), { method: 'PUT', headers: auth });
    assert((await submitted.text()) === '', 'Unexpected submission response');
    receipt.submissions = 1; receipt.submission_http_status = submitted.status;
    receipt.action = 'Submitted the existing owned sitemap containing the new public product and guide';
  }
  receipt.after = await row();
  assert(receipt.after?.path === sitemap && Number.isFinite(Date.parse(receipt.after.lastSubmitted)));
  if (receipt.submissions) assert(Date.parse(receipt.after.lastSubmitted) >= Date.parse(receipt.started_at) - 10000, 'Submitted timestamp did not advance');
  receipt.status = 'passed';
} catch { receipt.status = 'unavailable'; receipt.limitation = 'Read, authorization, submission or validation failed. Unavailable is not an indexing verdict; inspect this receipt before retrying.'; process.exitCode = 1; }
receipt.finished_at = new Date().toISOString();
receipt.limits = ['A successful submission and native readback do not establish crawling, indexing, ranking, clicks or buyers.', 'Only the exact owned sitemap record is retained; credentials and unrelated account records stay in memory.'];
writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, submissions: receipt.submissions, action: receipt.action || null }));
