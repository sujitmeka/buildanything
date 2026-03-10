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
- Metric loops that stall accept at >= 60% of target, skip below that.
- Log every decision to `docs/plans/build-log.md` so the user can review later.

If `--autonomous` is NOT present, all quality gates require user approval as described below.

### Metric Loop

Every phase uses a **metric-driven iteration loop** to drive quality. Read the full protocol at `commands/protocols/metric-loop.md`. The short version:

1. YOU define a metric for this phase based on context (what you're building, what matters)
2. Spawn a measurement agent to score the artifact 0-100
3. Pick the ONE highest-impact issue, spawn a fix agent
4. Re-measure. Repeat until target met, stalled (2 consecutive no-improvement iterations), or max iterations reached
5. Track all scores in `.build-state.md`

The metric is NOT predefined — you decide what to measure based on the project, the phase, and what the user is building. A security-heavy API needs different metrics than a static site.

---

## Phase 0: Initialize

1. Create a TodoWrite checklist with Phases 1-5.
2. Create `docs/plans/.build-state.md` with: "Phase: 0 — Starting. Input: [build request]."
3. Go to Phase 1.

**Resuming after compaction?** Read `docs/plans/.build-state.md`, re-read this file and `commands/protocols/metric-loop.md`, check TodoWrite, resume from saved state.

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

### Step 1.3 — Metric Loop: Architecture Quality

Run the Metric Loop Protocol (`commands/protocols/metric-loop.md`) on the Architecture Document. Define a metric appropriate to this project — e.g., completeness of requirements coverage, specificity of data models, consistency between agents' outputs. Max 3 iterations.

### Step 1.4 — Sprint Planning (2 sequential Agent tool calls)

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

### Step 2.3 — Metric Loop: Scaffold Health

Run the Metric Loop Protocol on the scaffold. Define a metric based on what matters — builds clean, tests pass, lint clean, dependencies resolve, structure matches architecture. Max 3 iterations.

Update TodoWrite and state.

---

## Phase 3: Build — Metric-Driven Dev Loops

<HARD-GATE>
Before starting: Phase 1 must be approved (user-approved or auto-approved in autonomous mode), Phase 2 must pass. You MUST call the Agent tool for EVERY task below. No exceptions.
</HARD-GATE>

Expand TodoWrite with each sprint task.

**For EACH task:**

### 3.1 — Implement

Call the Agent tool — description: "[task name]" — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. ARCHITECTURE: [relevant section]. Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built and test results."

Pick the right developer framing: frontend, backend, AI, etc.

### 3.2 — Metric Loop: Task Quality

Run the Metric Loop Protocol (`commands/protocols/metric-loop.md`) on the task implementation. Define a metric based on the task's acceptance criteria — the measurement agent checks each criterion, runs tests, checks for regressions. Max 5 iterations.

This replaces the old binary pass/fail retry loop. Now you track whether the score is improving, stop if it stalls, and give targeted feedback (fix ONE thing per iteration, not "try again").

### 3.3 — Loop Exit

On target met: mark task complete in TodoWrite, report "Task X/N: [name] — COMPLETE (score: [final], iterations: [count])".

On stall or max iterations:
- **Interactive:** present score history + top remaining issue to user.
- **Autonomous:** accept if score >= 60% of target, skip otherwise. Log to `docs/plans/build-log.md`.

After each task: update TodoWrite and `.build-state.md`.

---

## Phase 4: Harden — Metric-Driven Hardening

### Step 4.1 — Initial Audit (4 agents in parallel, ONE message)

Call the Agent tool 4 times in one message:

1. Description: "API testing" — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. Report findings with counts."

2. Description: "Performance audit" — Prompt: "Measure response times, identify bottlenecks, flag performance issues. Report benchmarks."

3. Description: "Accessibility audit" — Prompt: "WCAG compliance audit on all interfaces. Check screen reader, keyboard nav, contrast. Report issues with counts."

4. Description: "Security audit" — Prompt: "Security review: auth, input validation, data exposure, dependency vulnerabilities. Report findings with severity."

### Step 4.2 — Metric Loop: Hardening Quality

Run the Metric Loop Protocol on the full codebase using the audit findings as initial input. Define a composite metric based on what this project needs — API reliability, security posture, accessibility compliance, code quality, performance. The weight of each dimension depends on what you're building. Max 4 iterations.

IMPORTANT: When fixing, dispatch to the RIGHT specialist. Security issues → security-focused agent. Accessibility → frontend agent with a11y context. Don't send everything to one agent.

### Step 4.3 — Reality Check

Call the Agent tool — description: "Final verdict" — prompt: "You are the Reality Checker. Default: NEEDS WORK. The hardening loop reached score [final_score] after [iterations] iterations. Score history: [paste table]. Review all evidence. Verdict: PRODUCTION READY or NEEDS WORK with specifics."

<HARD-GATE>Do NOT self-approve. Reality Checker must give the verdict.</HARD-GATE>

**If autonomous mode:** Log verdict to `docs/plans/build-log.md`. Continue.
**If interactive:** Present score history + verdict to user. Update state.

---

## Phase 5: Ship

### Step 5.1 — Documentation

Call the Agent tool — description: "Documentation" — mode: "bypassPermissions" — prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

### Step 5.2 — Metric Loop: Documentation Quality

Run the Metric Loop Protocol on the documentation. Define a metric based on completeness, accuracy, and whether a new developer could follow the README to get the project running. Max 3 iterations.

### Completion Report

Create final commit. Present:

```
BUILD COMPLETE
Project: [name] | Tasks: [done]/[total] | Tests: [count] passing
Agents used: [list] | Verdict: [Reality Checker result]
Metric loops run: [count] | Avg iterations: [N]
Remaining: [any NEEDS WORK items]
```

Mark all TodoWrite items complete. Update `.build-state.md`: "Phase: 5 COMPLETE."
