# Cleanup Protocol (De-Sloppify)

You are the orchestrator. An implementation agent just finished a task. Before running the metric loop, you run a focused cleanup pass on the changed files.

## When to Skip

If the implementation was trivial — single config file change, < 20 lines changed total — skip this protocol. The overhead isn't worth it.

## Step 1: Collect the Changeset

Get the authoritative list of files changed by running `git diff --name-only HEAD~1` (or checking the implementation agent's commit). Do not rely solely on the agent's self-reported file list — use git as the source of truth. This is the cleanup scope. Nothing outside this list gets touched.

## Step 2: Invoke the Cleanup Agent

Call the Agent tool — description: "Cleanup [task name]" — mode: "bypassPermissions" — prompt:

"You are a code quality cleanup agent. Your job is to improve code quality in the files listed below WITHOUT changing behavior.

FILES IN SCOPE:
[list of files changed by the implementer]

ACCEPTANCE CRITERIA (do not break these):
[paste the task's acceptance criteria]

FIX these issues if you find them:
- Naming inconsistencies (variables, functions, files)
- Dead code and unused imports
- Redundant or duplicate imports
- Unclear variable or function names
- Missing error handling
- Code style violations
- Obvious DRY violations within the changed files

DO NOT:
- Add features or change behavior
- Modify the architecture or file structure
- Touch files outside the list above
- Refactor code that wasn't part of this task
- Modify tests unless fixing a broken assertion caused by the implementer

When finished, commit: 'refactor: cleanup [task name]'."

## Step 3: Verify

After the cleanup agent finishes, spot-check that acceptance criteria still hold. If the cleanup agent broke something, revert its commit and log the issue to `docs/plans/build-log.md`. Then proceed to the metric loop without cleanup.

---

## Rules

- The cleanup agent is a SEPARATE Agent tool call from the implementer. No cleaning your own mess.
- Scope is sacred. Only files from the implementation changeset. Zero exceptions.
- This runs AFTER implementation, BEFORE the metric loop.
- If cleanup breaks acceptance criteria, revert and skip. Never block the metric loop on a cleanup failure.

### Build Log Rotation

At Phase 0, if `docs/plans/build-log.md` exceeds 500 lines, archive it to `docs/plans/build-log.prev.md` and start a fresh log. The archived log preserves full history for debugging. The 500-line threshold keeps the active log within a reasonable context budget for agents that read it.