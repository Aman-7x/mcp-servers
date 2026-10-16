// GET /changelog is generated at scripts/build-pages.mjs time from docs/RELEASE_V*.md into
// billing/src/pages.js (CHANGELOG). Every version present in docs/ must appear on the page,
// and release dates determine chronology across different semantic version lines.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker from "../src/index.js";
import { CHANGELOG } from "../src/pages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DOCS = join(ROOT, "docs");

function versionsFromDocs() {
  return readdirSync(DOCS)
    .filter((f) => /^RELEASE_V[0-9]+\.md$/.test(f))
    .map((f) => {
      const content = readFileSync(join(DOCS, f), "utf8");
      const m = /^#\s*Release\s+(v[0-9]+\.[0-9]+\.[0-9]+)/im.exec(content);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

test("every release version under docs/ appears on the changelog page", async () => {
  const req = new Request("https://mcp.zovo.one/changelog");
  const res = await worker.fetch(req, {}, { waitUntil: () => {} });
  assert.equal(res.status, 200);
  const html = await res.text();
  const versions = versionsFromDocs();
  assert.ok(versions.length > 0, "docs/RELEASE_V*.md should exist");
  for (const v of versions) {
    assert.ok(html.includes(v), `changelog page missing version ${v}`);
  }
});

test("the most recently dated release renders first in CHANGELOG and on the page", async () => {
  const dated = CHANGELOG.releases.filter(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date || ''));
  const latestDate = dated.map(r => r.date).sort().at(-1);
  assert.equal(CHANGELOG.releases[0].date, latestDate);
  assert.equal(CHANGELOG.currentVersion, CHANGELOG.releases[0].version);
  for (let i = 1; i < dated.length; i++) assert.ok(dated[i - 1].date >= dated[i].date, 'Release dates must descend even across different semantic version lines');

  const req = new Request("https://mcp.zovo.one/changelog");
  const res = await worker.fetch(req, {}, { waitUntil: () => {} });
  const html = await res.text();
  const body = html.slice(html.indexOf("<h1>Changelog</h1>"));
  const positions = CHANGELOG.releases.map((r) => body.indexOf(`<h2>${r.version}`));
  assert.ok(positions.every((p) => p !== -1), "every release version should be found in the page HTML");
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i - 1] < positions[i], "releases must render newest first, in CHANGELOG.releases order");
  }
});

test("no sentence on the changelog page is invented: evidence and insight text trace to the release file", () => {
  // The build script joins a wrapped source paragraph's lines with a single space, so
  // the comparison here normalizes whitespace on both sides rather than requiring an
  // exact substring match against the raw, line-wrapped markdown.
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  for (const r of CHANGELOG.releases) {
    const raw = readFileSync(join(DOCS, r.file), "utf8");
    const header = /^#\s*Release\s+(v[0-9]+\.[0-9]+\.[0-9]+)(?:\s*\((\d{4}-\d{2}-\d{2})\))?/im.exec(raw);
    assert.equal(r.version, header[1]);
    assert.equal(r.date, header[2] || null);
    const content = norm(raw);
    if (r.evidence) assert.ok(content.includes(norm(r.evidence)), `${r.file}: evidence not found verbatim in source`);
    if (r.insightSentence) assert.ok(content.includes(norm(r.insightSentence)), `${r.file}: insight sentence not found verbatim in source`);
  }
});

test("meta description is under 160 chars", async () => {
  const req = new Request("https://mcp.zovo.one/changelog");
  const res = await worker.fetch(req, {}, { waitUntil: () => {} });
  const html = await res.text();
  const m = /<meta name="description" content="([^"]*)">/.exec(html);
  assert.ok(m, "meta description present");
  assert.ok(m[1].length < 160, `description is ${m[1].length} chars`);
});

test("footer, sitemap and llms.txt all link to /changelog", async () => {
  const home = await (await worker.fetch(new Request("https://mcp.zovo.one/"), {}, { waitUntil: () => {} })).text();
  assert.ok(home.includes('href="/changelog"'), "footer should link to /changelog");

  const sitemap = await (await worker.fetch(new Request("https://mcp.zovo.one/sitemap.xml"), {}, { waitUntil: () => {} })).text();
  assert.ok(sitemap.includes("<loc>https://mcp.zovo.one/changelog</loc>"), "sitemap should list /changelog");

  const llms = await (await worker.fetch(new Request("https://mcp.zovo.one/llms.txt"), {}, { waitUntil: () => {} })).text();
  assert.ok(llms.includes("https://mcp.zovo.one/changelog"), "llms.txt should list /changelog");
});
