import test from'node:test';import assert from'node:assert/strict';import{join}from'node:path';import{existsSync,copyFileSync}from'node:fs';import{Jimp}from'jimp';import{localClient}from'./refusal-client.mjs';
test('image batch, oversized output and custom watermark refusals are errors; measured capped colors remain success',async()=>{const c=await localClient();try{
 const source=join(c.dir,'synthetic.png');await new Jimp({width:32,height:32,color:0xff0000ff}).write(source);const paths=[source];for(let i=1;i<6;i++){const path=join(c.dir,`synthetic-${i}.png`);copyFileSync(source,path);paths.push(path);}
 const outDir=join(c.dir,'thumbs');const batch=await c.call('image_thumbnails',{paths,out_dir:outDir,size:16});assert.equal(batch.isError,true);assert.match(batch.text,/up to 5 files/);assert(!existsSync(outDir));
 const large=join(c.dir,'large.png');const size=await c.call('image_resize',{path:source,width:3000,height:3000,out_path:large});assert.equal(size.isError,true);assert.match(size.text,/4 MP/);assert(!existsSync(large));
 const watermark=join(c.dir,'watermark.png');assert.equal((await c.call('image_watermark',{path:source,text:'Synthetic custom',out_path:watermark})).isError,true);assert(!existsSync(watermark));
 const colors=await c.call('image_dominant_colors',{path:source,count:5});assert(!colors.isError,colors.text);assert.match(colors.text,/Pro feature/);assert.match(colors.text,/#ff0000/i);
 }finally{await c.close();}});
