---
description: "Full product build pipeline — orchestrates specialist agents through architecture, implementation, testing, hardening, and shipping"
argument-hint: "Describe what to build, or path to a design doc. Add --autonomous for unattended mode."
---

<HARD-GATE>
YOU ARE AN ORCHESTRATOR. YOU COORDINATE AGENTS. YOU DO NOT WRITE CODE.

Every step below tells you to call the Agent tool. DO IT. Do not role-play as the agent. Do not write implementation code yourself. Do not skip the Agent tool call "because it's faster." If you are typing code instead of calling the Agent tool, STOP — you are violating this process.

"Launch an agent" = call the Agent tool (the actual tool in your toolbar, the one that spawns a subprocess).

For implementation agents, set mode: "bypassPermissions".
For parallel work, put multiple Agent tool calls in ONE message.
</HARD-GATE>

Input: $ARGUMENTS

### Autonomous Mode

If the input contains `--autonomous` or `--auto`, this build runs **unattended**. The user will not be present to approve quality gates. In autonomous mode:
- Quality gates auto-approve. Do NOT pause and wait for user input.
- If a task fails 3 retries, SKIP it (log to `.build-state.md`) instead of escalating.
- Log every decision to `docs/plans/build-log.md` so the user can review later.
- At the end, write a summary of all decisions, skipped items, and issues to `docs/plans/build-log.md`.

If `--autonomous` is NOT present, all quality gates require user approval as described below.

---

## Phase 0: Initialize

1. Create a TodoWrite checklist with Phases 1-5.
2. Create `docs/plans/.build-state.md` with: "Phase: 0 — Starting. Input: [build request]."
3. Go to Phase 1.

**Resuming after compaction?** Read `docs/plans/.build-state.md`, re-read this file, check TodoWrite, resume from saved state.

---

## Phase 1: Architecture & Planning

### Step 1.1 — Explore (existing codebase only)

Call the Agent tool — description: "Explore codebase" — prompt: "Explore this codebase. Map architecture layers, file conventions, testing patterns, existing features. Report findings."

### Step 1.2 — Architecture Design (4 agents in parallel, ONE message)

Call the Agent tool 4 times in a single message:

1. Description: "Backend architecture" — Prompt: "Design system architecture for: [build request]. Include services, data models, API contracts, database schema. Be specific — name tables, endpoints, structures."

2. Description: "Frontend architecture" — Prompt: "Design frontend architecture for: [build request]. Include component hierarchy, layout system, responsive strategy, state management. Produce a component tree."

3. Description: "Security architecture" — Prompt: "Review proposed system for: [build request]. Cover auth model, input validation, secrets management, threat model for top 3 attack vectors."

4. Description: "Implementation blueprint" — Prompt: "Produce implementation blueprint for: [build request]. Include specific files to create/modify, build sequence, dependency order."

After all 4 return, YOU synthesize their outputs into one Architecture Document. Save to `docs/plans/architecture.md`. This synthesis is the ONE thing you write directly.

### Step 1.3 — Sprint Planning (2 sequential Agent tool calls)

Call the Agent tool — description: "Sprint breakdown" — prompt: "Break this architecture into ordered, atomic tasks. Each task needs: description, acceptance criteria, dependencies, size (S/M/L). Architecture: [paste architecture doc]."

Then call the Agent tool — description: "Validate task list" — prompt: "Validate this task list: [paste output]. Check scope is realistic, no missing tasks, descriptions specific enough for a developer agent to execute."

Save to `docs/plans/sprint-tasks.md`.

### Quality Gate 1

**If autonomous mode:** Log architecture and task list to `docs/plans/build-log.md`. Auto-approve. Proceed.

**If interactive:** Present Architecture Document + Sprint Task List to user. Ask: "Approve to start building, or flag changes?" <HARD-GATE>DO NOT PROCEED without user approval.</HARD-GATE>

Update TodoWrite and `.build-state.md`.

---

## Phase 2: Foundation

### Step 2.1 — Scaffolding

Call the Agent tool — description: "Project scaffolding" — mode: "bypassPermissions" — prompt: "Set up the project from this architecture: [paste]. Create directory structure, dependencies, build tooling, linting config, test framework with one passing test, .gitignore, .env.example. Commit: 'feat: initial scaffolding'."

### Step 2.2 — Design System (frontend only)

Call the Agent tool — description: "Design system setup" — mode: "bypassPermissions" — prompt: "Implement design system foundation from this architecture: [paste frontend section]. Create CSS tokens, base layout components, core UI primitives. Commit: 'feat: design system'."

### Quality Gate 2

Verify: project builds, tests pass, lint clean. Fix before proceeding. Update TodoWrite and state.

---

## Phase 3: Build — Dev→QA Loops

<HARD-GATE>
Before starting: Phase 1 must be approved (user-approved or auto-approved in autonomous mode), Phase 2 must pass. You MUST call the Agent tool for EVERY task below. No exceptions.
</HARD-GATE>

Expand TodoWrite with each sprint task.

**For EACH task, run this 3-step loop:**

### 3.1 — Implement

Call the Agent tool — description: "[task name]" — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. ARCHITECTURE: [relevant section]. Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built and test results."

Pick the right developer framing: frontend, backend, AI, etc.

### 3.2 — Verify

Call the Agent tool — description: "Verify [task]" — prompt: "Verify implementation of [task]. Acceptance criteria: [paste]. Run tests. Check each criterion. Report PASS or FAIL with evidence."

### 3.3 — Review

Call the Agent tool — description: "Review [task]" — prompt: "Code review [task]. Check for bugs, security issues, code quality, silent failures. Report APPROVE or REQUEST CHANGES with specifics."

### Loop Decision

- PASS + APPROVE → mark complete in TodoWrite, next task.
- Issues → call Agent tool with developer + feedback, re-verify (max 3 retries).
- 3 failures → **interactive:** escalate to user. **autonomous:** skip task, log to `docs/plans/build-log.md`, continue.

After each task: update TodoWrite, report "Task X/N: [name] — COMPLETE", update `.build-state.md`.

---

## Phase 4: Harden

### Step 4.1 — Audit (4 agents in parallel, ONE message)

Call the Agent tool 4 times in one message:

1. Description: "API testing" — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. Report findings."

2. Description: "Performance audit" — Prompt: "Measure response times, identify bottlenecks, flag performance issues. Report benchmarks."

3. Description: "Accessibility audit" — Prompt: "WCAG compliance audit on all interfaces. Check screen reader, keyboard nav, contrast. Report issues."

4. Description: "Security audit" — Prompt: "Security review: auth, input validation, data exposure, dependency vulnerabilities. Report findings with severity."

### Step 4.2 — Fix Critical Issues

For each critical finding: call Agent tool with developer + fix instructions, mode: "bypassPermissions". Then re-audit.

### Step 4.3 — Code Quality (2 agents in parallel)

1. Description: "Code cleanup" — mode: "bypassPermissions" — Prompt: "Simplify complex code. Preserve functionality. Commit improvements."
2. Description: "Type review" — mode: "bypassPermissions" — Prompt: "Review types and comments. Fix issues. Commit."

### Step 4.4 — Reality Check

Call the Agent tool — description: "Final verdict" — prompt: "You are the Reality Checker. Default: NEEDS WORK. Review all test results, QA evidence, acceptance criteria. Verdict: PRODUCTION READY (overwhelming evidence only) or NEEDS WORK (list specifics)."

<HARD-GATE>Do NOT self-approve. Reality Checker must give the verdict.</HARD-GATE>

**If autonomous mode:** Log Reality Checker verdict and all audit results to `docs/plans/build-log.md`. Continue to Phase 5.

**If interactive:** Present all results to user. Update state.

---

## Phase 5: Ship

Call the Agent tool — description: "Documentation" — mode: "bypassPermissions" — prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

Create final commit. Present completion report:

```
BUILD COMPLETE
Project: [name] | Tasks: [done]/[total] | Tests: [count] passing
Agents used: [list] | Verdict: [Reality Checker result]
Remaining: [any NEEDS WORK items]
```

Mark all TodoWrite items complete. Update `.build-state.md`: "Phase: 5 COMPLETE."
