#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('data/release_downloads.json', root), 'utf8'));
for (const [id, asset] of Object.entries(data.bundles)) {
  if (!/^[a-z0-9-]+$/.test(id) || !asset.url.startsWith('https://github.com/theluckystrike/mcp-servers/releases/download/') || !asset.url.endsWith(`/${id}.mcpb`)) throw Error('Invalid bundle URL: ' + id);
}
const body = '// Generated from data/release_downloads.json by scripts/build-downloads.mjs.\nexport const BUNDLE_DOWNLOADS = ' + JSON.stringify(data.bundles, null, 2) + ';\n';
const out = new URL('billing/src/downloads.js', root);
if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== body) throw Error('Run node scripts/build-downloads.mjs');
} else writeFileSync(out, body);
