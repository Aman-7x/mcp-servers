import test from 'node:test';import assert from 'node:assert/strict';import{join}from'node:path';import{existsSync}from'node:fs';import{localClient}from'./refusal-client.mjs';
test('expense project, rule, format and row caps are errors; free CSV and clamped reads still succeed',async()=>{const c=await localClient();try{
 const today=new Date().toISOString().slice(0,10);
 for(const project of ['Synthetic A','Synthetic B','Synthetic C'])assert(!(await c.call('expense_add',{amount:10,currency:'USD',project,merchant:'Synthetic merchant',date:today})).isError);
 const fourth=await c.call('expense_add',{amount:10,project:'Synthetic D'});assert.equal(fourth.isError,true);assert.match(fourth.text,/expense was not saved/);
 assert.equal((await c.call('category_rules',{rules:Array.from({length:6},(_,i)=>({match:`Synthetic ${i}`,category:'synthetic'}))})).isError,true);
 const xlsx=join(c.dir,'synthetic.xlsx');assert.equal((await c.call('expense_export',{from:today,to:today,format:'xlsx',path:xlsx})).isError,true);assert(!existsSync(xlsx));
 const csv=join(c.dir,'synthetic.csv');assert(!(await c.call('expense_export',{from:today,to:today,format:'csv',path:csv})).isError);assert(existsSync(csv));
 for(let i=0;i<198;i++)assert(!(await c.call('expense_add',{amount:10,currency:'USD',project:'Synthetic A',merchant:`Synthetic merchant ${i}`,date:today})).isError);
 const over=join(c.dir,'over.csv');const cap=await c.call('expense_export',{from:today,to:today,format:'csv',path:over});assert.equal(cap.isError,true);assert.match(cap.text,/201 expenses/);assert(!existsSync(over));
 const rebill=await c.call('expense_to_invoice',{project:'Synthetic A',from:today,to:today});assert.equal(rebill.isError,true);assert.match(rebill.text,/Nothing was changed/);
 const partial=await c.call('expense_list',{from:'2020-01-01',to:today});assert(!partial.isError,partial.text);assert.match(partial.text,/Pro feature/);assert.match(partial.text,/Synthetic merchant/);
 }finally{await c.close();}});
