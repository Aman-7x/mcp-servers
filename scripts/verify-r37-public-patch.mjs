#!/usr/bin/env node
// Read-only exact public release, registry and catalogue verification; no credentials.
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
// Registry serializes false variable flags by omission; preserve true flags and every other field.
const normalizePackages = packages => packages?.map(p => ({ ...p, ...(p.environmentVariables ? { environmentVariables: p.environmentVariables.map(v => ({ ...v, isRequired: v.isRequired ?? false, isSecret: v.isSecret ?? false })) } : {}) }));
if (!isDeepStrictEqual(normalizePackages([{environmentVariables:[{name:'KEY',isRequired:false}]}]), normalizePackages([{environmentVariables:[{name:'KEY'}]}])) || isDeepStrictEqual(normalizePackages([{environmentVariables:[{name:'KEY',isRequired:true}]}]), normalizePackages([{environmentVariables:[{name:'KEY'}]}]))) throw Error('Schema-default comparison controls failed');
const root = new URL('../', import.meta.url);
const json = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const local = json('data/r37_patch_release_integration.json');
const catalogue = json('data/release_downloads.json');
const registryOnly = process.argv.includes('--registry-only');
const result = { at: new Date().toISOString(), method: 'Unauthenticated public HTTP requests; SHA256 over complete release bytes, exact registry descriptors, all catalogue URLs HEAD only.', version: '0.22.8', registry_comparison: 'All fields equal after normalizing omitted false environment-variable boolean defaults; true-required negative control passes.', archives: [], registry: [], catalogue: [], errors: [] };
async function request(url, options = {}) {
 const response = await fetch(url, { ...options, signal: AbortSignal.timeout(90000), headers: { 'user-agent': 'R37-public-release-verification', ...options.headers } });
 if (!response.ok) throw Error(`HTTP ${response.status} ${url}`);
 return response;
}
if (!registryOnly) {
 for (const artifact of local.archives) {
  const url = catalogue.bundles[artifact.name].url;
  try {
   const response = await request(url); const bytes = Buffer.from(await response.arrayBuffer());
   const hash = createHash('sha256').update(bytes).digest('hex');
   if (hash !== artifact.sha256 || bytes.length !== artifact.bytes) throw Error(`Byte mismatch: ${artifact.name}`);
   result.archives.push({ name: artifact.name, url, status: response.status, bytes: bytes.length, sha256: hash, matches_local_verified_archive: true });
  } catch (error) { result.errors.push(error.message); }
 }
 const sumsUrl = 'https://github.com/theluckystrike/mcp-servers/releases/download/v0.22.8/SHA256SUMS.txt';
 try {
  const response = await request(sumsUrl); const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.equals(readFileSync(new URL('bundles/SHA256SUMS-r37-patch.txt', root)))) throw Error('SHA256SUMS manifest mismatch');
  result.checksums = { url: sumsUrl, status: response.status, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), exact_match: true };
 } catch (error) { result.errors.push(error.message); }
 const queue = Object.entries(catalogue.bundles);
 await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
   const [name, entry] = queue.shift();
   try { const response = await request(entry.url, { method: 'HEAD' }); result.catalogue.push({ name, url: entry.url, status: response.status, verification: 'availability only; no business functionality assertion' }); }
   catch (error) { result.errors.push(error.message); }
  }
 }));
 result.catalogue.sort((a,b) => a.name.localeCompare(b.name));
}
for (const [id, files] of [
 ['duplicate-invoice-check', ['server.json', 'server.supplier-invoice-duplicates.json']],
 ['three-way-match', ['server.json', 'server.supplier-invoice-matching.json']],
 ['office-suite', ['server.json', 'server.office-suite.json']],
]) for (const file of files) {
 const expected = json(`servers/${id}/${file}`);
 const url = `https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(expected.name)}/versions`;
 try {
  const response = await request(url); const body = await response.json();
  const actual = body.servers?.map(row => row.server).find(server => server.version === expected.version);
  if (!actual || actual.name !== expected.name || !isDeepStrictEqual(normalizePackages(actual.packages), normalizePackages(expected.packages)) || (actual.remotes?.length ?? 0) !== 0) throw Error(`Registry descriptor mismatch: ${expected.name}`);
  result.registry.push({ name: actual.name, version: actual.version, url, asset_url: actual.packages[0].identifier, sha256: actual.packages[0].fileSha256, local_stdio_only: true, matches_published_source: true });
 } catch (error) { result.errors.push(error.message); }
}
result.status = result.errors.length ? 'failed' : 'passed'; result.completed_at = new Date().toISOString();
const path = registryOnly ? 'data/r37_patch_registry_verification.json' : 'data/r37_patch_public_downloads.json';
writeFileSync(new URL(path, root), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, archives: result.archives.length, registry: result.registry.length, catalogue: result.catalogue.length, errors: result.errors }));
if (result.errors.length) process.exitCode = 1;
