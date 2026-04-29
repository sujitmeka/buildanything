#!/usr/bin/env node
'use strict';

// Thin shim: delegates to the graph indexer TypeScript entry via tsx.
const { spawn } = require('child_process');
const path = require('path');

const tsEntry = path.join(__dirname, 'graph-index.ts');
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
  process.stderr.write(`[graph-index shim] failed to spawn tsx: ${err.message}\n`);
  process.exit(1);
});
