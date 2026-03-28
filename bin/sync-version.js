#!/usr/bin/env node

/**
 * Reads version from package.json and writes it to:
 *   - .claude-plugin/plugin.json
 *   - .claude-plugin/marketplace.json
 *
 * Used by the npm "version" lifecycle hook so `npm version patch|minor|major`
 * keeps all three files in sync automatically.
 */

const { readFileSync, writeFileSync } = require("fs");
const { join } = require("path");

const root = join(__dirname, "..");

function readJSON(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf-8"));
}

function writeJSON(rel, obj) {
  writeFileSync(join(root, rel), JSON.stringify(obj, null, 2) + "\n");
}

const { version } = readJSON("package.json");

// Sync plugin.json
const plugin = readJSON(".claude-plugin/plugin.json");
const updatedPlugin = { ...plugin, version };
writeJSON(".claude-plugin/plugin.json", updatedPlugin);

// Sync marketplace.json — update the plugin entry's version
const marketplace = readJSON(".claude-plugin/marketplace.json");
const updatedPlugins = marketplace.plugins.map((p) => ({ ...p, version }));
const updatedMarketplace = { ...marketplace, plugins: updatedPlugins };
writeJSON(".claude-plugin/marketplace.json", updatedMarketplace);

console.log(`  Synced version ${version} → plugin.json, marketplace.json`);
