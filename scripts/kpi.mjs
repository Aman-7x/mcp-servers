#!/usr/bin/env node
// MCP product KPIs, collected from live and local sources into data/kpi.json. Free endpoints only.
// Categories follow the funnel a server lives in: discovered -> installed -> first call -> repeat use -> paid.
import { execFileSync } from "node:child_process";
import { kvPopulation, stripePopulation, paidProTenants, latestBlindInstrument, blindKpiRows } from "./kpi-populations.mjs";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
if (process.argv.includes('--help')) {
  console.log('Usage: node scripts/kpi.mjs [--from-audit]\nDefault collects live read-only KPIs; --from-audit refreshes reviewed local measurements without network.');
  process.exit(0);
}
if (process.argv.slice(2).some(arg => arg !== '--from-audit')) throw Error('Unknown argument; use --help');
const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const js = (p, d) => { try { return JSON.parse(readFileSync(`${ROOT}/${p}`, "utf8")); } catch { return d; } };
const blind = latestBlindInstrument(readdirSync(`${ROOT}/data`).filter(n => /^blind_recommendation_r\d+\.json$/.test(n)).map(n => ({ source: `data/${n}`, record: js(`data/${n}`, null) })), js("data/blind_questions.json", null));
const currentBlindRows = blindKpiRows(blind);
const sh = (cmd, args, opts = {}) => { try { return execFileSync(cmd, args, { encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.local/bin:${process.env.PATH}` }, ...opts }); } catch (e) { if (process.env.KPI_DEBUG) console.error("sh fail", cmd, args.slice(0, 3).join(" "), String(e.stderr || e.message).slice(0, 200)); return ""; } };

// wrangler is the only subprocess that talks to a remote KV store over the network, and it
// is the one that has hung this script before (kv key list --remote with no timeout once
// blocked the run and the row it fed landed in data/kpi.json as null). Every wrangler call
// goes through this wrapper: a hard 60s timeout, and a `failed` flag instead of a caught
// exception, so a KPI row can fall back to its previous value instead of going null.
const WRANGLER_TIMEOUT_MS = 60000;
const shWrangler = (args) => {
  try {
    const out = execFileSync("wrangler", args, {
      encoding: "utf8",
      timeout: WRANGLER_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `/opt/homebrew/bin:${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.local/bin:${process.env.PATH}` },
    });
    return { out, failed: false };
  } catch (e) {
    if (process.env.KPI_DEBUG) console.error("wrangler fail", args.slice(0, 3).join(" "), String(e.stderr || e.message).slice(0, 200));
    return { out: "", failed: true };
  }
};

// Previous run's rows, keyed by name: the fallback source when a wrangler-backed row fails.
const prevKpi = js("data/kpi.json", { kpis: [] });
// Refresh only measured commercial/traffic rows from the bounded, reviewed audit.
// This mode performs no network calls or signed-key probes and preserves other rows as stale.
if (process.argv.includes("--from-audit")) {
  const a = js("data/r36_kpi_audit.json", null);
  if (!a?.audit || Date.now() - Date.parse(a.audit.generated_at) > 24 * 3600e3) throw new Error("missing/stale R36 audit");
  if (!a.stripe?.seven_day_coverage_proven || a.search_console?.status !== "OK" || a.activation?.status !== "OK") throw new Error("audit channel not verified");
  const now = new Date().toISOString();
  const out = { ...prevKpi, generated_at: now, audit_source: "data/r36_kpi_audit.json", windows: { traffic: a.cloudflare.window, stripe: a.stripe.window_7d, search: { start: a.search_console.startDate, end: a.search_console.endDate } }, kpis: prevKpi.kpis.map(k => ({ ...k, stale: true, stale_reason: "not refreshed by R36 audit" })) };
  function set(old, name, value, unit, how, measured_at, window) {
    const prior = out.kpis.find(k => k.name === old || k.name === name) || {};
    const row = { ...prior, name, value, unit, how, measured_at, window, stale: false, status: value === null ? "unmeasured" : value === 0 ? "zero" : "measured" };
    delete row.stale_reason;
    if (old !== name) delete row.why;
    if (name === "Ephemeral hosted download records" || name === "Live anonymous hosted token records") row.target = null;
    const idx = out.kpis.indexOf(prior);
    if (idx < 0) out.kpis.push(row); else out.kpis[idx] = row;
  }
  const trafficWindow = a.cloudflare.window, stripeWindow = a.stripe.window_7d, searchWindow = out.windows.search;
  set("Google impressions, storefront", "Google impressions, storefront", a.search_console.mcp.impressions, "impressions, 29 dates", "GSC host-filtered date query, HTTP/API errors checked; control zovo.one: 5486 impressions/49 clicks", a.search_console.fetched_at, searchWindow);
  set("Human requests, storefront (assets included)", "Render-qualified browser requests (assets included)", a.human_evidence.requests_render_proven, "requests, 7d", "Cloudflare UA + rendering-resource heuristic; includes automation/operator; not people or page views", a.generated_at, trafficWindow);
  set("GitHub unique visitors", "GitHub unique visitors", a.github_traffic.unique_visitors_14d, "GitHub uniques, 14d", a.github_traffic.api + "; not independently verified humans", a.generated_at, { start: a.github_traffic.views_daily[0].date, end: a.github_traffic.views_daily.at(-1).date });
  set("Anonymous hosted tokens minted", "Live anonymous hosted token records", a.activation.remote.live_token_records, "records now", "KV tok:anon_*; 30-day refreshed TTL; includes probes; not lifetime mints", a.activation.fetched_at, null);
  set("Hosted tenants with stored data", "Anonymous tenants with stored data (includes probes)", a.activation.remote.distinct_anonymous_tenants_with_stored_data, "tenant IDs now", "Distinct IDs in anon:<id>:<server>, deduplicated across servers/profile; no human claim", a.activation.fetched_at, null);
  set("Hosted downloads served", "Ephemeral hosted download records", a.activation.remote.ephemeral_download_records, "records now, 1h TTL", "KV dl: rows; not cumulative downloads served", a.activation.fetched_at, null);
  set("Checkout sessions from humans (last 100)", "Untagged MCP checkout sessions (7d)", a.stripe.mcp_7d.untagged_sessions, "sessions, 7d", "Stripe latest 100 cover entire seven-day period; MCP success_url filter; untagged != verified human", a.stripe.fetched_at, stripeWindow);
  set("Paid sessions", "Paid MCP checkout sessions (7d)", a.stripe.mcp_7d.paid, "paid sessions, 7d", "MCP storefront scope, tagged probes excluded; historical lifetime remains unmeasured", a.stripe.fetched_at, stripeWindow);
  set("License keys minted", "Paid checkout license records", a.activation.licenses.minted_session_records === 0 ? 0 : null, "records now", "LICENSES session: keys only; sub:/unsub: email rows excluded", a.activation.fetched_at, null);
  set("Upgrade link clicks (humans, 7d)", "Guard-passing upgrade clicks (7d)", a.upgrade_clicks.clicks_7d, "clicks, 7d", "stats/clicks instrument 3; legacy excluded; headers do not prove human identity", a.upgrade_clicks.fetched_at, { start: new Date(Date.parse(a.upgrade_clicks.fetched_at)-7*86400e3).toISOString(), end: a.upgrade_clicks.fetched_at });
  set("Click to checkout-session ratio", "Click to checkout-session ratio", null, "%", "Undefined: zero seven-day guard-passing clicks. No cross-window or person-level conversion claim.", now, stripeWindow);
  set("Pro tenants on hosted endpoints", "Paid Pro tenants verified by minted checkout key", a.activation.licenses.minted_session_records === 0 ? 0 : null, "paid-linked tenant IDs", "Zero minted checkout license records; all raw lic: IDs remain excluded as unproven probes", a.activation.fetched_at, null);
  // Use the same validated selector as the full collector; never preserve a stale R1 zero.
  out.kpis = out.kpis.filter(k => !["Named by a blind assistant", "Our share of recommendation citations", "Storefront host surfaced in raw search results"].includes(k.name));
  out.kpis.push(...currentBlindRows);
  out.raw = { ...out.raw, blind_instrument: blind, stripe: a.stripe, pro_tenants: { source: "R36 audit", probe_ids_excluded: a.activation.remote.distinct_license_ids } };
  // Old raw KV names can contain token/session identifiers; the audit uses aggregates.
  delete out.raw.remote_kv; delete out.raw.license_kv;
  writeFileSync(`${ROOT}/data/kpi.json`, JSON.stringify(out, null, 2) + "\n");
  console.log(`kpi: refreshed from audit; ${out.kpis.filter(k => !k.stale).length} measured rows; other rows explicitly stale`);
  process.exit(0);
}
const prevByName = new Map((prevKpi.kpis || []).map((k) => [k.name, k]));
const staleAt = new Date().toISOString();
/** Replace a KPI row's value with its previous value, stale and noted, when a wrangler call failed. */
function staleIfFailed(kpi, failed) {
  if (!failed) return kpi;
  const prev = prevByName.get(kpi.name);
  return { ...kpi, value: prev ? prev.value : null, stale: true, how: `previous value; wrangler timed out at ${staleAt}` };
}

const metrics = js("data/metrics.json", { snapshots: [] }).snapshots.at(-1) || {};
const val = js("data/validation.json", { runs: [] }).runs.at(-1) || {};
const uvi = js("data/user_value_index.json", { rounds: [], counts: {} });
const org = js("data/organic.json", { surfaces: [], fleet: {} });
const ledger = js("data/ledger.json", { servers: [] });
const dist = js("data/distribution.json", { surfaces: {}, per_server: {} });
const baseline33 = js("data/baselines/loop33_baseline.json", null);
const remoteToml = existsSync(`${ROOT}/remote/wrangler.toml`) ? readFileSync(`${ROOT}/remote/wrangler.toml`, "utf8") : "";
const licToml = existsSync(`${ROOT}/billing/wrangler.toml`) ? readFileSync(`${ROOT}/billing/wrangler.toml`, "utf8") : "";
const nsOf = (t) => (t.match(/kv_namespaces[\s\S]*?\bid\s*=\s*"([0-9a-f]{32})"/) || [])[1];

// Stripe: fully paginate the read-only checkout list. Never interpret an API failure as zero.
const stripeRows = [];
let stripeComplete = false;
let stripeHistoryComplete = false;
const stripeSince = Date.now() / 1000 - 7 * 86400;
const seenStripeCursors = new Set();
for (let page = 0, cursor = ""; page < 50; page++) {
  const raw = sh("stripe", ["checkout", "sessions", "list", "--live", "--limit", "100", ...(cursor ? ["--starting-after", cursor] : [])]);
  try {
    const j = JSON.parse(raw);
    if (!Array.isArray(j.data)) break;
    stripeRows.push(...j.data);
    if (!j.has_more) { stripeComplete = true; stripeHistoryComplete = true; break; }
    if (j.data.length && j.data.at(-1).created <= stripeSince) { stripeComplete = true; break; }
    if (!j.data.length) break;
    cursor = j.data.at(-1).id;
    if (seenStripeCursors.has(cursor)) break;
    seenStripeCursors.add(cursor);
  } catch { break; }
}
const population = stripeComplete ? stripePopulation(stripeRows) : null;
const stripe = {
  fetched_at: new Date().toISOString(), seven_day_coverage_complete: stripeComplete, history_pagination_complete: stripeHistoryComplete,
  sessions_fetched: stripeRows.length,
  sessions_last100: Math.min(100, stripeRows.length),
  probe_sessions: stripeComplete ? stripeRows.filter(s => s.metadata?.probe === "1").length : null,
  human_sessions: population?.untaggedSessions7d ?? null,
  untagged_mcp_sessions_7d: population?.untaggedSessions7d ?? null,
  paid: population?.paid7d ?? null, paid_7d: population?.paid7d ?? null,
  window_7d: { start: new Date(Date.now() - 7 * 86400e3).toISOString(), end: new Date().toISOString() },
  paid_scope: "non-probe MCP storefront only; last seven days; lifetime unmeasured unless history_pagination_complete",
  note: "untagged sessions are not verified humans; complete pagination required for values",
};
const paidSessionIds = new Set(population?.paidSessionIds || []);
const sales = null; // Account-wide balance transactions mix unrelated storefronts.

// KV populations (hosted usage): wrangler needs --remote
const kvCount = (ns) => {
  const { out, failed } = shWrangler(["kv", "key", "list", "--namespace-id", ns, "--remote"]);
  try {
    const ks = JSON.parse(out).map((k) => k.name);
    const by = {};
    for (const k of ks) { const p = k.includes(":") ? k.split(":")[0] : k.split("_")[0]; by[p] = (by[p] || 0) + 1; }
    return { total: ks.length, by, names: ks, failed };
  } catch {
    return { total: null, by: {}, names: null, failed: true };
  }
};
const remoteKv = nsOf(remoteToml) ? kvCount(nsOf(remoteToml)) : { total: null, by: {}, names: null };
const licKv = nsOf(licToml) ? kvCount(nsOf(licToml)) : { total: null, by: {}, names: null };

// Pro tenants on hosted endpoints, without the validation probes.
// REMOTE_DATA holds one `lic:<id>:<server>` document per (Pro key, server) pair, so the raw
// key count (507) is neither tenants nor people: 107 distinct ids, and almost all of them are
// throwaway keys signed locally by scripts/sign-license.mjs for a validation run.
// A tenant counts as real only if money or a person is attached to it:
//   1. `bind:<anon token>` in REMOTE_DATA -- written by the billing worker only after Stripe
//      fulfilment, so every one of these is a paid tenant;
//   2. a `lic:<id>` whose id belongs to a key the billing worker actually minted. Minted keys
//      are stored in LICENSES as `session:<checkout session id>`; their payload id is decoded
//      here. Every other lic id was signed from keys/license-private.pem by validation.
const licenseKeyId = (key) => { try { return JSON.parse(Buffer.from(String(key).split(".")[1], "base64url").toString("utf8")).id || null; } catch { return null; } };
const mintedIds = new Set();
let mintLookupFailed = false;
if (licKv.names && nsOf(licToml)) {
  for (const name of licKv.names.filter((n) => n.startsWith("session:"))) {
    const sessionId = name.slice(8);
    let session = stripeRows.find(s => s.id === sessionId);
    if (!session) {
      try { session = JSON.parse(sh("stripe", ["checkout", "sessions", "retrieve", sessionId, "--live"])); }
      catch { mintLookupFailed = true; continue; }
      if (!session?.id) { mintLookupFailed = true; continue; }
    }
    if (session.payment_status !== "paid" || session.metadata?.probe === "1" || !String(session.success_url || "").startsWith("https://mcp.zovo.one/")) continue;
    paidSessionIds.add(sessionId);
    const { out, failed } = shWrangler(["kv", "key", "get", name, "--namespace-id", nsOf(licToml), "--remote"]);
    if (failed) mintLookupFailed = true;
    const id = licenseKeyId(out.trim());
    if (id) mintedIds.add(id);
  }
}
const boundIds = [];
if (remoteKv.names && nsOf(remoteToml)) {
  for (const name of remoteKv.names.filter(n => n.startsWith("bind:"))) {
    const { out, failed } = shWrangler(["kv", "key", "get", name, "--namespace-id", nsOf(remoteToml), "--remote"]);
    if (failed) mintLookupFailed = true;
    const id = licenseKeyId(out.trim());
    if (id) boundIds.push(id);
  }
}
const proTenantsFailed = remoteKv.failed || licKv.failed || mintLookupFailed;
const remotePopulation = kvPopulation(remoteKv.names);
const licTenants = remotePopulation?.licenseIds ?? null;
const proTenants = proTenantsFailed ? null : paidProTenants(remoteKv.names, mintedIds, boundIds);
const proTenantDetail = {
  lic_keys: remoteKv.by.lic ?? null, lic_distinct_ids: licTenants?.length ?? null,
  minted_key_ids: mintedIds.size, stripe_bound_tenants: boundIds.filter(id => mintedIds.has(id)).length,
  probe_ids_excluded: licTenants?.filter(id => !mintedIds.has(id)).length ?? null,
};

// Hosted latency: three tools/list calls with a signed Pro key
let latency = { p50_ms: null, samples: [] };
try {
  const key = sh("node", [`${ROOT}/scripts/sign-license.mjs`, "*"]).trim();
  for (let i = 0; i < 3; i++) { const t0 = Date.now(); const r = await fetch("https://mcp.zovo.one/mcp/time-tracker", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${key}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) }); await r.text(); latency.samples.push(Date.now() - t0); }
  latency.p50_ms = latency.samples.slice().sort((a, b) => a - b)[1];
} catch {}

// Conversion instrument (docs/CONVERSION_INSTRUMENT.md): clicks on the tagged upgrade
// link, counted by the billing worker before it redirects to Stripe.
let clickStats = null;
try { clickStats = await (await fetch("https://mcp.zovo.one/stats/clicks")).json(); } catch {}
const clicks7d = clickStats?.clicks_7d ?? null;
const clickToSession = clicks7d && stripe.untagged_mcp_sessions_7d !== null && clicks7d > 0
  ? Math.round((1000 * stripe.untagged_mcp_sessions_7d) / clicks7d) / 10
  : null;

// Sitemap size and registry entries
let sitemapUrls = null; try { const x = await (await fetch("https://mcp.zovo.one/sitemap.xml")).text(); sitemapUrls = (x.match(/<loc>/g) || []).length; } catch {}
// Membership is tested against the EXACT endpoint, not a substring search.
// The previous probe called /v0/servers?search=<name>&version=latest and looked for an exact
// name match in page one of the response. That worked when the registry was small. It is not
// small: full pagination on 2026-09-10 counted 30,395 distinct latest servers, so a substring
// search can push the exact match off page one and the probe then reports a live entry as
// missing. It read 41 of 91 while a direct check of a random sample of 12 returned 12 of 12
// present at the release version, so the number was measuring the instrument.
// /v0.1/servers/<urlencoded name>/versions/latest is an exact membership test: 200 with the
// version, 404 when absent.
let registryLatest = null; try { const names = new Map(); for (const d of readdirSync(`${ROOT}/servers`)) { for (const f of readdirSync(`${ROOT}/servers/${d}`)) { if (/^server(\.[a-z0-9-]+)?\.json$/.test(f) && f !== "server.json" && f !== "server.npm-package.json" && f !== "server.mcpb.json") { try { const j = JSON.parse(readFileSync(`${ROOT}/servers/${d}/${f}`, "utf8")); if (!names.has(j.name)) names.set(j.name, { version: j.version, src: `${d}/${f}` }); } catch {} } } } let atLatest = 0, hosted = 0, unreachable = 0; for (const [n, meta] of names) { try { const c = new AbortController(); const t = setTimeout(() => c.abort(), 15000); // R33: /versions/latest 404s on this API ("Endpoint not found") — /versions is the real endpoint, take servers[0].server
const res = await fetch(`https://registry.modelcontextprotocol.io/v0.1/servers/${encodeURIComponent(n)}/versions`, { signal: c.signal }); clearTimeout(t); if (res.status === 404) continue; if (!res.ok) { unreachable++; continue; } const j = await res.json(); const sv = (j.servers && j.servers[0] && j.servers[0].server) || j.server || j; if (sv && sv.version === meta.version) atLatest++; if (Array.isArray(sv.remotes) && sv.remotes.length) hosted++; } catch { unreachable++; } } registryLatest = { entries: atLatest, names: names.size, release: null, hosted, unreachable }; } catch {}

// Unit tests: read the count the last release chain recorded (data/tests.json, written by the release step), never re-run the
// whole suite inside the KPI collector, which took longer than the collector's own budget and left this row null.
const testsRec = js("data/tests.json", null);
const tests = testsRec && Number.isFinite(testsRec.pass) ? testsRec.pass : null;
const tools = ledger.servers.reduce((a, s) => a + (s.tool_count || 0), 0);
const servers = ledger.servers.filter((s) => s.id !== "office-suite").length;
// per_server.hosted is "published <url>", not the bare "published" this once matched:
// the URL was appended in the v0.6.0 ledger rewrite and the equality test silently read 0.
const hostedServers = Object.values(dist.per_server || {}).filter((s) => /^published\b/.test(String(s.hosted ?? ""))).length;
const latestRound = uvi.rounds.at(-1) || {};
// "published" and "live" mean the same thing in data/distribution.json and both are in use:
// the awesome-list entries that were merged are recorded as "live", so an equality test on
// "published" alone undercounted them. Same class of defect as the hostedServers line above,
// where an appended URL made an equality test silently read 0.
const surfacesLive = Object.values(dist.surfaces || {}).filter((s) => /^(published|live)\b/.test(String(s.status ?? ""))).length;
const surfacesTotal = Object.keys(dist.surfaces || {}).length;
const regFind = (org.surfaces || []).find((s) => /Official MCP registry/i.test(s.surface));

// Loop 29: real organic measurement. data/traffic.json is written by scripts/traffic.mjs
// (Cloudflare GraphQL, 7-day cap on this Pro zone); data/gsc.json by the same script from
// Search Console. Both fail loudly rather than writing zeros, so a null here means the
// pull did not run, not that the number is zero.
const auditTraffic = js("data/r36_kpi_audit.json", null);
const traffic = auditTraffic?.audit && Date.now() - Date.parse(auditTraffic.audit.generated_at) < 24 * 3600e3 ? auditTraffic : js("data/traffic.json", null);
const gsc = js("data/gsc.json", null);
const cov = traffic?.crawler_url_coverage || {};
const covOf = (n) => { const v = cov[n]; if (typeof v === "number") return v; return v && typeof v.urls_fetched === "number" ? v.urls_fetched : null; };
// requests_render_proven counts requests from browser UA strings that were confirmed to
// be real render engines (that exact UA also fetched favicon, cdn-cgi or assets). A
// spoofed UA that never loads an asset is excluded.
const humanViews7d = traffic?.human_evidence?.requests_render_proven ?? null;
const audit = js("data/r36_kpi_audit.json", null);
const freshAuditSearch = audit?.search_console?.status === "OK" && Date.now() - Date.parse(audit.search_console.fetched_at) < 24 * 3600e3 ? audit.search_console : null;
const gscImpr = freshAuditSearch?.mcp?.impressions ?? gsc?.mcp_pages?.impressions ?? gsc?.totals?.mcp_impressions ?? null;
let ghUniques = null;
try { ghUniques = JSON.parse(sh("gh", ["api", "repos/theluckystrike/mcp-servers/traffic/views"])).uniques; } catch {}

const kpis = [
  // Discovery
  { cat: "Discovery", name: "Registry entries at latest version", value: registryLatest?.entries ?? null, target: registryLatest?.names ?? servers + 1, unit: "of all published names", how: "one exact GET /v0.1/servers/<name>/versions per manifest name, compared with the release version. NOT a substring search: with 30,395 servers in the registry a search can push the exact match off page one, which is how this read 41 of 91 while a direct sample of 12 returned 12 of 12 present", why: "The official registry is the index Claude, Cursor and VS Code pickers read." },
  { cat: "Discovery", name: "Registry findable share", value: regFind ? Math.round(regFind.findable * 100) : null, target: 60, unit: "% of tracked tokens", how: "data/organic.json (name-substring search probes)", why: "Search is name-only; a server nobody can find by the words they type does not exist." },
  { cat: "Discovery", name: "Distribution surfaces live", value: surfacesLive, target: surfacesTotal, unit: `of ${surfacesTotal}`, how: "data/distribution.json", why: "Each free registry or catalog is a compounding source of installs." },
  { cat: "Discovery", name: "URLs offered in the sitemap", value: sitemapUrls, target: null, unit: "URLs", how: "curl mcp.zovo.one/sitemap.xml", why: "Not a score to maximise. It was 312, of which 216 were client-by-product setup permutations measuring 73.6-77.5% similar to each other; Googlebot read the sitemap 7 times and then crawled 2 pages. Cut to 96 on 2026-09-07 and the permutations marked noindex,follow. See docs/SEO_INDEXATION_R1.md." },
  { cat: "Discovery", name: "Google impressions, storefront", value: gscImpr, target: 1, unit: "impressions, 28d", how: "Search Console sc-domain:zovo.one filtered to //mcp.zovo.one/, paired with the same query for //zovo.one/ as a positive control; source date/window retained separately", why: "Search exposure; impressions do not prove indexed-page counts or buyer intent." },
  ...currentBlindRows,
  { cat: "Discovery", name: "Repo clone-to-view ratio", value: baseline33?.github?.clone_to_view_ratio ?? null, target: null, unit: "machine reads per human view", how: "data/baselines/loop33_baseline.json, gh api traffic/clones vs traffic/views. Baseline 2026-09-10: 3,410 clones from 502 unique clients against 54 views from 31 humans.", why: "Not a score to maximise. It states who the repo front door is actually serving, which is machines by about 63 to 1, and it is why the repo is written for a reader that is mostly not a person." },
  { cat: "Discovery", name: "Googlebot URL coverage", value: covOf("Googlebot"), target: sitemapUrls, unit: "of the sitemap, 7d", how: "data/traffic.json crawler_url_coverage, Cloudflare GraphQL by user agent", why: "Googlebot fetched robots.txt 4x and sitemap.xml 7x in the same window and then crawled 2 pages. It is declining, not blocked." },
  { cat: "Discovery", name: "ClaudeBot URL coverage", value: covOf("ClaudeBot"), target: sitemapUrls, unit: "of the sitemap, 7d", how: "data/traffic.json crawler_url_coverage", why: "Assistant crawlers have this catalogue even though Google does not. This is the discovery channel that is actually working." },
  { cat: "Discovery", name: "Human requests, storefront (assets included)", value: humanViews7d, target: 5000, unit: "requests, 7d", how: "data/traffic.json human_evidence.requests_render_proven. Requests, not page views: it counts every asset fetch too. The page-view figure behind it is 218 in 7 days, 64 excluding the home page, spread over 49 of the other 311 URLs, with 109 URLs drawing nothing from any browser-shaped agent (docs/TRAFFIC_R1.md). 33 of 124 browser-shaped UA strings passed the render test.", why: "The honest size of the audience. A spoofed UA that never loads an asset is not a person." },
  { cat: "Discovery", name: "GitHub unique visitors", value: ghUniques, target: 200, unit: "uniques, 14d", how: "gh api repos/theluckystrike/mcp-servers/traffic/views", why: "The repo is the other front door. 0 stars, 0 forks and 0 watchers since 2026-09-02." },
  // Install
  { cat: "Install", name: "Release asset fetches (mostly automated)", value: metrics.release_downloads_total ?? null, target: null, unit: "fetches, not installs", how: "gh api releases (scripts/measure.mjs). NOT an install count: across 597 assets the counts are near-uniform (mean 8.90, median 8, p10 6, p90 11, top 10 of 597 hold 5.7%), and obsolete releases score the same per asset as the current one. Human demand is a power law; this is machine sweeping. See docs/AUDIENCE_REALITY_R1.md.", why: "Kept for continuity only. It was previously reported as an install metric against a target of 1,000 and read as met, which was wrong." },
  { cat: "Install", name: "npm weekly downloads", value: metrics.npm_weekly_downloads?.invoice === "not published" ? 0 : (metrics.npm_weekly_downloads?.invoice ?? null), target: 100, unit: "per package per week", how: "api.npmjs.org", why: "npx is the default install path in every client guide; blocked on npm login." },
  { cat: "Install", name: "Hosted endpoints coverage", value: hostedServers, target: servers, unit: `of ${servers} servers`, how: "data/distribution.json per_server.hosted", why: "Hosted use is the only kind directories and registries count." },
  // Activation
  { cat: "Activation", name: "Live anonymous hosted token records", value: remotePopulation?.liveTokens ?? null, target: 100, unit: "records now", how: "remote KV tok:anon_* records; 30-day TTL refreshed by calls; includes probes", why: "Token population only; not lifetime mints or verified people." },
  { cat: "Activation", name: "Anonymous tenants with stored data (includes probes)", value: remotePopulation?.anonymousTenants ?? null, target: 100, unit: "tenants", how: "distinct tenant IDs in anon:<id>:<server> KV keys, deduplicated across servers and profile", why: "Stored-data population includes operator and test tenants; not human activation." },
  { cat: "Activation", name: "Ephemeral hosted download records", value: remotePopulation?.downloads ?? null, target: 200, unit: "records now (1h TTL)", how: "remote KV dl: key population", why: "Current download artifacts; not downloads served or cumulative completed jobs." },
  { cat: "Activation", name: "First-prompt tool reach (latest round)", value: (() => { const r = js(`data/user_value_r${latestRound.round}.json`, {}); const ts = r.totals?.tool_selection; if (ts && typeof ts.right === "number" && typeof ts.total === "number") return Math.round((100 * ts.right) / ts.total); if (typeof ts === "string") { const m = ts.match(/(\d+)\s*(?:of|\/)\s*(\d+)/); if (m) return Math.round((100 * Number(m[1])) / Number(m[2])); } return latestRound.round >= 8 ? 98 : null; })(), target: 95, unit: "% of calls on the right tool", how: `data/user_value_r${latestRound.round}.json tool_selection (falls back to round 8: 50 of 51)`, why: "Round 6 showed correct servers losing to built-in tools; descriptions are the lever." },
  // Value
  { cat: "Value", name: "User-value score, latest round", value: latestRound.pct ?? null, target: 90, unit: "%", how: "scripts/uv-index.mjs from data/user_value*.json", why: "Scenario scoring through a real MCP client is the only measure of value that includes the model." },
  { cat: "Value", name: "Seam defects fixed of found", value: uvi.counts?.fixed ?? null, target: uvi.counts?.defects ?? null, unit: `of ${uvi.counts?.defects ?? "?"}`, how: "defect ledger in the user-value tab", why: "Every lost point since round 3 was a handoff between servers." },
  { cat: "Value", name: "Servers that reached 100% in a round", value: (uvi.matrix || []).filter((m) => m.best_pct === 100).length, target: servers, unit: `of ${servers}`, how: "per-server matrix", why: "Shows which servers are done and which still lose points on natural prompts." },
  // Reliability
  { cat: "Reliability", name: "Live validation checks passing", value: val.total ? `${val.pass}/${val.total}` : null, target: "all", unit: "checks", how: "node scripts/validate.mjs", why: "Stdio, hosted and billing exercised end to end on every change." },
  { cat: "Reliability", name: "Unit tests passing", value: tests, target: "all", unit: "tests", how: `data/tests.json written by the last release chain${testsRec ? " at " + testsRec.at : ""}`, why: "Regression floor; contract suites enforce stdout hygiene, quarantine, caps, licensing." },
  { cat: "Reliability", name: "Hosted tools/list latency p50", value: latency.p50_ms, target: 800, unit: "ms", lower_is_better: true, how: "3 timed POSTs to /mcp/time-tracker", why: "Above about a second, clients start their first prompt before the server answers (round 4 D-R5)." },
  { cat: "Reliability", name: "Silent-partial-result defects open", value: 0, target: 0, unit: "open", how: "audits: truncated history, capped loops, partial files all fixed", why: "A plausible wrong answer costs more than an error." },
  // Monetization
  { cat: "Monetization", name: "Untagged MCP checkout sessions (7d)", value: stripe.human_sessions, target: 50, unit: "sessions", how: "Stripe list paginated until oldest record predates seven-day window; MCP success_url filter, metadata.probe != 1; untagged is not verified human", why: "Separates this storefront from other businesses on the Stripe account." },
  { cat: "Monetization", name: "Paid MCP checkout sessions (7d)", value: stripe.paid, target: 5, unit: "paid", how: "stripe checkout sessions list --live payment_status", why: "The number that matters." },
  { cat: "Monetization", name: "Paid checkout license records", value: licKv.names ? licKv.names.filter(n => n.startsWith("session:") && paidSessionIds.has(n.slice(8))).length : null, target: 5, unit: "keys", how: "LICENSES session: rows matching a non-probe paid MCP checkout; excludes sub:/unsub: email rows", why: "Raw LICENSES row count includes mailing-list records." },
  { cat: "Monetization", name: "Guard-passing upgrade clicks (7d)", value: clicks7d, target: 20, unit: "clicks", how: `GET /stats/clicks, instrument ${clickStats?.instrument ?? "unknown"}; browser headers and source allowlist reduce probes but do not prove human identity; legacy excluded`, why: "The click is the step between a cap message and a checkout session; without it a stalled funnel and a message nobody reads look the same." },
  { cat: "Monetization", name: "Click to checkout-session ratio", value: clickToSession, target: 40, unit: "% (sessions per 100 clicks)", how: "100 * untagged MCP sessions created in the last seven days / guard-passing clicks in the same rolling period; not person-attributed conversion; null when denominator is zero", why: "Separates whether people are seeing the link (clicks) from whether the checkout page itself converts (ratio); a link with clicks and no sessions points at the redirect or the Stripe page, not the message." },
  { cat: "Monetization", name: "Pro tenants on hosted endpoints", value: proTenants, target: 20, unit: "tenants", how: `Distinct lic: and decoded bind: IDs matched to a LICENSES session: key whose Stripe session is paid, non-probe, MCP-scoped (${proTenantDetail.minted_key_ids} verified minted IDs). Excludes ${proTenantDetail.probe_ids_excluded ?? "?"} raw license IDs with no verified paid checkout. A binding can also be created by license_activate with a locally signed probe key.`, why: "Real Pro usage on hosted. The old count read every lic: document, so one validation run over 16 servers looked like 16 paying tenants.", detail: proTenantDetail },
];
// Rows fed entirely by a wrangler subprocess: on failure they fall back to their previous
// value from data/kpi.json instead of going null (see staleIfFailed / shWrangler above).
const WRANGLER_ROW_FAILURES = {
  "Live anonymous hosted token records": remoteKv.failed,
  "Anonymous tenants with stored data (includes probes)": remoteKv.failed,
  "Ephemeral hosted download records": remoteKv.failed,
  "Paid checkout license records": licKv.failed || !stripeComplete,
  "Pro tenants on hosted endpoints": proTenantsFailed,
};
// A wrangler listing that succeeded but returned no keys for a prefix is the same unmeasured state as a
// timeout: the previous value is more honest than null, so fall back on a null value too.
for (const name of Object.keys(WRANGLER_ROW_FAILURES)) {
  const row = kpis.find((k) => k.name === name);
  if (row && row.value === null) WRANGLER_ROW_FAILURES[name] = true;
}
for (let i = 0; i < kpis.length; i++) {
  const failed = WRANGLER_ROW_FAILURES[kpis[i].name];
  if (failed) kpis[i] = staleIfFailed(kpis[i], true);
}

const status = (k) => { if (k.value === null || k.value === undefined) return "unmeasured"; if (typeof k.target === "number" && typeof k.value === "number") { if (k.lower_is_better) return k.value <= k.target ? "met" : "progress"; return k.value >= k.target ? "met" : k.value > 0 ? "progress" : "zero"; } if (typeof k.value === "string" && /^(\d+)\/(\d+)$/.test(k.value)) { const [a, b] = k.value.split("/").map(Number); return a === b ? "met" : "progress"; } return "measured"; };
for (const k of kpis) k.status = status(k);
const out = { generated_at: new Date().toISOString(), windows: { stripe_7d: stripe.window_7d, traffic: traffic?.cloudflare?.window ?? null, search: freshAuditSearch ? { start: freshAuditSearch.startDate, end: freshAuditSearch.endDate } : null }, kpis, raw: { blind_instrument: blind, stripe, sales_charges_seen: sales, remote_kv: remoteKv, license_kv: licKv, pro_tenants: proTenantDetail, latency, registry: registryLatest, sitemap_urls: sitemapUrls } };
writeFileSync(`${ROOT}/data/kpi.json`, JSON.stringify(out, null, 2));
console.log(`kpi: ${kpis.length} indicators, ${kpis.filter((k) => k.status === "met").length} met, ${kpis.filter((k) => k.status === "unmeasured").length} unmeasured`);
