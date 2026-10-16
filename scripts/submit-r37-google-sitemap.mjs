#!/usr/bin/env node
// One explicitly scoped resubmission of the already registered project sitemap.
import assert from 'node:assert/strict';
import { createSign, createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
assert(process.argv.length===3 && process.argv[2]==='--submit','Usage: --submit');
const output=new URL('../data/r37_google_sitemap_resubmission.json',import.meta.url);
assert(!existsSync(output),'Submission receipt already exists; inspect it instead of submitting twice');
const property='sc-domain:zovo.one', sitemap='https://mcp.zovo.one/sitemap.xml';
const base='https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(property);
const result={at:new Date().toISOString(),property,sitemap,scope:'One existing sitemap resubmission after exact project/permission/content checks; no property/account/key/role changes and no URL Indexing API call',documentation:'https://developers.google.com/webmaster-tools/v1/sitemaps/submit',submission_attempts:0,submissions_accepted:0};
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});assert(r.ok,'HTTP '+r.status);return r.json();}
async function auth(scope){const k=JSON.parse(readFileSync('/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json','utf8'));const b64=s=>Buffer.from(s).toString('base64url'),now=Math.floor(Date.now()/1000);const unsigned=b64(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+b64(JSON.stringify({iss:k.client_email,scope,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+600}));const s=createSign('RSA-SHA256');s.update(unsigned);s.end();const a=await json('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+s.sign(k.private_key).toString('base64url')})});assert(a.access_token);return a.access_token;}
try{
 const readToken=await auth('https://www.googleapis.com/auth/webmasters.readonly');
 const readHeaders={authorization:'Bearer '+readToken};
 const site=await json(base,{headers:readHeaders});assert.equal(site.siteUrl,property);result.existing_property_permission=site.permissionLevel;
 assert(['siteOwner','siteFullUser'].includes(site.permissionLevel),'Existing property role does not permit this operation');
 const records=await json(base+'/sitemaps',{headers:readHeaders});const prior=records.sitemap?.find(x=>x.path===sitemap);assert(prior,'Only an already registered exact sitemap may be resubmitted');
 result.before={path:prior.path,lastSubmitted:prior.lastSubmitted??null,lastDownloaded:prior.lastDownloaded??null,errors:prior.errors??null,warnings:prior.warnings??null};
 const r=await fetch(sitemap,{headers:{'x-mcp-probe':'1','user-agent':'mcp-r37-sitemap-preflight/1'},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);const xml=await r.text();const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert(urls.length>0&&new Set(urls).size===urls.length);assert(urls.every(u=>new URL(u).hostname==='mcp.zovo.one'));for(const u of ['https://mcp.zovo.one/s/duplicate-invoice-check','https://mcp.zovo.one/guides/check-duplicate-supplier-invoice-references-in-claude'])assert(urls.includes(u));
 result.content_preflight={http_status:200,url_count:urls.length,sha256:createHash('sha256').update(xml).digest('hex'),new_product_and_guide_present:true,all_urls_exact_project_host:true};
 const token=await auth('https://www.googleapis.com/auth/webmasters');result.oauth_write_scope='https://www.googleapis.com/auth/webmasters';
 result.submission_attempts=1;result.submitted_at=new Date().toISOString();
 const put=await fetch(base+'/sitemaps/'+encodeURIComponent(sitemap),{method:'PUT',headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});result.submit_http_status=put.status;assert(put.ok,'Submission HTTP '+put.status);assert.equal((await put.text()).trim(),'');result.submissions_accepted=1;
 const after=await json(base+'/sitemaps/'+encodeURIComponent(sitemap),{headers:{authorization:'Bearer '+token}});result.after=Object.fromEntries(['path','lastSubmitted','lastDownloaded','isPending','errors','warnings'].map(k=>[k,after[k]??null]));result.status='accepted';
}catch(e){result.status=result.submissions_accepted?'accepted_followup_unavailable':'not_confirmed';result.error_code=String(e.message).slice(0,300);}
result.finished_at=new Date().toISOString();result.limits='Acceptance and lastSubmitted do not establish a new crawl, URL indexing, rank, traffic or customers. Deprecated contents[].indexed is not used. Credentials and OAuth assertions stayed in memory.';
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));if(result.status!=='accepted')process.exitCode=1;
