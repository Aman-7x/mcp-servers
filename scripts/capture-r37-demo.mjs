#!/usr/bin/env node
// GIF source frames are actual exact production markup + production JS, no fabricated output.
import {createServer} from 'node:http';
import {mkdirSync,mkdtempSync,writeFileSync,readFileSync,appendFileSync,lstatSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {DUPLICATE_DEMO_HTML} from '../billing/src/duplicate-demo-markup.js';
import {DUPLICATE_DEMO_JAVASCRIPT,DUPLICATE_DEMO_INPUT_SHA256} from '../billing/src/duplicate-demo-bundle.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');const work=join(homedir(),'mcp-servers-work');mkdirSync(work,{recursive:true});const scope=mkdtempSync(join(work,'r37-demo-gif-'));const frames=join(scope,'frames');mkdirSync(frames);const profile=join(scope,'fresh-browser-profile');
const html=`<!doctype html><html><head><meta charset="utf-8"><title>Duplicate invoice review: real browser example</title><style>:root{--bd:#343434;--fg:#eee;--ac:#8fe5bd;--mut:#aaa;--warn:#ffc273}body{background:#080808;color:var(--fg);font:15px/1.45 system-ui;margin:0 auto;max-width:940px;padding:20px}a{color:var(--ac)}table{width:100%;border-collapse:collapse;font-size:12px}td,th{border:1px solid #444;padding:7px;text-align:left}h1{font-size:25px}code{font-family:monospace}</style></head><body><h1>Duplicate supplier invoice review</h1><p>Synthetic inputs. Actual browser computation. Candidates need human review.</p>${DUPLICATE_DEMO_HTML}</body></html>`;
const server=createServer((req,res)=>{if(req.url==='/assets/duplicate-demo.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(DUPLICATE_DEMO_JAVASCRIPT);}else if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});res.end(html);}else{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
let context;const evidence={at:new Date().toISOString(),source:'Exact production duplicate-demo-markup.js and duplicate-demo-bundle.js served on loopback; browser-computed results captured as PNG frames and encoded as GIF.',core_ui_source_sha256:DUPLICATE_DEMO_INPUT_SHA256,synthetic_inputs:true,frames:[],diagnostic_network_requests:0,page_errors:[]};
try{
 context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',viewport:{width:1000,height:820},deviceScaleFactor:1,args:['--disable-background-networking']});const page=await context.newPage();page.on('pageerror',e=>evidence.page_errors.push(e.message));let loaded=false;page.on('request',()=>{if(loaded)evidence.diagnostic_network_requests++;});await page.goto(origin);await page.locator('#duplicate-demo-summary').filter({hasText:'4 supplied records'}).waitFor();loaded=true;
 let index=0;const capture=async(label,selector,expected)=>{await page.locator(selector).scrollIntoViewIfNeeded();await page.waitForTimeout(150);await page.screenshot({path:join(frames,`${String(index++).padStart(2,'0')}.png`)});evidence.frames.push({label,expected,summary:await page.locator('#duplicate-demo-summary').innerText(),status:await page.locator('#duplicate-demo-status').innerText()});};
 await capture('Editable synthetic input','#duplicate-demo-input','Four structured records visible');await capture('Computed overlapping evidence','#duplicate-demo-summary','Four candidate records, three groups');
 await page.selectOption('#duplicate-demo-preset','formatting');assert.match(await page.locator('#duplicate-demo-summary').innerText(),/2 distinct candidate records/);await capture('Formatting variants','#duplicate-demo-summary','Two candidates, one normalized reference group');
 await page.selectOption('#duplicate-demo-preset','zeros');assert.match(await page.locator('#duplicate-demo-summary').innerText(),/0 distinct candidate records/);await capture('Leading zeros preserved','#duplicate-demo-summary','Zero candidates with supplied-batch limitation');
 await page.selectOption('#duplicate-demo-preset','legitimate');assert.match(await page.locator('#duplicate-demo-groups').innerText(),/same_amount_date/);await capture('Potentially legitimate equal totals','#duplicate-demo-summary','Same amount/date review evidence; no payment decision');
 assert.equal(evidence.diagnostic_network_requests,0);assert.deepEqual(evidence.page_errors,[]);evidence.browser=await context.browser().version();
 await context.close();context=null;await new Promise(r=>server.close(r));
 execFileSync('python3',['-c',`from PIL import Image\nfrom pathlib import Path\np=Path(${JSON.stringify(frames)})\nframes=[Image.open(f).convert('RGB').resize((800,656)) for f in sorted(p.glob('*.png'))]\nframes[0].save(${JSON.stringify(join(root,'assets/demo-duplicate-invoice-check.gif'))},save_all=True,append_images=frames[1:],duration=[1800,2600,2600,2600,2600],loop=0,optimize=True)\n`]);
 const gif=readFileSync(join(root,'assets/demo-duplicate-invoice-check.gif'));evidence.gif={path:'assets/demo-duplicate-invoice-check.gif',bytes:gif.length,sha256:createHash('sha256').update(gif).digest('hex'),frames:5,width:800,height:656};evidence.status='passed';
}finally{
 if(context)await context.close();if(server.listening)await new Promise(r=>server.close(r));const end=Date.now()+10_000;while(true){const r=spawnSync('/usr/sbin/lsof',['-t','+D',scope],{encoding:'utf8'});if(r.status===1&&!r.stdout.trim())break;if(r.error||r.status!==0||Date.now()>end)throw Error('Fresh QA browser scope retained: '+scope);await delay(100);}
 const size=p=>{const s=lstatSync(p);return s.isDirectory()?readdirSync(p).reduce((n,f)=>n+size(join(p,f)),0):s.size;};appendFileSync(join(root,'data/build-deletions.jsonl'),JSON.stringify({at:new Date().toISOString(),path:scope,bytes:size(scope),lsof:'no open handles',reason:'R37 actual browser GIF synthetic frame source and owned fresh browser profile'})+'\n');rmSync(scope,{recursive:true});
}
writeFileSync(join(root,'data/r37_demo_gif_evidence.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({status:evidence.status,gif:evidence.gif,requests:evidence.diagnostic_network_requests}));
