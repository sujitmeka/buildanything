#!/usr/bin/env node

const { execFileSync } = require("child_process");

const REPO = "sujitmeka/buildanything";
const MARKETPLACE = "buildanything-marketplace";
const PLUGIN = "buildanything";
const OFFICIAL_MARKETPLACE = "claude-plugins-official";

const OFFICIAL_PLUGINS = [
  { name: "feature-dev", desc: "code-architect, code-explorer, code-reviewer" },
  { name: "pr-review-toolkit", desc: "silent-failure-hunter, code-simplifier, type-design-analyzer" },
  { name: "code-review", desc: "final code review passes" },
  { name: "commit-commands", desc: "clean git commits" },
  { name: "playwright", desc: "browser automation for design research and visual QA" },
];

const IOS_MCPS = [
  {
    name: "xcodebuildmcp",
    args: ["npx", "-y", "xcodebuildmcp@latest"],
    desc: "Xcode build, simulator, and project management",
  },
  {
    name: "apple-docs",
    args: ["npx", "-y", "apple-docs-mcp@latest"],
    desc: "Live Apple developer documentation lookup",
  },
];

const isIosFlag = process.argv.includes("--ios");

function detectExistingIos() {
  const mcps = run("claude", ["mcp", "list"]) ?? "";
  return mcps.includes("xcodebuildmcp") || mcps.includes("apple-docs");
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
      stdio: "pipe",
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

function runJson(command, args) {
  const out = run(command, args);
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function snapshotState() {
  const plugins = runJson("claude", ["plugin", "list", "--json"]);
  const marketplaces = runJson("claude", ["plugin", "marketplace", "list", "--json"]);
  const skillsOutput = run("npx", ["--no-install", "skills", "list", "-g"]) ?? "";

  return {
    installedPluginIds: new Set((plugins ?? []).map((p) => p.id)),
    pluginVersions: new Map((plugins ?? []).map((p) => [p.id, p.version])),
    installedMarketplaces: new Set((marketplaces ?? []).map((m) => m.name)),
    installedSkills: skillsOutput,
    hasBin: (name) => run("which", [name]) !== null,
    pluginJsonAvailable: plugins !== null,
  };
}

function ensureMarketplace(state, name, source, report) {
  if (state.installedMarketplaces.has(name)) {
    report.marketplacesPresent.push(name);
    return true;
  }
  const result = run("claude", ["plugin", "marketplace", "add", source]);
  if (result === null) {
    report.failures.push(`marketplace: ${name}`);
    return false;
  }
  report.marketplacesAdded.push(name);
  return true;
}

function ensurePlugin(state, pluginName, marketplace, report) {
  const id = `${pluginName}@${marketplace}`;
  if (state.installedPluginIds.has(id)) {
    report.pluginsPresent.push(pluginName);
    return { alreadyInstalled: true, id };
  }
  const result = run("claude", ["plugin", "install", id]);
  if (result === null) {
    report.failures.push(`plugin: ${pluginName}`);
    return { alreadyInstalled: false, id, failed: true };
  }
  report.pluginsInstalled.push(pluginName);
  return { alreadyInstalled: false, id };
}

function updateBuildanything(state, report) {
  const id = `${PLUGIN}@${MARKETPLACE}`;
  const oldVersion = state.pluginVersions.get(id);
  const result = run("claude", ["plugin", "update", id]);
  if (result === null) {
    report.failures.push(`update: ${PLUGIN}`);
    return;
  }
  const fresh = runJson("claude", ["plugin", "list", "--json"]);
  const newVersion = fresh?.find((p) => p.id === id)?.version;
  if (oldVersion && newVersion && oldVersion !== newVersion) {
    report.updated.push(`${PLUGIN}: ${oldVersion} → ${newVersion}`);
  } else {
    report.pluginsPresent.push(`${PLUGIN} (up to date)`);
  }
}

function ensureBin(name, installCmd, report) {
  if (run("which", [name]) !== null) {
    report.binsPresent.push(name);
    return true;
  }
  const result = run(installCmd.cmd, installCmd.args);
  if (result === null) {
    report.failures.push(`${name} (install manually: ${installCmd.manual})`);
    return false;
  }
  report.binsInstalled.push(name);
  return true;
}

function ensureSkill(state, skillArgs, skillLabel, report) {
  if (state.installedSkills.includes(skillLabel)) {
    report.skillsPresent.push(skillLabel);
    return;
  }
  const result = run("npx", ["skills", "add", ...skillArgs]);
  if (result === null) {
    report.failures.push(`skill: ${skillLabel}`);
    return;
  }
  report.skillsInstalled.push(skillLabel);
}

function main() {
  console.log("\n  buildanything — one command to build an entire product\n");

  const version = run("claude", ["--version"]);
  if (!version) {
    console.error(
      "  Error: Claude Code is not installed.\n" +
        "  Install it first: https://docs.anthropic.com/en/docs/claude-code/overview\n"
    );
    process.exit(1);
  }
  console.log(`  Found Claude Code ${version}`);

  const existingIos = detectExistingIos();
  const isIos = isIosFlag || existingIos;
  if (isIosFlag) console.log("  iOS mode: will install XcodeBuildMCP, apple-docs-mcp, and Maestro.\n");
  else if (existingIos) console.log("  Detected existing iOS setup — will verify iOS tools are current.\n");

  const state = snapshotState();
  if (!state.pluginJsonAvailable) {
    console.log("  (Claude plugin list unavailable — running in blind re-install mode)");
  }

  const report = {
    marketplacesAdded: [],
    marketplacesPresent: [],
    pluginsInstalled: [],
    pluginsPresent: [],
    updated: [],
    binsInstalled: [],
    binsPresent: [],
    skillsInstalled: [],
    skillsPresent: [],
    mcpsAdded: [],
    mcpsPresent: [],
    failures: [],
  };

  // Marketplace
  console.log(`\n  Ensuring marketplace ${MARKETPLACE}...`);
  const marketplaceOk = ensureMarketplace(state, MARKETPLACE, REPO, report);
  if (!marketplaceOk) {
    console.error("  Error: Failed to add marketplace. Check your internet connection.\n");
    process.exit(1);
  }

  // buildanything plugin — install if missing, else update
  console.log(`  Ensuring ${PLUGIN} plugin...`);
  const buildId = `${PLUGIN}@${MARKETPLACE}`;
  if (state.installedPluginIds.has(buildId)) {
    updateBuildanything(state, report);
  } else {
    ensurePlugin(state, PLUGIN, MARKETPLACE, report);
  }

  // Official companion plugins
  console.log("\n  Ensuring companion plugins...");
  for (const plugin of OFFICIAL_PLUGINS) {
    const id = `${plugin.name}@${OFFICIAL_MARKETPLACE}`;
    if (state.installedPluginIds.has(id)) {
      console.log(`    ${plugin.name} — already installed`);
      report.pluginsPresent.push(plugin.name);
    } else {
      process.stdout.write(`    ${plugin.name} (${plugin.desc})... `);
      const result = run("claude", ["plugin", "install", id]);
      if (result === null) {
        console.log("failed");
        report.failures.push(`plugin: ${plugin.name}`);
      } else {
        console.log("installed");
        report.pluginsInstalled.push(plugin.name);
      }
    }
  }

  // tsx — required by hooks
  console.log("\n  Ensuring tsx (TypeScript runner for plugin hooks)...");
  ensureBin(
    "tsx",
    { cmd: "npm", args: ["install", "-g", "tsx"], manual: "npm i -g tsx" },
    report
  );
  console.log(
    `    tsx — ${report.binsPresent.includes("tsx") ? "already installed" : report.binsInstalled.includes("tsx") ? "installed" : "failed"}`
  );

  // agent-browser CLI + Chrome + skills
  console.log("\n  Ensuring agent-browser (behavioral testing)...");
  ensureBin(
    "agent-browser",
    {
      cmd: "npm",
      args: ["install", "-g", "agent-browser"],
      manual: "npm i -g agent-browser",
    },
    report
  );
  console.log(
    `    agent-browser CLI — ${report.binsPresent.includes("agent-browser") ? "already installed" : report.binsInstalled.includes("agent-browser") ? "installed" : "failed"}`
  );

  // Chrome for agent-browser — agent-browser install is internally idempotent,
  // but we skip the call when the CLI was already present (assume prior setup).
  if (report.binsPresent.includes("agent-browser")) {
    console.log("    Chrome browser — skipped (agent-browser already configured)");
  } else {
    process.stdout.write("    Chrome browser... ");
    const chromeResult = run("agent-browser", ["install"]);
    console.log(chromeResult === null ? "skipped (run: agent-browser install)" : "ready");
  }

  // Skills — check before re-adding
  ensureSkill(
    state,
    ["vercel-labs/agent-browser"],
    "agent-browser",
    report
  );
  console.log(
    `    agent-browser skill — ${report.skillsPresent.includes("agent-browser") ? "already installed" : report.skillsInstalled.includes("agent-browser") ? "installed" : "failed"}`
  );

  ensureSkill(
    state,
    ["vercel-labs/agent-browser", "--skill", "dogfood"],
    "dogfood",
    report
  );
  console.log(
    `    dogfood skill — ${report.skillsPresent.includes("dogfood") ? "already installed" : report.skillsInstalled.includes("dogfood") ? "installed" : "failed"}`
  );

  // iOS-specific
  if (isIos) {
    console.log("\n  Ensuring iOS MCP servers...");
    const existingMcps = run("claude", ["mcp", "list"]) ?? "";

    for (const mcp of IOS_MCPS) {
      process.stdout.write(`    ${mcp.name} (${mcp.desc})... `);
      if (existingMcps.includes(mcp.name)) {
        console.log("already configured");
        report.mcpsPresent.push(mcp.name);
      } else {
        const result = run("claude", ["mcp", "add", mcp.name, "--", ...mcp.args]);
        if (result === null) {
          console.log("failed");
          report.failures.push(`mcp: ${mcp.name}`);
        } else {
          console.log("configured");
          report.mcpsAdded.push(mcp.name);
        }
      }
    }

    console.log("\n  Ensuring Maestro (iOS E2E test runner)...");
    if (run("which", ["maestro"]) !== null) {
      console.log("    maestro — already installed");
      report.binsPresent.push("maestro");
    } else {
      const brewCheck = run("which", ["brew"]);
      process.stdout.write("    maestro... ");
      if (!brewCheck) {
        console.log("skipped — Homebrew not found");
        report.failures.push("maestro (install Homebrew first, then: brew install maestro)");
      } else {
        const maestroResult = run("brew", ["install", "maestro"]);
        if (maestroResult === null) {
          console.log("failed");
          report.failures.push("maestro (brew install maestro)");
        } else {
          console.log("installed");
          report.binsInstalled.push("maestro");
        }
      }
    }
  }

  // Summary
  printSummary(report, isIos);
}

function printSummary(report, isIos) {
  console.log("\n  ─── Summary ───");

  const newThings = [
    ...report.marketplacesAdded.map((n) => `  marketplace: ${n}`),
    ...report.pluginsInstalled.map((n) => `  plugin: ${n}`),
    ...report.binsInstalled.map((n) => `  bin: ${n}`),
    ...report.skillsInstalled.map((n) => `  skill: ${n}`),
    ...report.mcpsAdded.map((n) => `  mcp: ${n}`),
  ];

  const alreadyThere =
    report.marketplacesPresent.length +
    report.pluginsPresent.length +
    report.binsPresent.length +
    report.skillsPresent.length +
    report.mcpsPresent.length;

  if (report.updated.length > 0) {
    console.log("  Updated:");
    report.updated.forEach((u) => console.log(`    ${u}`));
  }

  if (newThings.length > 0) {
    console.log(`  Newly installed (${newThings.length}):`);
    newThings.forEach((t) => console.log(t));
  }

  if (alreadyThere > 0) {
    console.log(`  Already present: ${alreadyThere} item${alreadyThere === 1 ? "" : "s"}`);
  }

  if (report.failures.length > 0) {
    console.log(`  Failures (${report.failures.length}):`);
    report.failures.forEach((f) => console.log(`    ${f}`));
  }

  const nothingChanged =
    newThings.length === 0 && report.updated.length === 0 && report.failures.length === 0;

  if (nothingChanged) {
    console.log("  Everything is already up to date.");
  }

  console.log(
    isIos
      ? "\n  Restart Claude Code so MCP servers load, then use:\n    /buildanything:build <your iOS app idea>\n"
      : "\n  Start Claude Code and use:\n    /buildanything:build <your idea>       — full product pipeline\n    /buildanything:idea-sweep <your idea>  — parallel research sweep\n"
  );

  if (!isIos) {
    console.log("  Building an iOS app? Re-run with: npx buildanything --ios\n");
  }
}

main();
