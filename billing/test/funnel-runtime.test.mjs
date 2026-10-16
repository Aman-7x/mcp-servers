import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const modulePath = process.env.MCP_MINIFLARE_MODULE;

test('actual workerd SQLite DO: atomic batch, response retry, first deduplication, native rollback and bounded reads', { skip: !modulePath }, async () => {
  const workRoot = join(homedir(), 'mcp-servers-work');
  mkdirSync(workRoot, { recursive: true });
  const scope = mkdtempSync(join(workRoot, 'r37-funnel-runtime-'));
  const oldTmp = process.env.TMPDIR;
  process.env.TMPDIR = scope;
  let mf;
  try {
    const { Miniflare } = await import(pathToFileURL(resolve(modulePath)).href);
    const source = `
      import {DurableObject} from 'cloudflare:workers';
      import {FunnelState,acceptFunnelBatch,readFunnelDay} from './billing/src/funnel-state.js';
      import {recordFunnelEvents,funnelStats} from './billing/src/funnel.js';
      export {FunnelState};
      export class NativeRollbackControl extends DurableObject {
        async alarm() {}
        async fetch(req) {
          const u=new URL(req.url);
          if(u.pathname==='/stats') return Response.json({...await readFunnelDay(this.ctx.storage,u.searchParams.get('day')),alarm:await this.ctx.storage.getAlarm()});
          const incoming=await req.json();
          const s=this.ctx.storage;
          const fault={setAlarm:at=>s.setAlarm(at),transaction:fn=>s.transaction(tx=>fn({get:k=>tx.get(k),put:(k,v)=>{if(k.startsWith('first:'))throw Error('injected after summary write');return tx.put(k,v)}}))};
          try{return Response.json(await acceptFunnelBatch(u.pathname==='/fail'?fault:s,incoming));}
          catch(error){return Response.json({failed:true,error:String(error?.message||error)},{status:503})}
        }
      }
      export default {async fetch(req,env){
        if(req.method==='GET')return Response.json(await funnelStats(env,{days:7}));
        const input=await req.json();
        return Response.json(await recordFunnelEvents(env,input));
      }};`;
    const bundled = await build({ stdin: { contents: source, resolveDir: ROOT, sourcefile: 'funnel-native-control.js' },
      bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:workers'] });
    mf = new Miniflare({ rootPath: scope, modules: true, script: bundled.outputFiles[0].text,
      compatibilityDate: '2025-09-01', compatibilityFlags: ['nodejs_compat'],
      durableObjects: { FUNNEL: { className: 'FunnelState', useSQLite: true }, ROLLBACK: { className: 'NativeRollbackControl', useSQLite: true } },
      durableObjectsPersist: join(scope, 'state') });
    const day = new Date().toISOString().slice(0, 10);
    const token = `anon_${'d'.repeat(32)}`;
    const input = { server: 'invoice', source: 'guide', cohort: 'probe', token,
      events: ['successful_business_call', 'first_successful_anon_token_server_day', 'upgrade_impression'] };
    const post = async (payload) => {
      const r = await mf.dispatchFetch('https://funnel-control.invalid/record', { method: 'POST', body: JSON.stringify(payload) });
      assert.equal(r.status, 200);
      return r.json();
    };
    const repeated = { ...input, observationId: crypto.randomUUID() };
    await post(repeated);
    assert.equal((await post(repeated)).duplicate, true);
    await Promise.all(Array.from({ length: 25 }, () => post(input)));
    const stats = await (await mf.dispatchFetch('https://funnel-control.invalid/stats')).json();
    assert.equal(stats.complete, true);
    assert.equal(stats.probe.successful_business_call, 26);
    assert.equal(stats.probe.upgrade_impression, 26);
    assert.equal(stats.probe.first_successful_anon_token_server_day, 1);
    assert.equal(stats.ordinary.successful_business_call, 0);
    assert.ok(stats.rows.length <= 490);
    assert.equal(JSON.stringify(stats).includes(token), false);

    const ns = await mf.getDurableObjectNamespace('ROLLBACK');
    const stub = ns.get(ns.idFromName('native-rollback-control'));
    const native = { day, server: 'invoice', source: 'guide', cohort: 'probe', observationId: crypto.randomUUID(),
      tokenServerHash: 'e'.repeat(64), events: input.events };
    const failing = await stub.fetch('https://internal/fail', { method: 'POST', body: JSON.stringify(native) });
    assert.equal(failing.status, 503);
    assert.match((await failing.json()).error, /injected after summary write/);
    const rolledBack = await (await stub.fetch(`https://internal/stats?day=${day}`)).json();
    assert.deepEqual(rolledBack.rows, []);
    assert.equal(rolledBack.first_recorded_at, null);
    assert.equal(rolledBack.alarm, null, 'alarm scheduling rolls back with native SQLite transaction');
    const recovered = await stub.fetch('https://internal/retry', { method: 'POST', body: JSON.stringify(native) });
    assert.equal(recovered.status, 200, await recovered.text());
    const afterRetry = await (await stub.fetch(`https://internal/stats?day=${day}`)).json();
    assert.equal(afterRetry.rows.find((row) => row.event === 'first_successful_anon_token_server_day').count, 1);
    assert.equal(afterRetry.rows.find((row) => row.event === 'successful_business_call').count, 1);
    assert.equal(afterRetry.alarm, Date.parse(day+'T00:00:00Z')+31*86400000);

    if (process.env.MCP_FUNNEL_EVIDENCE_PATH) {
      const hashes = Object.fromEntries(['billing/src/funnel.js', 'billing/src/funnel-state.js', 'remote/src/index.ts'].map((path) => [path, createHash('sha256').update(readFileSync(join(ROOT, path))).digest('hex')]));
      writeFileSync(resolve(process.env.MCP_FUNNEL_EVIDENCE_PATH), JSON.stringify({ verified_at: new Date().toISOString(),
        runtime: 'Miniflare/workerd, real SQLite-backed Durable Object, compatibility_date2025-09-01',
        checks: { response_count: 26, replay_idempotent: true, daily_first_count: 1, ordinary_probe_isolation: true,
          actual_native_transaction_rollback: true, native_alarm_rollback: true, retention_at_most_days: 31,
          rollback_retry_first_count: 1, bounded_7day_summary: true, raw_token_not_exported: true },
        source_sha256: hashes, deployed: false, live_calls: 0 }, null, 2) + '\n');
    }
  } finally {
    if (mf) await mf.dispose();
    if (oldTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = oldTmp;
    if (existsSync(scope)) {
      let open = '';
      try { open = execFileSync('/usr/sbin/lsof', ['+D', scope], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
      catch (error) { if (error.status !== 1) throw error; }
      assert.equal(open.trim(), '', 'runtime scope remains in use');
      const size = (path) => lstatSync(path).isDirectory() ? readdirSync(path).reduce((sum, name) => sum + size(join(path, name)), 0) : lstatSync(path).size;
      appendFileSync(join(ROOT, 'data/build-deletions.jsonl'), JSON.stringify({ deleted_at: new Date().toISOString(), path: scope, size_bytes: size(scope), task: 'R37 funnel local workerd verification', lsof_clear: true }) + '\n');
      rmSync(scope, { recursive: true });
    }
  }
});
