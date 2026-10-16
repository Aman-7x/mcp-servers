import { DurableObject } from 'cloudflare:workers';
import { FUNNEL_EVENTS, FUNNEL_SOURCES } from './funnel.js';

const EVENTS = new Set(FUNNEL_EVENTS);
const SOURCES = new Set(FUNNEL_SOURCES);
const DAY_MS = 86400000;
const MAX_BATCH_BYTES = 2048;
const validDay = (day) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;

function validateBatch(batch) {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch) || Object.keys(batch).some((key) => !['day', 'server', 'events', 'source', 'cohort', 'observationId', 'tokenServerHash'].includes(key))) return false;
  if (!validDay(batch.day) || !/^[a-z][a-z0-9-]{0,63}$/.test(batch.server || '') || !SOURCES.has(batch.source) || !['ordinary', 'probe'].includes(batch.cohort) || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(batch.observationId || '')) return false;
  if (!Array.isArray(batch.events) || batch.events.length < 1 || batch.events.length > 3 || new Set(batch.events).size !== batch.events.length || batch.events.some((event) => !EVENTS.has(event))) return false;
  if (batch.tokenServerHash !== undefined && !/^[a-f0-9]{64}$/.test(batch.tokenServerHash)) return false;
  const successful = batch.events.includes('successful_business_call');
  if (batch.events.includes('first_successful_anon_token_server_day') && (!successful || !batch.tokenServerHash)) return false;
  if (batch.events.includes('upgrade_impression') && !successful) return false;
  if (!successful && batch.events.length !== 1) return false;
  if (successful && batch.events.some((event) => ['offer_view', 'checkout_handoff'].includes(event))) return false;
  return true;
}

/** Exported for rollback/concurrency controls; the class uses this exact transaction. */
export async function acceptFunnelBatch(storage, batch, now = Date.now()) {
  if (!validateBatch(batch)) return { status: 400, error: 'invalid_funnel_batch' };
  const dayStart = Date.parse(`${batch.day}T00:00:00Z`);
  const expiresAt = dayStart + 31 * DAY_MS; // At most31 days for any event in this day.
  if (expiresAt <= now || dayStart > now + DAY_MS) return { status: 410, error: 'funnel_day_outside_retention' };
  const fingerprint = JSON.stringify({ ...batch, events: [...batch.events].sort() });
  return storage.transaction(async (tx) => {
    const meta = await tx.get('meta');
    if (meta && meta.day !== batch.day) return { status: 409, error: 'funnel_day_conflict' };
    const seenKey = `seen:${batch.observationId}`;
    const seen = await tx.get(seenKey);
    if (seen) return seen === fingerprint ? { status: 200, duplicate: true } : { status: 409, error: 'funnel_observation_conflict' };
    const summary = await tx.get('summary') || {};
    const firstKey = batch.tokenServerHash ? `first:${batch.tokenServerHash}` : null;
    const firstSeen = firstKey ? await tx.get(firstKey) : false;
    for (const event of batch.events) {
      if (event === 'first_successful_anon_token_server_day' && firstSeen) continue;
      const key = `${batch.cohort}:${batch.source}:${event}`;
      const count = (summary[key] || 0) + 1;
      if (!Number.isSafeInteger(count)) throw new Error('Funnel count overflow');
      summary[key] = count;
    }
    // SQLite-backed DO storage includes this alarm operation in the transaction.
    // It commits with every counter and marker, or the entire batch rolls back.
    await storage.setAlarm(expiresAt);
    await tx.put('summary', summary);
    if (firstKey && batch.events.includes('first_successful_anon_token_server_day') && !firstSeen) await tx.put(firstKey, 1);
    await tx.put(seenKey, fingerprint);
    await tx.put('meta', { day: batch.day, expiresAt, firstRecordedAt: meta?.firstRecordedAt ?? now, lastRecordedAt: now });
    return { status: 200, duplicate: false };
  });
}

export async function readFunnelDay(storage, day) {
  if (!validDay(day)) return { status: 400, error: 'invalid_funnel_day' };
  return storage.transaction(async (tx) => {
    const meta = await tx.get('meta');
    if (meta && meta.day !== day) return { status: 409, error: 'funnel_day_conflict' };
    const summary = await tx.get('summary') || {};
    const rows = [];
    for (const [key, count] of Object.entries(summary)) {
      const [cohort, source, event, ...extra] = key.split(':');
      if (extra.length || !['ordinary', 'probe'].includes(cohort) || !SOURCES.has(source) || !EVENTS.has(event) || !Number.isSafeInteger(count) || count < 0) return { status: 503, day, complete: false };
      rows.push({ cohort, source, event, count });
    }
    if (rows.length > 70) return { status: 503, day, complete: false };
    return { status: 200, day, complete: true, first_recorded_at: meta ? new Date(meta.firstRecordedAt).toISOString() : null, rows };
  });
}

export class FunnelState extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/stats' && request.method === 'GET') {
      const result = await readFunnelDay(this.ctx.storage, url.searchParams.get('day'));
      return Response.json(result, { status: result.status });
    }
    if (url.pathname !== '/record' || request.method !== 'POST') return new Response('Not found', { status: 404 });
    if (Number(request.headers.get('content-length') || 0) > MAX_BATCH_BYTES) return new Response('Too large', { status: 413 });
    const text = await request.text();
    if (text.length > MAX_BATCH_BYTES) return new Response('Too large', { status: 413 });
    let incoming;
    try { incoming = JSON.parse(text); } catch { return new Response('Invalid JSON', { status: 400 }); }
    const result = await acceptFunnelBatch(this.ctx.storage, incoming);
    return Response.json(result, { status: result.status });
  }

  async alarm() {
    const meta = await this.ctx.storage.get('meta');
    if (meta && meta.expiresAt > Date.now()) {
      await this.ctx.storage.setAlarm(meta.expiresAt);
      return;
    }
    await this.ctx.storage.deleteAll();
    // Current worker compatibility date predates deleteAll deleting alarms.
    await this.ctx.storage.deleteAlarm();
  }
}
