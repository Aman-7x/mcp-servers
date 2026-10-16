import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { PRODUCTS, checkoutCustomText, successPage, bindDecision } from "../src/index.js";
import { BUNDLE_DOWNLOADS } from "../src/downloads.js";
import { LISTED_IDS } from "../src/figures.js";
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { MATCHER_DEMO_INPUT_SHA256, MATCHER_DEMO_JAVASCRIPT } from '../src/matcher-demo-bundle.js';

test('buyer guide serves the same engine compiled for the browser with fresh source provenance', async () => {
  const hash = createHash('sha256');
  for (const file of ['servers/three-way-match/src/core.ts', 'billing/browser/matcher-demo.mjs']) {
    hash.update(file); hash.update(readFileSync(new URL('../../' + file, import.meta.url)));
  }
  assert.equal(hash.digest('hex'), MATCHER_DEMO_INPUT_SHA256, 'Rebuild the browser asset after engine or UI changes');
  const ctx = { waitUntil() {} };
  const asset = await worker.fetch(new Request('https://mcp.zovo.one/assets/matcher-demo.js'), {}, ctx);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(await asset.text(), MATCHER_DEMO_JAVASCRIPT);
  const guide = await worker.fetch(new Request('https://mcp.zovo.one/guides/match-supplier-invoice-purchase-order-delivery-note-in-claude'), {}, ctx);
  assert.match(await guide.text(), /id="matcher-demo-form"/);
});

test("download catalog covers every listed server with an explicit release asset", async () => {
  assert.deepEqual(Object.keys(BUNDLE_DOWNLOADS).sort(), [...LISTED_IDS].sort());
  const response = await worker.fetch(new Request("https://mcp.zovo.one/downloads"), {}, { waitUntil() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /releases\/download\/v0\.22\.0\/invoice\.mcpb/);
  assert.match(html, /releases\/download\/v0\.22\.6\/three-way-match\.mcpb/);
  assert.match(html, /releases\/download\/v0\.22\.6\/office-suite\.mcpb/);
  assert.doesNotMatch(html, /releases\/latest/);
});

test("catalogue leads to working setup and labels free-only calculators as free", async () => {
  const response = await worker.fetch(new Request("https://mcp.zovo.one/"), {}, { waitUntil() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.doesNotMatch(html, /Install: <code>npx -y @theluckystrike/);
  assert.ok(html.includes('/setup/claude-desktop/three-way-match'));
  assert.match(html, /href="\/s\/hourly-rate"[\s\S]*?<span class="muted">Free<\/span>/);
});

// Synthetic bearer only: never mint a live tenant or contact a payment API.
const TENANT = `anon_${"a".repeat(32)}`;
const env = { STRIPE_SECRET_KEY: "sk_test_stub", REMOTE_DATA: { get: async () => null, put: async () => {} } };
const ctx = { waitUntil() {} };
const request = (path, method = "GET") => new Request(`https://mcp.zovo.one${path}`, {
  method,
  headers: { "user-agent": "Mozilla/5.0 Chrome/140.0", accept: "text/html", origin: "https://mcp.zovo.one",
    "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "content-type": "application/x-www-form-urlencoded" },
  ...(method === "POST" ? { body: "intent=checkout" } : {}),
});
async function stubStripe(fn, session = {}) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), params: Object.fromEntries(new URLSearchParams(init?.body)) });
    return Response.json({ id: "cs_test_r36", url: "https://checkout.stripe.com/c/pay/cs_test_r36", ...session });
  };
  try { return { value: await fn(), calls }; }
  finally { globalThis.fetch = real; }
}
function bundleHref(html) {
  const link = html.match(/href="([^\"]*\/buy\/bundle\?[^\"]*)"/);
  assert.ok(link, "single-server checkout offers the bundle");
  return link[1].replaceAll("&amp;", "&");
}

test("single-to-bundle checkout keeps the hosted connection bound without creating a session on GET", async () => {
  const { value: html, calls: getCalls } = await stubStripe(async () =>
    (await worker.fetch(request(`/buy/invoice?tenant=${TENANT}&src=invoice.success`), env, ctx)).text());
  const href = bundleHref(html);
  assert.equal(new URL(href, "https://mcp.zovo.one").searchParams.get("tenant"), TENANT);
  assert.equal(getCalls.length, 0);
  const { value: res, calls } = await stubStripe(() => worker.fetch(request(href, "POST"), env, ctx));
  assert.equal(res.status, 303);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params["metadata[product]"], "bundle");
  assert.equal(calls[0].params["line_items[0][price]"], PRODUCTS.bundle.price);
  assert.equal(calls[0].params["metadata[tenant]"], TENANT);
  assert.deepEqual(bindDecision({ metadata: { tenant: calls[0].params["metadata[tenant]"] } }, true), { bind: true, tenant: TENANT });
});

test("Stripe's bundle cross-sell carries only a validated hosted token", () => {
  const valid = new URL(checkoutCustomText("invoice", "invoice", TENANT).submit.split(" ").at(-1));
  assert.equal(valid.searchParams.get("tenant"), TENANT);
  for (const bad of ["", "not-a-token", `anon_${"b".repeat(32)}&injected=1`]) {
    const link = new URL(checkoutCustomText("invoice", "invoice", bad).submit.split(" ").at(-1));
    assert.equal(link.searchParams.has("tenant"), false);
    assert.equal(link.searchParams.has("injected"), false);
  }
});

test("cancelling an expired checkout keeps hosted activation when starting a replacement", async () => {
  const { calls } = await stubStripe(() => worker.fetch(request(`/buy/invoice?tenant=${TENANT}`, "POST"), env, ctx));
  const cancel = new URL(calls[0].params.cancel_url.replace("{CHECKOUT_SESSION_ID}", "cs_test_expired"));
  assert.equal(cancel.searchParams.get("tenant"), TENANT);
  const { value: res, calls: retryCalls } = await stubStripe(() => worker.fetch(request(cancel.pathname + cancel.search, "POST"), env, ctx), { status: "expired", payment_status: "unpaid", metadata: { product: "invoice", tenant: TENANT } });
  assert.equal(res.status, 303);
  assert.equal(retryCalls.length, 2, "retrieve the expired session then create its replacement");
  assert.equal(retryCalls[1].params["metadata[tenant]"], TENANT);
});

test("purchase pages consistently describe confirmation-page key delivery and the actual purchase scope", async () => {
  for (const id of ["invoice", "bundle"]) {
    const html = await (await worker.fetch(request(`/buy/${id}`), env, ctx)).text();
    assert.match(html, /key[^<.]*confirmation page/i);
    assert.doesNotMatch(html, /key[^<.]*Stripe receipt|delivered instantly by email|re-sendable|No usage cap/i);
    assert.doesNotMatch(html, /<h2>One key, \d+ servers, yours for good<\/h2>/);
    assert.match(html, /Continue to Stripe/);
    const success = successPage("MCPL1.synthetic.key", id, {});
    assert.doesNotMatch(success, /key[^<.]*Stripe receipt|re-sendable|No usage cap/i);
  }
});

test("pricing presents current prices without an unconfigured price deadline or inferred human demand", async () => {
  const html = await (await worker.fetch(request("/pricing"), env, ctx)).text();
  assert.match(html, /\$19/);
  assert.match(html, /\$39/);
  assert.doesNotMatch(html, /Founding|2026-11-08|hosted tenants|anonymous tokens minted|delivered instantly by email|key[^<.]*Stripe receipt/i);
  assert.match(html, /confirmation page/i);
});


test("the bank guide's legacy PDF URL discloses CSV-only input and Pro export in page and search metadata", async () => {
  const res = await worker.fetch(request("/guides/bank-statement-pdf-to-excel-in-chat"), env, ctx);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<h1>Turn a bank CSV export into Excel rows from chat<\/h1>/);
  assert.match(html, /does not parse PDF statements/);
  assert.match(html, /statement_import/);
  assert.match(html, /statement_export<\/code> is a <strong>Pro feature/);
  assert.match(html, /does not create an Excel workbook/);
  assert.doesNotMatch(html, /It reads text-layer PDFs|running balance cross-checked|does the extraction and the tidying|removes the monthly processing cap/);
  const metadata = [...html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description|twitter:description)"[^>]*>/g)].map((m) => m[0]).join(" ");
  assert.match(metadata, /CSV/);
  assert.doesNotMatch(metadata, /How to read a bank statement PDF/);
});
