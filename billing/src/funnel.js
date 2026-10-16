/**
 * Hosted-only, aggregate measurement. Source labels are caller declarations, not
 * verified acquisition, and an unmarked request is not evidence of a human.
 * Never pass tool arguments/results, emails, IPs or credentials to event fields.
 */
export const FUNNEL_VERSION = 2;
export const FUNNEL_SOURCES = Object.freeze([
  'unattributed', 'store.product', 'store.setup', 'guide', 'github', 'directory', 'oauth',
]);
export const FUNNEL_EVENTS = Object.freeze([
  'successful_business_call', 'first_successful_anon_token_server_day',
  'upgrade_impression', 'offer_view', 'checkout_handoff',
]);
const SOURCES = new Set(FUNNEL_SOURCES);
const EVENTS = new Set(FUNNEL_EVENTS);
const PREFIX = 'funnel:v1:';
const RETENTION_SECONDS = 31 * 86400;
const sourceLabel = (value) => SOURCES.has(value) ? value : 'unattributed';
const cohortLabel = (value) => value === 'probe' ? 'probe' : 'ordinary';
const isAnon = (value) => typeof value === 'string' && /^anon_[0-9a-f]{32}$/.test(value);

async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A bounded declaration only. Unknown/query-injected text is never persisted. */
export function requestCohort(request) {
  return {
    source: sourceLabel(new URL(request.url).searchParams.get('acq')),
    cohort: request.headers.get('x-mcp-probe') === '1' ? 'probe' : 'ordinary',
  };
}

/** The token is already a product credential. Only its hash is added to telemetry. */
export async function saveMintCohort(kv, token, request) {
  if (!isAnon(token)) return;
  const value = requestCohort(request);
  if (new URL(request.url).pathname.startsWith('/oauth/')) value.source = 'oauth';
  await kv.put(`${PREFIX}cohort:${await digest(token)}`, JSON.stringify(value), {
    expirationTtl: RETENTION_SECONDS,
  });
}

/**
 * Existing tokens without a sidecar are unmeasured. Their caller cannot rewrite
 * acquisition via ?acq=. An explicit probe always excludes the current request;
 * probe status at mint remains sticky even when subsequent headers omit it.
 */
export async function readFunnelCohort(kv, token, headers = new Headers(), request = null) {
  const marked = headers.get('x-mcp-probe') === '1';
  if (!isAnon(token)) {
    const declared = request ? requestCohort(request) : { source: 'unattributed', cohort: 'ordinary' };
    return { source: declared.source, cohort: marked ? 'probe' : declared.cohort };
  }
  // A failed KV read must not silently reclassify a stored probe as ordinary.
  let raw;
  try { raw = await kv.get(`${PREFIX}cohort:${await digest(token)}`); }
  catch (error) {
    if (marked) return { source: 'unattributed', cohort: 'probe' };
    throw error;
  }
  let stored;
  try { stored = JSON.parse(raw || 'null'); }
  catch {
    if (marked) return { source: 'unattributed', cohort: 'probe' };
    throw new Error('Invalid funnel cohort');
  }
  if (stored === null) return marked ? { source: 'unattributed', cohort: 'probe' } : null;
  if (!stored || typeof stored !== 'object' || !SOURCES.has(stored.source) || !['ordinary', 'probe'].includes(stored.cohort)) {
    if (marked) return { source: 'unattributed', cohort: 'probe' };
    throw new Error('Invalid funnel cohort');
  }
  return {
    source: sourceLabel(stored?.source),
    cohort: marked || stored?.cohort === 'probe' ? 'probe' : 'ordinary',
  };
}

/** Fail closed on RPC errors, tool errors, discovery, licence tools and malformed data. */
export function successfulBusinessResponse(requestBody, responseBody, httpStatus = 200) {
  if (httpStatus < 200 || httpStatus >= 300) return false;
  try {
    const request = typeof requestBody === 'string' ? JSON.parse(requestBody) : requestBody;
    const response = typeof responseBody === 'string' ? JSON.parse(responseBody) : responseBody;
    if (!request || request.jsonrpc !== '2.0' || request.method !== 'tools/call' || request.id == null || Array.isArray(request)) return false;
    const name = request.params?.name;
    if (typeof name !== 'string' || !name || name.startsWith('license_')) return false;
    if (!response || Array.isArray(response) || response.jsonrpc !== '2.0' || response.id !== request.id || 'error' in response) return false;
    const result = response.result;
    if (!result || typeof result !== 'object' || result.isError === true || !Array.isArray(result.content)) return false;
    // Some legacy handlers return an Error: text result without setting isError.
    if (result.content.some((part) => part?.type === 'text' && typeof part.text === 'string' && /^\s*Error\s*:/i.test(part.text))) return false;
    return true;
  } catch { return false; }
}

/** Parse, append one trailer, preserve all structured/unknown result properties. */
export function appendSuccessUpgrade(requestBody, responseBody, trailer, httpStatus = 200) {
  if (!successfulBusinessResponse(requestBody, responseBody, httpStatus)) return { body: responseBody, appended: false };
  const response = JSON.parse(responseBody);
  response.result.content.push({ type: 'text', text: trailer });
  return { body: JSON.stringify(response), appended: true };
}

/** One batch per returned response. All its counters and dedup markers commit together. */
export async function recordFunnelEvents(env, { server, events, source, cohort, token, observationId = crypto.randomUUID() }, now = Date.now()) {
  if (!env.FUNNEL || typeof server !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(server) || !Array.isArray(events) || !events.length || events.length > 3 || events.some((event) => !EVENTS.has(event))) throw new Error('Invalid funnel observation');
  if (!Number.isFinite(now) || !['ordinary', 'probe'].includes(cohort)) throw new Error('Invalid funnel metadata');
  const day = new Date(now).toISOString().slice(0, 10);
  const wanted = [...new Set(events)];
  const tokenServerHash = isAnon(token) ? await digest(`${day}\n${cohort}\n${server}\n${token}`) : undefined;
  if (!tokenServerHash) {
    const index = wanted.indexOf('first_successful_anon_token_server_day');
    if (index >= 0) wanted.splice(index, 1);
  }
  if (!wanted.length) return { skipped: true };
  const batch = { day, server, events: wanted, source: sourceLabel(source), cohort, observationId,
    ...(tokenServerHash ? { tokenServerHash } : {}) };
  const stub = env.FUNNEL.get(env.FUNNEL.idFromName(`funnel:v2:${day}`));
  const requestBody = JSON.stringify(batch);
  // Retry the same response identity once, including an ambiguous committed-write
  // timeout. The DO deduplicates that retry. A new tool invocation gets a fresh ID.
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await stub.fetch('https://funnel.internal/record', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: requestBody,
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`Funnel record unavailable (${response.status})`);
      return await response.json();
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

/** Billing single-stage compatibility wrapper; hosted response events use a batch. */
export async function recordFunnelEvent(env, { event, ...observation }, now = Date.now()) {
  return recordFunnelEvents(env, { ...observation, events: [event] }, now);
}

/** At most seven DO requests and 490 fixed aggregate cells; never a KV/key scan. */
export async function funnelStats(env, { days = 1, now = Date.now() } = {}) {
  if (!Number.isInteger(days) || days < 1 || days > 7 || !Number.isFinite(now)) throw new Error('Invalid funnel window');
  const end = new Date(now);
  const dates = Array.from({ length: days }, (_, index) => new Date(now - index * 86400000).toISOString().slice(0, 10)).sort();
  const daily = await Promise.all(dates.map(async (day) => {
    try {
      const stub = env.FUNNEL.get(env.FUNNEL.idFromName(`funnel:v2:${day}`));
      const response = await stub.fetch(`https://funnel.internal/stats?day=${day}`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('unavailable');
      const text = await response.text();
      if (text.length > 32768) throw new Error('oversized');
      const value = JSON.parse(text);
      if (value.day !== day || value.complete !== true || !Array.isArray(value.rows) || value.rows.length > 70) throw new Error('incomplete');
      for (const row of value.rows) {
        if (!['ordinary', 'probe'].includes(row.cohort) || !SOURCES.has(row.source) || !EVENTS.has(row.event) || !Number.isSafeInteger(row.count) || row.count < 0 || Object.keys(row).some((key) => !['cohort', 'source', 'event', 'count'].includes(key))) throw new Error('invalid');
      }
      if (new Set(value.rows.map((row) => `${row.cohort}:${row.source}:${row.event}`)).size !== value.rows.length) throw new Error('duplicate');
      return { day, complete: true, first_recorded_at: value.first_recorded_at ?? null, rows: value.rows };
    } catch { return { day, complete: false, reason: 'day_unavailable_or_invalid' }; }
  }));
  const complete = daily.every((day) => day.complete);
  const rows = complete ? daily.flatMap(({ day, rows }) => rows.map((row) => ({ day, ...row }))) : [];
  const totals = (cohort) => Object.fromEntries(FUNNEL_EVENTS.map((event) => [event, rows.filter((row) => row.cohort === cohort && row.event === event).reduce((sum, row) => sum + row.count, 0)]));
  return {
    instrument: FUNNEL_VERSION, generated_at: end.toISOString(), complete,
    window: { start: `${dates[0]}T00:00:00.000Z`, end: end.toISOString(), utc_dates: dates, today_partial: true },
    interpretation: 'Recorded hosted response/event counts pooled across servers. ordinary means unmarked, not human or customer. Source labels are unverified declarations. First success is per anonymous token/server/UTC day, not lifetime use. No local usage or conversion rate is measured.',
    coverage: 'Starts only on deployment. Empty counters do not prove deployment, full-window coverage or zero historic use. Anonymous observations with missing/expired sidecars are unmeasured, except explicitly marked current probes.',
    limitations: 'Durable transactions preserve admitted batches and daily deduplication. Deferred write failures or unresolved cohort metadata drop observations. complete concerns bounded counter retrieval only, not full traffic capture. Sidecars expire 31 days after mint; their missing/negative-cached lookups never become ordinary.',
    ordinary: complete ? totals('ordinary') : null, probe: complete ? totals('probe') : null,
    days: daily.map(({ rows, ...day }) => day), rows,
  };
}
