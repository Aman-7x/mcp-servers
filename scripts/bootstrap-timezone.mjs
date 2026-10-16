#!/usr/bin/env node
// mcp-license/profile imports timezone/lib; the timezone MCP entry point imports
// mcp-license. Compile only the dependency-free timezone engine first, so a fresh
// clone never needs stale dist files or an unpublished registry package to build.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
  '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
  '--target', 'ES2022', '--declaration', '--skipLibCheck', '--types', 'node',
  '--rootDir', 'servers/timezone/src', '--outDir', 'servers/timezone/dist',
  'servers/timezone/src/lib.ts',
], { cwd: root, stdio: 'inherit' });
console.log('bootstrap: timezone engine compiled without the license-dependent MCP entry point');
