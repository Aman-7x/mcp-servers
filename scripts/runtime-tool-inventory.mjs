#!/usr/bin/env node
// Measure the shipped entry, including proxy collision names, without calling tools.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { appendFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const entry = process.argv[2];
if (!entry || process.argv.length !== 3) throw Error('Usage: runtime-tool-inventory.mjs <built entry>');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = join(homedir(), 'mcp-servers-work');
mkdirSync(work, { recursive: true });
const sandbox = mkdtempSync(join(work, 'tool-inventory-'));
const client = new Client({ name: 'release-tool-inventory', version: '1' });
const transport = new StdioClientTransport({
  command: process.execPath, args: [resolve(entry)], stderr: 'pipe',
  env: { PATH: process.env.PATH || '', HOME: sandbox, XDG_DATA_HOME: join(sandbox, 'data'), XDG_CONFIG_HOME: join(sandbox, 'config'), MCP_LICENSE_KEY: '' },
});
let stderr = '';
transport.stderr?.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-16000); });
const timeout = setTimeout(() => { void client.close(); }, 90_000);
try {
  await client.connect(transport);
  const tools = [];
  let cursor;
  do {
    const page = await client.listTools(cursor ? { cursor } : {});
    tools.push(...page.tools.map(({ name, description }) => ({ name, description: description || '' })));
    cursor = page.nextCursor;
  } while (cursor);
  if (!tools.length || new Set(tools.map(t => t.name)).size !== tools.length) throw Error('Empty or duplicate runtime inventory');
  if (/failed to (?:connect|start)|unable to start|child .*unavailable|optional child .*not found, skipping/i.test(stderr)) throw Error('A child failed to initialize; refusing partial inventory');
  process.stdout.write(JSON.stringify(tools));
} finally {
  clearTimeout(timeout);
  await client.close();
  const open = spawnSync('lsof', ['-t', '+D', sandbox], { encoding: 'utf8' });
  if (open.error || open.status !== 1 || open.stdout.trim()) throw Error('Inventory cleanup deferred: lsof could not establish zero open handles');
  const bytes = p => { const s = lstatSync(p); return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + bytes(join(p, f)), 0) : s.size; };
  appendFileSync(join(root, 'data/build-deletions.jsonl'), JSON.stringify({ at: new Date().toISOString(), path: sandbox, bytes: bytes(sandbox), reason: 'completed isolated runtime inventory', lsof: 'no open handles' }) + '\n');
  rmSync(sandbox, { recursive: true });
}
