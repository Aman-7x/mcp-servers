import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }', shortCircuit: true };
    return next(specifier, context);
  },
});
export const { FunnelState, acceptFunnelBatch, readFunnelDay } = await import('../src/funnel-state.js');

/** Serialized transactions stage all writes and alarms, committing only on success. */
export function storageHarness() {
  let committed = new Map(), tail = Promise.resolve(), active = null, alarm = null;
  let failKey = null;
  const storage = {
    get: async (key) => structuredClone(committed.get(key)),
    setAlarm: async (at) => { if (active) active.alarm = at; else alarm = at; },
    deleteAlarm: async () => { alarm = null; },
    deleteAll: async () => { committed = new Map(); },
    transaction(fn) {
      const run = tail.then(async () => {
        const stage = { values: structuredClone(committed), alarm };
        active = stage;
        const tx = {
          get: async (key) => structuredClone(stage.values.get(key)),
          put: async (key, value) => {
            if (failKey === key) { failKey = null; throw new Error('injected transaction failure'); }
            stage.values.set(key, structuredClone(value));
          },
        };
        try {
          const result = await fn(tx);
          committed = stage.values;
          alarm = stage.alarm;
          return result;
        } finally { active = null; }
      });
      tail = run.catch(() => {});
      return run;
    },
  };
  return { storage, values: () => structuredClone(committed), alarm: () => alarm, failNextPut: (key) => { failKey = key; } };
}

export function namespaceHarness() {
  const objects = new Map();
  let fetches = 0;
  const unavailable = new Set();
  let loseNextReply = false;
  const FUNNEL = {
    idFromName: (name) => name,
    get(name) {
      if (!objects.has(name)) {
        const harness = storageHarness();
        objects.set(name, { ...harness, object: new FunnelState({ storage: harness.storage }, {}) });
      }
      return { async fetch(url, options) {
        fetches++;
        if (unavailable.has(name)) throw new Error('injected unavailable object');
        const response = await objects.get(name).object.fetch(new Request(url, options));
        if (loseNextReply) { loseNextReply = false; throw new Error('reply lost after commit'); }
        return response;
      } };
    },
  };
  return { env: { FUNNEL }, objects, fetches: () => fetches, unavailable,
    loseNextReply: () => { loseNextReply = true; } };
}
