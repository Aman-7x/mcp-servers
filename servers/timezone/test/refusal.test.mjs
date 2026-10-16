import test from 'node:test';import assert from 'node:assert/strict';import {join} from 'node:path';import {existsSync} from 'node:fs';import {localClient} from './refusal-client.mjs';
test('timezone caps participants, recurring search, contacts and ICS writes as errors, retaining shortened search', async()=>{
 const c=await localClient();try{
 const participants=Array.from({length:4},(_,i)=>({name:`Synthetic ${i}`,zone:'UTC'}));
 for(const args of [{participants},{participants:participants.slice(0,2),recurring:true}]){const r=await c.call('find_meeting_slots',args);assert.equal(r.isError,true);assert.match(r.text,/Pro feature/);}
 const search=await c.call('find_meeting_slots',{participants:participants.slice(0,2),days:14,earliest_date:'2026-10-19',limit:1});assert(!search.isError,search.text);assert.match(search.text,/Searched 5 of the 14/);assert.match(search.text,/2026-10-19/);
 for(let i=0;i<5;i++)assert(!(await c.call('contacts_set',{name:`Synthetic ${i}`,zone:'UTC'})).isError);
 assert.equal((await c.call('contacts_set',{name:'Synthetic Sixth',zone:'UTC'})).isError,true);
 for(let i=0;i<3;i++)assert(!(await c.call('ics_create',{title:`Synthetic ${i}`,start:'2026-10-19 10:00',zone:'UTC',duration_minutes:30,out_path:join(c.dir,`${i}.ics`)})).isError);
 const out=join(c.dir,'fourth.ics');const fourth=await c.call('ics_create',{title:'Synthetic Fourth',start:'2026-10-19 10:00',zone:'UTC',duration_minutes:30,out_path:out});assert.equal(fourth.isError,true);assert(!existsSync(out));
 }finally{await c.close();}
});
