#!/usr/bin/env node
// Local packaging gate only: this does not certify every child's business features.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
const source=read(join(root,'servers/office-suite/src/index.ts'));
const block=/const CHILDREN: ChildDef\[\] = \[([\s\S]*?)\n\];/.exec(source);
assert(block,'Missing CHILDREN declaration');
const children=[...block[1].matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*pkg:\s*"([^"]+)"/g)].map(m=>({id:m[1],pkg:m[2]}));
assert(children.length>0);assert.equal(new Set(children.map(c=>c.id)).size,children.length,'Duplicate child IDs');
const build=read(join(root,'scripts/build-mcpb.sh'));
const ids=(/^SERVERS="([^"]*)"/m.exec(build)?.[1]||'').split(/\s+/).filter(Boolean);
assert.deepEqual([...ids].sort(),children.map(c=>c.id).sort(),'Build and proxy child lists differ');
const dirs=[join(root,'servers/office-suite'),...children.map(c=>join(root,'servers',c.id))];
const checked=new Set();
function check(dir,expectedName){
 if(checked.has(dir))return;checked.add(dir);
 const p=json(join(dir,'package.json'));if(expectedName)assert.equal(p.name,expectedName);
 assert(existsSync(join(dir,'dist/index.js')),`${p.name}: missing dist/index.js`);
 if(dir.startsWith(join(root,'servers')+'/')){
 for(const f of ['src/version.ts','dist/version.js'])assert(existsSync(join(dir,f)),`${p.name}: missing ${f}`);
 const sourceVersion=/VERSION\s*=\s*["']([^"']+)["']/.exec(read(join(dir,'src/version.ts')))?.[1];
 const distVersion=/VERSION\s*=\s*["']([^"']+)["']/.exec(read(join(dir,'dist/version.js')))?.[1];
 assert.equal(sourceVersion,p.version,`${p.name}: stale source version`);assert.equal(distVersion,p.version,`${p.name}: stale compiled version`);
 }
 for(const[name,range]of Object.entries(p.dependencies||{})){
  if(!name.startsWith('@theluckystrike/'))continue;
  const base=name.slice('@theluckystrike/'.length);
  const target=[join(root,'packages',base),join(root,'servers',base.replace(/^mcp-/,''))].find(d=>existsSync(join(d,'package.json')));
  assert(target,`${name}: missing dependency source`);
  const dependency=json(join(target,'package.json'));
  assert.equal(range,`^${dependency.version}`,`${p.name}: ${name} range mismatches its actual version`);
  check(target,name);
 }
}
for(let i=0;i<dirs.length;i++)check(dirs[i],i?children[i-1].pkg:'@theluckystrike/mcp-office-suite');
console.log(`office packaging inputs: ${children.length} children, ${checked.size} package closures; source/dist/package versions and dependency ranges agree. Business features of older children are not certified.`);
