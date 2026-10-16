import test from 'node:test';import assert from 'node:assert/strict';import{join}from'node:path';import{writeFileSync,existsSync}from'node:fs';import{localClient}from'./refusal-client.mjs';
test('bank account, category-rule and export refusals are errors; clamped transaction results remain successful',async()=>{const c=await localClient();try{
 const today=new Date().toISOString().slice(0,10);const path=join(c.dir,'synthetic.csv');writeFileSync(path,`Date,Description,Amount,Currency\n${today},Synthetic fee,-10.00,EUR\n`);
 for(const account of ['Synthetic A','Synthetic B']){const r=await c.call('statement_import',{path,account,bank:'generic',currency:'EUR'});assert(!r.isError,r.text);}
 const third=await c.call('statement_import',{path,account:'Synthetic C',bank:'generic',currency:'EUR'});assert.equal(third.isError,true);assert.match(third.text,/account number 3/);
 const rules=Array.from({length:6},(_,i)=>({match:`Synthetic ${i}`,category:'synthetic'}));assert.equal((await c.call('category_rules',{rules})).isError,true);
 const out=join(c.dir,'export.csv');assert.equal((await c.call('statement_export',{from:today,to:today,format:'csv',path:out})).isError,true);assert(!existsSync(out));
 const list=await c.call('transactions_list',{from:'2020-01-01',to:today});assert(!list.isError,list.text);assert.match(list.text,/Pro feature/);assert.match(list.text,/Synthetic fee/);
 }finally{await c.close();}});
