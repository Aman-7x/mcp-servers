#!/usr/bin/env node
// Read-only public GitHub API snapshot. No repository edits, comments, submissions or paid requests.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--output' || !/^data\/r37_organic_after_[a-z0-9_-]+\.json$/.test(args[1])))throw Error('Usage: measure-r37-organic.mjs [--output data/r37_organic_after_<label>.json]');
const output=args.length?args[1]:'data/r37_organic_github.json';
if(existsSync(output))throw Error('Snapshot already exists; choose a new timestamp label rather than overwriting history');
const raw=readFileSync('data/r37_organic_queries_frozen.json');const frozen=JSON.parse(raw);
const api=path=>JSON.parse(execFileSync('gh',['api','--method','GET',path],{encoding:'utf8',maxBuffer:5_000_000}));
const evidence={at:new Date().toISOString(),method:frozen.method,frozen_sha256:createHash('sha256').update(raw).digest('hex'),queries:[],mirror:null};
for(const query of frozen.queries){
 try{const response=api('search/repositories?q='+encodeURIComponent(query.q)+'&per_page=20');evidence.queries.push({...query,at:new Date().toISOString(),total_count:response.total_count,incomplete_results:response.incomplete_results,returned:response.items.length,results:response.items.filter(x=>!x.private).map((x,i)=>({position:i+1,full_name:x.full_name,description:x.description,html_url:x.html_url,stars:x.stargazers_count})),estate_position:response.items.findIndex(x=>x.full_name==='theluckystrike/mcp-duplicate-invoice-check')+1||null});}catch(e){evidence.queries.push({...query,status:'error',message:String(e.message).slice(0,300)});}
 writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');await delay(1000);
}
const repo=api('repos/theluckystrike/mcp-duplicate-invoice-check');evidence.mirror={full_name:repo.full_name,description:repo.description,homepage:repo.homepage,topics:repo.topics,visibility:repo.visibility,default_branch:repo.default_branch,pushed_at:repo.pushed_at,html_url:repo.html_url,files:[]};
for(const path of ['README.md','server.json','glama.json','smithery.yaml','package.json']){
 try{const value=api('repos/theluckystrike/mcp-duplicate-invoice-check/contents/'+path);const bytes=Buffer.from(value.content,'base64');const file={path,github_blob_sha:value.sha,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),download_url:value.download_url};
 if(path==='README.md'){const text=bytes.toString();file.checks={browser_proof_link:text.includes('/guides/check-duplicate-supplier-invoice-references-in-claude#duplicate-demo'),product_page:text.includes('https://mcp.zovo.one/s/duplicate-invoice-check'),candidate_limitation:text.includes('Candidates are not confirmed duplicates'),local_install:text.includes('dist/index.js'),npm_unpublished:text.includes('not published'),pro_price:text.includes('$19'),bundle_price:text.includes('$39')};}
 if(path.endsWith('.json')){const x=JSON.parse(bytes);if(path==='server.json')file.projected={name:x.name,version:x.version,packages:x.packages,remotes:x.remotes};if(path==='glama.json')file.projected=x;if(path==='package.json')file.projected={name:x.name,version:x.version,dependencies:x.dependencies,scripts:x.scripts};}
 evidence.mirror.files.push(file);
 }catch(e){evidence.mirror.files.push({path,status:'error',message:String(e.message).slice(0,200)});}
}
evidence.completed_at=new Date().toISOString();writeFileSync(output,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({queries:evidence.queries.map(x=>({id:x.id,total:x.total_count,position:x.estate_position,status:x.status||'measured'})),mirror:evidence.mirror.full_name,files:evidence.mirror.files.map(x=>({path:x.path,status:x.status||'read'}))}));
