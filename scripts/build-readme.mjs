#!/usr/bin/env node
// Regenerate the volatile parts of README.md from data, so they cannot drift again.
//
// Written 2026-09-07 after the README was found claiming nine servers, 76 tools, v0.3.2 and
// 321 tests while the estate was 31 servers, 292 tools, v0.21.0 and 1507 tests. Every number
// below is read from a file or from the running estate, never typed.
//
// Regions are delimited by <!-- gen:<name> --> ... <!-- /gen:<name> --> so the prose between
// them is untouched. Run: node scripts/build-readme.mjs [--check]
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { HOSTED_IDS } from '../billing/src/figures.js';

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const CHECK = process.argv.includes("--check");
const rd = (p) => readFileSync(join(ROOT, p), "utf8");
const js = (p, d) => { try { return JSON.parse(rd(p)); } catch { return d; } };

const VERSION = js("servers/office-suite/package.json", {}).version || "0.0.0";
const facts = js("data/facts.json", {});
const REPO = "https://github.com/theluckystrike/mcp-servers";

// The server list is the directory list, minus the aggregator, which gets its own row.
const dirs = readdirSync(join(ROOT, "servers")).filter((d) => existsSync(join(ROOT, "servers", d, "package.json"))).sort();
const singles = dirs.filter((d) => d !== "office-suite");

function factOf(id) {
  const walk = (o) => {
    if (o && typeof o === "object") {
      if (o[id] && typeof o[id] === "object" && o[id].tagline) return o[id];
      for (const v of Object.values(o)) { const r = walk(v); if (r) return r; }
    }
    return null;
  };
  return walk(facts) || {};
}

const hosted = new Set(HOSTED_IDS);

const rows = [...singles, "office-suite"].map((id) => {
  const f = factOf(id);
  const tagline = (f.tagline || "").replace(/\|/g, "\\|");
  const gif = existsSync(join(ROOT, "assets", `demo-${id}.gif`)) ? `![${id}](assets/demo-${id}.gif)` : "";
  return `| [mcp-${id}](servers/${id}/README.md) | ${gif} | ${tagline} | [\`${id}.mcpb\`](https://mcp.zovo.one/downloads#${id}) |`;
}).join("\n");

const table = `| Server | Demo | What it does | One-click bundle |\n|---|---|---|---|\n${rows}`;

const counts = `${singles.length} servers plus the office-suite aggregator, ${hosted.size} of them also reachable as a hosted endpoint with no install.`;

const REGIONS = {
  badge: `![License](https://img.shields.io/badge/license-MIT-blue)\n![MCP Registry](https://img.shields.io/badge/MCP%20registry-listed-brightgreen)\n![Release](https://img.shields.io/badge/release-v${VERSION}-informational)`,
  table,
  counts,
  hosted: [
    `${hosted.size} servers have hosted endpoints. Open [the connect page](https://mcp.zovo.one/mcp/connect), get a free token and copy the complete URL for the server you need.`,
    '',
    'The ready URL has the form `https://mcp.zovo.one/mcp/<server>/t/<token>`. If your client supports headers, the bare endpoint also works with `Authorization: Bearer <token>`. The bare URL alone can initialize and list tools but refuses tool calls.',
    '',
    'Hosted file tools accept inline data/uploads and return temporary download URLs instead of reading your local disk. Read the server-specific setup guide for supported formats. A local install is the path for files on your machine.',
    '',
    'Office Suite, Three-Way Match, Duplicate Invoice Check and Supplier Statement Check are local stdio servers. Do not substitute a hosted URL for their executable. See each server page and the [client setup guides](https://mcp.zovo.one/setup).',
  ].join('\n'),
  install: [
    "![invoice](assets/demo-invoice.gif)",
    "",
    "That is the invoice server answering a real prompt: a client, some hours, a VAT rate, and a numbered PDF at the end.",
    "The table links the demonstrations that are available; some are labeled evidence diagrams rather than client captures.",
    "",
    "**Choose the install path supported by your server.**",
    "",
    "1. **Claude Desktop bundle.** Choose the server in the [download catalog](https://mcp.zovo.one/downloads), download its versioned `.mcpb` and open it.",
    `2. **Hosted, for ${hosted.size} servers.** Open [mcp.zovo.one/mcp/connect](https://mcp.zovo.one/mcp/connect), mint a free token and copy the ready URL for your server. That URL includes the token; a bare endpoint does not authorize tool calls. Servers without an endpoint use the bundle or source build.`,
    "",
    "The npm packages are not published. Use a bundle or the source build below rather than an npm package command.",
  ].join("\n"),
};

let src = rd("README.md"), changed = [], missing = [];
for (const [name, body] of Object.entries(REGIONS)) {
  const re = new RegExp(`(<!-- gen:${name} -->)([\\s\\S]*?)(<!-- /gen:${name} -->)`);
  if (!re.test(src)) { missing.push(name); continue; }
  const next = src.replace(re, `$1\n${body}\n$3`);
  if (next !== src) changed.push(name);
  src = next;
}
if (missing.length) { console.error(`README has no marker for: ${missing.join(", ")}`); process.exit(2); }
if (CHECK) { console.log(changed.length ? `README drifted in: ${changed.join(", ")}` : "README is current"); process.exit(changed.length ? 1 : 0); }
writeFileSync(join(ROOT, "README.md"), src);
console.log(`README regenerated (v${VERSION}, ${singles.length} servers, ${hosted.size} hosted); regions rewritten: ${changed.join(", ") || "none"}`);
