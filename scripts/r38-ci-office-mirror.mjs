#!/usr/bin/env node
// Key-independent clean-clone Office proof. Mutates only the CI checkout and owned work.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

if (process.env.CI !== 'true' || process.platform !== 'linux') throw Error('This clean-clone pipeline runs on the Linux CI runner, not the local Mac');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(homedir(), 'mcp-servers-work'); mkdirSync(work, { recursive: true });
const output = join(root, 'data/r38_ci_office_mirror'); mkdirSync(output, { recursive: true });
const receiptPath = join(output, 'receipt.json');
const json = path => JSON.parse(readFileSync(path, 'utf8'));
const receipt = { started_at: new Date().toISOString(), status: 'running', source_commit: process.env.GITHUB_SHA || null, node: process.version, platform: process.platform, commands: [], external_publications: 0, production_credentials_required: false };
const save = () => writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
const env = { ...process.env, TMPDIR: work, npm_config_cache: join(work, 'npm-cache'), DRY_RUN: '1', NO_RELEASE: '1', SQUASH: '0' };
let mirror;
const run = (label, command, args, cwd = root) => {
  const path = join(output, label + '.log');
  const fd = openSync(path, 'w');
  const started = Date.now();
  let result;
  try { result = spawnSync(command, args, { cwd, env, stdio: ['ignore', fd, fd], timeout: 15 * 60 * 1000 }); }
  finally { closeSync(fd); }
  const step = { label, command: [command, ...args], exit_code: result.status, signal: result.signal || null, seconds: (Date.now() - started) / 1000, log: 'data/r38_ci_office_mirror/' + label + '.log' };
  receipt.commands.push(step); save();
  console.log(`${label}: ${result.status === 0 ? 'passed' : 'failed'} (${step.seconds.toFixed(2)}s)`);
  if (result.error || result.status !== 0) throw Error(label + ' failed; inspect the uploaded command log');
  return readFileSync(path, 'utf8');
};
const size = path => { const st = lstatSync(path); return st.isDirectory() ? readdirSync(path).reduce((n, name) => n + size(join(path, name)), 0) : st.size; };

try {
  save();
  // npm ci is a workflow step; this bootstrap is a required generated timezone input.
  run('bootstrap-timezone', process.execPath, ['scripts/bootstrap-timezone.mjs']);
  const packages = new Map();
  for (const group of ['packages', 'servers']) for (const entry of readdirSync(join(root, group), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, group, entry.name), path = join(dir, 'package.json');
    if (!existsSync(path)) continue;
    const pkg = json(path); assert(!packages.has(pkg.name), 'Duplicate workspace package identity');
    packages.set(pkg.name, { pkg, dir, workspace: group + '/' + entry.name });
  }
  const source = readFileSync(join(root, 'servers/office-suite/src/index.ts'), 'utf8');
  const block = /const CHILDREN: ChildDef\[\] = \[([\s\S]*?)\n\];/.exec(source); assert(block);
  const children = [...block[1].matchAll(/\{\s*id:\s*"([a-z0-9-]+)"\s*,\s*pkg:\s*"(@theluckystrike\/mcp-[a-z0-9-]+)"/g)].map(m => ({ id: m[1], pkg: m[2] }));
  assert(children.length > 0); assert.equal(new Set(children.map(c => c.id)).size, children.length);
  for (const child of children) assert.equal(packages.get(child.pkg)?.workspace, 'servers/' + child.id);
  // The explicit bootstrap above breaks license/profile -> timezone/lib -> license.
  // Compile those two complete packages in that proven order, then sort the rest.
  const baseNames = ['@theluckystrike/mcp-license', '@theluckystrike/mcp-timezone'];
  const ordered = [], built = new Set(baseNames), active = new Set();
  for (const name of baseNames) {
    const value = packages.get(name); assert(value?.pkg.scripts?.build, 'Missing bootstrap package ' + name);
    assert(Object.keys(value.pkg.dependencies || {}).filter(n => n.startsWith('@theluckystrike/')).every(n => baseNames.includes(n)), 'Bootstrap dependency changed; review its order');
    ordered.push(value);
  }
  function visit(name) {
    if (built.has(name)) return;
    assert(!active.has(name), 'Local dependency cycle at ' + name);
    const value = packages.get(name); assert(value, 'Missing local dependency ' + name);
    active.add(name);
    for (const dependency of Object.keys(value.pkg.dependencies || {}).filter(n => n.startsWith('@theluckystrike/')).sort()) visit(dependency);
    assert(value.pkg.scripts?.build, 'Missing declared build script for ' + name);
    active.delete(name); built.add(name); ordered.push(value);
  }
  for (const name of [...children.map(c => c.pkg), '@theluckystrike/mcp-office-suite']) visit(name);
  receipt.source_children = children; receipt.build_order = ordered.map(p => p.workspace); save();
  for (const [index, p] of ordered.entries()) run(`build-${String(index).padStart(2, '0')}-${p.workspace.split('/').at(-1)}`, 'npm', ['run', 'build', '--workspace', p.workspace]);
  run('closure-regression', process.execPath, ['--test', 'test/r38-office-mirror-closure.test.mjs']);
  const generated = run('generate-office-mirror', 'bash', ['scripts/sync-mirrors.sh', 'office-suite']);
  mirror = /DRY_RUN: mirror built at (.+) \(not pushed\)/.exec(generated)?.[1];
  assert(mirror && resolve(mirror).startsWith(work + '/mirror-office-suite.'), 'Missing owned standalone mirror path');
  assert(!resolve(mirror).startsWith(root + '/'), 'Mirror must live outside the monorepo');
  const mirrorPackage = json(join(mirror, 'package.json'));
  for (const child of children) {
    const name = child.pkg.split('/')[1];
    assert.equal(mirrorPackage.dependencies[child.pkg], 'file:vendor/' + name);
    assert(existsSync(join(mirror, 'vendor', name, 'dist/index.js')));
  }
  receipt.mirror = { path: mirror, child_count: children.length, all_source_children_vendored: true }; save();
  run('mirror-install', 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], mirror);
  run('mirror-build', 'npm', ['run', 'build'], mirror);
  const tests = run('mirror-tests', 'npm', ['test'], mirror);
  const counts = Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, Number(tests.split('\n').find(line => line.startsWith('# ' + key + ' '))?.slice(key.length + 3))]));
  assert(Number.isFinite(counts.tests) && counts.tests > 0 && counts.fail === 0, 'Mirror test result lacks complete passing counts');
  receipt.mirror.tests = counts; save();
  run('actual-mirror-runtime', process.execPath, ['scripts/r38-verify-office-mirror.mjs', '--directory', mirror]);
  const runtime = json(join(root, 'data/r38_public_distribution_office_runtime.json'));
  assert.equal(runtime.status, 'passed'); assert.equal(runtime.tools, json(join(root, 'bundles/office-suite/manifest.json')).tools.length);
  copyFileSync(join(root, 'data/r38_public_distribution_office_runtime.json'), join(output, 'runtime.json'));
  receipt.mirror.runtime_tools = runtime.tools; receipt.mirror.version = runtime.version;
  receipt.status = 'passed';
} catch (error) {
  receipt.status = 'failed'; receipt.error = error.message; process.exitCode = 1;
} finally {
  if (mirror && existsSync(mirror)) {
    const handles = spawnSync('lsof', ['-t', '+D', mirror], { encoding: 'utf8' });
    if (handles.status === 1 && !handles.stdout.trim()) {
      const deletion = { at: new Date().toISOString(), path: mirror, bytes: size(mirror), lsof: 'no open handles', reason: 'Completed owned CI Office mirror build and verification artifact workspace' };
      appendFileSync(join(root, 'data/build-deletions.jsonl'), JSON.stringify(deletion) + '\n');
      writeFileSync(join(output, 'mirror-cleanup.json'), JSON.stringify(deletion, null, 2) + '\n');
      rmSync(mirror, { recursive: true }); receipt.mirror_removed = true;
    } else { receipt.mirror_removed = false; receipt.status = 'failed'; receipt.error = 'Mirror retained because lsof did not prove zero handles'; process.exitCode = 1; }
  }
  receipt.finished_at = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: receipt.status, children: receipt.source_children?.length, built_packages: receipt.build_order?.length, runtime_tools: receipt.mirror?.runtime_tools, evidence: 'data/r38_ci_office_mirror/receipt.json' }));
}
