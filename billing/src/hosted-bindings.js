// Keep each purchased scope independently. The legacy slot remains readable by older
// Workers during a rollout; it must never be the sole copy of a replaced purchase.
const scopePattern = /^(?:\*|[a-z0-9]+(?:-[a-z0-9]+)*)$/;
export function bindingSlot(tenant, scope) {
  if (!/^anon_[0-9a-f]{32}$/.test(tenant) || !scopePattern.test(scope)) {
    throw new Error("invalid hosted binding scope");
  }
  return `bind:${tenant}:${scope}`;
}

/** verify returns {ok, p, reason}; every read rechecks signatures and expiry. */
export async function readBinding(kv, tenant, product, verify) {
  const slots = [...new Set([bindingSlot(tenant, "*"),
    ...(product === "*" ? [] : [bindingSlot(tenant, product)]), `bind:${tenant}`])];
  const keys = await Promise.all(slots.map(slot => kv.get(slot)));
  let rejected = null;
  for (const key of new Set(keys.filter(Boolean))) {
    const checked = await verify(key.trim(), product);
    if (checked.ok) return checked;
    rejected = checked;
  }
  return rejected;
}

/** The caller has already verified the incoming key and its scope. */
export async function writeBinding(kv, tenant, key, scope, verify) {
  const slot = bindingSlot(tenant, scope);
  const legacySlot = `bind:${tenant}`;
  const previous = await kv.get(legacySlot);
  if (previous && previous !== key) {
    const checked = await verify(previous.trim(), "*");
    if (checked.ok && checked.p !== scope) {
      const previousSlot = bindingSlot(tenant, checked.p);
      // Retain a valid scoped entitlement, but a corrupt or expired copy must not
      // prevent recovery of the still-valid legacy purchase before it is replaced.
      const scoped = await kv.get(previousSlot);
      if (!scoped || !(await verify(scoped.trim(), checked.p)).ok) {
        await kv.put(previousSlot, previous.trim());
      }
    }
  }
  // Licenses have their own signed expiry. Anonymous document/token retention is
  // separate: refreshing a token must not leave a lifetime purchase expiring in KV.
  await kv.put(slot, key);
  await kv.put(legacySlot, key);
}
