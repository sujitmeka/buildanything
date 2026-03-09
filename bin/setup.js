#!/usr/bin/env node

const { execFileSync } = require("child_process");

const REPO = "sujitmeka/buildanything";
const MARKETPLACE = "buildanything-marketplace";
const PLUGIN = "buildanything";

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

  // Add marketplace
  console.log(`  Adding marketplace from ${REPO}...`);
  const addResult = run("claude", ["plugin", "marketplace", "add", REPO]);
  if (addResult === null) {
    console.error(
      "  Error: Failed to add marketplace. Check your internet connection and try again.\n"
    );
    process.exit(1);
  }
  console.log("  Marketplace added.");

  // Install plugin
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

  console.log(
    "\n  Installed! Start Claude Code and use:\n" +
      "    /buildanything:build <your idea>       — full product pipeline\n" +
      "    /buildanything:idea-sweep <your idea>  — parallel research sweep\n"
  );
}

main();
