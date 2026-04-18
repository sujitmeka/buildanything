#!/usr/bin/env tsx
/*
 * buildanything runtime — entrypoint loaded by Claude Code plugin
 * when SDK mode is enabled.
 */

import process from "node:process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import semver from "semver";

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
  let sdkStateFile = ".buildanything/sdk-state";
  try {
    const plugin = await loadPluginConfig();
    if (plugin.config?.sdkVersion) pinned = plugin.config.sdkVersion;
    if (plugin.config?.claudeCodeHostRange) hostRange = plugin.config.claudeCodeHostRange;
    if (plugin.config?.sdkStateFile) sdkStateFile = plugin.config.sdkStateFile;
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

  const hostVersion = process.env.CLAUDE_CODE_VERSION;
  let hostCompat = true;
  if (!hostVersion) {
    console.log("[buildanything-runtime] host version unavailable (CLAUDE_CODE_VERSION not set); skipping compat check");
  } else if (semver.satisfies(hostVersion, hostRange)) {
    console.log(`[buildanything-runtime] host version ${hostVersion} satisfies compat range ${hostRange}`);
  } else {
    hostCompat = false;
  }

  if (!hostCompat) {
    console.warn(`[buildanything-runtime] host version ${hostVersion} outside compat range ${hostRange} — falling back to markdown mode.`);
  }

  const stateFilePath = resolve(process.cwd(), sdkStateFile);
  let stateFileActive = false;
  try {
    const contents = (await readFile(stateFilePath, "utf8")).trim();
    stateFileActive = contents === "on";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.log(`[buildanything-runtime] debug: sdk state file missing at ${stateFilePath}; treating as off`);
    } else {
      console.warn(`[buildanything-runtime] warning: could not read sdk state file (${(err as Error).message}); treating as off`);
    }
  }
  const sdkActive = stateFileActive && hostCompat;
  console.log(`[buildanything-runtime] sdkActive=${sdkActive} (stateFile=${stateFileActive}, hostCompat=${hostCompat})`);

  // [Task 1.2.4] scribe MCP registration
  // [Task 2.3.4] write-lease MCP registration
  const mcpServers: Record<string, unknown> = {};
  if (!sdkActive) {
    console.log("[buildanything-runtime] sdk inactive — scribe + write-lease MCP registration skipped (markdown mode)");
  } else {
    try {
      const sdk = await import("@anthropic-ai/claude-agent-sdk");
      const { buildScribeTool } = await import("./adapters/scribe-tool.js");
      const scribeTool = buildScribeTool(sdk.tool, process.cwd());
      mcpServers.scribe = sdk.createSdkMcpServer({
        name: "scribe",
        tools: [scribeTool],
      });
      console.log("[buildanything-runtime] scribe MCP server registered (tool: scribe_decision)");
    } catch (err) {
      console.warn(
        `[buildanything-runtime] warning: scribe MCP registration failed (${(err as Error).message}); continuing in markdown mode`,
      );
    }

    try {
      const sdk = await import("@anthropic-ai/claude-agent-sdk");
      const {
        buildAcquireWriteLeaseTool,
        buildReleaseWriteLeaseTool,
        buildListWriteLeasesTool,
      } = await import("./adapters/write-lease-tool.js");
      const acquireTool = buildAcquireWriteLeaseTool(sdk.tool);
      const releaseTool = buildReleaseWriteLeaseTool(sdk.tool);
      const listTool = buildListWriteLeasesTool(sdk.tool);
      mcpServers.write_lease = sdk.createSdkMcpServer({
        name: "write_lease",
        tools: [acquireTool, releaseTool, listTool],
      });
      console.log(
        "[buildanything-runtime] write-lease MCP server registered (tools: acquire_write_lease, release_write_lease, list_write_leases)",
      );
    } catch (err) {
      console.warn(
        `[buildanything-runtime] warning: write-lease MCP registration failed (${(err as Error).message}); continuing without lease enforcement`,
      );
    }
  }

  // [Task 4.5.2] schema_version forward-reject
  void mcpServers;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[buildanything-runtime] fatal:", err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
