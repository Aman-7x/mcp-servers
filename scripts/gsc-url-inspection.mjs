#!/usr/bin/env node
// Measure real Google indexation per URL via the URL Inspection API.
// Read-only: no submit, no reindex request, no permission escalation.
// Usage: node scripts/gsc-url-inspection.mjs [--limit N]
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const KEY_PATH =
  "/Users/mike/.config/gcloud/legacy_credentials/zovo-gsc-cleanup@zovo-extensions.iam.gserviceaccount.com/adc.json";
const PROPERTY = "sc-domain:zovo.one";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const OUT_DIR = new URL("../data/s1106/", import.meta.url);
const OUT = new URL("gsc-indexation.json", OUT_DIR);
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i > 0 ? Number(process.argv[i + 1]) : Infinity;
})();

const b64 = (v) => Buffer.from(v).toString("base64url");

async function token() {
  const key = JSON.parse(readFileSync(KEY_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64(JSON.stringify({ alg: "RS256", typ: "JWT" })) +
    "." +
    b64(
      JSON.stringify({
        iss: key.client_email,
        scope: SCOPE,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3300,
      }),
    );
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + "." + signer.sign(key.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`token ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

async function inspect(tok, url) {
  const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { authorization: "Bearer " + tok, "content-type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: PROPERTY, languageCode: "en" }),
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json();
  if (!r.ok) return { url, http: r.status, error: j.error?.status ?? "unknown" };
  const res = j.inspectionResult ?? {};
  const idx = res.indexStatusResult ?? {};
  return {
    url,
    http: r.status,
    verdict: idx.verdict ?? null,
    coverage: idx.coverageState ?? null,
    robots: idx.robotsTxtState ?? null,
    indexing: idx.indexingState ?? null,
    crawled: idx.lastCrawlTime ?? null,
    googleCanonical: idx.googleCanonical ?? null,
    userCanonical: idx.userCanonical ?? null,
    sitemaps: idx.sitemap?.length ?? 0,
  };
}

const xml = await (await fetch("https://mcp.zovo.one/sitemap.xml", { signal: AbortSignal.timeout(30000) })).text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, LIMIT);
const tok = await token();

const rows = [];
for (let i = 0; i < urls.length; i += 4) {
  const batch = urls.slice(i, i + 4);
  const settled = await Promise.all(
    batch.map((u) =>
      inspect(tok, u).catch((e) => ({ url: u, http: 0, error: String(e).slice(0, 80) })),
    ),
  );
  rows.push(...settled);
  if (i % 40 === 0) console.log(`  ${Math.min(i + 4, urls.length)}/${urls.length}`);
  // Checkpoint every batch: a killed run must not lose 40 minutes of quota.
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        method: "URL Inspection API, read-only, one call per sitemap URL",
        property: PROPERTY,
        probed: rows.length,
        complete: rows.length === urls.length,
        rows,
      },
      null,
      1,
    ) + "\n",
  );
}

const hist = {};
for (const r of rows) {
  const k = r.error ? `error:${r.error}` : `${r.verdict}/${r.coverage}`;
  hist[k] = (hist[k] ?? 0) + 1;
}
mkdirSync(OUT_DIR, { recursive: true });
const out = {
  at: new Date().toISOString(),
  method: "URL Inspection API, read-only, one call per sitemap URL",
  property: PROPERTY,
  probed: rows.length,
  histogram: hist,
  indexed: rows.filter((r) => r.verdict === "PASS").length,
  rows,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify({ probed: rows.length, indexed: out.indexed, histogram: hist }, null, 2));
