---
description: "Full product build pipeline — orchestrates specialist agents through brainstorming, research, architecture, implementation, testing, hardening, and shipping"
argument-hint: "Describe what to build, or path to a design doc. --autonomous for unattended mode. --resume to continue a previous build."
---

<HARD-GATE>
YOU ARE AN ORCHESTRATOR. YOU COORDINATE AGENTS. YOU DO NOT WRITE CODE.

Every step below tells you to call the Agent tool. DO IT. Do not role-play as the agent. Do not write implementation code yourself. Do not skip the Agent tool call "because it's faster." If you are typing code instead of calling the Agent tool, STOP — you are violating this process.

"Launch an agent" = call the Agent tool (the actual tool in your toolbar, the one that spawns a subprocess).

For implementation agents, set mode: "bypassPermissions".
For parallel work, put multiple Agent tool calls in ONE message.

Exception: Brainstorming (Phase 1, Step 1.1) is a direct conversation with the user — you ask questions and process answers yourself. This is the ONE phase where you work directly, not through agents.
</HARD-GATE>

### Orchestrator Discipline

Your context window is precious. Protect it.

**You are a DISPATCHER, not a DOER.** Your job is: read state → decide next step → compose agent prompt → dispatch → process result → decide next step.

**Two types of agents — handle their results differently:**

| Agent Type | Examples | What you keep |
|-----------|----------|---------------|
| **Research/analysis** | Market research, tech feasibility, architecture design, audits, measurement | **Full output** — their response IS the deliverable. You need it to synthesize, compare, and make decisions. Save to `docs/plans/` when applicable. |
| **Implementation** | Code writing, fixes, cleanup, verification, scaffolding | **Summary only** — their work product lives in the codebase. Keep: what was done, files changed, test results, pass/fail. Discard: code snippets, full build logs, lint output. |

**After implementation agents return:**
1. Extract: what was built, files changed, test pass/fail, any blockers
2. Record in `docs/plans/.build-state.md` under the current phase
3. The code is in the repo — you don't need it in your context

**After research/analysis agents return:**
1. Read and use the full output — this is your decision-making input
2. Save the output to the appropriate file in `docs/plans/` (research brief, architecture doc, etc.)
3. Once saved to disk, you can reference the file later instead of holding it all in context

**Never do these yourself:**
- Read source code files to understand implementation details — spawn an Explore agent
- Write or edit code — spawn an implementation agent
- Debug failures — spawn a fix agent with the error message

If you catch yourself typing code or reading source files: STOP. You are wasting context. Spawn an agent.

**Dispatch Counter:** Track agent dispatches in `docs/plans/.build-state.md` under `## Dispatch Counter`:
- `dispatches_since_save: [N]`
- `last_save: [Phase.Step]`
Increment after each agent returns (parallel dispatch of 4 agents = +4). Reset to 0 after each compaction save.

Input: $ARGUMENTS

### Autonomous Mode

If the input contains `--autonomous` or `--auto`, this build runs **unattended**. The user will not be present to approve quality gates. In autonomous mode:
- Quality gates auto-approve. Do NOT pause and wait for user input.
- Brainstorming runs in autonomous mode (see protocol).
- Metric loops that stall accept at >= 60% of target, skip below that.
- Log every decision to `docs/plans/build-log.md` so the user can review later.

If `--autonomous` is NOT present, all quality gates require user approval as described below.

When combining `--resume` with `--autonomous`: the current invocation's flags take precedence over saved state. If you resume a previously interactive build with `--autonomous`, it continues in autonomous mode.

### Metric Loop

Every phase uses a **metric-driven iteration loop** to drive quality. Read the full protocol at `commands/protocols/metric-loop.md`. Critical rules (survive compaction):

1. YOU define a metric for this phase based on context (what you're building, what matters). The metric is NOT predefined.
2. Spawn a **measurement agent** to score the artifact 0-100. Read its full output — it's analysis.
3. Pick the ONE highest-impact issue. Spawn a separate **fix agent** with ONLY that issue + file paths.
4. Re-measure. Repeat until: target met, stalled (2 consecutive delta <= 0), or max iterations.
5. Track all scores in `docs/plans/.build-state.md` — this is your lifeline across compaction.

<HARD-GATE>
METRIC LOOP NON-NEGOTIABLES:
- Measurement agent and fix agent are SEPARATE Agent tool calls — never share context (author-bias elimination).
- Fix agent gets ONLY the top issue + file paths + acceptance criteria. NOT the full measurement findings.
- One fix per iteration. Measure impact before fixing the next thing.
- Each measurement is fresh — don't accumulate findings across iterations.
</HARD-GATE>

### Handoff Documents

When spawning agents in sequence (e.g., architect → implementer → reviewer), pass **scoped handoffs** — not the full architecture dump. Each agent receives only what it needs:

1. **Relevant architecture section** — the specific part of architecture.md that applies to this agent's task
2. **Previous agent's output** — what the upstream agent produced (if any)
3. **Acceptance criteria** — what "done" looks like for THIS agent

For implementation agents (Phase 4+): Do NOT paste the entire Design Document or Architecture Document. Extract the relevant sections only. For research and architecture agents (Phases 1-2): pass the full document — these agents need complete context to do their analysis.

### Complexity Routing (Advisory)

When composing agent prompts, prefix with `[COMPLEXITY: S/M/L]` to hint at the appropriate model tier:

| Complexity | Task Types | Preferred Tier |
|-----------|-----------|----------------|
| S | Build-fix, cleanup, lint fix, single-error fix | Haiku-class (fastest) |
| M | Measurement, eval, testing, single-feature impl | Sonnet-class (balanced) |
| L | Architecture, research, multi-file impl, debugging | Opus-class (deepest reasoning) |

For sprint tasks, use the Size field from `docs/plans/sprint-tasks.md`. This is advisory — the tag documents intent for future model routing support.

---

## Phase 0: Context & Pre-Flight

**Resuming?** If the input contains `--resume` OR if context was just compacted (SessionStart hook fired with active state):
1. Read `docs/plans/.build-state.md` — verify it exists and has a Resume Point section.
   If `docs/plans/.build-state.md` does not exist or has no Resume Point, warn the user: 'No previous build state found. Starting fresh.' Then proceed to Step 0.1 as a new build.
2. Re-read this file and all protocol files in `commands/protocols/`.
3. Re-read `docs/plans/sprint-tasks.md`, `docs/plans/architecture.md`, and `CLAUDE.md`.
4. Rebuild TodoWrite from the state file (TodoWrite does NOT survive compaction or session breaks).
5. Reset `dispatches_since_save` to 0 (fresh context window).
6. Resume from the saved phase and step. Skip Phase 0.

### Step 0.1 — Read the Room

Before doing anything, scan for existing context:

- Check if the input is a file path (e.g., `docs/plans/brainstorm.md`). If so, read it.
- Check if `docs/plans/` or `docs/briefs/` exist with prior brainstorming, design docs, decision briefs, or research. Read them.
- Check if there's existing code in the project. If so, this is an enhancement, not greenfield.
- Check the conversation history — has the user been discussing this idea already?
- Check if `docs/plans/learnings.md` exists from a previous build. If so, read it. Apply relevant PATTERNS to agent prompt design, avoid listed PITFALLs, use HEURISTICS when applicable.

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

0. Create `docs/plans/` directory if it doesn't exist (greenfield projects won't have it).
1. Create a TodoWrite checklist with Phases 0-6.
2. Create `docs/plans/.build-state.md` as a single write with ALL of the following: phase and step (`Phase: 0 — Starting`), input (`[build request]`), context level (`[classification]`), prerequisites (`[status]`), dispatch counter (`dispatches_since_save: 0, last_save: Phase 0`), and a `## Resume Point` section with: phase, step, autonomous mode flag, completed tasks (none), git branch name.
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

Update TodoWrite and `docs/plans/.build-state.md`.

**Compaction checkpoint:** Check `dispatches_since_save` in `docs/plans/.build-state.md`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.md`. Reset `dispatches_since_save` to 0. TodoWrite does NOT survive compaction — rebuild it from this state file on resume.

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

Update TodoWrite and `docs/plans/.build-state.md`.

**Compaction checkpoint:** Check `dispatches_since_save` in `docs/plans/.build-state.md`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.md`. Reset `dispatches_since_save` to 0. TodoWrite does NOT survive compaction — rebuild it from this state file on resume.

---

## Phase 3: Foundation

### Step 3.1 — Scaffolding

Call the Agent tool — description: "Project scaffolding" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Set up the project from this architecture: [paste]. Create directory structure, dependencies, build tooling, linting config, test framework with one passing test, .gitignore, .env.example. Commit: 'feat: initial scaffolding'."

### Step 3.2 — Design System (frontend only)

Call the Agent tool — description: "Design system setup" — mode: "bypassPermissions" — prompt: "Implement design system foundation from this architecture: [paste frontend section]. Create CSS tokens, base layout components, core UI primitives. Commit: 'feat: design system'."

### Step 3.3 — Metric Loop: Scaffold Health

Run the Metric Loop Protocol. Define a metric: builds clean, tests pass, lint clean, structure matches architecture. Max 3 iterations.

### Step 3.4 — Verification Gate

Run the Verification Protocol (`commands/protocols/verify.md`). Critical rules (survive compaction):
- ONE agent runs all 6 checks sequentially: Build → Type-Check → Lint → Test → Security → Diff Review. Stop on first FAIL.
- Agent auto-detects stack from manifest files (package.json → Node, go.mod → Go, etc.).
- On FAIL: for build/type/lint errors, use the Build-Fix Protocol (`commands/protocols/build-fix.md`) — fixes one error at a time with cascade detection. For test/security/diff failures, spawn a targeted fix agent. Re-verify. Max 3 fix attempts.
- On PASS: log `VERIFY: PASS (6/6)` to `docs/plans/.build-state.md`. Proceed.

Call the Agent tool — description: "Verify scaffolding" — mode: "bypassPermissions" — prompt: "Run the Verification Protocol. Execute all 6 checks sequentially, stop on first failure. Report: VERIFY: PASS or VERIFY: FAIL with details."

Do not proceed to Phase 4 until verification passes.

Update TodoWrite and state.

**Compaction checkpoint:** Check `dispatches_since_save` in `docs/plans/.build-state.md`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.md`. Reset `dispatches_since_save` to 0. TodoWrite does NOT survive compaction — rebuild it from this state file on resume.

---

## Phase 4: Build — Metric-Driven Dev Loops

<HARD-GATE>
Before starting: Phase 2 must be approved, Phase 3 must pass. You MUST call the Agent tool for EVERY task. No exceptions.
</HARD-GATE>

Expand TodoWrite with each sprint task.

**For EACH task:**

### Step 4.1 — Implement

Call the Agent tool — description: "[task name]" — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. HANDOFF — Architecture section: [paste ONLY the relevant section from architecture.md]. Design section: [paste ONLY the relevant section from the design doc]. Previous task output: [what the last completed task produced, if relevant]. Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

Pick the right developer framing: frontend, backend, AI, etc. Set `[COMPLEXITY: S/M/L]` based on the task's Size from sprint-tasks.md.

### Step 4.1b — Cleanup (De-Sloppify)

Follow the Cleanup Protocol (`commands/protocols/cleanup.md`). Critical rules (survive compaction):
[COMPLEXITY: S]
- Skip if trivial (< 20 lines, single file).
- Cleanup agent is a SEPARATE agent from the implementer — no cleaning your own mess.
- Scope is sacred: ONLY files from the implementation changeset. Zero exceptions.
- Cleanup fixes: naming, dead code, unused imports, style, DRY. Does NOT: add features, change architecture, touch other files.
- If cleanup breaks acceptance criteria, revert and skip. Never block the metric loop on cleanup failure.

Call the Agent tool — description: "Cleanup [task name]" — mode: "bypassPermissions" — with the list of files changed and the task's acceptance criteria.

### Step 4.2 — Metric Loop: Task Quality

Run the Metric Loop Protocol on the task implementation. Define a metric based on the task's acceptance criteria. Max 5 iterations.

### Step 4.3 — Loop Exit

On target met: mark task complete in TodoWrite, report "Task X/N: [name] — COMPLETE (score: [final], iterations: [count])".

On stall or max iterations:
- **Interactive:** present score history + top remaining issue to user.
- **Autonomous:** accept if score >= 60% of target, skip otherwise. Log to `docs/plans/build-log.md`.

After each task: update TodoWrite and `docs/plans/.build-state.md`.

### Step 4.4 — Post-Task Verification

Run the Verification Protocol (`commands/protocols/verify.md`) to catch regressions. If FAIL, fix before starting the next task.

**Compaction checkpoint:** Check `dispatches_since_save` in `docs/plans/.build-state.md`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.md`. Reset `dispatches_since_save` to 0. TodoWrite does NOT survive compaction — rebuild it from this state file on resume.

---

## Phase 5: Harden — Metric-Driven Hardening

### Step 5.0 — Pre-Hardening Verification

Run the Verification Protocol (`commands/protocols/verify.md`). ONE agent, 6 sequential checks (Build → Type → Lint → Test → Security → Diff), stop on first FAIL. Max 3 fix attempts. All checks must pass before starting expensive audit agents — do not waste audit agents on code that doesn't build or pass tests.

### Step 5.1 — Initial Audit (4 agents in parallel, ONE message)

Call the Agent tool 4 times in one message:

1. Description: "API testing" — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. Report findings with counts."

2. Description: "Performance audit" — Prompt: "Measure response times, identify bottlenecks, flag performance issues. Report benchmarks."

3. Description: "Accessibility audit" — Prompt: "WCAG compliance audit on all interfaces. Check screen reader, keyboard nav, contrast. Report issues with counts."

4. Description: "Security audit" — Prompt: "Security review: auth, input validation, data exposure, dependency vulnerabilities. Report findings with severity."

### Step 5.1b — Eval Harness

Run the Eval Harness Protocol (`commands/protocols/eval-harness.md`). Define 8-15 concrete, executable eval cases from the audit findings and architecture doc. Run the eval agent. Record baseline pass rate. CRITICAL and HIGH failures feed into the metric loop in Step 5.2 as specific issues to fix.

### Step 5.2 — Metric Loop: Hardening Quality

Run the Metric Loop Protocol on the full codebase using audit findings as initial input. Define a composite metric based on what this project needs. Max 4 iterations.

When fixing, dispatch to the RIGHT specialist. Security → security agent. Accessibility → frontend agent. Don't send everything to one agent.

### Step 5.2b — Eval Re-run

Re-run the Eval Harness after the metric loop exits. All CRITICAL eval cases must now pass. If any CRITICAL case still fails, include it as evidence for the Reality Checker.

### Step 5.3 — Reality Check

Call the Agent tool — description: "Final verdict" — prompt: "You are the Reality Checker. Default: NEEDS WORK. The hardening loop reached score [final_score] after [iterations] iterations. Score history: [paste table]. Review all evidence. Eval harness results: [baseline pass rate] → [final pass rate]. CRITICAL failures remaining: [list or none]. Verdict: PRODUCTION READY or NEEDS WORK with specifics."

<HARD-GATE>Do NOT self-approve. Reality Checker must give the verdict.</HARD-GATE>

**Autonomous:** Log verdict to `docs/plans/build-log.md`. Continue.
**Interactive:** Present score history + verdict to user. Update state.

**Compaction checkpoint:** Check `dispatches_since_save` in `docs/plans/.build-state.md`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.md`. Reset `dispatches_since_save` to 0. TodoWrite does NOT survive compaction — rebuild it from this state file on resume.

---

## Phase 6: Ship

### Step 6.0 — Pre-Ship Verification

Final verification gate. Run the Verification Protocol (`commands/protocols/verify.md`). ONE agent, 6 sequential checks (Build → Type → Lint → Test → Security → Diff), stop on first FAIL. Max 3 fix attempts. All checks must pass before documenting and shipping. If FAIL persists, return to Phase 5 for targeted fixes.

### Step 6.1 — Documentation

Call the Agent tool — description: "Documentation" — mode: "bypassPermissions" — prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

### Step 6.2 — Metric Loop: Documentation Quality

Run the Metric Loop Protocol on documentation. Define a metric based on completeness and whether a new developer could follow the README. Max 3 iterations.

### Step 6.3 — Record Learnings

Append to `docs/plans/learnings.md` (create if it doesn't exist). Review the build and record 3-5 learnings:

- **PATTERN:** [what worked well and should be repeated in future builds]
- **PITFALL:** [what failed, caused waste, or required excessive iterations]
- **HEURISTIC:** [project-specific tuning discovered during this build]

Base learnings on: metric loop stall patterns, build-fix frequency, phases that exceeded expected iterations, agent prompts that needed rework.

### Completion Report

Create final commit. Present:

```
BUILD COMPLETE
Project: [name] | Tasks: [done]/[total] | Tests: [count] passing
Agents used: [list] | Verdict: [Reality Checker result]
Metric loops run: [count] | Avg iterations: [N]
Remaining: [any NEEDS WORK items]
```

Mark all TodoWrite items complete. Update `docs/plans/.build-state.md`: "Phase: 6 COMPLETE."
