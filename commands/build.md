---
description: "Full product build pipeline — orchestrates specialist agents through brainstorming, research, architecture, implementation, testing, hardening, and shipping"
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
- Brainstorming runs in autonomous mode (see protocol).
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

The metric is NOT predefined — you decide what to measure based on the project, the phase, and what the user is building.

---

## Phase 0: Context & Pre-Flight

**Resuming after compaction?** Read `docs/plans/.build-state.md`, re-read this file and the protocol files in `commands/protocols/`, check TodoWrite, resume from saved state. Skip Phase 0.

### Step 0.1 — Read the Room

Before doing anything, scan for existing context:

- Check if the input is a file path (e.g., `docs/plans/brainstorm.md`). If so, read it.
- Check if `docs/plans/` or `docs/briefs/` exist with prior brainstorming, design docs, decision briefs, or research. Read them.
- Check if there's existing code in the project. If so, this is an enhancement, not greenfield.
- Check the conversation history — has the user been discussing this idea already?

**Classify what you found:**

| Context Level | What You Have | What Happens |
|---|---|---|
| **Full design** | Design doc with decisions, scope, tech stack, data models | Skip Phase 1. Feed design into Phase 2. |
| **Decision brief** | An idea-sweep brief with verdicts and MVP definition | Phase 1 skips research (Step 1.2). Brainstorming refines the brief into a design. |
| **Partial context** | Some notes, conversation, rough sketch | Phase 1 runs fully. Feed context into brainstorming + research. |
| **Raw idea** | One-line build request, no prior work | Phase 1 runs fully from scratch. |

### Step 0.2 — Human Prerequisites Checklist

Identify everything that requires HUMAN action before going heads-down:

- **API keys & secrets** — External services the project integrates with. List each key needed.
- **Database setup** — Supabase, Postgres, etc. User needs to create it and provide credentials.
- **Repository** — Git repo on GitHub? Public or private?
- **Deployment** — Vercel, Railway, Fly.io? User needs to connect.
- **MCP servers** — Playwright for visual testing, database access, etc.
- **Local tooling** — Docker, specific runtimes, etc.

Present the checklist:

```
BEFORE I GO HEADS-DOWN, please set up:

[ ] [Service] API key → add as [KEY_NAME] to .env
[ ] [Database] → add connection URL to .env
[ ] GitHub repo → share the URL
[ ] [Deployment service] connected (optional)

Once done, say "ready" and I'll start building.
```

<HARD-GATE>
Interactive mode: DO NOT proceed until the user confirms prerequisites (or says to skip).
Autonomous mode: Log checklist to `docs/plans/build-log.md`. Create `.env.example` with required keys. Proceed — log missing keys as blockers if hit during build.
</HARD-GATE>

### Step 0.3 — Initialize

1. Create a TodoWrite checklist with Phases 0-6.
2. Create `docs/plans/.build-state.md` with: "Phase: 0 — Starting. Input: [build request]. Context level: [classification]. Prerequisites: [status]."
3. Go to Phase 1 (or Phase 2 if context level is "Full design").

---

## Phase 1: Brainstorm & Research

**Goal**: Turn the raw idea into a validated Design Document grounded in research. This ensures Phase 2 architects receive a design, not a guess.

**Skip if** Step 0.1 classified context as "Full design" — go straight to Phase 2.

### Step 1.1 — Brainstorming

Follow the Brainstorm Protocol (`commands/protocols/brainstorm.md`).

In interactive mode: this is a conversation. Ask questions one at a time, propose approaches with trade-offs, let the user decide. Output: Design Document saved to `docs/plans/`.

In autonomous mode: synthesize a design document directly using the build request and available context. Pick pragmatic defaults. Log rationale to `docs/plans/build-log.md`.

### Step 1.2 — Parallel Research (5 agents, ONE message)

Skip if context level is "Decision brief" (research already done).

Call the Agent tool 5 times in a single message. Pass each agent the build request AND the Design Document draft.

1. Description: "Market research" — Prompt: "Research market size (TAM/SAM/SOM), competitive landscape (5-10 players), timing, and market structure for: [build request]. Design context: [paste design doc]. Use web search extensively. Report with a Market Verdict: GREEN/AMBER/RED."

2. Description: "Tech feasibility" — Prompt: "Evaluate hard technical problems (Solved/Hard/Unsolved), build-vs-buy decisions, MVP scope, and stack validation for: [build request]. Design context: [paste design doc]. Search for APIs and libraries mentioned in the design to verify they exist and are maintained. Report with a Technical Verdict."

3. Description: "User research" — Prompt: "Analyze target persona, jobs-to-be-done, current alternatives, behavioral barriers to adoption for: [build request]. Design context: [paste design doc]. Search for real user complaints and communities discussing this problem. Report with a User Verdict."

4. Description: "Business model" — Prompt: "Evaluate revenue models, unit economics, growth loops, first-1000-users strategy for: [build request]. Design context: [paste design doc]. Search for comparable pricing and growth data. Report with a Business Verdict."

5. Description: "Risk analysis" — Prompt: "Adversarial review: regulatory risk, security concerns, dependency risks, competitive response, top 3 failure modes for: [build request]. Design context: [paste design doc]. Search for enforcement actions and comparable failures. Report with a Risk Verdict."

After all 5 return, synthesize a **Research Brief** with a verdict table. Save to `docs/plans/research-brief.md`.

### Step 1.3 — Design Refinement

Read the Design Document and Research Brief together. Check for contradictions:

- Tech-feasibility flagged "Unsolved" hard problem → simplify or flag as risk
- Risk-analysis returned RED → add mitigation or descope
- User-research says "no validated demand" → flag as pivot point
- Business-model says "no moat" → note for speed-to-market priority

Update the Design Document with corrections. Save final version.

### Step 1.4 — Persist Decisions

Append key decisions to the project's `CLAUDE.md` (create if needed) under `## Build Decisions`:

- Project name and one-line description
- Primary user and core value prop
- Tech stack (with rationale)
- Key constraints or risks
- MVP scope boundary (in vs. deferred)

This ensures decisions survive context compaction.

### Quality Gate 1

**Autonomous:** Log design and research paths to `docs/plans/build-log.md`. If 2+ RED verdicts, log warning. Proceed.

**Interactive:** Present Design Document summary + Research Brief verdict table. Ask: "Approve this design, or want to adjust?" <HARD-GATE>DO NOT PROCEED without user approval.</HARD-GATE>

Update TodoWrite and `.build-state.md`.

---

## Phase 2: Architecture & Planning

**Goal**: Convert the validated Design Document into a concrete architecture and ordered task list. Every agent receives the Design Document — not just the build request.

### Step 2.1 — Explore (existing codebase only)

If existing code, call the Agent tool — description: "Explore codebase" — prompt: "Explore this codebase. Map architecture layers, file conventions, testing patterns, existing features. Report findings."

If greenfield, skip to Step 2.2.

### Step 2.2 — Architecture Design (4 agents in parallel, ONE message)

Read the Design Document and Research Brief. Pass both to every agent.

Call the Agent tool 4 times in a single message:

1. Description: "Backend architecture" — Prompt: "Design system architecture. DESIGN DOC: [paste]. RESEARCH: [paste tech + risk sections]. Include services, data models, API contracts, database schema. Be specific. Respect tech stack and constraints from the design doc."

2. Description: "Frontend architecture" — Prompt: "Design frontend architecture. DESIGN DOC: [paste]. RESEARCH: [paste user research section]. Include component hierarchy, layout, responsive strategy, state management. Align UX with the user persona from research."

3. Description: "Security architecture" — Prompt: "Security review. DESIGN DOC: [paste]. RESEARCH: [paste risk section]. Cover auth model, input validation, secrets management, threat model. Address any regulatory risks flagged in research."

4. Description: "Implementation blueprint" — Prompt: "Implementation blueprint. DESIGN DOC: [paste]. Include specific files to create/modify, build sequence, dependency order. Scope to MVP boundary from design doc."

After all 4 return, YOU synthesize into one Architecture Document. Save to `docs/plans/architecture.md`.

### Step 2.3 — Metric Loop: Architecture Quality

Run the Metric Loop Protocol (`commands/protocols/metric-loop.md`) on the Architecture Document. Define a metric based on this project — coverage of design doc requirements, specificity, consistency between agents. Max 3 iterations.

### Step 2.4 — Sprint Planning

Follow the Planning Protocol (`commands/protocols/planning.md`). Use 2 sequential Agent tool calls:

Call the Agent tool — description: "Sprint breakdown" — prompt: "Break this architecture into ordered, atomic tasks. Each task needs: description, acceptance criteria, dependencies, size (S/M/L). ARCHITECTURE: [paste]. DESIGN DOC: [paste]. Scope to MVP only."

Then call the Agent tool — description: "Validate task list" — prompt: "Validate this task list: [paste]. Check scope is realistic, no missing tasks, descriptions specific enough for a developer agent to execute, all tasks within MVP boundary."

Save to `docs/plans/sprint-tasks.md`.

### Quality Gate 2

**Autonomous:** Log to `docs/plans/build-log.md`. Proceed.

**Interactive:** Present Architecture + Sprint Task List. Ask: "Approve to start building, or flag changes?" <HARD-GATE>DO NOT PROCEED without user approval.</HARD-GATE>

Update TodoWrite and `.build-state.md`.

---

## Phase 3: Foundation

### Step 3.1 — Scaffolding

Call the Agent tool — description: "Project scaffolding" — mode: "bypassPermissions" — prompt: "Set up the project from this architecture: [paste]. Create directory structure, dependencies, build tooling, linting config, test framework with one passing test, .gitignore, .env.example. Commit: 'feat: initial scaffolding'."

### Step 3.2 — Design System (frontend only)

Call the Agent tool — description: "Design system setup" — mode: "bypassPermissions" — prompt: "Implement design system foundation from this architecture: [paste frontend section]. Create CSS tokens, base layout components, core UI primitives. Commit: 'feat: design system'."

### Step 3.3 — Metric Loop: Scaffold Health

Run the Metric Loop Protocol. Define a metric: builds clean, tests pass, lint clean, structure matches architecture. Max 3 iterations.

Update TodoWrite and state.

---

## Phase 4: Build — Metric-Driven Dev Loops

<HARD-GATE>
Before starting: Phase 2 must be approved, Phase 3 must pass. You MUST call the Agent tool for EVERY task. No exceptions.
</HARD-GATE>

Expand TodoWrite with each sprint task.

**For EACH task:**

### 4.1 — Implement

Call the Agent tool — description: "[task name]" — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. ARCHITECTURE: [relevant section]. DESIGN: [relevant section]. Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built and test results."

Pick the right developer framing: frontend, backend, AI, etc.

### 4.2 — Metric Loop: Task Quality

Run the Metric Loop Protocol on the task implementation. Define a metric based on the task's acceptance criteria. Max 5 iterations.

### 4.3 — Loop Exit

On target met: mark task complete in TodoWrite, report "Task X/N: [name] — COMPLETE (score: [final], iterations: [count])".

On stall or max iterations:
- **Interactive:** present score history + top remaining issue to user.
- **Autonomous:** accept if score >= 60% of target, skip otherwise. Log to `docs/plans/build-log.md`.

After each task: update TodoWrite and `.build-state.md`.

---

## Phase 5: Harden — Metric-Driven Hardening

### Step 5.1 — Initial Audit (4 agents in parallel, ONE message)

Call the Agent tool 4 times in one message:

1. Description: "API testing" — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. Report findings with counts."

2. Description: "Performance audit" — Prompt: "Measure response times, identify bottlenecks, flag performance issues. Report benchmarks."

3. Description: "Accessibility audit" — Prompt: "WCAG compliance audit on all interfaces. Check screen reader, keyboard nav, contrast. Report issues with counts."

4. Description: "Security audit" — Prompt: "Security review: auth, input validation, data exposure, dependency vulnerabilities. Report findings with severity."

### Step 5.2 — Metric Loop: Hardening Quality

Run the Metric Loop Protocol on the full codebase using audit findings as initial input. Define a composite metric based on what this project needs. Max 4 iterations.

When fixing, dispatch to the RIGHT specialist. Security → security agent. Accessibility → frontend agent. Don't send everything to one agent.

### Step 5.3 — Reality Check

Call the Agent tool — description: "Final verdict" — prompt: "You are the Reality Checker. Default: NEEDS WORK. The hardening loop reached score [final_score] after [iterations] iterations. Score history: [paste table]. Review all evidence. Verdict: PRODUCTION READY or NEEDS WORK with specifics."

<HARD-GATE>Do NOT self-approve. Reality Checker must give the verdict.</HARD-GATE>

**Autonomous:** Log verdict to `docs/plans/build-log.md`. Continue.
**Interactive:** Present score history + verdict to user. Update state.

---

## Phase 6: Ship

### Step 6.1 — Documentation

Call the Agent tool — description: "Documentation" — mode: "bypassPermissions" — prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

### Step 6.2 — Metric Loop: Documentation Quality

Run the Metric Loop Protocol on documentation. Define a metric based on completeness and whether a new developer could follow the README. Max 3 iterations.

### Completion Report

Create final commit. Present:

```
BUILD COMPLETE
Project: [name] | Tasks: [done]/[total] | Tests: [count] passing
Agents used: [list] | Verdict: [Reality Checker result]
Metric loops run: [count] | Avg iterations: [N]
Remaining: [any NEEDS WORK items]
```

Mark all TodoWrite items complete. Update `.build-state.md`: "Phase: 6 COMPLETE."
