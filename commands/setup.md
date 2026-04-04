---
description: "Install buildanything's external dependencies — companion plugins, agent-browser CLI, Chrome for Testing, and skills"
---

# Setup

You are installing buildanything's external dependencies. The plugin itself is already installed (that's how this command is running), but the companion plugins, CLI tools, and skills it depends on are not — they need to be installed separately. This command does that in one shot.

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

## Step 2: Install the `agent-browser` CLI globally

1. Run `which agent-browser`. If it returns a path, record as `already present` and skip to Step 3.
2. Otherwise run `npm install -g agent-browser`. Record `installed` or `failed` based on exit status.

## Step 3: Download Chrome for Testing

Run `agent-browser install`. This downloads a pinned Chrome build. If `agent-browser` isn't on PATH (Step 2 failed), record `skipped (agent-browser CLI missing)` and continue. Otherwise record `ready` or `failed`.

Note: this is safe to re-run — `agent-browser install` no-ops if Chrome is already downloaded.

## Step 4: Install the `agent-browser` skill

Run `npx skills add vercel-labs/agent-browser`. Record `installed` or `failed`.

## Step 5: Install the `dogfood` skill

Run `npx skills add vercel-labs/agent-browser --skill dogfood`. Record `installed` or `failed`.

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
Next: restart Claude Code so newly installed plugins/skills are loaded.
Then try:
  /buildanything:build <your idea>
  /buildanything:idea-sweep <your idea>
```
