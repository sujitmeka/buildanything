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

const isIos = process.argv.includes("--ios");

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
  if (isIos) console.log("  iOS mode: will also install XcodeBuildMCP, apple-docs-mcp, and Maestro.\n");

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

  // Install tsx — required by all plugin hooks (pre-tool-use, subagent-start/stop,
  // compile-writer-owner-cache, record-mode-transitions). Hooks use
  // `npx --no-install tsx` which silently degrades if tsx is missing.
  console.log("\n  Installing tsx (TypeScript runner for plugin hooks)...");
  const tsxCheck = run("which", ["tsx"]);
  if (tsxCheck) {
    console.log("    already installed");
  } else {
    process.stdout.write("    tsx... ");
    const tsxResult = run("npm", ["install", "-g", "tsx"]);
    if (tsxResult === null) {
      console.log("failed (install manually: npm i -g tsx)");
    } else {
      console.log("installed");
    }
  }

  // Install agent-browser for behavioral verification
  console.log("\n  Installing agent-browser (behavioral testing)...");

  process.stdout.write("    CLI... ");
  const abCheck = run("which", ["agent-browser"]);
  if (abCheck) {
    console.log("already installed");
  } else {
    const abResult = run("npm", ["install", "-g", "agent-browser"]);
    if (abResult === null) {
      console.log("failed (install manually: npm i -g agent-browser)");
    } else {
      console.log("installed");
    }
  }

  process.stdout.write("    Chrome browser... ");
  const chromeResult = run("agent-browser", ["install"]);
  if (chromeResult === null) {
    console.log("skipped (run manually: agent-browser install)");
  } else {
    console.log("ready");
  }

  process.stdout.write("    agent-browser skill... ");
  const skillResult = run("npx", ["skills", "add", "vercel-labs/agent-browser"]);
  if (skillResult === null) {
    console.log("skipped (install manually: npx skills add vercel-labs/agent-browser)");
  } else {
    console.log("installed");
  }

  process.stdout.write("    dogfood skill... ");
  const dfResult = run("npx", ["skills", "add", "vercel-labs/agent-browser", "--skill", "dogfood"]);
  if (dfResult === null) {
    console.log("skipped (install manually: npx skills add vercel-labs/agent-browser --skill dogfood)");
  } else {
    console.log("installed");
  }

  // iOS-specific deps — only when --ios flag is passed
  if (isIos) {
    console.log("\n  Installing iOS MCP servers...");
    const existingMcps = run("claude", ["mcp", "list"]) ?? "";

    for (const mcp of IOS_MCPS) {
      process.stdout.write(`    ${mcp.name} (${mcp.desc})... `);
      if (existingMcps.includes(mcp.name)) {
        console.log("already configured");
      } else {
        const result = run("claude", ["mcp", "add", mcp.name, "--", ...mcp.args]);
        if (result === null) {
          console.log(`failed (add manually: claude mcp add ${mcp.name} -- ${mcp.args.join(" ")})`);
        } else {
          console.log("configured");
        }
      }
    }

    console.log("\n  Installing Maestro (iOS E2E test runner)...");
    process.stdout.write("    maestro... ");
    const maestroCheck = run("which", ["maestro"]);
    if (maestroCheck) {
      console.log("already installed");
    } else {
      const brewCheck = run("which", ["brew"]);
      if (!brewCheck) {
        console.log("skipped — Homebrew not found (install Homebrew first, then: brew install maestro)");
      } else {
        const maestroResult = run("brew", ["install", "maestro"]);
        if (maestroResult === null) {
          console.log("failed (install manually: brew install maestro)");
        } else {
          console.log("installed");
        }
      }
    }
  }

  const completionMsg = isIos
    ? "\n  Setup complete! Restart Claude Code so MCP servers load, then use:\n" +
      "    /buildanything:build <your iOS app idea>  — full iOS pipeline\n"
    : "\n  Setup complete! Start Claude Code and use:\n" +
      "    /buildanything:build <your idea>       — full product pipeline\n" +
      "    /buildanything:idea-sweep <your idea>  — parallel research sweep\n";

  console.log(completionMsg);

  if (!isIos) {
    console.log("  Building an iOS app? Re-run with: npx buildanything --ios\n");
  }

  if (installed.length > 0) {
    console.log(`  Companion plugins installed: ${installed.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.log(`  Already installed: ${skipped.join(", ")}`);
  }
  console.log();
}

main();
