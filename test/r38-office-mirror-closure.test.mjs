import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const project = new URL('../', import.meta.url);
const source = readFileSync(new URL('scripts/sync-mirrors.sh', project), 'utf8');
const program = /<<'PYOFFICE'\n([\s\S]*?)\nPYOFFICE/.exec(source)?.[1];
assert(program, 'Missing authoritative Office mirror dependency derivation');
const base = join(homedir(), 'mcp-servers-work'); mkdirSync(base, { recursive: true });
const scope = mkdtempSync(join(base, 'r38-mirror-closure-test-'));
const writeJson = (path, value) => writeFileSync(path, JSON.stringify(value));
function fixture(name) {
  const root = join(scope, name); mkdirSync(join(root, 'servers/office-suite/src'), { recursive: true });
  const target = join(root, 'mirror.json');
  writeJson(target, { dependencies: { '@modelcontextprotocol/sdk': '^1.30.0', '@theluckystrike/mcp-one': '^0.22.8' } });
  for (const [id, version] of [['one', '0.22.8'], ['two', '0.25.0']]) {
    const path = join(root, 'servers', id); mkdirSync(join(path, 'dist'), { recursive: true });
    writeJson(join(path, 'package.json'), { name: '@theluckystrike/mcp-' + id, version });
    writeFileSync(join(path, 'dist/index.js'), '// synthetic existence fixture\n');
  }
  const declaration = 'const CHILDREN: ChildDef[] = [\n  { id: "one", pkg: "@theluckystrike/mcp-one" },\n  { id: "two", pkg: "@theluckystrike/mcp-two", optional: true },\n];';
  const path = join(root, 'servers/office-suite/src/index.ts'); writeFileSync(path, declaration);
  return { root, target, path, declaration, run: () => spawnSync('python3', ['-c', program, root, target], { encoding: 'utf8' }) };
}

test('Office mirror includes optional source children absent from package.json without changing source packages', () => {
  const f = fixture('optional');
  const before = readFileSync(join(f.root, 'servers/two/package.json'), 'utf8');
  assert.equal(f.run().status, 0);
  const deps = JSON.parse(readFileSync(f.target)).dependencies;
  assert.deepEqual(deps, { '@modelcontextprotocol/sdk': '^1.30.0', '@theluckystrike/mcp-one': '^0.22.8', '@theluckystrike/mcp-two': '^0.25.0' });
  assert.equal(readFileSync(join(f.root, 'servers/two/package.json'), 'utf8'), before);
  assert(source.includes("' \"$MIRROR/package.json\"); do"), 'Vendoring must consume the augmented mirror map');
});

test('Office mirror refuses incomplete builds or package identity mismatches rather than dropping children', () => {
  const missing = fixture('missing');
  const badPath = join(missing.root, 'servers/two/package.json');
  writeJson(badPath, { name: '@theluckystrike/mcp-different', version: '0.25.0' });
  assert.notEqual(missing.run().status, 0);
  const noBuild = fixture('no-build');
  // Retain the owned fixture bytes while making the declared build unavailable.
  renameSync(join(noBuild.root, 'servers/two/dist/index.js'), join(noBuild.root, 'servers/two/dist/index.js.held'));
  assert.notEqual(noBuild.run().status, 0);
});

test('Office mirror rejects empty or duplicate source child declarations', () => {
  const empty = fixture('empty'); writeFileSync(empty.path, 'const CHILDREN: ChildDef[] = [\n];');
  assert.notEqual(empty.run().status, 0);
  const duplicate = fixture('duplicate'); writeFileSync(duplicate.path, duplicate.declaration.replace('id: "two"', 'id: "one"'));
  assert.notEqual(duplicate.run().status, 0);
});

process.on('exit', () => {
  if (!existsSync(scope)) return;
  const handles = spawnSync(process.platform === 'darwin' ? '/usr/sbin/lsof' : 'lsof', ['-t', '+D', scope], { encoding: 'utf8' });
  if (handles.status !== 1 || handles.stdout.trim()) return;
  const bytes = path => { const stat = lstatSync(path); return stat.isDirectory() ? readdirSync(path).reduce((n, name) => n + bytes(join(path, name)), 0) : stat.size; };
  appendFileSync(new URL('data/build-deletions.jsonl', project), JSON.stringify({ at: new Date().toISOString(), path: scope, bytes: bytes(scope), lsof: 'no open handles', reason: 'Completed minimal Office mirror dependency regression fixtures' }) + '\n');
  rmSync(scope, { recursive: true });
});
