import assert from "node:assert/strict";
import test from "node:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { registerHooks } from "node:module";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const licenseUrl = new URL("../../billing/src/license.js", import.meta.url).href;
const originalPublic = readFileSync(new URL(licenseUrl), "utf8").match(/export const PUBLIC_KEY_B64 = "([^"]+)";/)[1];
const fixturePublic = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("base64");
registerHooks({ load(url, context, next) {
  const result = next(url, context);
  return url === licenseUrl ? { ...result, source: result.source.toString().replace(originalPublic, fixturePublic) } : result;
} });
const { paidSessionFindings, webhookFindings, stripeWebhookHttpFindings, isMcpSession } = await import("../billing-operations-monitor.mjs");

const now = 1_800_000_000;
function signed(product, id = product) {
  const body = Buffer.from(JSON.stringify({ v: 1, p: product, id, iat: 1 })).toString("base64url");
  return "MCPL1." + body + "." + sign(null, Buffer.from(body), privateKey).toString("base64url");
}
const key = signed("*");
const tenant = `anon_${"a".repeat(32)}`;
const paid = {
  id: "cs_live_paid", livemode: true, created: now - 3600, status: "complete",
  payment_status: "paid", metadata: { site: "mcp.zovo.one", product: "bundle", tenant },
};

test("paid Session with missing license or hosted binding is an alert", async () => {
  let result = await paidSessionFindings([paid], () => null, now);
  assert.deepEqual(result.findings.map((f) => f.issue), ["issued key missing or invalid"]);
  assert.equal(result.findings[0].sessionRef,
    createHash("sha256").update(`mcp-session-log-v1:${paid.id}`).digest("hex").slice(0, 12));
  result = await paidSessionFindings([paid], (binding) => binding === "LICENSES" ? key : null, now);
  assert.deepEqual(result.findings.map((f) => f.issue), ["hosted binding missing or invalid"]);
  result = await paidSessionFindings([paid], (binding) => binding === "LICENSES" ? key : "MCPL1.other.signature", now);
  assert.deepEqual(result.findings.map((f) => f.issue), ["hosted binding missing or invalid"]);
});

test("paid Session with matching records clears; recent payment gets settlement time", async () => {
  assert.equal((await paidSessionFindings([paid], () => key, now)).findings.length, 0);
  const recent = { ...paid, created: now - 100 };
  const result = await paidSessionFindings([recent], () => { throw new Error("read during grace period"); }, now);
  assert.equal(result.pending, 1);
  assert.equal(result.checked, 0);
});

test("old native equality check falsely alerts after two singles; scoped verification clears", async () => {
  const invoice = signed("invoice"), docx = signed("docx");
  const rows = ["invoice", "docx"].map(product => ({ ...paid, id: "cs_live_synthetic_" + product,
    metadata: { ...paid.metadata, product } }));
  const values = new Map([
    ["LICENSES:session:" + rows[0].id, invoice], ["LICENSES:session:" + rows[1].id, docx],
    ["REMOTE_DATA:bind:" + tenant + ":invoice", invoice], ["REMOTE_DATA:bind:" + tenant + ":docx", docx],
    ["REMOTE_DATA:bind:" + tenant, docx],
  ]);
  const read = (binding, name) => values.get(binding + ":" + name) ?? null;
  const old = execFileSync("git", ["show", "e290ce3cfec0cf7c9f44e9273485473d0fea2da6:scripts/billing-operations-monitor.mjs"],
    { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
  const start = old.indexOf("export function paidSessionFindings(");
  const end = old.indexOf("\nexport function webhookFindings", start);
  assert.ok(start > 0 && end > start);
  const previous = new Function("isMcpSession", "sessionRef", "SETTLE_SECONDS", "return (" +
    old.slice(start, end).replace("export function", "function").trim() + ");")(isMcpSession,
    id => createHash("sha256").update("mcp-session-log-v1:" + id).digest("hex").slice(0, 12), 900);
  assert.equal(previous(rows, read, now).findings.length, 1);
  assert.deepEqual((await paidSessionFindings(rows, read, now)).findings, []);
  values.set("REMOTE_DATA:bind:" + tenant + ":*", key);
  values.set("REMOTE_DATA:bind:" + tenant, signed("invoice", "replacement"));
  assert.deepEqual((await paidSessionFindings(rows, read, now)).findings, []);
});

test("native reconciliation detects exact-host Sessions with unresolved metadata", async () => {
  const urlOnly = { ...paid, metadata: {}, success_url: "https://mcp.zovo.one/success" };
  assert.equal(isMcpSession(urlOnly), true);
  assert.equal(isMcpSession({ ...urlOnly, success_url: "https://mcp.zovo.one.attacker.invalid/success" }), false);
  const result = await paidSessionFindings([urlOnly], () => key, now);
  assert.deepEqual(result.findings.map(row => row.issue), ["paid product metadata unresolved"]);
});

test("webhook check detects duplicate destination and overdue MCP event", () => {
  const endpoint = { url: "https://mcp.zovo.one/webhook", status: "enabled",
    enabled_events: ["checkout.session.completed", "checkout.session.async_payment_succeeded"] };
  const event = { type: "checkout.session.completed", created: now - 3600,
    pending_webhooks: 1, data: { object: { metadata: { site: "mcp.zovo.one" } } } };
  const result = webhookFindings([endpoint, endpoint], [event], now);
  assert.equal(result.findings.length, 2);
  assert.equal(webhookFindings([endpoint], [], now).findings.length, 0);
});

test("Cloudflare rows flag observed Stripe HTTP 4xx/5xx and ignore unrelated traffic", () => {
  const rows = [
    { count: 2, dimensions: { edgeResponseStatus: 400, userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" } },
    { count: 3, dimensions: { edgeResponseStatus: 503, userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" } },
    { count: 10, dimensions: { edgeResponseStatus: 404, userAgent: "curl/8" } },
    { count: 5, dimensions: { edgeResponseStatus: 200, userAgent: "Stripe/1.0 (+https://stripe.com/docs/webhooks)" } },
  ];
  assert.deepEqual(stripeWebhookHttpFindings(rows), { failures: 5, statuses: [400, 503] });
  assert.throws(() => stripeWebhookHttpFindings(undefined), /missing/);
});
