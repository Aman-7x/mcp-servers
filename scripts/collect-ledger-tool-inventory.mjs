#!/usr/bin/env node
// Persist tools/list observations of existing builds. No rebuilds or tools/call.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INVENTORY_PATH = 'data/runtime-tool-inventory.json';
export const MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const METHOD = 'MCP stdio initialize + complete paginated tools/list; no tools/call';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = path => JSON.parse(readFileSync(path, 'utf8'));

export function buildSnapshot(root = ROOT) {
  const paths = [];
  const addTree = dir => {
    if (!existsSync(dir)) return;
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, item.name);
      if (item.isDirectory()) addTree(path);
      else paths.push(path);
    }
  };
  for (const file of ['package.json', 'package-lock.json', 'node_modules/.package-lock.json']) {
    if (existsSync(join(root, file))) paths.push(join(root, file));
  }
  for (const group of ['packages', 'servers']) {
    for (const item of readdirSync(join(root, group), { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const dir = join(root, group, item.name);
      if (existsSync(join(dir, 'package.json'))) paths.push(join(dir, 'package.json'));
      addTree(join(dir, 'src')); addTree(join(dir, 'dist'));
    }
  }
  const hash = createHash('sha256');
  const runtime = { node_version: process.version, platform: process.platform, arch: process.arch };
  hash.update(JSON.stringify(runtime));
  for (const path of paths.sort()) {
    hash.update('\0' + relative(root, path).split('\\').join('/') + '\0');
    hash.update(createHash('sha256').update(readFileSync(path)).digest());
  }
  return { sha256: hash.digest('hex'), file_count: paths.length, ...runtime,
    scope: 'All workspace package.json, src and dist bytes; root package/lock and installed dependency lock; Node version/platform/architecture. Conservative shared fingerprint covers proxy children and local dependency closure.' };
}

export function inventoryForServer(database, id, version, snapshot, now = Date.now()) {
  const record = database?.servers?.[id];
  const provenance = { source: INVENTORY_PATH, method: METHOD, measured_at: record?.measured_at ?? null,
    status: 'unmeasured', reason: 'No runtime inventory', built_entry: `servers/${id}/dist/index.js`,
    version: record?.version ?? null, build_fingerprint: record?.build_fingerprint ?? null,
    max_age_hours: MAX_AGE_MS / 3_600_000 };
  const unavailable = (status, reason) => ({ tools: [], tool_count: null, tool_inventory: { ...provenance, status, reason } });
  if (!record) return unavailable('unmeasured', 'No runtime inventory');
  if (record.status !== 'complete') return unavailable(record.status === 'partial' ? 'partial' : 'unmeasured', record.error || 'Runtime inventory failed');
  if (typeof version !== 'string' || record.version !== version || record.built_entry !== provenance.built_entry) return unavailable('stale', 'Package version or built entry changed');
  const measured = Date.parse(record.measured_at);
  if (!Number.isFinite(measured) || now - measured > MAX_AGE_MS || measured - now > 300_000) return unavailable('stale', 'Measurement timestamp missing, expired or in the future');
  if (!snapshot || !/^[a-f0-9]{64}$/.test(record.build_fingerprint || '') || record.build_fingerprint !== snapshot.sha256) return unavailable('stale', 'Current build/dependency fingerprint differs or cannot be verified');
  if (database.schema_version !== 1 || record.method !== METHOD || !Array.isArray(record.tools) || !record.tools.length || record.tools.some(t => typeof t?.name !== 'string' || !t.name) || new Set(record.tools.map(t => t.name)).size !== record.tools.length) return unavailable('unmeasured', 'Malformed, empty or duplicate tool inventory');
  return { tools: record.tools.map(t => t.name), tool_count: record.tools.length, tool_inventory: { ...provenance, status: 'measured', reason: null } };
}

async function collect(ids) {
  const { collectRuntimeTools } = await import('./runtime-tool-inventory.mjs');
  const before = buildSnapshot();
  let old;
  try { old = json(join(ROOT, INVENTORY_PATH)); } catch { old = {}; }
  const database = { schema_version: 1, generated_at: new Date().toISOString(), build_snapshot: before, servers: old.servers || {} };
  const available = readdirSync(join(ROOT, 'servers'), { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(ROOT, 'servers', d.name, 'package.json'))).map(d => d.name).sort();
  const selected = ids.length ? ids : available;
  for (const id of selected) {
    if (!available.includes(id)) throw Error(`Unknown server id: ${id}`);
    const pkg = json(join(ROOT, 'servers', id, 'package.json'));
    const built_entry = `servers/${id}/dist/index.js`;
    const record = { status: 'failed', measured_at: new Date().toISOString(), method: METHOD, version: pkg.version, built_entry, build_fingerprint: before.sha256 };
    try {
      if (!existsSync(join(ROOT, built_entry))) throw Error('Built entry is missing; no build was attempted');
      record.tools = await collectRuntimeTools(join(ROOT, built_entry));
      record.status = 'complete';
      console.error(`${id}: ${record.tools.length} runtime tools`);
    } catch (error) {
      record.error = error.message;
      console.error(`${id}: unmeasured (${record.error})`);
    }
    database.servers[id] = record;
  }
  const after = buildSnapshot();
  if (before.sha256 !== after.sha256) {
    for (const id of selected) {
      database.servers[id].status = 'failed';
      database.servers[id].error = 'Build/dependency snapshot changed during collection; repeat collection';
    }
  }
  database.generated_at = new Date().toISOString();
  database.collection = {
    status: selected.every(id => database.servers[id].status === 'complete') ? 'complete' : 'partial',
    requested_servers: selected.length,
    complete_servers: selected.filter(id => database.servers[id].status === 'complete').length,
    unmeasured_servers: selected.filter(id => database.servers[id].status !== 'complete').length,
  };
  const path = join(ROOT, INVENTORY_PATH), temporary = path + `.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(database, null, 2) + '\n'); renameSync(temporary, path);
  if (selected.some(id => database.servers[id].status !== 'complete')) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await collect(process.argv.slice(2));
