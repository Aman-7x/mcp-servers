#!/usr/bin/env node
// One bounded notification for this release's changed owned pages, never a loop.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url), file = new URL('data/r38_indexnow_submission.json', root);
assert(process.argv.length === 3 && process.argv[2] === '--submit-once' && !existsSync(file));
const origin = 'https://mcp.zovo.one';
const source = readFileSync(new URL('billing/src/index.js', root), 'utf8');
const keys = [...source.matchAll(/path === "\/([a-f0-9]{32})\.txt"/g)].map(m => m[1]);
assert(keys.length === 1);
const key = keys[0], keyLocation = origin + '/' + key + '.txt';
const paths = ['/', '/servers', '/s/supplier-statement-check', '/guides/compare-supplier-statement-ap-open-items-in-claude', '/compare/supplier-statement-check', '/downloads', '/changelog', '/guides', '/compare', '/s/duplicate-invoice-check', '/s/three-way-match'];
const urls = paths.map(path => origin + path);
const receipt = { started_at: new Date().toISOString(), status: 'prepared', endpoint: 'https://api.indexnow.org/indexnow', urls, key_location: keyLocation, submissions: 0, scope: 'One notification of changed owned pages, after marked GET and ownership-key checks. No contact, email, account, Checkout or business tool.', documentation: 'https://www.indexnow.org/documentation' };
writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
try {
  const headers = { 'x-mcp-probe': '1', 'user-agent': 'r38-indexnow-release-check/1' };
  const ownership = await fetch(keyLocation, { headers, signal: AbortSignal.timeout(20000) });
  assert(ownership.ok && (await ownership.text()).trim() === key);
  receipt.ownership_key_verified = true;
  receipt.public_checks = await Promise.all(urls.map(async url => {
    assert(new URL(url).origin === origin);
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20000) }); assert(response.status === 200);
    return { url, http_status: response.status };
  }));
  // Persist intent before the one POST. A timeout is ambiguous and is not retried.
  receipt.status = 'submission_started'; receipt.submissions = 1;
  writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
  const response = await fetch(receipt.endpoint, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host: 'mcp.zovo.one', key, keyLocation, urlList: urls }), signal: AbortSignal.timeout(25000) });
  const body = await response.text();
  receipt.http_status = response.status; receipt.response_bytes = Buffer.byteLength(body); receipt.response_sha256 = createHash('sha256').update(body).digest('hex');
  assert([200, 202].includes(response.status));
  receipt.status = 'received';
  receipt.interpretation = response.status === 202 ? 'URLs received; IndexNow ownership-key validation is pending.' : 'URLs received by the submission endpoint.';
} catch { receipt.status = 'unavailable'; receipt.limitation = 'Validation, read or submission failed. A started POST may have committed; preserve this receipt and do not automatically resubmit.'; process.exitCode = 1; }
receipt.finished_at = new Date().toISOString();
receipt.limits = ['Receipt does not prove page crawling, indexing, ranking, traffic or buyers.', 'This notification is separate from the existing Google sitemap submission; no repeated or all-estate submission was made.'];
writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, http_status: receipt.http_status ?? null, changed_urls: urls.length, submissions: receipt.submissions }));
