---
description: "Install buildanything's external dependencies — tsx, companion plugins, agent-browser CLI, Chrome for Testing, skills, and optional iOS toolchain (XcodeBuildMCP, apple-docs-mcp, Maestro)"
---

# Setup

You are installing buildanything's external dependencies. The plugin itself is already installed (that's how this command is running), but the companion plugins, CLI tools, and skills it depends on are not — they need to be installed separately. This command does that in one shot.

**iOS project?** If the user's intent is to build an iOS app, also run Steps 8–10 below. Skip them otherwise.

Run every step below. Each step is idempotent: check first, install only if missing, continue on failure. Collect results as you go and report them all at the end.

## Step 1: Install companion plugins from `claude-plugins-official`

For each plugin below, run `claude plugin install <name>@claude-plugins-official`. If the command fails, record the failure and continue — do NOT abort.

| Plugin | Purpose |
|--------|---------|
| `feature-dev` | code-architect, code-explorer, code-reviewer |
| `pr-review-toolkit` | silent-failure-hunter, code-simplifier, type-design-analyzer |
| `code-review` | final code review passes |
| `commit-commands` | clean git commits |
| `playwright` | browser automation for design research and visual QA |

For each one, treat a non-zero exit as "already installed or failed" — record it as `skipped` and keep going. Treat a success as `installed`.

## Step 2: Install `tsx` globally

`tsx` is required by all plugin hooks (pre-tool-use, subagent-start, subagent-stop, session-start cache compiler). Hooks call `npx --no-install tsx` and silently degrade if tsx is missing.

1. Run `which tsx`. If it returns a path, record as `already present` and skip to Step 3.
2. Otherwise run `npm install -g tsx`. Record `installed` or `failed` based on exit status.

## Step 3: Install the `agent-browser` CLI globally

1. Run `which agent-browser`. If it returns a path, record as `already present` and skip to Step 4.
2. Otherwise run `npm install -g agent-browser`. Record `installed` or `failed` based on exit status.

## Step 4: Download Chrome for Testing

Run `agent-browser install`. This downloads a pinned Chrome build. If `agent-browser` isn't on PATH (Step 2 failed), record `skipped (agent-browser CLI missing)` and continue. Otherwise record `ready` or `failed`.

Note: this is safe to re-run — `agent-browser install` no-ops if Chrome is already downloaded.

## Step 5: Install the `agent-browser` skill

Run `npx skills add vercel-labs/agent-browser`. Record `installed` or `failed`.

## Step 6: Install the `dogfood` skill

Run `npx skills add vercel-labs/agent-browser --skill dogfood`. Record `installed` or `failed`.

### Step 7 — Install design.md linter (web/iOS Phase 3 lint gate)

`@google/design.md` is the linter that runs at Phase 3 Step 3.8 to validate `DESIGN.md`. It is pinned as a devDependency in `package.json` so lint behavior is reproducible across runs.

1. Check if installed: `npm ls @google/design.md` from the plugin root. If listed, record `already installed` and continue.
2. Otherwise run `npm install --save-dev @google/design.md` from the plugin root. Record `installed` or `failed` based on exit status.

A missing linter does NOT block Phase 0/1/2 — it only fails Phase 3.8 with a "linter spawn failed" stderr that names the install command. The plugin keeps working without it.

---

## Step 8: Install iOS MCP servers _(iOS only)_

For each MCP server below, run `claude mcp list` first. If the name already appears, record `already configured`. Otherwise run the install command and record `configured` or `failed`.

| MCP | Install command | Purpose |
|-----|-----------------|---------|
| `xcodebuildmcp` | `claude mcp add xcodebuildmcp -- npx -y xcodebuildmcp@latest` | Xcode build, simulator, scheme discovery, plist editing |
| `apple-docs` | `claude mcp add apple-docs -- npx -y apple-docs-mcp@latest` | Live Apple developer documentation and API lookup |

If either fails: record the failure with the exact manual-install command.

## Step 9: Install Maestro _(iOS only)_

Maestro runs E2E flow YAML tests against a booted iOS simulator.

1. Run `which maestro`. If present, record `already installed`.
2. Otherwise run `brew install maestro`. Record `installed` or `failed`.
3. If `brew` is missing, record `skipped — install Homebrew first (brew.sh), then: brew install maestro`.

## Step 10: Verify iOS toolchain _(iOS only)_

Run `xcodebuild -version`. Record the version string. If not found, warn: "Xcode 26.3+ required — install from the Mac App Store."

---

## Report

Print a single summary block with three sections:

```
buildanything setup complete.

Already present:
  - <item>
  - <item>

Installed:
  - <item>
  - <item>

Failed:
  - <item> — retry with: <exact command>
  - <item> — retry with: <exact command>
```

Omit any section that has no entries. For every item in the `Failed` section, include the exact manual-install command the user can run themselves. If everything succeeded or was already present, print only a one-line success message instead of the full block.

After the summary, print this reminder:

```
Next: restart Claude Code so newly installed plugins and MCP servers load.
Then try:
  /buildanything:build <your idea>       — full product pipeline
  /buildanything:idea-sweep <your idea>  — parallel research sweep
```

If iOS steps were run, also print:
```
iOS: after restarting, confirm mcp__xcodebuildmcp__ and mcp__apple-docs__ tools appear.
```
