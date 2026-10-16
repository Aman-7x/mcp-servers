import test from 'node:test';import assert from 'node:assert/strict';import{join}from'node:path';import{mkdirSync,writeFileSync}from'node:fs';import{localClient}from'./refusal-client.mjs';
test('currency wholly unread range is an error; cached partial history and clamped conversion remain successes without external fetches',async()=>{
 const c=await localClient({env:{ECB_BASE_URL:'http://127.0.0.1:1/fixture-only'},setup(dir){const path=join(dir,'mcp-servers','currency');mkdirSync(path,{recursive:true});const days={};for(let i=0;i<=90;i++)days[new Date(Date.now()-i*86400000).toISOString().slice(0,10)]={USD:1.1,PLN:4.3};writeFileSync(join(path,'history.json'),JSON.stringify({version:1,fetched_at:new Date().toISOString(),days}));}});
 try{const rejected=await c.call('rate_history',{from:'USD',to:'PLN',from_date:'2000-01-01',to_date:'2000-02-01'});assert.equal(rejected.isError,true);assert.match(rejected.text,/Nothing was looked up/);
 const partial=await c.call('rate_history',{from:'USD',to:'PLN',days:180});assert(!partial.isError,partial.text);assert.match(partial.text,/Pro feature/);assert(JSON.parse(partial.text).rates.length>0);
 const converted=await c.call('convert',{amount:100,from:'USD',to:'PLN',date:'2000-01-01'});assert(!converted.isError,converted.text);assert.match(converted.text,/Pro feature/);const result=JSON.parse(converted.text);assert(result.rate_date>'2000-01-01');assert.equal(result.requested_date,'2000-01-01');
 }finally{await c.close();}
});
