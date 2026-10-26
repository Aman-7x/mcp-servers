#!/usr/bin/env node
// Read-only commercial audit; aggregate output only. Never creates Sessions, payments or email.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { createHash, createSign } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const run = promisify(execFile);
const path = p => join(root, p);
const load = p => JSON.parse(readFileSync(path(p), 'utf8'));
const iso = () => new Date().toISOString();
const hash = p => createHash('sha256').update(readFileSync(path(p))).digest('hex');
const output = 'data/r38_kpi_audit.json';


function save(p, data) {
  const target = path(p), pending = target + '.pending-' + process.pid;
  writeFileSync(pending, JSON.stringify(data, null, 2) + '\n');
  renameSync(pending, target);
}
function exactHost(s) { try { return new URL(s.success_url).hostname === 'mcp.zovo.one'; } catch { return false; } }
function amounts(rows) {
  const out = {};
  for (const s of rows) {
    assert.ok(Number.isSafeInteger(s.amount_total) && s.amount_total >= 0 && /^[a-z]{3}$/.test(s.currency));
    out[s.currency] = (out[s.currency] || 0) + s.amount_total;
    assert.ok(Number.isSafeInteger(out[s.currency]));
  }
  return out;
}
function classify(rows, start, end) {
  const matching = rows.filter(s => s.created * 1000 >= start && s.created * 1000 <= end && exactHost(s));
  const ordinary = matching.filter(s => s.metadata?.probe !== '1');
  const paid = ordinary.filter(s => s.payment_status === 'paid');
  return { mcp_total_sessions: matching.length, mcp_tagged_probes: matching.length - ordinary.length, mcp_untagged_sessions: ordinary.length, mcp_untagged_paid_sessions: paid.length, mcp_untagged_paid_checkout_gross_minor_by_currency: amounts(paid) };
}
async function stripePage(args) {
  const { stdout } = await run('stripe', args, { cwd: root, timeout: 45000, maxBuffer: 16 * 1024 * 1024 });
  const j = JSON.parse(stdout);
  assert.ok(!j.error && Array.isArray(j.data) && typeof j.has_more === 'boolean');
  return j;
}
async function rolling(days = 28) {
  const end = Date.now(), start = end - days * 86400e3, rows = [], seen = new Set();
  let cursor;
  for (let pages = 1; pages <= 50; pages++) {
    const j = await stripePage(['checkout', 'sessions', 'list', '--live', '--limit', '100', ...(cursor ? ['--starting-after', cursor] : [])]);
    for (const s of j.data) { assert.ok(s.livemode && s.id && !seen.has(s.id)); seen.add(s.id); rows.push(s); }
    const oldest = j.data.at(-1);
    if (!j.has_more || (oldest && oldest.created * 1000 < start)) return {
      status: 'OK', fetched_at: iso(), window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
      method: 'stripe checkout sessions list --live --limit 100; paginate until exhausted or oldest record predates window',
      pages, records_read: rows.length, oldest_record_at: oldest ? new Date(oldest.created * 1000).toISOString() : null,
      entire_window_covered: true, days, nonzero_account_read_control: rows.length > 0, ...classify(rows, start, end),
      limitations: ['Untagged does not establish a person.', 'Explicit probe=1 Sessions excluded from commercial totals; probe counts are measured, not hardcoded.'],
    };
    assert.ok(oldest); cursor = oldest.id;
  }
  throw Error('pagination_guard');
}
async function completed() {
  const seen = new Set(), rows=[]; let cursor, pages;
  for(pages=1;pages<=50;pages++) {
    const j=await stripePage(['get','/v1/checkout/sessions','--live','-d','status=complete','-d','limit=100','-d','expand[]=data.line_items',...(cursor?['-d','starting_after='+cursor]:[])]);
    for(const s of j.data){assert(s.livemode&&s.status==='complete'&&s.id&&!seen.has(s.id));seen.add(s.id);assert(s.line_items&&Array.isArray(s.line_items.data)&&s.line_items.has_more===false,'line_item_coverage');rows.push(s);}
    if(!j.has_more)break;
    assert(j.data.length);cursor=j.data.at(-1).id;
  }
  assert(pages<=50,'pagination_guard');
  const {PRODUCTS}=await import('../billing/src/index.js');
  const prices=new Set(Object.values(PRODUCTS).map(p=>p.price).filter(Boolean));
  const products=new Set(Object.keys(PRODUCTS));
  const priceMatch=s=>s.line_items.data.some(x=>prices.has(x.price?.id));
  const metadataMatch=s=>products.has(s.metadata?.product);
  const paid=rows.filter(s=>s.payment_status==='paid');
  const mcp=rows.filter(exactHost), ordinary=mcp.filter(s=>s.metadata?.probe!=='1'), mcpPaid=ordinary.filter(s=>s.payment_status==='paid');
  const host=u=>{try{return new URL(u).hostname}catch{return null}};
  const historic=['cs_live_a1dlVs8P','cs_live_a1MN1EJF'].map(prefix=>{
    const s=rows.find(x=>x.id.startsWith(prefix));
    return s?{found:true,created_at:new Date(s.created*1000).toISOString(),success_host:host(s.success_url),cancel_host:host(s.cancel_url),mode:s.mode,paid:s.payment_status==='paid',amount_total_minor:s.amount_total,currency:s.currency,exact_mcp_host:exactHost(s),known_mcp_price:priceMatch(s),known_mcp_metadata_product:metadataMatch(s),mcp_named_line_item:s.line_items.data.some(x=>/\bMCP\b/i.test(x.description||''))}:{found:false};
  });
  return {status:'OK',fetched_at:iso(),method:'stripe get /v1/checkout/sessions --live -d status=complete -d limit=100 -d expand[]=data.line_items; exhaust cursor pagination and assert complete line-item coverage',pages,complete_history_of_completed_sessions:true,all_line_items_covered:true,counts:{account_completed:rows.length,account_paid:paid.length,mcp_completed:mcp.length,mcp_tagged_probes:mcp.length-ordinary.length,mcp_untagged_paid:mcpPaid.length,paid_known_mcp_price:paid.filter(priceMatch).length,paid_known_mcp_metadata_product:paid.filter(metadataMatch).length,paid_other_host_with_known_mcp_price:paid.filter(s=>!exactHost(s)&&priceMatch(s)).length},mcp_untagged_paid_checkout_gross_minor_by_currency:amounts(mcpPaid),paid_account_positive_control:paid.length>0,oldest_account_completed_at:new Date(Math.min(...rows.map(s=>s.created))*1000).toISOString(),newest_account_completed_at:new Date(Math.max(...rows.map(s=>s.created))*1000).toISOString(),historical_two_sale_claim:{source:'intel/R7_MONETIZATION.md',claimed_gross_usd:38,checks:historic},limitations:['Completed Checkout history and current known MCP price catalog, not all payment channels or net profit.','Metadata and line items independently cross-check host attribution. Older retired price IDs outside the current catalog remain a limit.','Two historical records are summarized without customer identity, session IDs or unrelated account amounts.']};
}
async function github() {
  const base = 'repos/theluckystrike/mcp-servers';
  const j = await Promise.all(['/traffic/views', '/traffic/clones', '/traffic/popular/referrers', ''].map(async suffix => JSON.parse((await run('gh', ['api', base + suffix], { timeout: 45000, maxBuffer: 2 * 1024 * 1024 })).stdout)));
  const [v, c, referrers, r] = j; assert.ok(Array.isArray(v.views) && v.views.length && Array.isArray(c.clones) && Array.isArray(referrers));
  const days = rows => rows.map(x => ({ date: x.timestamp.slice(0, 10), count: x.count, uniques: x.uniques }));
  return { status: 'OK', fetched_at: iso(), method: 'gh api repos/theluckystrike/mcp-servers/traffic/{views,clones,popular/referrers}; repository GET', window: { start: v.views[0].timestamp.slice(0, 10), end: v.views.at(-1).timestamp.slice(0, 10) }, views: v.count, unique_visitors: v.uniques, views_daily: days(v.views), clones: c.count, clone_unique_clients: c.uniques, clones_daily: days(c.clones), referrers, stars: r.stargazers_count, forks: r.forks_count, nonzero_read_control: v.count > 0 && c.count > 0, limitations: ['Platform-reported clients, not proven people, installs or successful jobs.', 'Rolling dataset can lag; daily unique clients are not additive.'] };
}
async function jsonGet(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const j = await r.json(); assert.ok(r.ok && !j.error); return j;
}
async function searchConsole() {
  const k = JSON.parse(readFileSync('/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json', 'utf8'));
  const b64 = s => Buffer.from(s).toString('base64url'), now = Math.floor(Date.now() / 1000);
  const claim = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3300 }));
  const signer = createSign('RSA-SHA256'); signer.update(claim); signer.end();
  const assertion = claim + '.' + signer.sign(k.private_key).toString('base64url');
  const auth = await jsonGet('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  assert.ok(auth.access_token);
  const end = new Date(Date.now()-3*86400e3).toISOString().slice(0,10);
  const window = { start: new Date(Date.parse(end+'T00:00:00Z')-27*86400e3).toISOString().slice(0,10), end };
  async function one(host) {
    const body = { startDate: window.start, endDate: window.end, dimensions: ['page'], rowLimit: 25000, dataState: 'final', dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: '//' + host + '/' }] }] };
    const j = await jsonGet('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Azovo.one/searchAnalytics/query', { method: 'POST', headers: { Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const rows = j.rows || []; assert.ok(Array.isArray(rows) && rows.length < 25000);
    const exact = rows.filter(r => { try { return new URL(r.keys[0]).hostname === host; } catch { return false; } });
    const out = { host, rows_returned: rows.length, exact_host_page_rows: exact.length, clicks: 0, impressions: 0 };
    for (const r of exact) { assert.ok(Number.isFinite(r.clicks) && r.clicks >= 0 && Number.isFinite(r.impressions) && r.impressions >= 0); out.clicks += r.clicks; out.impressions += r.impressions; }
    out.pages = exact.map(r => ({page:r.keys[0],clicks:r.clicks,impressions:r.impressions,position:r.position}));
    return out;
  }
  const [mcp, control] = await Promise.all([one('mcp.zovo.one'), one('zovo.one')]);
  assert.ok(control.impressions > 0);
  const inspection_urls = load('data/r37_google_index_after_revenue_review.json').urls.map(row => row.url);
  const inspections=[];
  for(const url of inspection_urls){
    try{
      const j=await jsonGet('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',{method:'POST',headers:{Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({inspectionUrl:url,siteUrl:'sc-domain:zovo.one'})});
      const x=j.inspectionResult?.indexStatusResult;
      assert(x && typeof x.coverageState==='string');
      inspections.push({url,status:'OK',verdict:x.verdict,coverage:x.coverageState,robots:x.robotsTxtState||null,indexing:x.indexingState||null,crawled_at:x.lastCrawlTime||null,google_canonical:x.googleCanonical||null,user_canonical:x.userCanonical||null});
    }catch{inspections.push({url,status:'UNAVAILABLE',limitation:'Read or validation failure is not an indexing verdict.'});}
  }
  return { status: 'OK', inspections, fetched_at: iso(), method: 'Read-only service-account OAuth; GSC searchAnalytics/query, finalized page rows, contains-host prefilter then URL.hostname exact check; row cap checked', window, data_state: 'final', mcp, positive_control: control, inspection_method:'POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect with inspectionUrl and siteUrl; inspection only, no indexing request', query_row_limit: 25000, limitations: ['28-date finalized window ending three UTC dates before collection; GSC reporting dates are Pacific time. Not live current-day traffic.', 'Search Console excludes some data; page totals are not indexed-page counts.'] };
}


const args=process.argv.slice(2);assert(args.length===1&&args[0]==='--collect','Use --collect for a bounded read-only snapshot');
try{readFileSync(path(output));throw Error('Output already exists; preserve the original snapshot')}catch(e){if(e.code!=='ENOENT')throw e;}
const previous=['data/r37_kpi_baseline.json','data/r37_kpi_final.json','data/r37_watch.json','data/r37_google_index_after_final.json','data/revenue_audit_2026-10-17.json','data/r37_google_index_after_revenue_review.json'];
const before=Object.fromEntries(previous.map(p=>[p,hash(p)]));
const audit={schema:1,started_at:iso(),scope:'Read-only revenue diagnosis: Stripe Checkout, Search Console, GitHub, hosted aggregate counters and URL Inspection. No Checkout creation, payment, tool calls, emails or external writes.'};
async function aggregate(route){const r=await fetch('https://mcp.zovo.one'+route,{headers:{'x-mcp-probe':'1','user-agent':'mcp-revenue-audit/1'},signal:AbortSignal.timeout(45000)});const j=await r.json();assert(r.ok);if(route==='/stats/funnel')assert(j.complete===true&&j.instrument===2);if(route==='/stats/clicks')assert(j.instrument===3);return {status:'OK',fetched_at:iso(),method:'GET '+route+'; read-only, marked operator request',...j};}
const keys=['stripe_28d','stripe_7d','stripe_completed','github','search_console','funnel','upgrade_clicks'];
const results=await Promise.allSettled([rolling(28),rolling(7),completed(),github(),searchConsole(),aggregate('/stats/funnel'),aggregate('/stats/clicks')]);
for(let i=0;i<keys.length;i++){const r=results[i];audit[keys[i]]=r.status==='fulfilled'?r.value:{status:'UNAVAILABLE',fetched_at:iso(),error_code:/pagination_guard|line_item_coverage/.test(r.reason?.message||'')?r.reason.message:'read_or_validation_failed',limitation:'Unavailable is not zero; retained evidence keeps its own date.'};}
audit.previous_evidence_sha256=before;audit.previous_evidence_unchanged=previous.every(p=>hash(p)===before[p]);
audit.finished_at=iso();audit.status=keys.every(k=>audit[k].status==='OK')&&audit.previous_evidence_unchanged?'OK':'PARTIAL';
audit.privacy='Only aggregate counts and public URLs are persisted. Credentials, full Stripe objects, customer identifiers and session IDs stay in memory.';
save(output,audit);console.log(JSON.stringify({output,status:audit.status,channels:Object.fromEntries(keys.map(k=>[k,audit[k].status])),previous_evidence_unchanged:audit.previous_evidence_unchanged}));
