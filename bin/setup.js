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

function main() {
  console.log("\n  buildanything — one command to build an entire product\n");

  // Check claude is installed
  const version = run("claude", ["--version"]);
  if (!version) {
    console.error(
      "  Error: Claude Code is not installed.\n" +
        "  Install it first: https://docs.anthropic.com/en/docs/claude-code/overview\n"
    );
    process.exit(1);
  }
  console.log(`  Found Claude Code ${version}`);

  // Add marketplace and install buildanything
  console.log(`  Adding marketplace from ${REPO}...`);
  const addResult = run("claude", ["plugin", "marketplace", "add", REPO]);
  if (addResult === null) {
    console.error(
      "  Error: Failed to add marketplace. Check your internet connection and try again.\n"
    );
    process.exit(1);
  }
  console.log("  Marketplace added.");

  console.log(`  Installing ${PLUGIN} plugin...`);
  const installResult = run("claude", [
    "plugin",
    "install",
    `${PLUGIN}@${MARKETPLACE}`,
  ]);
  if (installResult === null) {
    console.error(
      "  Error: Failed to install plugin. Try manually:\n" +
        `  /plugin marketplace add ${REPO}\n` +
        `  /plugin install ${PLUGIN}@${MARKETPLACE}\n`
    );
    process.exit(1);
  }
  console.log("  buildanything installed.\n");

  // Install official companion plugins
  console.log("  Installing companion plugins from official marketplace...");
  const installed = [];
  const skipped = [];

  for (const plugin of OFFICIAL_PLUGINS) {
    const fullName = `${plugin.name}@${OFFICIAL_MARKETPLACE}`;
    process.stdout.write(`    ${plugin.name} (${plugin.desc})... `);
    const result = run("claude", ["plugin", "install", fullName]);
    if (result === null) {
      console.log("skipped (may already be installed)");
      skipped.push(plugin.name);
    } else {
      console.log("installed");
      installed.push(plugin.name);
    }
  }

  // Install agent-browser for behavioral verification
  console.log("  Installing agent-browser (behavioral testing)...");
  process.stdout.write("    agent-browser... ");
  const abCheck = run("which", ["agent-browser"]);
  if (abCheck) {
    console.log("already installed");
  } else {
    const abResult = run("npm", ["install", "-g", "agent-browser"]);
    if (abResult === null) {
      console.log("failed (optional — install manually: npm i -g agent-browser)");
    } else {
      // Install browser binary
      run("agent-browser", ["install"]);
      console.log("installed");
    }
  }

  console.log(
    "\n  Setup complete! Start Claude Code and use:\n" +
      "    /buildanything:build <your idea>       — full product pipeline\n" +
      "    /buildanything:idea-sweep <your idea>  — parallel research sweep\n"
  );

  if (installed.length > 0) {
    console.log(`  Companion plugins installed: ${installed.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`  Already installed: ${skipped.join(", ")}`);
  }
  console.log();
}

main();
