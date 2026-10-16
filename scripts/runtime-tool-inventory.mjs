#!/usr/bin/env node
// Measure an existing built entry, including proxy collision names. Never call tools.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function collectRuntimeTools(entry, { timeoutMs = 90_000 } = {}) {
  const work = join(homedir(), 'mcp-servers-work');
  mkdirSync(work, { recursive: true });
  const sandbox = mkdtempSync(join(work, 'tool-inventory-'));
  const client = new Client({ name: 'release-tool-inventory', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath, args: [resolve(entry)], cwd: dirname(resolve(entry)), stderr: 'pipe',
    env: { PATH: process.env.PATH || '', HOME: sandbox, TMPDIR: sandbox, XDG_DATA_HOME: join(sandbox, 'data'), XDG_CONFIG_HOME: join(sandbox, 'config'), MCP_LICENSE_KEY: '' },
  });
  let stderr = '', partial = false, timeout;
  transport.stderr.on('data', chunk => {
    stderr = (stderr + chunk.toString()).slice(-16000);
    partial ||= /failed to (?:connect|start)|unable to start|child .*unavailable|optional child .*not found, skipping/i.test(stderr);
  });
  const run = async () => {
    await client.connect(transport);
    const tools = [], cursors = new Set();
    let cursor;
    do {
      const page = await client.listTools(cursor ? { cursor } : {});
      tools.push(...page.tools.map(({ name, description }) => ({ name, description: description || '' })));
      cursor = page.nextCursor;
      if (cursor && cursors.has(cursor)) throw Error('Repeated tools/list cursor; inventory is partial');
      if (cursor) cursors.add(cursor);
    } while (cursor);
    if (!tools.length || new Set(tools.map(t => t.name)).size !== tools.length) throw Error('Empty or duplicate runtime inventory');
    if (partial) throw Error('A child failed to initialize; refusing partial inventory');
    return tools;
  };
  try {
    return await Promise.race([
      run(),
      new Promise((_, reject) => { timeout = setTimeout(() => reject(Error(`Runtime inventory timed out after ${timeoutMs} ms`)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timeout);
    await client.close(); // SDK waits for this process's exit; children may close just after it.
    const deadline = Date.now() + 10_000;
    while (true) {
      const open = spawnSync('lsof', ['-t', '+D', sandbox], { encoding: 'utf8' });
      if (!open.error && open.status === 1 && !open.stdout.trim()) break;
      if (open.error || open.status !== 0 || Date.now() >= deadline) throw Error(`Inventory cleanup deferred: cannot establish zero open handles in ${sandbox}`);
      await delay(100);
    }
    const bytes = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; };
    const size = bytes(sandbox);
    if (size > 50_000_000) throw Error(`Inventory scope retained: exceeds 50 MB (${sandbox})`);
    appendFileSync(join(root, 'data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path: sandbox, bytes: size, reason: 'completed isolated runtime inventory', lsof: 'no open handles' }) + '\n');
    rmSync(sandbox, { recursive: true });
    if (existsSync(sandbox)) throw Error(`Inventory scope retained: ${sandbox}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const entry = process.argv[2];
  if (!entry || process.argv.length !== 3) throw Error('Usage: runtime-tool-inventory.mjs <built entry>');
  process.stdout.write(JSON.stringify(await collectRuntimeTools(entry)));
}
