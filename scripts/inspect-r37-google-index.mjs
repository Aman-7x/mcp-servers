#!/usr/bin/env node
// Read-only Google indexed-version inspection using the existing service account.
import { createSign } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--output' || !/^data\/r37_google_index_after_[a-z0-9_]+\.json$/.test(args[1]))) throw Error('Use --output data/r37_google_index_after_<label>.json');
const output=new URL('../'+(args[1]||'data/r37_google_index_inspection.json'),import.meta.url);
if(existsSync(output)) throw Error('Refusing to overwrite an existing index-inspection snapshot');
const urls = [
 ['new_product','https://mcp.zovo.one/s/duplicate-invoice-check'],
 ['new_guide','https://mcp.zovo.one/guides/check-duplicate-supplier-invoice-references-in-claude'],
 ['matcher_product','https://mcp.zovo.one/s/three-way-match'],
 ['download_catalogue','https://mcp.zovo.one/downloads'],
 ['older_home_control','https://mcp.zovo.one/'],
 ['older_invoice_control','https://mcp.zovo.one/s/invoice'],
];
const result={at:new Date().toISOString(),method:'POST urlInspection/index:inspect; Google indexed version only, not a live URL test or indexing request',documentation:'https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect',oauth_scope:'https://www.googleapis.com/auth/webmasters.readonly',property:'sc-domain:zovo.one',urls:[],credentials_printed:false,indexing_requests:0};
async function get(url, options){const response=await fetch(url,{...options,signal:AbortSignal.timeout(45000)});const json=await response.json();if(!response.ok){const error=Error('read_failed');error.http_status=response.status;error.api_status=json.error?.status??null;throw error;}return json;}
try{
 const key=JSON.parse(readFileSync('/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json','utf8'));
 const b64=value=>Buffer.from(value).toString('base64url');const now=Math.floor(Date.now()/1000);
 const unsigned=b64(JSON.stringify({alg:'RS256',typ:'JWT'}))+'.'+b64(JSON.stringify({iss:key.client_email,scope:result.oauth_scope,aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3300}));
 const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();const assertion=unsigned+'.'+signer.sign(key.private_key).toString('base64url');
 const auth=await get('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(typeof auth.access_token!=='string')throw Error('read_failed');
 for(const [role,url]of urls){try{
  const json=await get('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',{method:'POST',headers:{authorization:'Bearer '+auth.access_token,'content-type':'application/json'},body:JSON.stringify({inspectionUrl:url,siteUrl:result.property,languageCode:'en-US'})});
  const index=json.inspectionResult?.indexStatusResult;if(!index)throw Error('read_failed');
  const fields={};for(const name of['verdict','coverageState','robotsTxtState','indexingState','lastCrawlTime','pageFetchState','googleCanonical','userCanonical','crawledAs'])fields[name]=index[name]??null;
  result.urls.push({role,url,at:new Date().toISOString(),status:'measured',index:fields});
 }catch(error){result.urls.push({role,url,status:'unavailable',http_status:error.http_status??null,api_status:error.api_status??null,index:null});}}
 result.status=result.urls.every(row=>row.status==='measured')?'measured':'partial';
}catch(error){result.status='unavailable';result.auth_error={http_status:error.http_status??null,api_status:error.api_status??null};}
result.completed_at=new Date().toISOString();result.limits=['Indexed-version snapshot only; no live crawl, indexing submission, position, traffic or customer inference.','Unknown/not-indexed URLs are not treated as request failures. API failures remain unavailable.'];
writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));
