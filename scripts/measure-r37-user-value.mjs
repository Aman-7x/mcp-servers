#!/usr/bin/env node
// Synthetic operator acceptance tasks, not a human/model recommendation trial.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,appendFileSync,lstatSync,readdirSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve,join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const frozenPath=join(root,'data/r37_user_value_frozen.json');
const raw=readFileSync(frozenPath);const frozen=JSON.parse(raw);
assert.equal(frozen.round,46);assert.equal(frozen.scenarios.length,5);
const work=join(homedir(),'mcp-servers-work');mkdirSync(work,{recursive:true});
const scope=mkdtempSync(join(work,'r37-value-'));
const transport=new StdioClientTransport({command:process.execPath,args:[join(root,'servers/duplicate-invoice-check/dist/index.js')],env:{PATH:process.env.PATH||'',HOME:scope,XDG_DATA_HOME:scope,XDG_CONFIG_HOME:scope,MCP_LICENSE_KEY:''},stderr:'pipe'});
const client=new Client({name:'r37-frozen-operator-tasks',version:'1'});
const evidence={at:new Date().toISOString(),frozen_at:frozen.frozen_at,frozen_sha256:createHash('sha256').update(raw).digest('hex'),built_entry_sha256:createHash('sha256').update(readFileSync(join(root,'servers/duplicate-invoice-check/dist/index.js'))).digest('hex'),method:'Fixed structured arguments and expected outcomes written before running actual MCP stdio. No model translation, real customers, client install timing, or competitor runtime.',scenarios:[]};
try{
 await client.connect(transport);assert.equal(client.getServerVersion().version,'0.22.7');assert.equal((await client.listTools()).tools.length,8);
 for(const scenario of frozen.scenarios){
  const started=performance.now();const receipts=[];let calls=0;
  const call=async(name,args={})=>{calls++;const r=await client.callTool({name,arguments:args});assert(!r.isError,r.content?.[0]?.text);const value=JSON.parse(r.content[0].text);receipts.push({name,args,result:value});return value;};
  const result=await call('duplicate_invoice_check',{records:scenario.records,save:scenario.workflow||false});
  const report=result.report;assert.equal(report.summary.candidate_record_count,scenario.expected.candidates);assert.equal(report.groups.length,scenario.expected.groups);assert.deepEqual(report.groups.map(g=>g.rule).sort(),[...scenario.expected.rules].sort());
  assert.deepEqual(report.records,[...scenario.records].sort((a,b)=>a.record_id.localeCompare(b.record_id)));
  assert.match(report.scope,/No payment approval, fraud verdict, duplicate confirmation/);
  if(scenario.expected.candidates===0)assert.equal(report.status,'no_candidates_in_supplied_batch');
  for(const group of report.groups)if(group.rule==='same_amount_date')assert.match(group.explanation,/legitimate invoices/);
  if(scenario.expected.conflict_fields)for(const field of scenario.expected.conflict_fields)assert(report.groups.find(g=>g.rule==='exact_reference').conflicting_fields.includes(field));
  if(scenario.workflow){
   const saved=[result.id];for(let i=0;i<2;i++)saved.push((await call('duplicate_invoice_check',{records:scenario.records,save:true})).id);
   const capped=await call('duplicate_invoice_check',{records:scenario.records,save:true});assert.equal(capped.saved,false);assert.equal(capped.save_error,'free_saved_report_cap');assert.equal(capped.report.summary.candidate_record_count,4);assert(capped.upgrade.includes('/buy/duplicate-invoice-check'));
   const id=capped.report.retrieval.report_id;
   const csv=await call('report_export_csv',{id});assert.equal(csv.total_rows,4);for(const row of scenario.records)assert(csv.csv.includes(row.record_id));
   const page=await call('report_page',{id,section:'records',limit:2});assert.equal(page.total,4);assert.equal(page.rows.length,2);assert.equal(page.next_offset,2);
   for(const savedId of saved)assert.equal((await call('report_delete',{id:savedId})).deleted,savedId);
   assert.equal((await call('report_list')).total,0);
  }
  const seconds=(performance.now()-started)/1000;evidence.scenarios.push({id:scenario.id,prompt:scenario.prompt,criteria:scenario.criteria,expected:scenario.expected,status:'passed',score:3,score_definition:'3 only when every frozen expected-output and workflow assertion passes; 0 on any failure. An operator acceptance score, not subjective quality or customer preference.',tool_calls:calls,seconds:Number(seconds.toFixed(6)),receipts});
 }
 evidence.status='passed';
}finally{
 await client.close();const end=Date.now()+10_000;while(true){const r=spawnSync('/usr/sbin/lsof',['-t','+D',scope],{encoding:'utf8'});if(r.status===1&&!r.stdout.trim())break;if(r.error||r.status!==0||Date.now()>end)throw Error('Cannot establish no open handles; retained '+scope);await delay(100);}
 const size=p=>{const s=lstatSync(p);return s.isDirectory()?readdirSync(p).reduce((n,f)=>n+size(join(p,f)),0):s.size;};const bytes=size(scope);assert(bytes<50_000_000);appendFileSync(join(root,'data/build-deletions.jsonl'),JSON.stringify({at:new Date().toISOString(),path:scope,bytes,lsof:'no open handles',reason:'R37 synthetic operator user-value round46 complete'})+'\n');rmSync(scope,{recursive:true});
}
writeFileSync(join(root,'data/r37_user_value_evidence.json'),JSON.stringify(evidence,null,2)+'\n');
const scenarios=evidence.scenarios.map(s=>({server:'duplicate-invoice-check',id:s.id,prompt:s.prompt,score:s.score,tool_calls:s.tool_calls,seconds:s.seconds,note:s.criteria.join('; ')}));
writeFileSync(join(root,'data/user_value_r46.json'),JSON.stringify({server:'duplicate-invoice-check',round:46,at:evidence.at,scenarios,totals:{scenarios:scenarios.length,passed:scenarios.length,avg_seconds:Number((scenarios.reduce((n,s)=>n+s.seconds,0)/scenarios.length).toFixed(6))},method:evidence.method,score_definition:evidence.scenarios[0].score_definition,frozen_source:'data/r37_user_value_frozen.json',evidence:'data/r37_user_value_evidence.json',bottom_line:'Five specified synthetic buyer tasks returned the independently expected review evidence. No customer study, search visibility measurement, time saving estimate or revenue claim.'},null,2)+'\n');
console.log(JSON.stringify({status:evidence.status,scenarios:scenarios.length,calls:scenarios.reduce((n,s)=>n+s.tool_calls,0)}));
