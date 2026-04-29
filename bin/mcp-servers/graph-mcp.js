#!/usr/bin/env node
'use strict';

// Thin shim: delegates to the TypeScript entry via tsx.
// Mirrors bin/buildanything-runtime.js and the hooks pattern so Claude Code
// can launch this stdio MCP server without tsx installed globally.
const { spawn } = require('child_process');
const path = require('path');

const tsEntry = path.join(__dirname, 'graph-mcp.ts');
const child = spawn('npx', ['--no-install', 'tsx', tsEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  process.stderr.write(`[graph-mcp shim] failed to spawn tsx: ${err.message}\n`);
  process.exit(1);
});
