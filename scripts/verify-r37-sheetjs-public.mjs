#!/usr/bin/env node
// Exact unauthenticated publication checks. Does not install or create business traffic.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
const root = new URL('../', import.meta.url);
const output = process.argv[2];
assert(process.argv.length === 3 && /^data\/r37_sheetjs_[a-z0-9_]+\.json$/.test(output || ''), 'Supply a new R37 SheetJS evidence JSON path');
assert(!existsSync(new URL(output, root)), 'Evidence output already exists');
const json = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const norm = ps => ps?.map(p => ({ ...p, ...(p.environmentVariables ? { environmentVariables: p.environmentVariables.map(v => ({ ...v, isRequired: v.isRequired ?? false, isSecret: v.isSecret ?? false })) } : {}) }));
assert(isDeepStrictEqual(norm([{environmentVariables:[{name:'K',isRequired:false}]}]),norm([{environmentVariables:[{name:'K'}]}])));
assert(!isDeepStrictEqual(norm([{environmentVariables:[{name:'K',isRequired:true}]}]),norm([{environmentVariables:[{name:'K'}]}])));
const local = json('data/r37_sheetjs_artifacts.json');
assert.equal(local.status, 'passed');
const catalogue = json('data/release_downloads.json');
const result = { at: new Date().toISOString(), method: 'Unauthenticated full-byte GETs, exact registry descriptor comparisons with documented omitted-false defaults, and catalogue HEAD availability only', archives: [], registry: [], catalogue: [], errors: [] };
async function request(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(90000), headers: { 'user-agent': 'R37-SheetJS-public-verification', 'x-mcp-probe': '1', ...options.headers } });
  assert(r.ok, `HTTP ${r.status} ${url}`); return r;
}
for (const a of local.archives) {
  const url = catalogue.bundles[a.name].url;
  try {
    const r = await request(url), b = Buffer.from(await r.arrayBuffer()), sha = createHash('sha256').update(b).digest('hex');
    assert.equal(b.length, a.bytes); assert.equal(sha, a.sha256);
    result.archives.push({ name: a.name, url, bytes: b.length, sha256: sha, status: r.status, matches_independently_verified_archive: true });
  } catch (e) { result.errors.push(String(e.message)); }
}
try {
  const url = 'https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.9/SHA256SUMS.txt';
  const b = Buffer.from(await (await request(url)).arrayBuffer());
  assert(b.equals(readFileSync(new URL('bundles/SHA256SUMS-r37-sheetjs.txt', root))));
  result.checksums = { url, bytes: b.length, exact_match: true };
} catch (e) { result.errors.push(String(e.message)); }
for (const [id, files] of [
  ['spreadsheet', ['server.json', 'server.pivot.json']],
  ['expense-tracker', ['server.json', 'server.expense-tracker.json']],
  ['office-suite', ['server.json', 'server.office-suite.json']],
]) for (const file of files) {
  const expected = json(`servers/${id}/${file}`);
  const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(expected.name)}/versions`;
  try {
    const body = await (await request(url)).json();
    const actual = body.servers?.map(row => row.server).find(s => s.version === expected.version);
    assert(actual && actual.name === expected.name);
    assert(isDeepStrictEqual(norm(actual.packages), norm(expected.packages)), `Registry package mismatch ${expected.name}`);
    assert.equal(actual.remotes?.length ?? 0, 0);
    result.registry.push({ name: actual.name, version: actual.version, url, asset_url: actual.packages[0].identifier, sha256: actual.packages[0].fileSha256, matches_published_source: true });
  } catch (e) { result.errors.push(`${expected.name}: ${e.message}`); }
}
const queue = Object.entries(catalogue.bundles);
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const [name, a] = queue.shift();
    try { const r = await request(a.url, { method: 'HEAD' }); result.catalogue.push({ name, url: a.url, status: r.status }); }
    catch (e) { result.errors.push(String(e.message)); }
  }
}));
result.catalogue.sort((a,b) => a.name.localeCompare(b.name));
result.status = result.errors.length ? 'failed' : 'passed'; result.finished_at = new Date().toISOString();
writeFileSync(new URL(output, root), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: result.status, archives: result.archives.length, registry: result.registry.length, catalogue: result.catalogue.length, errors: result.errors }));
if (result.errors.length) process.exitCode = 1;
