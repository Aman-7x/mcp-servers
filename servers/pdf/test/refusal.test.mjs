import test from'node:test';import assert from'node:assert/strict';import{join}from'node:path';import{writeFileSync,existsSync}from'node:fs';import{PDFDocument}from'pdf-lib';import{localClient}from'./refusal-client.mjs';
test('PDF six-file merge refusal is an error without output; two-file merge and info succeed',async()=>{const c=await localClient();try{
 const document=await PDFDocument.create();document.addPage([100,100]);const bytes=await document.save();const paths=[];for(let i=0;i<6;i++){const path=join(c.dir,`synthetic-${i}.pdf`);writeFileSync(path,bytes);paths.push(path);}
 const denied=join(c.dir,'denied.pdf');const r=await c.call('pdf_merge',{paths,out_path:denied});assert.equal(r.isError,true);assert.match(r.text,/up to 5 files/);assert(!existsSync(denied));
 const output=join(c.dir,'two.pdf');const made=await c.call('pdf_merge',{paths:paths.slice(0,2),out_path:output});assert(!made.isError,made.text);assert(existsSync(output));const info=await c.call('pdf_info',{path:output});assert(!info.isError,info.text);assert.match(info.text,/2/);
 }finally{await c.close();}});
