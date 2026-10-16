import test from'node:test';import assert from'node:assert/strict';import{join}from'node:path';import{mkdirSync,writeFileSync,existsSync,readFileSync}from'node:fs';import{localClient}from'./refusal-client.mjs';
test('zip entry and monthly caps return errors without files, while existing archives remain readable',async()=>{const c=await localClient();try{
 const input=join(c.dir,'input');mkdirSync(input);for(let i=0;i<201;i++)writeFileSync(join(input,`synthetic-${i}.txt`),'synthetic');
 const denied=join(c.dir,'denied.zip');const cap=await c.call('zip_create',{dir:input,out_path:denied});assert.equal(cap.isError,true);assert.match(cap.text,/up to 200 entries/);assert(!existsSync(denied));
 const one=join(input,'synthetic-0.txt');for(let i=0;i<20;i++){const r=await c.call('zip_create',{paths:[one],out_path:join(c.dir,`synthetic-${i}.zip`)});assert(!r.isError,r.text);}
 const monthly=await c.call('zip_create',{paths:[one],out_path:join(c.dir,'monthly-cap.zip')});assert.equal(monthly.isError,true);assert.match(monthly.text,/20 archives per calendar month/);assert(!existsSync(join(c.dir,'monthly-cap.zip')));
 const existing=join(c.dir,'synthetic-0.zip'),before=readFileSync(existing);const add=await c.call('zip_add',{path:existing,paths:[join(input,'synthetic-1.txt')]});assert.equal(add.isError,true);assert.deepEqual(readFileSync(existing),before);
 const listed=await c.call('zip_list',{path:existing});assert(!listed.isError,listed.text);assert.match(listed.text,/synthetic-0.txt/);
 }finally{await c.close();}});
