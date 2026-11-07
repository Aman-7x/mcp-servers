#!/usr/bin/env node
/**
 * Fail fast when a workspace's tests need a build that has not happened.
 *
 * 54 test files repo-wide import a workspace's own ../dist, which a clean checkout does
 * not contain. Without this guard `npm test` walks all 58 workspaces and reports ~58
 * timeout failures (a 15-minute crawl that looks like broken code and is only a missing
 * build). Here the same condition is one line per workspace, in under a second.
 *
 *   node scripts/pretest-dist.mjs           # check, exit 1 if anything is unbuilt
 *   node scripts/pretest-dist.mjs --build   # build what is missing, then exit
 */
import { readFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const build = process.argv.includes("--build");
// --assets: dist already exists, just refresh the copied data files (no rebuild).
const assetsOnly = process.argv.includes("--assets");
const roots = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).workspaces ?? [];
// workspaces are globs ("servers/*", "packages/*"): expand them, never existsSync the pattern
const workspaces = roots.flatMap((w) =>
  w.endsWith("/*")
    ? readdirSync(join(ROOT, w.slice(0, -2)), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => join(w.slice(0, -2), e.name))
    : [w],
);

const importsDist = (dir) =>
  readdirSync(dir, { withFileTypes: true }).some((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name !== "node_modules" && importsDist(p);
    return /\.(mjs|js|ts)$/.test(e.name) && /["'`]\.\.\/dist\//.test(readFileSync(p, "utf8"));
  });

// A workspace's dist is only usable once everything it imports has one: mcp-license
// imports mcp-timezone, 50+ servers import mcp-license. Build in dependency order, not
// alphabetically, or the first build emits JS that cannot be imported.
const byName = new Map();
for (const ws of workspaces) {
  try {
    byName.set(JSON.parse(readFileSync(join(ROOT, ws, "package.json"), "utf8")).name, ws);
  } catch {}
}
const deps = (ws) => {
  const src = join(ROOT, ws, "src");
  if (!existsSync(src)) return [];
  const found = new Set();
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = join(d, e.name);
      if (e.isDirectory()) return e.name !== "node_modules" && walk(p);
      if (!/\.ts$/.test(e.name)) return;
      for (const m of readFileSync(p, "utf8").matchAll(/@theluckystrike\/([\w-]+)/g))
        if (byName.has(`@theluckystrike/${m[1]}`) && byName.get(`@theluckystrike/${m[1]}`) !== ws)
          found.add(`@theluckystrike/${m[1]}`);
    });
  walk(src);
  return [...found];
};
const order = [];
const seen = new Set();
const visit = (ws, stack = new Set()) => {
  if (seen.has(ws) || stack.has(ws)) return;
  stack.add(ws);
  for (const d of deps(ws)) visit(byName.get(d), stack);
  seen.add(ws);
  order.push(ws);
};
workspaces.forEach((ws) => visit(ws));

// tsc emits only .js/.d.ts. Packages whose runtime reads data files next to the
// source (src/tables/*.json) ship a dist that throws ENOENT unless the data is
// copied across, so treat "built" as "code + assets".
const ASSET = /\.(json|csv)$/;
const copyAssets = (ws) => {
  const from = join(ROOT, ws, "src");
  const to = join(ROOT, ws, "dist");
  if (!existsSync(from)) return 0;
  let copied = 0;
  const walk = (rel) => {
    for (const e of readdirSync(join(from, rel), { withFileTypes: true })) {
      const relNext = join(rel, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules") walk(relNext);
        continue;
      }
      if (!ASSET.test(e.name)) continue;
      const dst = join(to, relNext);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(join(from, relNext), dst);
      copied++;
    }
  };
  walk("");
  return copied;
};

if (assetsOnly) {
  let files = 0;
  for (const ws of workspaces) {
    if (!existsSync(join(ROOT, ws, "dist"))) continue;
    const n = copyAssets(ws);
    if (n) files += n;
  }
  console.log(`pretest: refreshed ${files} data file(s) from src/ into dist/`);
  process.exit(0);
}

const missing = [];
for (const ws of order) {
  const dir = join(ROOT, ws);
  const tests = join(dir, "test");
  if (!existsSync(tests)) continue;
  if (!importsDist(tests)) continue;
  if (!existsSync(join(dir, "dist"))) missing.push(ws);
}

// A missing workspace is not the whole job: amortization imports
// @theluckystrike/mcp-asset-register/lib and .../mcp-quotes/lib, and neither of those
// packages has a test that touches ../dist, so neither was ever built. The build then
// died on TS2307 for a module that only looked absent. Pull in the unbuilt
// dependencies of anything we are about to build.
const unbuilt = new Set(missing);
const addDeps = (ws) => {
  for (const d of deps(ws)) {
    const dep = byName.get(d);
    if (!dep || unbuilt.has(dep)) continue;
    if (existsSync(join(ROOT, dep, "dist"))) continue;
    unbuilt.add(dep);
    addDeps(dep);
  }
};
missing.forEach(addDeps);
const toBuild = order.filter((ws) => unbuilt.has(ws));
missing.length = 0;
missing.push(...toBuild);

if (!missing.length) {
  console.log("pretest: every workspace whose tests import dist/ has one");
  process.exit(0);
}

if (!build) {
  console.error(`pretest: ${missing.length} workspace(s) need a build before their tests can run:`);
  for (const ws of missing) console.error(`  - ${ws}`);
  console.error("run `node scripts/pretest-dist.mjs --build` first (each build wants ~8 GB heap)");
  process.exit(1);
}

for (const ws of missing) {
  console.log(`pretest: building ${ws}`);
  const r = spawnSync("npm", ["run", "build", "-w", ws], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" },
  });
  if (r.status !== 0) {
    console.error(`pretest: build failed for ${ws}`);
    process.exit(1);
  }
  const n = copyAssets(ws);
  if (n) console.log(`pretest: copied ${n} data file(s) into ${ws}/dist`);
}
console.log(`pretest: built ${missing.length} workspace(s)`);
