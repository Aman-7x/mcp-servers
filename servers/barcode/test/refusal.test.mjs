import test from'node:test';import assert from'node:assert/strict';import{join}from'node:path';import{existsSync}from'node:fs';import{localClient}from'./refusal-client.mjs';
test('barcode PNG and batch refusals are errors; free measured SVG generation succeeds',async()=>{const c=await localClient();try{
 const out=join(c.dir,'denied.png');const png=await c.call('qr_create',{text:'Synthetic example',format:'png',out_path:out});assert.equal(png.isError,true);assert.match(png.text,/Pro feature/);assert(!existsSync(out));
 const batch=await c.call('barcode_batch',{out_dir:join(c.dir,'batch'),items:[{value:'SYNTHETIC',symbology:'code128'}]});assert.equal(batch.isError,true);assert.match(batch.text,/Pro feature/);
 const svg=await c.call('qr_create',{text:'Synthetic example',format:'svg'});assert(!svg.isError,svg.text);assert.match(svg.text,/<svg/);
 }finally{await c.close();}});
