#!/usr/bin/env tsx
/*
 * buildanything runtime — entrypoint loaded by Claude Code plugin
 * when SDK mode is enabled.
 */

import process from "node:process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface PluginConfig {
  config?: {
    sdkStateFile?: string;
    claudeCodeHostRange?: string;
    sdkVersion?: string;
  };
}

const RUNTIME_VERSION = "0.1.0";

async function loadPluginConfig(): Promise<PluginConfig> {
  const scriptPath = process.argv[1] ?? "";
  const here = scriptPath ? dirname(scriptPath) : process.cwd();
  const pluginJsonPath = resolve(here, "..", ".claude-plugin", "plugin.json");
  const raw = await readFile(pluginJsonPath, "utf8");
  return JSON.parse(raw) as PluginConfig;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const resumeRequested = argv.includes("--resume");

  let pinned = "unknown";
  let hostRange = "unknown";
  try {
    const plugin = await loadPluginConfig();
    if (plugin.config?.sdkVersion) pinned = plugin.config.sdkVersion;
    if (plugin.config?.claudeCodeHostRange) hostRange = plugin.config.claudeCodeHostRange;
    if (!plugin.config) {
      console.warn("[buildanything-runtime] warning: plugin.json has no 'config' block; using unknown defaults");
    }
  } catch (err) {
    console.warn(`[buildanything-runtime] warning: could not load plugin.json config (${(err as Error).message}); using unknown defaults`);
  }

  console.log(`buildanything-runtime v${RUNTIME_VERSION} starting (sdk=${pinned}, hostRange=${hostRange})`);

  if (resumeRequested) {
    console.log("[buildanything-runtime] resume requested");
    // [Task 4.3.4] --resume staleness decrement
  }

  // [Task 1.1.4] $SDK_STATE_FILE read
  // [Task 1.4.1] semver.satisfies host check
  // [Task 1.4.2] fallback-to-markdown warning
  // [Task 1.2.4] scribe MCP registration
  // [Task 4.5.2] schema_version forward-reject
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[buildanything-runtime] fatal:", err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
