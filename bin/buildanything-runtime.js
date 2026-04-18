#!/usr/bin/env node
'use strict';

// Thin shim: delegates to the TypeScript entry via tsx.
// Mirrors the hook pattern (npx --no-install tsx) used by subagent-start,
// pre-tool-use, and compile-writer-owner-cache — consistent behavior across
// the whole plugin when tsx is not globally installed.
const { spawnSync } = require('child_process');
const path = require('path');

const tsEntry = path.join(__dirname, 'buildanything-runtime.ts');
const result = spawnSync('npx', ['--no-install', 'tsx', tsEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? (result.error ? 1 : 0));
