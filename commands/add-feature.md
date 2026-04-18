---
description: "Add a single feature to an existing project — lightweight build cycle using existing architecture, design system, and CLAUDE.md context"
argument-hint: "Describe the feature to add. --autonomous for unattended mode."
---

<HARD-GATE>
YOU ARE AN ORCHESTRATOR. YOU COORDINATE AGENTS. YOU DO NOT WRITE CODE.

"Launch an agent" = call the Agent tool. For implementation agents, set mode: "bypassPermissions". For parallel work, put multiple Agent tool calls in ONE message.
</HARD-GATE>

Input: $ARGUMENTS

If the input contains `--autonomous` or `--auto`, skip user approval gates and log decisions to `docs/plans/build-log.md`.

---

## Phase 1: Context Gathering

Read these files directly (no agent needed — this is fast):

1. `CLAUDE.md` — product context, tech stack, rules
2. `docs/plans/architecture.md` — current architecture
3. `docs/plans/sprint-tasks.md` — existing user journeys and scope

If any file is missing, proceed with what exists. If the codebase is unfamiliar or the feature touches unknown areas, spawn an Explore agent:

Call the Agent tool — description: "Explore codebase for [feature area]" — prompt: "Find all files related to [feature area]. Report: directory structure, key files, patterns used, relevant components/routes/APIs. Be concise."

---

## Phase 2: Plan the Feature

You do this yourself — no agent needed.

1. **Break the feature into 1-5 tasks** (most features are 1-3). Each task should be one commit-sized unit of work.
2. **Define behavioral acceptance criteria** for each task — what must be true when the task is done.
3. **Define the user journey** — the end-to-end flow the user will experience with this feature.
4. **Present the plan to the user for approval.** In autonomous mode, log the plan to `docs/plans/build-log.md` and proceed.

---

## Phase 3: Build

**For EACH task:**

### Step 3.1 — Implement

Call the Agent tool — description: "[task name]" — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. HANDOFF — Architecture context: [paste ONLY the relevant section from architecture.md]. Style guide: the living style guide at /design-system shows component styling — match it. Implement with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

Set `[COMPLEXITY: S/M/L]` based on task scope.

### Step 3.2 — Cleanup

Skip if trivial (< 20 lines, single file). Otherwise:

Call the Agent tool — description: "Cleanup [task name]" — mode: "bypassPermissions" — prompt: "Clean up these files: [list from implementation]. Fix: naming, dead code, unused imports, style, DRY. Do NOT add features, change architecture, or touch other files. If cleanup breaks acceptance criteria, revert."

### Step 3.3 — Smoke Test

Skip if this task has no UI surface. Otherwise run the Smoke Test Protocol (`protocols/smoke-test.md`): open the affected route, execute behavioral acceptance criteria via agent-browser, collect evidence. On FAIL: spawn fix agent with evidence. Max 2 fix-and-retest cycles.

### Step 3.4 — Verification

Run the Verification Protocol (`protocols/verify.md`). All 7 checks. If FAIL, fix before starting the next task.

---

## Phase 4: End-to-End Verification

### Step 4.1 — Run the User Journey

Call the Agent tool — description: "E2E: [feature name]" — mode: "bypassPermissions" — prompt: "Verify the full user journey for [feature name]: [paste the user journey from Phase 2]. Use agent-browser to walk through each step. For each step: interact, verify the expected outcome, capture evidence. Report PASS/FAIL per step with screenshots."

### Step 4.2 — Dogfood Affected Pages

Call the Agent tool — description: "Dogfood [feature area]" — prompt: "Open every page affected by [feature name]. Check for: broken layouts, console errors, missing data, dead links, regressions. Report issues with screenshots."

### Step 4.3 — Fix Loop

If issues found in 4.1 or 4.2: spawn a fix agent with the evidence. Re-run the failing check. Max 2 fix-and-retest cycles. After 2 failures:
- **Interactive:** present evidence to the user.
- **Autonomous:** log to `docs/plans/build-log.md` and proceed with a warning.

---

## Phase 5: Done

Report to the user:

```
FEATURE COMPLETE: [feature name]
Tasks: [done]/[total] | Tests: [count] passing
User journey: PASS/FAIL
Evidence: [paths to screenshots/logs]
```

If the feature expands the product scope, update `CLAUDE.md` to reflect the new capability.

**After any CLAUDE.md update:** Run `wc -l < CLAUDE.md`. If the count exceeds 200 lines, trim it back to ≤200 lines — cut the least-critical content, not the new addition. CLAUDE.md is auto-loaded into every subagent; bloat here multiplies across all dispatches.
