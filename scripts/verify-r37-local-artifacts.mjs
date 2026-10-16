#!/usr/bin/env node
// Bounded local verification of exact archives; no publication or product network calls.
import assert from 'node:assert/strict';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);let outputFile=join(root,'data/r37_release_integration.json'),requiredVersion;
for(let i=0;i<args.length;i+=2){
 const flag=args[i],value=args[i+1];assert(value,'Missing argument value');
 if(flag==='--output'){assert(/^data\/[A-Za-z0-9_.-]+\.json$/.test(value),'Output must be a data JSON artifact');outputFile=join(root,value);}
 else if(flag==='--expected-version'){assert(/^\d+\.\d+\.\d+$/.test(value));requiredVersion=value;}
 else throw Error('Usage: verify-r37-local-artifacts.mjs [--output data/name.json] [--expected-version x.y.z]');
}
const work=join(homedir(),'mcp-servers-work');mkdirSync(work,{recursive:true});
const scope=mkdtempSync(join(work,'r37-artifact-'));
const output={measured_at:new Date().toISOString(),scope:'Exact current standalone and office archives; declared package/manifest/runtime versions and duplicate/matcher workflows, older child feature coverage excluded',archives:[]};
const loader=join(scope,'guard-loader.mjs'),requireGuard=join(scope,'guard-require.cjs');
writeFileSync(loader,`import {appendFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';export async function resolve(s,c,n){const r=await n(s,c);if(r.url.startsWith('file:')){const p=fileURLToPath(r.url);if(!p.startsWith(process.env.ARTIFACT_ROOT+'/'))throw Error('Outside artifact ESM resolution: '+p);appendFileSync(process.env.RESOLUTION_LOG,JSON.stringify({kind:'esm',path:p})+'\\n');}return r;}`);
writeFileSync(requireGuard,`const M=require('node:module'),fs=require('node:fs'),old=M._resolveFilename;M._resolveFilename=function(...a){const p=old.apply(this,a);if(p.startsWith('/')){if(!p.startsWith(process.env.ARTIFACT_ROOT+'/'))throw Error('Outside artifact CJS resolution: '+p);fs.appendFileSync(process.env.RESOLUTION_LOG,JSON.stringify({kind:'cjs',path:p})+'\\n');}return p;};`);
try{
 for(const name of ['duplicate-invoice-check','three-way-match','office-suite']){
  const expectedVersion=JSON.parse(readFileSync(join(root,'servers',name,'package.json'),'utf8')).version;if(requiredVersion)assert.equal(expectedVersion,requiredVersion,'Source package version differs from required patch');
  const archive=join(root,'bundles',name+'.mcpb');const bytes=readFileSync(archive);const sha256=createHash('sha256').update(bytes).digest('hex');
  execFileSync('/usr/bin/unzip',['-t',archive],{stdio:'pipe',maxBuffer:10_000_000});
  const extracted=join(scope,name);mkdirSync(extracted);execFileSync('/usr/bin/unzip',['-q',archive,'-d',extracted]);
  const manifest=JSON.parse(readFileSync(join(extracted,'manifest.json'),'utf8'));assert.equal(manifest.version,expectedVersion);
  const artifactRoot=join(extracted,'server'),storage=join(scope,name+'-data');mkdirSync(storage);
  const resolution=join(scope,name+'-resolution.jsonl');writeFileSync(resolution,'');
  const env={PATH:process.env.PATH||'',HOME:storage,TMPDIR:storage,XDG_DATA_HOME:storage,XDG_CONFIG_HOME:storage,MCP_LICENSE_KEY:'',ARTIFACT_ROOT:artifactRoot,RESOLUTION_LOG:resolution,NODE_OPTIONS:`--no-warnings --experimental-loader=${loader} --require=${requireGuard}`};
  const control=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(join(root,'servers/duplicate-invoice-check/dist/core.js'))})`],{env,encoding:'utf8'});assert.notEqual(control.status,0);assert.match(control.stderr,/Outside artifact ESM resolution/);
  const cjsControl=spawnSync(process.execPath,['-e',`require(${JSON.stringify(join(root,'package.json'))})`],{env,encoding:'utf8'});assert.notEqual(cjsControl.status,0);assert.match(cjsControl.stderr,/Outside artifact CJS resolution/);
  const transport=new StdioClientTransport({command:process.execPath,args:[join(artifactRoot,'index.js')],cwd:artifactRoot,env,stderr:'pipe'});
  let stderr='';transport.stderr.on('data',d=>stderr+=d.toString());const client=new Client({name:'r37-exact-archive-verifier',version:'1'});let calls=0;
  const result={name,version:expectedVersion,bytes:bytes.length,sha256,zip_crc:'passed',resolution_guard:'ESM and CommonJS constrained to extracted server tree',known_bad_external_import:'ESM and CommonJS rejected',calls:0};
  try{
   await client.connect(transport);assert.equal(client.getServerVersion().version,expectedVersion);
   const tools=(await client.listTools()).tools.map(({name,description})=>({name,description:description||''}));
   const sorted=t=>[...t].sort((a,b)=>a.name.localeCompare(b.name));assert.deepEqual(sorted(tools),sorted(manifest.tools));result.tools=tools.length;
   const call=async(tool,args={})=>{calls++;const r=await client.callTool({name:tool,arguments:args},undefined,{timeout:90_000});assert(!r.isError,r.content?.[0]?.text);return JSON.parse(r.content[0].text);};
   const office=name==='office-suite';const prefix=office?'duplicate-invoice-check_':'';
   if(office){const map=JSON.parse((await client.readResource({uri:'office://tools_map'})).contents[0].text);result.children=map.servers.length;assert.equal(result.children,49);assert(map.servers.includes('duplicate-invoice-check'));assert(tools.some(t=>t.name==='three-way-match_report_get'));assert(tools.some(t=>t.name===prefix+'report_get'));}
   else assert.equal(tools.length,8);
   const licenseRoot=join(artifactRoot,'node_modules/@theluckystrike/mcp-license');
   const licensePackage=JSON.parse(readFileSync(join(licenseRoot,'package.json'),'utf8'));
   assert.equal(licensePackage.version,JSON.parse(readFileSync(join(root,'packages/mcp-license/package.json'),'utf8')).version);result.license_version=licensePackage.version;
   assert(readFileSync(join(licenseRoot,'dist/index.js')).equals(readFileSync(join(root,'packages/mcp-license/dist/index.js'))),'Packaged license code is stale');
   const status=await call('license_status');
   for(const productStatus of office?[status.children['duplicate-invoice-check'],status.children['three-way-match']]:[status]){
    assert.equal(productStatus.tier,'free');assert.equal(productStatus.payment.alternative.grants,'lifetime Pro on all 48 servers');assert.equal(productStatus.payment.price.amount,'19.00');assert.equal(productStatus.payment.alternative.amount,'39.00');assert.equal(productStatus.payment.agent_settleable,false);
   }
   result.paid_bundle_count=48;result.payment_permissions='human checkout, agent_settleable=false, $19 single/$39 bundle';
   result.compiled_store_sha256={};
   for(const product of office?['duplicate-invoice-check','three-way-match']:[name]){
    const actualStore=readFileSync(office?join(artifactRoot,'node_modules/@theluckystrike/mcp-'+product+'/dist/store.js'):join(artifactRoot,'store.js'));
    const currentStore=readFileSync(join(root,'servers',product,'dist/store.js'));
    assert(actualStore.equals(currentStore),`${product} archive store is stale`);
    result.compiled_store_sha256[product]=createHash('sha256').update(actualStore).digest('hex');
   }
   if(name!=='three-way-match'){
   const base={entity_id:'E',supplier_id:'S',document_type:'invoice',invoice_number:'report_get',invoice_date:'2026-10-16',currency:'USD',total_minor:10000};
   const records=[{...base,record_id:'A'},{...base,record_id:'B',total_minor:12000},{...base,record_id:'C',invoice_number:'REPORT_GET'},{...base,record_id:'D',supplier_id:'OTHER'}];
   const checked=await call('duplicate_invoice_check',{records,save:true});assert.equal(checked.saved,true);assert.equal(checked.report.records[0].invoice_number,'report_get');if(office)assert.equal(checked.report.retrieval.page_tool,prefix+'report_page');assert.equal(checked.report.summary.candidate_record_count,3);assert(checked.report.groups.some(g=>g.rule==='exact_reference'));
   assert.equal((await call(prefix+'report_get',{id:checked.id})).report.summary.candidate_record_count,3);
   const csv=await call(prefix+'report_export_csv',{id:checked.id});assert.equal(csv.total_rows,4);assert(csv.csv.includes('report_get'));assert(!csv.csv.includes('duplicate-invoice-check_report_get'));
   assert.equal((await call(prefix+'report_page',{id:checked.id,section:'records',limit:1})).rows.length,1);
   assert.equal((await client.callTool({name:'duplicate_invoice_check',arguments:{records,unknown:true}})).isError,true);calls++;
   if(!office){await call('duplicate_invoice_check',{records,save:true});await call('duplicate_invoice_check',{records,save:true});const capped=await call('duplicate_invoice_check',{records,save:true});assert.equal(capped.saved,false);assert.equal(capped.save_error,'free_saved_report_cap');assert.equal(capped.report.summary.candidate_record_count,3);assert.equal((await call('report_export_csv',{id:capped.report.retrieval.report_id})).total_rows,4);assert.equal((await call('report_list')).total,3);result.free_cap_preserves_full_diagnosis=true;}
   }
   if(name==='three-way-match'||office){
    const matcherPrefix=office?'three-way-match_':'';
    const matchedInput={po:{reference:'report_get',supplier:'Supply Co',currency:'USD',lines:[{sku:'A',quantity:10,unit_price_minor:100},{sku:'B',quantity:10,unit_price_minor:100}]},receipts:[{reference:'GR1',po_reference:'report_get',supplier:'Supply Co',date:'2026-10-16',lines:[{sku:'A',accepted_quantity:5,rejected_quantity:5},{sku:'B',accepted_quantity:15,rejected_quantity:0}]}],invoice:{reference:'report_page',po_reference:'report_get',supplier:'Supply Co',currency:'USD',lines:[{sku:'A',quantity:10,unit_price_minor:100},{sku:'B',quantity:10,unit_price_minor:100}],total_minor:2000},prior_invoiced:[],save:true};
    const matched=await call('three_way_match',matchedInput);assert.equal(matched.saved,true);assert.equal(matched.report.status,'exceptions');assert(matched.report.issues.some(i=>i.code==='invoiced_above_accepted'));
    const retrieved=await call(matcherPrefix+'report_get',{id:matched.id});assert.equal(retrieved.report.lines.find(l=>l.sku==='A').accepted_quantity,5);assert.equal(retrieved.report.documents.po.reference,'report_get');assert.equal(retrieved.report.documents.invoice.reference,'report_page');
    assert((await call(matcherPrefix+'report_export_csv',{id:matched.id})).csv.includes('invoiced_above_accepted'));result.matcher_business_checks='saved offsetting-quantity exceptions, source-reference preservation, get and CSV through exact artifact';
   }
   assert(!/failed to (connect|start)|optional child .*not found, skipping|Outside artifact/.test(stderr),stderr);if(name!=='three-way-match')result.business_checks='candidate union, scope negative control, conflicting amount, save/get/page/CSV, unknown-field error, literal tool-name source/CSV preservation';result.calls=calls;result.status='passed';
  }finally{await client.close();}
  const events=readFileSync(resolution,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l));result.resolution_events=events.length;result.unique_resolved_files=new Set(events.map(e=>e.path)).size;assert(events.length>0);assert(events.every(e=>e.path.startsWith(artifactRoot+'/')));output.archives.push(result);
 }
 output.status='passed';output.release_ready=true;output.release_ready_scope='Local archive verification only; publication, independent review and broader estate checks remain separate.';output.completed_at=new Date().toISOString();
}finally{
 const deadline=Date.now()+15_000;
 while(true){const handles=spawnSync('/usr/sbin/lsof',['-t','+D',scope],{encoding:'utf8'});if(handles.status===1&&!handles.stdout.trim())break;if(handles.error||handles.status!==0||Date.now()>deadline)throw Error('Retained artifact scope: open handles cannot be ruled out');await delay(100);}
 const size=p=>{const s=lstatSync(p);return s.isDirectory()?readdirSync(p).reduce((n,f)=>n+size(join(p,f)),0):s.size;};
 appendFileSync(join(root,'data/build-deletions.jsonl'),JSON.stringify({at:new Date().toISOString(),path:scope,bytes:size(scope),reason:'completed exact archive verification, derived artifacts and synthetic records',lsof:'no open handles'})+'\n');rmSync(scope,{recursive:true});assert(!existsSync(scope));output.cleanup='guarded scope removed';
 writeFileSync(outputFile,JSON.stringify(output,null,2)+'\n');
}
console.log(JSON.stringify(output));
