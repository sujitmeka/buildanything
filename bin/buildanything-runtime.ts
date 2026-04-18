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
    maxSupportedSchemaVersion?: number;
  };
}

const RUNTIME_VERSION = "0.1.0";
// Hardcoded fallback if plugin.json lacks maxSupportedSchemaVersion. Keep this
// in sync with the `schema_version` table in protocols/state-schema.md.
const MAX_SUPPORTED_SCHEMA_VERSION_FALLBACK = 2;
// EX_CONFIG — configuration/state mismatch.
const EXIT_SCHEMA_VERSION_REJECT = 78;
const BUILD_STATE_PATH_REL = "docs/plans/.build-state.json";

export interface SchemaVersionCheck {
  accepted: boolean;
  reason?: "too_new";
  detected?: number;
  max?: number;
  message?: string;
}

// Pure: evaluate whether a parsed state file's schema_version is forward-
// compatible with this runtime. Missing / non-numeric / ≤ max → accepted.
// Only `> max` triggers a reject. Upgrade/migration for LOWER versions is
// explicitly out of scope here (task 4.5.2 scope note).
export function checkSchemaVersion(
  state: unknown,
  maxSupported: number,
  stateFilePath: string,
): SchemaVersionCheck {
  if (!state || typeof state !== "object") return { accepted: true };
  const raw = (state as Record<string, unknown>).schema_version;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return { accepted: true };
  if (raw <= maxSupported) return { accepted: true };
  return {
    accepted: false,
    reason: "too_new",
    detected: raw,
    max: maxSupported,
    message:
      `buildanything: state file schema_version=${raw} exceeds supported maximum ${maxSupported} ` +
      `(${stateFilePath}). Upgrade plugin to >=v${raw} or delete the state file. ` +
      `See docs/migration/sdk-host-compat.md.`,
  };
}

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
  let maxSupportedSchemaVersion = MAX_SUPPORTED_SCHEMA_VERSION_FALLBACK;
  try {
    const plugin = await loadPluginConfig();
    if (plugin.config?.sdkVersion) pinned = plugin.config.sdkVersion;
    if (plugin.config?.claudeCodeHostRange) hostRange = plugin.config.claudeCodeHostRange;
    if (plugin.config?.sdkStateFile) sdkStateFile = plugin.config.sdkStateFile;
    if (
      typeof plugin.config?.maxSupportedSchemaVersion === "number" &&
      Number.isFinite(plugin.config.maxSupportedSchemaVersion)
    ) {
      maxSupportedSchemaVersion = plugin.config.maxSupportedSchemaVersion;
    }
    if (!plugin.config) {
      console.warn("[buildanything-runtime] warning: plugin.json has no 'config' block; using unknown defaults");
    }
  } catch (err) {
    console.warn(`[buildanything-runtime] warning: could not load plugin.json config (${(err as Error).message}); using unknown defaults`);
  }

  // [Task 4.5.2] Forward-reject state files with schema_version > max.
  // Runs before any SDK/MCP wiring so an incompatible state file halts the
  // whole session instead of silently stripping fields on next write.
  const buildStatePath = resolve(process.cwd(), BUILD_STATE_PATH_REL);
  try {
    const raw = await readFile(buildStatePath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // Malformed JSON is NOT our concern here — other handlers surface it.
      // Log for visibility and continue.
      console.warn(
        `[buildanything-runtime] warning: could not parse ${buildStatePath} for schema check (${(err as Error).message}); continuing`,
      );
      parsed = null;
    }
    const check = checkSchemaVersion(parsed, maxSupportedSchemaVersion, buildStatePath);
    if (!check.accepted) {
      process.stderr.write(`${check.message}\n`);
      process.exit(EXIT_SCHEMA_VERSION_REJECT);
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(
        `[buildanything-runtime] warning: could not read ${buildStatePath} for schema check (${(err as Error).message}); continuing`,
      );
    }
    // ENOENT → no state file yet (fresh project); nothing to reject.
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
  // [Task 3.2.4] state-save MCP registration
  const mcpServers: Record<string, unknown> = {};
  if (!sdkActive) {
    console.log("[buildanything-runtime] sdk inactive — scribe + write-lease + state-save MCP registration skipped (markdown mode)");
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

    try {
      const sdk = await import("@anthropic-ai/claude-agent-sdk");
      const {
        buildStateSaveTool,
        buildStateReadTool,
        buildVerifyIntegrityTool,
      } = await import("./adapters/state-save-tool.js");
      const saveTool = buildStateSaveTool(sdk.tool);
      const readTool = buildStateReadTool(sdk.tool);
      const verifyTool = buildVerifyIntegrityTool(sdk.tool);
      mcpServers.state_save = sdk.createSdkMcpServer({
        name: "state_save",
        tools: [saveTool, readTool, verifyTool],
      });
      console.log(
        "[buildanything-runtime] state-save MCP server registered (tools: state_save, state_read, verify_integrity)",
      );
    } catch (err) {
      console.warn(
        `[buildanything-runtime] warning: state-save MCP registration failed (${(err as Error).message}); continuing in markdown mode`,
      );
    }
  }

  void mcpServers;
}

function isCliEntry(): boolean {
  // Run main() only when invoked as the CLI, not when imported by tests.
  const entry = process.argv[1] ?? "";
  return entry.endsWith("buildanything-runtime.ts") || entry.endsWith("buildanything-runtime.js");
}

if (isCliEntry()) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[buildanything-runtime] fatal:", err instanceof Error ? err.stack ?? err.message : err);
      process.exit(1);
    });
}
