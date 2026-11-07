#!/usr/bin/env node
// Ask Google to re-read the sitemap, and read back what it holds.
// Read-only except for the PUT: use it after the sitemap actually changes.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const SA = JSON.parse(readFileSync(`${process.env.HOME}/.config/gsc/sa-key.json`, "utf8"));
const SITE = encodeURIComponent("sc-domain:zovo.one");
const FEED = encodeURIComponent("https://mcp.zovo.one/sitemap.xml");

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
  iss: SA.client_email,
  scope: "https://www.googleapis.com/auth/webmasters",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
})}`;
const signer = createSign("RSA-SHA256");
signer.update(unsigned);
const jwt = `${unsigned}.${signer.sign(SA.private_key).toString("base64url")}`;

const tok = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
})).json();
if (!tok.access_token) {
  console.error("token failed:", JSON.stringify(tok).slice(0, 300));
  process.exit(2);
}
const auth = { authorization: `Bearer ${tok.access_token}` };

const put = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${SITE}/sitemaps/${FEED}`, {
  method: "PUT",
  headers: auth,
});
console.log(`PUT sitemap -> ${put.status} ${put.status === 200 ? "(accepted)" : await put.text().then((t) => t.slice(0, 200))}`);

const list = await (await fetch(`https://www.googleapis.com/webmasters/v3/sites/${SITE}/sitemaps`, { headers: auth })).json();
for (const s of list.sitemap ?? []) {
  console.log(`${s.path}\n  lastDownloaded=${s.lastDownloaded ?? "-"} errors=${s.errors ?? 0} warnings=${s.warnings ?? 0}`);
  for (const c of s.contents ?? []) {
    console.log(`  type=${c.type} submitted=${c.submitted ?? "-"} indexed=${c.indexed ?? "-"} (indexed is deprecated by Google)`);
  }
}
if (!list.sitemap?.length) console.log("no sitemaps listed:", JSON.stringify(list).slice(0, 200));
