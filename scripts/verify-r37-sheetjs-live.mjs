#!/usr/bin/env node
// Read-only, marked public GETs and native deployment/pin reads; no business calls.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DUPLICATE_DEMO_INPUT_SHA256, DUPLICATE_DEMO_JAVASCRIPT } from '../billing/src/duplicate-demo-bundle.js';
const output = new URL('../data/r37_sheetjs_live_verification.json', import.meta.url);
assert(!existsSync(output), 'Live evidence already exists');
const expected = { 'mcp-billing': 'c1c84ab6-4a25-43a4-a6b3-3562234ae185', 'mcp-remote': '4bd75932-3eff-4475-8df3-3c8c5ccc35d7', 'mcp-funnel': 'c09f6360-34da-4107-82ae-15e7ae4ac387' };
const origin = 'https://mcp.zovo.one';
const base = 'https://api.cloudflare.com/client/v4/accounts/dd3f2a29b7707e21a87f26a622c0bb9d';
const result = { at: new Date().toISOString(), scope: 'Marked GET-only current HTML, exact unchanged reviewed browser bytes and native sole-version/approved-pin reads. Actual hosted XLSX workflow proof has a separate earlier billing-version receipt.', checks: [], errors: [] };
async function cf(path) {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` }, signal: AbortSignal.timeout(30000) });
  assert(r.ok); return r;
}
async function versions() {
  const out = {};
  for (const [name, version] of Object.entries(expected)) {
    const body = await (await cf(`/workers/scripts/${name}/deployments`)).json(); assert(body.success);
    const d = [...body.result.deployments].sort((a,b) => Date.parse(b.created_on)-Date.parse(a.created_on))[0];
    assert.equal(d.versions.length, 1); assert.equal(d.versions[0].percentage, 100); assert.equal(d.versions[0].version_id, version);
    out[name] = { deployment_id: d.id, version, percentage: 100 };
  }
  const pin = (await (await cf('/storage/kv/namespaces/cf848cc5c07d4e0a9c7c65ad1c70055c/values/monitor:approved-version')).text()).trim();
  assert.equal(pin, expected['mcp-billing']); return { ...out, approved_billing_pin: pin };
}
async function get(path) {
  const r = await fetch(origin+path, { headers: { 'x-mcp-probe': '1', 'user-agent': 'mcp-r37-sheetjs-live-verifier/1' }, signal: AbortSignal.timeout(30000) });
  assert.equal(r.status, 200, path); return { text: await r.text(), headers: Object.fromEntries(['last-modified','cache-control','etag'].map(k => [k,r.headers.get(k)])) };
}
async function check(name, run) { try { result.checks.push({ name, status: 'passed', ...await run() }); } catch(e) { result.errors.push({ name, error: e.message }); } }
await check('sole deployments and approved pin before', async () => ({ deployments: await versions() }));
for (const id of ['spreadsheet','expense-tracker','office-suite']) await check(id+' current install', async () => {
  const page = await get('/s/'+id); assert(page.text.includes(`/releases/download/v0.22.9/${id}.mcpb`));
  assert(!/"command":\s*"npx"/.test(page.text)); return { path: '/s/'+id, version: '0.22.9', headers: page.headers };
});
await check('complete current download catalog', async () => {
  const d = JSON.parse(readFileSync(new URL('../data/release_downloads.json', import.meta.url), 'utf8'));
  const page = await get('/downloads'); for (const [name,a] of Object.entries(d.bundles)) assert(page.text.includes(a.url),name);
  return { path: '/downloads', entries: Object.keys(d.bundles).length };
});
await check('current release chronology', async () => {
  const p = await get('/changelog'); assert(p.text.includes('Current version v0.22.9'));
  assert(p.text.indexOf('<h2>v0.22.9')>=0 && p.text.indexOf('<h2>v0.22.9')<p.text.indexOf('<h2>v0.22.8'));
  return { path: '/changelog', current: '0.22.9' };
});
await check('unchanged reviewed local CSV/JSON proof', async () => {
  const path = '/assets/duplicate-demo.js?v='+DUPLICATE_DEMO_INPUT_SHA256;
  const guide = await get('/guides/check-duplicate-supplier-invoice-references-in-claude');
  assert(guide.text.includes('src="'+path+'"')); assert(guide.text.includes('id="duplicate-demo-csv-file"'));
  const asset = await get(path); assert.equal(asset.text,DUPLICATE_DEMO_JAVASCRIPT);
  const sha = createHash('sha256').update(asset.text).digest('hex'); assert.equal(sha,'607931acffaf33ee9041151006056bf8ad05daa8f64e3629f0e5bd27fbbd1449');
  return { script_url: origin+path, bytes: Buffer.byteLength(asset.text), sha256: sha, prior_browser_receipt: 'data/r37_csv_browser_live_verification.json', prior_browser_billing_version: '3376864a-7e1c-40dc-98a2-01fea2cd1af1' };
});
await check('sole deployments and approved pin after', async () => ({ deployments: await versions() }));
result.status = result.errors.length ? 'failed' : 'passed'; result.finished_at = new Date().toISOString();
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,checks:result.checks.length,errors:result.errors})); if(result.errors.length)process.exitCode=1;
