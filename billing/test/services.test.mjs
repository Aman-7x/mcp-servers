import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import worker, { PRODUCTS, SERVICES, SERVER_COUNT, isService, catalogEntry, fulfillmentAllowed,
  serviceCheckoutParams, serviceCustomText, serviceOwnerAlert, serviceBuyerEmail, crosssellHtml } from "../src/index.js";
import { paidSessionEntitlementIssue, entitlementRecordKey } from "../src/scheduled-monitor.js";

const ctx = { waitUntil() {} };
const browser = { accept: "text/html,application/xhtml+xml", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/130 Safari/537.36" };

const EXPECTED = { "svc-audit": 490, "svc-launch-deposit": 1500, "svc-custom-deposit": 1500 };

function kv() {
  const store = new Map();
  return { store, get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); },
    list: async () => ({ keys: [] }) };
}

function paidSession(product, extra = {}) {
  const cents = SERVICES[product].usd * 100;
  return {
    id: `cs_live_svc_${product.replace(/-/g, "")}`, created: 1788352878, mode: "payment", status: "complete",
    payment_status: "paid", currency: "usd", amount_total: cents, livemode: true,
    payment_intent: "pi_123", customer_details: { email: "buyer@example.com", name: "Buyer" },
    custom_fields: [{ key: "mcpserver", type: "text", text: { value: "https://example.com/mcp" } }],
    metadata: { product, site: "mcp.zovo.one", source: "test" },
    line_items: { data: [{ quantity: 1, currency: "usd", price: { id: "price_inline", type: "one_time", unit_amount: cents } }] },
    ...extra,
  };
}

test("the three services exist at their prices and stay out of the license catalogue", () => {
  for (const [id, usd] of Object.entries(EXPECTED)) {
    assert.equal(SERVICES[id].usd, usd);
    assert.ok(isService(id));
    assert.equal(catalogEntry(id), SERVICES[id]);
    assert.ok(!Object.hasOwn(PRODUCTS, id), `${id} must not be a PRODUCTS row`);
    assert.equal(SERVICES[id].price, undefined, "services are priced inline");
  }
  assert.ok(!isService("bundle"));
  assert.ok(!SERVER_COUNT.toString().includes("."));
});

test("service checkout params collect the server field and never carry license wording", () => {
  for (const id of Object.keys(SERVICES)) {
    const p = serviceCheckoutParams(id);
    assert.equal(p["custom_fields[0][key]"], "mcpserver");
    assert.match(p["custom_fields[0][key]"], /^[a-z0-9]+$/i);
    assert.equal(p["custom_fields[0][type]"], "text");
    assert.equal(p["custom_fields[0][optional]"], "true");
    assert.equal(p["custom_fields[0][label][custom]"], "MCP server URL or repo (optional)");
    assert.ok(p["custom_fields[0][label][custom]"].length <= 50);
    const ct = serviceCustomText(id);
    assert.doesNotMatch(ct.submit + ct.after_submit, /licen[cs]e|key/i);
  }
});

test("GET /buy/svc-* serves a service intent page and never calls Stripe", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("GET must not call any API"); };
  try {
    for (const [id, usd] of Object.entries(EXPECTED)) {
      const r = await worker.fetch(new Request(`https://mcp.zovo.one/buy/${id}?src=test`, { headers: browser }), {}, ctx);
      const html = await r.text();
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-mcp-buy"), "checkout-intent-required");
      assert.match(html, /<form\b[^>]*method="post"/);
      assert.match(html, /name="intent" value="checkout"/);
      assert.match(html, new RegExp(`\\$${usd.toLocaleString("en-US")}`));
      assert.match(html, /support@zovo\.one within 1 business day/);
      assert.doesNotMatch(html, /lifetime licen[cs]e|Pro key|license_activate/i);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("POST /buy/svc-audit sends custom field, service metadata and no tenant to Stripe", async () => {
  const originalFetch = globalThis.fetch;
  let sent;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /checkout\/sessions$/);
    sent = new URLSearchParams(init.body);
    return Response.json({ id: "cs_live_x", url: "https://checkout.stripe.com/c/pay/cs_live_x",
      line_items: { data: [{ description: "McpStamp Readiness Audit", amount_total: 49000, price: { unit_amount: 49000 } }] } });
  };
  try {
    const page = await worker.fetch(new Request("https://mcp.zovo.one/buy/svc-audit?src=test", { headers: browser }), {}, ctx);
    const token = (await page.text()).match(/name="order_token" value="([^"]+)"/)[1];
    const r = await worker.fetch(new Request(`https://mcp.zovo.one/buy/svc-audit?src=test&tenant=anon_${"a".repeat(32)}`, {
      method: "POST", body: `intent=checkout&order_token=${encodeURIComponent(token)}`,
      headers: { ...browser, origin: "https://mcp.zovo.one", "content-type": "application/x-www-form-urlencoded" },
    }), { REMOTE_DATA: kv(), LICENSES: kv() }, ctx);
    assert.equal(r.status, 303);
    assert.equal(sent.get("line_items[0][price_data][unit_amount]"), "49000");
    assert.equal(sent.get("line_items[0][price_data][product_data][name]"), "McpStamp Readiness Audit");
    assert.equal(sent.get("metadata[product]"), "svc-audit");
    assert.equal(sent.get("metadata[kind]"), "service");
    assert.equal(sent.get("metadata[site]"), "mcp.zovo.one");
    assert.equal(sent.get("custom_fields[0][key]"), "mcpserver");
    assert.match(sent.get("custom_text[after_submit][message]"), /support@zovo\.one within 1 business day/);
    assert.equal(sent.get("customer_creation"), "always");
    assert.equal(sent.get("metadata[tenant]"), null);
    assert.equal(sent.get("client_reference_id"), null);
    for (const [k, v] of sent) assert.notEqual(v, "undefined", k);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a paid service: webhook records the order, alerts the owner once, mints nothing", async () => {
  const session = paidSession("svc-launch-deposit");
  assert.deepEqual(fulfillmentAllowed(session, "svc-launch-deposit"), { ok: true, reason: "paid" });
  assert.equal(fulfillmentAllowed({ ...session, amount_total: 100 }, "svc-launch-deposit").ok, false);
  const LICENSES = kv();
  const mails = [];
  const env = { STRIPE_SECRET_KEY: "sk_test_stub", STRIPE_WEBHOOK_SECRET: "whsec_stub", RESEND_API_KEY: "re_stub", LICENSES,
    FULFILLMENT: { getByName: () => { throw new Error("services must not create a fulfillment job"); } } };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.resend.com/")) { mails.push(JSON.parse(init.body)); return Response.json({ id: "m" }); }
    assert.match(String(url), /checkout\/sessions\/cs_live_svc_/);
    return Response.json(session);
  };
  try {
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: session.id } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
    const hook = () => worker.fetch(new Request("https://mcp.zovo.one/webhook", { method: "POST", body,
      headers: { "stripe-signature": `t=${t},v1=${sig}` } }), env, ctx);
    const w = await hook();
    assert.equal(w.status, 200);
    assert.deepEqual(await w.json(), { received: true, fulfilled: true, service: true });
    assert.equal(mails.length, 2);
    const owner = mails.find((m) => m.to[0] === "support@zovo.one");
    assert.match(owner.subject, /PAID \$1500: McpStamp Store Launch/);
    assert.match(owner.text, /buyer@example\.com/);
    assert.match(owner.text, /https:\/\/example\.com\/mcp/);
    assert.equal(owner.reply_to, "buyer@example.com");
    const buyer = mails.find((m) => m.to[0] === "buyer@example.com");
    assert.match(buyer.subject, /Payment received/);
    assert.doesNotMatch(buyer.text, /licen[cs]e key|MCPL1/);
    assert.ok(LICENSES.store.has(`service:${session.id}`));
    assert.ok(![...LICENSES.store.keys()].some((k) => k.startsWith("session:")), "no license key stored");

    await hook();
    assert.equal(mails.length, 2, "a redelivered webhook sends no second alert");

    const success = await worker.fetch(new Request(`https://mcp.zovo.one/success?session_id=${session.id}`), env, ctx);
    const html = await success.text();
    assert.equal(success.status, 200);
    assert.equal(success.headers.get("x-mcp-fulfillment"), "service");
    assert.match(html, /Payment received/);
    assert.match(html, /support@zovo\.one<\/strong> within 1 business day/);
    assert.match(html, /https:\/\/example\.com\/mcp/);
    assert.doesNotMatch(html, /Your license key|license_activate|MCPL1/);
    assert.equal(mails.length, 2);

    const recover = await worker.fetch(new Request(`https://mcp.zovo.one/recover?session_id=${session.id}`), env, ctx);
    assert.deepEqual(await recover.json(), { ok: true, product: "svc-launch-deposit", service: true, key: null, support: "support@zovo.one" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("monitors accept a recorded service order and flag a missing one", async () => {
  const session = paidSession("svc-audit");
  assert.equal(entitlementRecordKey(session), `service:${session.id}`);
  assert.equal(entitlementRecordKey({ id: "cs_live_a", metadata: { product: "bundle" } }), "session:cs_live_a");
  assert.equal(await paidSessionEntitlementIssue(session, "{\"product\":\"svc-audit\"}", kv()), null);
  assert.equal(await paidSessionEntitlementIssue(session, null, kv()), "service_order");
});

test("owner alert and buyer email are plain and complete without a server field", () => {
  const s = paidSession("svc-custom-deposit", { custom_fields: [] });
  assert.match(serviceOwnerAlert("svc-custom-deposit", s).text, /MCP server URL or repo: \(not given\)/);
  assert.match(serviceBuyerEmail("svc-custom-deposit", s).text, /Reply to this email with your MCP server URL or repo/);
});

test("landing band and every page footer cross-sell McpStamp with UTM tags", async () => {
  const r = await worker.fetch(new Request("https://mcp.zovo.one/"), {}, ctx);
  const html = await r.text();
  assert.match(html, /<p class="feat" id="mcpstamp">New: <a href="https:\/\/www\.mcpstamp\.com\/check\/\?utm_source=mcp\.zovo\.one&amp;utm_medium=crosssell/);
  assert.ok(html.indexOf('id="mcpstamp"') < html.indexOf("<h2"), "band sits above the first section");
  assert.match(crosssellHtml("x"), /Hire the builder of these \d+ servers/);
  const guide = await (await worker.fetch(new Request("https://mcp.zovo.one/guides"), {}, ctx)).text();
  assert.match(guide, /<footer>[\s\S]*mcpstamp\.com\/services\/\?utm_source=mcp\.zovo\.one&amp;utm_medium=crosssell&amp;utm_content=footer/);
});
