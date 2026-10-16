#!/usr/bin/env node
// Cleanup for rebuildable bundle output only. Never follows a folder outside
// bundles/, and refuses removal while any process has a handle open there.
import { appendFileSync, existsSync, lstatSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundles = join(root, 'bundles');
export function removeBuildOutput(input) {
  const path = resolve(input);
  const rel = relative(bundles, path);
  if (!rel || rel.startsWith('..') || resolve(bundles, rel) !== path) throw Error('Refusing removal outside a bundle output');
  if (!existsSync(path)) return;
  const parent = realpathSync(dirname(path));
  if (parent !== bundles && !parent.startsWith(bundles + '/')) throw Error('Refusing symlinked parent outside bundles');
  const stat = lstatSync(path);
  const handles = spawnSync('/usr/sbin/lsof', stat.isDirectory() ? ['-t', '+D', path] : ['-t', '--', path], { encoding: 'utf8' });
  if (handles.error || handles.status !== 1 || handles.stdout.trim()) throw Error('Refusing removal: lsof did not establish zero open handles');
  function bytes(p) { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; }
  appendFileSync(join(root, 'data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path, bytes: bytes(path), lsof: 'no open handles', reason: 'replace derived bundle output' }) + '\n');
  rmSync(path, { recursive: stat.isDirectory() });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw Error('Usage: remove-build-output.mjs <bundle output>');
  removeBuildOutput(process.argv[2]);
}
