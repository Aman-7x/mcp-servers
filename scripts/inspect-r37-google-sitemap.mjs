#!/usr/bin/env node
// Read only current MCP sitemap records; no submission or account changes.
import { createSign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
const result={at:new Date().toISOString(),method:'GET Search Console sitemaps list; exact MCP host filter; aggregate other-property read control only',resource_documentation:'https://developers.google.com/webmaster-tools/v1/sitemaps',deprecated_fields_ignored:['contents[].indexed'],property:'sc-domain:zovo.one',oauth_scope:'https://www.googleapis.com/auth/webmasters.readonly',submissions:0};
async function get(url,options){const response=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});const json=await response.json();if(!response.ok){const error=Error('read_failed');error.http_status=response.status;error.api_status=json.error?.status??null;throw error;}return json;}
try{
 const key=JSON.parse(readFileSync('/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json','utf8'));const b64=value=>Buffer.from(value).toString('base64url');const now=Math.floor(Date.now()/1000);
 const unsigned=b64(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+b64(JSON.stringify({iss:key.client_email,scope:result.oauth_scope,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3300}));const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
 const auth=await get('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+signer.sign(key.private_key).toString('base64url')})});
 const data=await get('https://www.googleapis.com/webmasters/v3/sites/'+encodeURIComponent(result.property)+'/sitemaps',{headers:{authorization:'Bearer '+auth.access_token}});if(data.sitemap!==undefined&&!Array.isArray(data.sitemap))throw Error('read_failed');
 const all=data.sitemap??[];result.total_records_read=all.length;result.mcp_sitemaps=all.filter(s=>{try{return new URL(s.path).hostname==='mcp.zovo.one';}catch{return false;}}).map(s=>Object.fromEntries(['path','lastSubmitted','lastDownloaded','isPending','isSitemapsIndex','type','errors','warnings','contents'].map(k=>[k,s[k]??null])));result.status='measured';
}catch(error){result.status='unavailable';result.error={http_status:error.http_status??null,api_status:error.api_status??null};result.mcp_sitemaps=null;}
result.completed_at=new Date().toISOString();result.limits='Sitemap records do not establish URL indexing, ranking, clicks or customers. No submission, reindex request or OAuth permission escalation.';
writeFileSync(new URL('../data/r37_google_sitemap_inspection.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
