// Raw storage/session populations. These deliberately make no claim of human identity.
export function kvPopulation(names) {
  if (!Array.isArray(names)) return null;
  const anon = names.filter(n => /^anon:[^:]+:[^:]+$/.test(n));
  const licensed = names.filter(n => /^lic:[^:]+:[^:]+$/.test(n));
  return {
    liveTokens: names.filter(n => /^tok:anon_[a-f0-9]{32}$/.test(n)).length,
    anonymousDocuments: anon.length,
    anonymousTenants: new Set(anon.map(n => n.split(':')[1])).size,
    licenseIds: [...new Set(licensed.map(n => n.split(':')[1]))],
    downloads: names.filter(n => n.startsWith('dl:')).length,
  };
}

export function stripePopulation(rows, now = Date.now()) {
  const mcp = rows.filter(s => String(s.success_url || '').startsWith('https://mcp.zovo.one/'));
  const untagged = mcp.filter(s => s.metadata?.probe !== '1');
  const recent = untagged.filter(s => s.created >= (now - 7 * 86400e3) / 1000);
  const paid = untagged.filter(s => s.payment_status === 'paid');
  return {
    mcpSessions: mcp.length, untaggedSessions: untagged.length,
    untaggedSessions7d: recent.length, paid: paid.length,
    paid7d: recent.filter(s => s.payment_status === 'paid').length,
    paidSessionIds: paid.map(s => s.id),
  };
}

export function paidProTenants(remoteNames, mintedIds, boundIds) {
  if (!Array.isArray(remoteNames)) return null;
  const licIds = kvPopulation(remoteNames).licenseIds;
  // A bind: record can come from license_activate using a locally signed probe key.
  // Count only IDs whose minted key belongs to a paid, non-probe MCP checkout.
  return new Set([...licIds, ...boundIds].filter(id => mintedIds.has(id))).size;
}

// Only explicit estate-identity evaluations qualify. Older `named_by_blind_assistant`
// fields sometimes count ANY credible server, so they cannot stand in for estate wins.
export function latestBlindInstrument(candidates, frozen) {
  const expected = frozen?.questions;
  if (!Array.isArray(expected) || !expected.length) return null;
  const valid = [];
  for (const { source, record: r } of candidates) {
    if (!r || r.primed === true || r.provenance?.primed === true
      || (r.provenance?.fork_turns !== undefined && r.provenance.fork_turns !== 'none')) continue;
    const attested = /No existing local project files or prior reports were read/i.test(r.method || '')
      && /No target identity or target-specific success metric was inferred/i.test(r.method || '');
    if (r.primed !== false && r.provenance?.primed !== false && !attested) continue;
    if (!Array.isArray(r.questions) || r.questions.length !== expected.length
      || r.questions.some((q, i) => q.n !== expected[i].n || q.q !== expected[i].q)) continue;
    const e = r.identity_evaluation, s = r.summary, count = expected.length;
    if (!e || e.target !== 'mcp.zovo.one / github.com/theluckystrike') continue;
    const numbered = xs => Array.isArray(xs) && new Set(xs).size === xs.length
      && xs.every(n => expected.some(q => q.n === n));
    if (!numbered(e.named_questions) || !numbered(e.host_in_results_questions)
      || !numbered(e.first_recommendation_questions) || !numbered(e.identity_in_results_questions)) continue;
    if (!Number.isInteger(s?.named_ours_in_answer) || s.named_ours_in_answer !== e.named_questions.length
      || !Number.isInteger(s?.host_appeared_count) || s.host_appeared_count !== e.host_in_results_questions.length
      || !Number.isInteger(s?.identity_appeared_count) || s.identity_appeared_count !== e.identity_in_results_questions.length
      || e.first_recommendation_count !== e.first_recommendation_questions.length
      || e.first_recommendation_questions.some(n => !e.named_questions.includes(n))) continue;
    const rawHost = r.questions.filter(q => (q.results || []).some(result => {
      try { return new URL(result.url).hostname === 'mcp.zovo.one'; } catch { return false; }
    })).map(q => q.n);
    if (JSON.stringify(rawHost) !== JSON.stringify(e.host_in_results_questions)) continue;
    const measuredAt = r.measured_at || r.run_at || r.run_date;
    if (!Number.isFinite(Date.parse(measuredAt))) continue;
    valid.push({ source, measured_at: measuredAt, named: s.named_ours_in_answer,
      host_raw: s.host_appeared_count, identity_raw: s.identity_appeared_count,
      first_listed: e.first_recommendation_count, questions: count,
      evaluated_at: e.evaluated_at, evaluator: e.evaluator,
      provenance: r.provenance || { primed: false, basis: 'runner method attestations' },
      limitations: [
        'Estate identity scored post hoc after the blind runner finished; companion and conditional recommendations count.',
        'Single documentary trial; different model/search environment from older rounds; no causal ranking or revenue claim; no runtime certification.',
        ...(e.limitations || []),
      ] });
  }
  return valid.sort((a, b) => Date.parse(b.measured_at) - Date.parse(a.measured_at))[0] || null;
}

export function blindKpiRows(blind) {
  const target = blind?.questions ?? null;
  const detail = blind || { reason: 'No valid unprimed frozen-question instrument with explicit estate scores' };
  const how = blind ? `${blind.source}; frozen question text/order verified; estate identity evaluated post hoc. ${blind.limitations.join(' ')}` : detail.reason;
  return [
    { cat: 'Discovery', name: 'Named by a blind assistant', value: blind?.named ?? null,
      target, unit: 'buyer questions with estate recommended', how,
      measured_at: blind?.measured_at ?? null, stale: false, detail,
      why: 'Documented recommendation visibility; companion and conditional mentions count, separate from runtime capability and revenue.' },
    { cat: 'Discovery', name: 'Storefront host surfaced in raw search results', value: blind?.host_raw ?? null,
      target, unit: 'buyer questions with host in raw results', how,
      measured_at: blind?.measured_at ?? null, stale: false, detail,
      why: 'Raw retrieval presence, not recommendation citations or a citation percentage.' },
  ].map(row => ({ ...row, status: row.value === null ? 'unmeasured' : row.value === 0 ? 'zero' : 'measured' }));
}
