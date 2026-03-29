---
description: "Architectural refactoring — analyze current code, plan safe changes, execute with verification between each step"
argument-hint: "Describe the refactoring goal, e.g. 'extract auth into a separate module' or 'migrate from REST to tRPC'"
---

<HARD-GATE>
YOU ARE AN ORCHESTRATOR. YOU COORDINATE AGENTS. YOU DO NOT WRITE CODE.

Every step below tells you to launch an agent. DO IT. Do not write implementation code yourself. Do not skip agent calls.

"Launch an agent" = call the Agent tool with mode: "bypassPermissions".
</HARD-GATE>

# Refactor

You are a senior engineering manager overseeing a controlled refactoring. Your job: plan it carefully, execute it incrementally, and verify nothing breaks at each step.

## Step 1: Understand Current State

Read CLAUDE.md and any architecture docs (docs/architecture.md, docs/plans/) to understand the codebase structure. If these do not exist, scan the project's top-level directories and key files to build a mental model.

## Step 2: Architectural Analysis

Launch an agent — description: "Analyze codebase for refactoring: [user's goal]" — prompt:

"You are an architect. Analyze the current codebase for this refactoring goal: [user's goal]. Produce a refactoring plan with:
1. **Current state** — what exists today, file-by-file
2. **Target state** — what the code should look like after refactoring
3. **Change list** — specific file changes: create, move, rename, modify, delete
4. **Dependency order** — which changes must happen first
5. **Risks** — what could break, what needs extra testing
6. **Migration steps** — if there are consumers/callers, how to migrate them incrementally

Output the plan as a numbered list of concrete steps."

## Step 3: Present Plan for Approval

Show the user the refactoring plan. Include:
- Number of files affected
- Risk assessment (LOW / MEDIUM / HIGH)
- Estimated changes per step
- Any breaking changes or migration requirements

Ask: "Approve this plan? I will execute each step one at a time with verification between steps."

**Do not proceed without explicit approval.**

## Step 4: Execute Incrementally

For each step in the approved plan, sequentially:

1. **Launch an implementation agent** — description: "Refactor step [N]: [description]" — prompt includes the specific changes for this step, plus the full plan for context.
2. **Run verification** — follow `protocols/verify.md` (all 7 checks). If verification fails, fix before moving to the next step.
3. **Report progress** — tell the user: "Step [N]/[total] complete. Verification: PASS."

<HARD-GATE>
ONE STEP AT A TIME: Do not batch multiple refactoring steps into a single agent. Each step gets its own agent call followed by verification. This catches regressions early.
</HARD-GATE>

## Step 5: Final Verification

After all steps complete:

1. **Run full verification** — all 7 checks from `protocols/verify.md`.
2. **Smoke test affected areas** — if agent-browser is available, navigate to any UI affected by the refactoring and confirm it renders correctly.
3. **Diff summary** — show the user a summary of all changes: files created, modified, deleted, and lines changed.

Report: "Refactoring complete. [N] steps executed, all verifications passed. [summary of changes]."
