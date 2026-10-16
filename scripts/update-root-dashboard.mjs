#!/usr/bin/env node
// Refresh the ledger and the canonical main dashboard; preserve the legacy URL.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let note;
if (args.length === 2 && args[0] === '--note') note = args[1];
else if (args.length === 1 && args[0].startsWith('--note=')) note = args[0].slice(7);
else if (args.length) throw Error('Usage: update-root-dashboard.mjs [--note <session note>]');
function run(script) {
  const result = spawnSync(process.execPath, [join(root, 'scripts', script)], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) throw Error(result.stderr || result.error?.message || `${script} failed`);
  if (result.stdout) process.stdout.write(result.stdout);
}
run('update-dashboard.mjs');
if (note) {
  const path = join(root, 'data/ledger.json');
  const ledger = JSON.parse(readFileSync(path, 'utf8'));
  const at = new Date().toISOString();
  ledger.session ||= { count: 0, history: [] };
  ledger.session.count++;
  ledger.session.history.push({ at, note });
  ledger.generated_at = at;
  writeFileSync(path, JSON.stringify(ledger, null, 2) + '\n');
  appendFileSync(join(root, 'data/session.log'), `${at}  ${note}\n`);
}
run('render-main.mjs');
writeFileSync(join(root, 'DASHBOARD.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./index.html"><title>MCP project dashboard</title><p>The current project dashboard is <a href="./index.html">index.html</a>. It includes current measurements, observation windows, session outcomes, server details and historical evidence.</p></html>\n`);
console.log('DASHBOARD.html now points to the canonical index.html');
