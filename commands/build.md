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

**Compaction checkpoint format:** At every phase boundary, check `dispatches_since_save` in `docs/plans/.build-state.md`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.md`. Reset `dispatches_since_save` to 0. TodoWrite does NOT survive compaction — rebuild it from this state file on resume.

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

Every phase uses a **metric-driven iteration loop** to drive quality. Read the full protocol at `protocols/metric-loop.md`. Critical rules (survive compaction):

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

For implementation agents (Phase 5+): Do NOT paste the entire Design Document or Architecture Document. Extract the relevant sections only. For research and architecture agents (Phases 1-2): pass the full document — these agents need complete context to do their analysis.

### Complexity Routing (Advisory)

Tag agent prompts with `[COMPLEXITY: S/M/L]` based on task size from `docs/plans/sprint-tasks.md`. This is advisory — the tag documents intent for future model routing support.

---

## Phase 0: Context & Pre-Flight

**Resuming?** If the input contains `--resume` OR if context was just compacted (SessionStart hook fired with active state):
1. Read `docs/plans/.build-state.md` — verify it exists and has a Resume Point section.
   If `docs/plans/.build-state.md` does not exist or has no Resume Point, warn the user: 'No previous build state found. Starting fresh.' Then proceed to Step 0.1 as a new build.
2. Re-read this file and all protocol files in `protocols/`.
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
1. Create a TodoWrite checklist with Phases 0-7.
2. Create `docs/plans/.build-state.md` as a single write with ALL of the following: phase and step (`Phase: 0 — Starting`), input (`[build request]`), context level (`[classification]`), prerequisites (`[status]`), dispatch counter (`dispatches_since_save: 0, last_save: Phase 0`), and a `## Resume Point` section with: phase, step, autonomous mode flag, completed tasks (none), git branch name.
3. Go to Phase 1 (or Phase 2 if context level is "Full design").

---

## Phase 1: Brainstorm & Research

**Goal**: Turn the raw idea into a validated Design Document grounded in research. This ensures Phase 2 architects receive a design, not a guess.

**Skip if** Step 0.1 classified context as "Full design" — go straight to Phase 2.

### Step 1.1 — Brainstorming

Follow the Brainstorm Protocol (`protocols/brainstorm.md`).

In interactive mode: this is a conversation. Ask questions one at a time, propose approaches with trade-offs, let the user decide. Output: Design Document saved to `docs/plans/`.

In autonomous mode: synthesize a design document directly using the build request and available context. Pick pragmatic defaults. Log rationale to `docs/plans/build-log.md`.

### Step 1.2 — Parallel Research (5 agents, ONE message)

Skip if context level is "Decision brief" (research already done).

Call the Agent tool 5 times in a single message. Pass each agent the build request AND the Design Document draft.

1. Description: "Market research" — Prompt: "Research market size (TAM/SAM/SOM), competitive landscape (5-10 players), timing, and market structure for: [build request]. Design context: [paste design doc]. Report with a Market Verdict: GREEN/AMBER/RED."

2. Description: "Tech feasibility" — Prompt: "Evaluate hard technical problems (Solved/Hard/Unsolved), build-vs-buy decisions, MVP scope, and stack validation for: [build request]. Design context: [paste design doc]. Verify APIs and libraries from the design exist and are maintained. Report with a Technical Verdict."

3. Description: "User research" — Prompt: "Analyze target persona, jobs-to-be-done, current alternatives, and behavioral barriers to adoption for: [build request]. Design context: [paste design doc]. Report with a User Verdict."

4. Description: "Business model" — Prompt: "Evaluate revenue models, unit economics, growth loops, and first-1000-users strategy for: [build request]. Design context: [paste design doc]. Report with a Business Verdict."

5. Description: "Risk analysis" — Prompt: "Adversarial review: regulatory risk, security concerns, dependency risks, competitive response, top 3 failure modes for: [build request]. Design context: [paste design doc]. Report with a Risk Verdict."

After all 5 return, synthesize a **Research Brief** with a verdict table. Save to `docs/plans/research-brief.md`.

### Step 1.3 — Design Refinement

Read the Design Document and Research Brief together. Check for contradictions:

- Tech-feasibility flagged "Unsolved" hard problem → simplify or flag as risk
- Risk-analysis returned RED → add mitigation or descope
- User-research says "no validated demand" → flag as pivot point
- Business-model says "no moat" → note for speed-to-market priority

Update the Design Document with corrections. Save final version.

### Step 1.4 — Write CLAUDE.md

Create (or overwrite) the project's `CLAUDE.md`. This is the product brain — every agent spawned during the build reads it automatically. Write it from the Design Document and Research Brief. It must give any agent enough context to make smart product, UX, and technical decisions without needing the full design doc.

<HARD-GATE>
CLAUDE.md must be under 200 lines. It is not a wiki, not a conventions doc, not a dump of everything you know. It is the minimum context an agent needs to make correct decisions about this specific product.
</HARD-GATE>

Structure:

```
## Product
[1-3 sentences: what this is, core value prop, what success looks like]

## User
[Primary persona: who they are, what they care about, pain points,
technical sophistication. This drives every UX decision.]

## Tech Stack
[Stack choices with 1-line rationale for each. Framework, DB, auth,
key libraries, deployment target.]

## Scope
[What's in MVP vs. deferred. Hard boundaries. This prevents agents
from building features that aren't scoped.]

## Rules
[Project-specific hard rules derived from the product and user context.
Examples: "All data must be real-time — no simulated/fake data",
"User must be able to pause/stop any automated process at any time",
"Every interactive element must have visible feedback within 200ms".
Only include rules this specific project needs — not generic best practices.]
```

Keep it product-focused. An implementation agent reading this should understand WHO the user is and WHAT matters enough to make the right call when the handoff prompt doesn't cover an edge case.

### Quality Gate 1

**Autonomous:** Log design and research paths to `docs/plans/build-log.md`. If 2+ RED verdicts, log warning. Proceed.

**Interactive:** Present Design Document summary + Research Brief verdict table. Ask: "Approve this design, or want to adjust?" <HARD-GATE>DO NOT PROCEED without user approval.</HARD-GATE>

Update TodoWrite and `docs/plans/.build-state.md`.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

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

Run the Metric Loop Protocol (`protocols/metric-loop.md`) on the Architecture Document. Define a metric based on: coverage of design doc requirements, specificity, consistency between agents, and **simplicity** — is this the simplest architecture that meets the requirements? Could any service, abstraction, or dependency be eliminated without losing functionality? Penalize over-engineering (microservices for a simple app, Kubernetes for a static site, complex state management for a 3-page app). Max 3 iterations.

### Step 2.4 — Sprint Planning

Follow the Planning Protocol (`protocols/planning.md`). Use 2 sequential Agent tool calls:

Call the Agent tool — description: "Sprint breakdown" — prompt: "Break this architecture into ordered, atomic tasks. Each task needs: description, acceptance criteria, dependencies, size (S/M/L). Include a `**Behavioral Test:**` field for every task that has UI — a concrete interaction test: 'Navigate to [page], click [element], verify [expected outcome]'. API-only tasks should have curl-based acceptance tests instead. ARCHITECTURE: [paste]. DESIGN DOC: [paste]. Scope to MVP only."

Then call the Agent tool — description: "Validate task list" — prompt: "Validate this task list: [paste]. Check scope is realistic, no missing tasks, descriptions specific enough for a developer agent to execute, all tasks within MVP boundary."

Save to `docs/plans/sprint-tasks.md`.

### Quality Gate 2

**Autonomous:** Log to `docs/plans/build-log.md`. Proceed.

**Interactive:** Present Architecture + Sprint Task List. Ask: "Approve to start building, or flag changes?" <HARD-GATE>DO NOT PROCEED without user approval.</HARD-GATE>

Update TodoWrite and `docs/plans/.build-state.md`.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 3: Design & Visual Identity

**Goal**: Transform architecture into a research-backed visual design system, proven with Playwright screenshots. Fully autonomous — agents research, decide, and iterate without user input.

**Skip if** the project has no user-facing frontend (CLI tools, pure APIs, backend services).

<HARD-GATE>
UI/UX IS THE PRODUCT. This phase is a full peer to Architecture and Build — not a footnote, not an afterthought, not a "nice to have." Do NOT skip, compress, or rush this phase for any reason. The agents must research real competitors and award-winning sites, make deliberate visual choices backed by that research, build a living style guide with every component rendered and interactive, and iterate with Playwright-verified visual QA before a single line of product code is written.

Phase 4 (Foundation) WILL NOT START without `docs/plans/visual-design-spec.md`. If it does not exist, return here.
</HARD-GATE>

### Step 3.1 — Design Research (2 agents, parallel, both use Playwright)

Follow the Design Protocol (`protocols/design.md`), Step 3.1.

Call the Agent tool 2 times in one message:

1. Description: "Competitive visual audit" — Prompt: "Research the top 5-8 competitors/analogues for: [product description]. Use Playwright to screenshot each site (desktop 1920x1080 + mobile 375x812). Screenshot standout components (hero, cards, forms, nav, CTAs). Save to docs/plans/design-references/competitors/. Analyze visual language: colors, typography, spacing, what feels premium vs cheap. Rank by visual quality. DESIGN DOC: [paste]."

2. Description: "Design inspiration mining" — Prompt: "Search Awwwards.com, Godly.website, SiteInspire for award-winning sites in category: [product category]. Use Playwright to screenshot top 5-8 results + standout components. Save to docs/plans/design-references/inspiration/. Identify visual trends, what separates best-in-class from generic. DESIGN DOC: [paste]."

After both return, synthesize a **Design Research Brief** to `docs/plans/design-research.md`. Include all screenshot paths.

### Step 3.2 — Design Direction (2 agents, sequential)

Follow the Design Protocol (`protocols/design.md`), Step 3.2.

1. Call the Agent tool — description: "UX architecture" — Prompt: "Create structural design foundation. INPUTS: frontend architecture section from architecture.md [paste], Design Research Brief [paste], reference screenshot paths [list], user persona [paste]. OUTPUT: information architecture, layout strategy, component hierarchy, responsive approach, interaction patterns. Base decisions on competitive research, not generic patterns."

2. Call the Agent tool — description: "Visual design spec" — Prompt: "Create the Visual Design Spec with AUTONOMOUS decisions — pick the single best direction, do not present options. INPUTS: UX foundation [paste previous output], Design Research Brief [paste], reference screenshot paths [list], user persona [paste]. OUTPUT: color system (with hex, light+dark), typography (Google Fonts, mathematical scale), 8px spacing system, tinted shadow system, border radius, animation/motion, component styles with ALL states. Every choice must cite the research. Apply anti-AI-template rules from the Design Protocol. Save to docs/plans/visual-design-spec.md."

### Step 3.3 — Living Style Guide (1 implementation agent)

Follow the Design Protocol (`protocols/design.md`), Step 3.3.

Call the Agent tool — description: "Build living style guide" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: L] Build a living style guide page (/design-system route or standalone HTML). INPUTS: Visual Design Spec [paste], UX foundation [paste relevant sections], reference screenshots [list paths — these are your quality targets]. Must include rendered, interactive examples of: color swatches, typography scale, spacing scale, buttons (all states), form elements (all states), cards, navigation, feedback components (alerts, toasts, spinners, empty states), modals/overlays, and layout grid examples. Every component interactive (hover, focus, transitions work). Mobile-responsive. This ships with the product. Commit: 'feat: living style guide'."

### Step 3.4 — Visual QA Loop (Playwright + Metric Loop)

Run the Metric Loop Protocol (`protocols/metric-loop.md`) using the measurement criteria from the Design Protocol (`protocols/design.md`, Step 3.4).

Measurement: Playwright screenshots of the living style guide sections (desktop + mobile). Design critic agent scores 0-100 across 6 dimensions: spacing/alignment, typography hierarchy, color harmony, component polish, responsive quality, originality (anti-AI-template check). Receives screenshots + Visual Design Spec + reference screenshots.

**Target: 80. Max 5 iterations.** On stall: accept if >= 65, log warning below 65.

### Step 3.5 — Autonomous Quality Gate

Log to `docs/plans/build-log.md`: final screenshot paths, score history table, design decisions, originality score. No user pause. Proceed to Phase 4.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 4: Foundation

<HARD-GATE>
Before starting Phase 4: Phase 2 must be approved AND Phase 3 must have produced `docs/plans/visual-design-spec.md`.
If visual-design-spec.md does not exist, DO NOT PROCEED. Return to Phase 3.
Step 4.2 (Design System) MUST implement from visual-design-spec.md — not generic architecture tokens.
</HARD-GATE>

### Step 4.1 — Scaffolding

Call the Agent tool — description: "Project scaffolding" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Set up the project from this architecture: [paste]. Create directory structure, dependencies, build tooling, linting config, test framework with one passing test, .gitignore, .env.example. Commit: 'feat: initial scaffolding'."

### Step 4.2 — Design System (frontend only)

Call the Agent tool — description: "Design system setup" — mode: "bypassPermissions" — prompt: "Implement the design system from the Visual Design Spec: [paste from docs/plans/visual-design-spec.md]. Create CSS tokens matching the spec's color system, typography scale, spacing system, shadow/elevation tokens, and base layout components. The living style guide from Phase 3 is the reference implementation — components must match. Commit: 'feat: design system'."

### Step 4.2b — Acceptance Test Scaffolding

Call the Agent tool — description: "Scaffold acceptance tests" — mode: "bypassPermissions" — prompt: "Read docs/plans/sprint-tasks.md. For every task with a Behavioral Test field, create a Playwright test stub in tests/e2e/acceptance/. Use Page Object Model. Each test should: navigate to the page, perform the interaction, assert the expected outcome. Tests should FAIL right now (features aren't built yet) — that's correct. Also ensure agent-browser is available (run `which agent-browser`). Commit: 'test: scaffold acceptance tests from sprint tasks'."

### Step 4.3 — Metric Loop: Scaffold Health

Run the Metric Loop Protocol. Define a metric: builds clean, tests pass, lint clean, structure matches architecture. Max 3 iterations.

### Step 4.4 — Verification Gate

Run the Verification Protocol (`protocols/verify.md`). Critical rules (survive compaction):
- ONE agent runs all 6 checks sequentially: Build → Type-Check → Lint → Test → Security → Diff Review. Stop on first FAIL.
- Agent auto-detects stack from manifest files (package.json → Node, go.mod → Go, etc.).
- On FAIL: for build/type/lint errors, use the Build-Fix Protocol (`protocols/build-fix.md`) — fixes one error at a time with cascade detection. For test/security/diff failures, spawn a targeted fix agent. Re-verify. Max 3 fix attempts.
- On PASS: log `VERIFY: PASS (6/6)` to `docs/plans/.build-state.md`. Proceed.

Call the Agent tool — description: "Verify scaffolding" — mode: "bypassPermissions" — prompt: "Run the Verification Protocol. Execute all 6 checks sequentially, stop on first failure. Report: VERIFY: PASS or VERIFY: FAIL with details."

Do not proceed to Phase 5 until verification passes.

Update TodoWrite and state.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 5: Build — Metric-Driven Dev Loops

<HARD-GATE>
Before starting: Phase 2 must be approved, Phase 3 must produce docs/plans/visual-design-spec.md, Phase 4 must pass. You MUST call the Agent tool for EVERY task. No exceptions.
</HARD-GATE>

Expand TodoWrite with each sprint task.

**For EACH task:**

### Step 5.1 — Implement

Call the Agent tool — description: "[task name]" — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. HANDOFF — Architecture section: [paste ONLY the relevant section from architecture.md]. Design section: [paste ONLY the relevant section from the design doc]. Previous task output: [what the last completed task produced, if relevant]. For UI tasks: the living style guide at /design-system shows every component's exact styling and states — match it. Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

Pick the right developer framing: frontend, backend, AI, etc. Set `[COMPLEXITY: S/M/L]` based on the task's Size from sprint-tasks.md.

### Step 5.1b — Cleanup (De-Sloppify)

Follow the Cleanup Protocol (`protocols/cleanup.md`). Critical rules (survive compaction):
[COMPLEXITY: S]
- Skip if trivial (< 20 lines, single file).
- Cleanup agent is a SEPARATE agent from the implementer — no cleaning your own mess.
- Scope is sacred: ONLY files from the implementation changeset. Zero exceptions.
- Cleanup fixes: naming, dead code, unused imports, style, DRY. Does NOT: add features, change architecture, touch other files.
- If cleanup breaks acceptance criteria, revert and skip. Never block the metric loop on cleanup failure.

Call the Agent tool — description: "Cleanup [task name]" — mode: "bypassPermissions" — with the list of files changed and the task's acceptance criteria.

### Step 5.2 — Metric Loop: Task Quality

Run the Metric Loop Protocol on the task implementation. Define a metric based on the task's acceptance criteria. For UI-facing tasks, include behavioral verification: the measurement agent should use agent-browser to verify the feature renders and responds to interaction, not just read the code. Max 5 iterations.

### Step 5.3 — Loop Exit

On target met: mark task complete in TodoWrite, report "Task X/N: [name] — COMPLETE (score: [final], iterations: [count])".

On stall or max iterations:
- **Interactive:** present score history + top remaining issue to user.
- **Autonomous:** accept if score >= 60% of target, skip otherwise. Log to `docs/plans/build-log.md`.

After each task: update TodoWrite and `docs/plans/.build-state.md`.

### Step 5.3b — Behavioral Smoke Test

Skip if this task has no Behavioral Test criteria (API-only, config, infrastructure tasks).

Run the Smoke Test Protocol (`protocols/smoke-test.md`). This uses agent-browser to open the app, execute the task's behavioral acceptance criteria, and verify the feature actually works.

Evidence saved to `docs/plans/evidence/[task-name]/`: annotated screenshot, snapshot diff, error log, network log, HAR file.

On FAIL: spawn fix agent with the evidence. The fix agent receives: what was expected (from acceptance criteria), what actually happened (snapshot diff + errors + screenshot), and the relevant source files. Max 2 fix-and-retest cycles.

On PASS: proceed to Step 5.4.

### Step 5.4 — Post-Task Verification

Run the Verification Protocol (`protocols/verify.md`). If FAIL, fix before starting the next task.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 6: Harden — Metric-Driven Hardening

### Step 6.0 — Pre-Hardening Verification

Run the Verification Protocol (`protocols/verify.md`). All checks must pass before starting expensive audit agents.

### Step 6.1 — Initial Audit (5 agents in parallel, ONE message)

Read the NFRs from `docs/plans/sprint-tasks.md`. Pass the relevant NFR thresholds to each audit agent so they have concrete targets, not generic checks.

Call the Agent tool 5 times in one message:

1. Description: "API testing" — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. NFR targets: [paste performance and reliability NFRs]. Report findings with counts."

2. Description: "Performance audit" — Prompt: "Measure response times, identify bottlenecks, flag performance issues. NFR targets: [paste performance NFRs — e.g., API < 200ms, page load < 3s]. Report benchmarks AGAINST these targets."

3. Description: "Accessibility audit" — Prompt: "WCAG compliance audit on all interfaces. NFR target: [paste accessibility NFR — e.g., WCAG AA]. Check screen reader, keyboard nav, contrast. Report issues with counts."

4. Description: "Security audit" — Prompt: "Security review: auth, input validation, data exposure, dependency vulnerabilities. NFR targets: [paste security NFRs]. Report findings with severity."

5. Description: "UX quality audit" — Prompt: "UX quality review of every user-facing page. NFR targets: [paste accessibility NFRs]. First, screenshot the living style guide at /design-system as your reference for how components should look. Then review every product page and check: loading states (every async action must show a loading indicator), error states (every form and API call must show user-friendly error feedback), empty states (every list/table must handle zero items gracefully), mobile responsiveness (test at 375px viewport — touch targets >= 44px, no horizontal scroll, readable text), form validation (inline feedback, not just alert()), transition smoothness (no layout shifts, no janky animations), visual consistency (compare each page's components against the style guide — buttons, inputs, cards, colors, spacing should match). Report issues with page, severity, and screenshot."

### Step 6.1b — Eval Harness

Run the Eval Harness Protocol (`protocols/eval-harness.md`). Define 8-15 concrete, executable eval cases from the audit findings and architecture doc. For UI flows, eval cases should use agent-browser: "agent-browser open /dashboard -> agent-browser click @submit -> agent-browser wait --text Success -> expect text contains confirmation ID". Run the eval agent. Record baseline pass rate. CRITICAL and HIGH failures feed into the metric loop in Step 6.2 as specific issues to fix.

### Step 6.2 — Metric Loop: Hardening Quality

Run the Metric Loop Protocol on the full codebase using audit findings as initial input. Define a composite metric based on what this project needs. Max 4 iterations.

When fixing, dispatch to the RIGHT specialist. Security → security agent. Accessibility → frontend agent. Don't send everything to one agent.

### Step 6.2b — Eval Re-run

Re-run the Eval Harness after the metric loop exits. All CRITICAL eval cases must now pass. If any CRITICAL case still fails, include it as evidence for the Reality Checker.

### Step 6.2c — E2E Testing (3 mandatory iterations)

<HARD-GATE>
ALL 3 ITERATIONS ARE MANDATORY. Do NOT stop after iteration 1 even if all tests pass. The purpose of 3 runs is to catch flaky tests, timing-dependent failures, and race conditions that only surface on repeated execution. Skip this step ONLY if the project has no user-facing frontend.
</HARD-GATE>

Generate and execute end-to-end tests using Playwright against the running application. Tests cover the **User Journeys** defined in `docs/plans/sprint-tasks.md` (Step 0 of the Planning Protocol). Each journey = one E2E test file.

**Iteration 1 — Generate & Run:**

Call the Agent tool — description: "E2E test generation" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: L] Generate and run end-to-end Playwright tests for this application.

INPUTS:
- User Journeys from docs/plans/sprint-tasks.md: [paste the User Journeys section — each journey becomes one E2E test]
- Architecture doc (API contracts): [paste relevant sections from docs/plans/architecture.md]
- NFRs from docs/plans/sprint-tasks.md: [paste — use performance thresholds as test assertions]
- Visual Design Spec (component selectors): [paste relevant sections from docs/plans/visual-design-spec.md]

REQUIREMENTS:
1. One E2E test per User Journey from sprint-tasks.md (each journey = one test file covering the full flow)
2. Use Page Object Model pattern — one page object per major view
3. Use data-testid selectors (add them to components if missing)
4. Wait for API responses, NEVER use arbitrary timeouts (no waitForTimeout)
5. Capture screenshots at critical verification points
6. Configure multi-browser: Chromium + Firefox + WebKit
7. Set up playwright.config.ts with: fullyParallel, retries: 0 (we handle retries ourselves), screenshot: 'only-on-failure', video: 'retain-on-failure', trace: 'on-first-retry'
8. Run all tests. Report: total, passed, failed, with failure details and screenshot paths.
9. Commit: 'test: e2e test suite for critical user journeys'

Test priority:
- CRITICAL: Auth, core feature happy path, data submission, payment/transaction flows
- HIGH: Search, filtering, navigation, error states
- MEDIUM: Responsive layout, animations, edge cases"

Record results: total tests, pass count, fail count, failure details. Log to `docs/plans/.build-state.md` under `## E2E Testing`:

```
| Iter | Total | Passed | Failed | Flaky | Top Failure |
|------|-------|--------|--------|-------|-------------|
| 1    | ...   | ...    | ...    | ...   | ...         |
```

**Iteration 2 — Fix & Re-run:**

Call the Agent tool — description: "E2E fix iteration 2" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Fix E2E test failures from iteration 1: [paste failure details — test names, error messages, screenshot paths]. Diagnose each as real bug, flaky test, or missing selector. Fix accordingly — do NOT delete or skip tests. Re-run ALL tests. Commit: 'fix: e2e test failures iteration 2'."

Record results in the E2E table. Identify flaky candidates (passed iter 1, failed iter 2 or vice versa).

**Iteration 3 — Final Stability Run:**

Call the Agent tool — description: "E2E stability run" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Final E2E stability run (3 of 3). Previous results — Iter 1: [pass/fail counts], Iter 2: [pass/fail counts], Flaky candidates: [list]. Run ALL tests with --repeat-each=3. Quarantine inconsistent tests with test.fixme(). Fix remaining consistent failures. PASS CRITERIA: 95%+ pass rate (quarantined flaky tests excluded but logged). Commit: 'test: e2e stability fixes iteration 3'."

Record final results. Include in Reality Checker evidence.

### Step 6.2d — Autonomous Dogfooding

Run the agent-browser dogfood skill against the running app. Unlike the per-task smoke tests (which verify specific acceptance criteria), dogfooding is **exploratory** — it autonomously navigates every reachable page, clicks buttons, fills forms, checks console errors, and finds issues we didn't think to test.

Start the dev server if not running. Then invoke the dogfood skill:

Call the Agent tool — description: "Dogfood the app" — mode: "bypassPermissions" — prompt: "Run the agent-browser dogfood skill against the running app at http://localhost:[port]. Explore every reachable page. Click every button. Fill every form. Check console for errors. Report a structured list of issues with severity ratings (critical/high/medium/low), screenshots, and repro steps. If dogfood skill is not available, use agent-browser manually: snapshot each page, click all interactive elements, check errors and network requests. Also evaluate UX quality: missing loading states, poor error messages, broken mobile layouts (resize to 375px), visual inconsistencies, missing empty states, form validation gaps. Report UX issues separately from functional issues."

**Fix loop:** For each CRITICAL or HIGH issue found:
1. Classify: is this a code bug (fix in Phase 5 style — spawn implementation fix agent) or a structural problem (needs architecture change — spawn architect agent to propose a fix plan, then implementation agent to execute)?
2. Spawn the appropriate fix agent with: the issue description, repro steps, screenshot, affected page/component.
3. After fixes, re-run dogfood on the affected pages only (not the full app). If new CRITICAL/HIGH issues appear, repeat. Max 3 fix cycles.

MEDIUM/LOW issues: log to `docs/plans/build-log.md` for the Reality Checker.

### Step 6.2e — Fake Data Detector

Call the Agent tool — description: "Fake data audit" — mode: "bypassPermissions" — prompt: "Run the Fake Data Detector Protocol (protocols/fake-data-detector.md). Check for mock/hardcoded data in production paths. Static analysis: grep for Math.random() business data, hardcoded API responses, setTimeout faking async, placeholder text. Dynamic analysis: inspect HAR files from docs/plans/evidence/ for missing real API calls, static responses, absent WebSocket traffic. Report findings with file:line references and severity."

**Fix loop:** For each CRITICAL finding:
1. Spawn a fix agent with: the finding (file:line, what's fake, what it should be), and the relevant source files.
2. The fix agent replaces fake data with real API calls, real WebSocket connections, real data sources. If real data sources aren't available (missing API keys, no backend), the fix agent must flag this as a blocker — not paper over it with better-looking fake data.
3. After fixes, re-run the fake data detector (static checks only — fast). Max 2 fix cycles.

Remaining findings feed into the Reality Checker in Step 6.4.

### Step 6.4 — Reality Check

Call the Agent tool — description: "Final verdict" — prompt: "You are the Reality Checker. Default: NEEDS WORK. The hardening loop reached score [final_score] after [iterations] iterations. Score history: [paste table]. Review all evidence. Eval harness results: [baseline pass rate] → [final pass rate]. E2E test results: [paste E2E table — 3 iterations, final pass rate, quarantined count]. Dogfood results: [paste issue count and any CRITICAL/HIGH findings, or 'clean — no issues found']. Fake data audit results: [paste findings or 'clean — no fake data detected']. CRITICAL failures remaining: [list or none]. Verdict: PRODUCTION READY or NEEDS WORK with specifics."

<HARD-GATE>Do NOT self-approve. Reality Checker must give the verdict.</HARD-GATE>

**On PRODUCTION READY:** Log verdict. Proceed to Phase 7.

**On NEEDS WORK:** The Reality Checker returns specific issues. These must be fixed — not logged and ignored.

1. Read the Reality Checker's specific findings. Classify each:
   - **Code bug** (broken feature, failing test, fake data) → spawn implementation fix agent with the finding + affected files.
   - **Structural issue** (missing feature, wrong architecture, data flow problem) → spawn architect agent to produce a fix plan, then implementation agent to execute it. This is a mini Phase 5 loop for the specific issue.
   - **Blocker** (missing API key, no backend, needs human action) → log to `docs/plans/build-log.md` and present to user. Cannot be auto-fixed.
2. After fixes, re-run verification (7 checks) + the specific failing gate (E2E, dogfood, or fake data — whichever surfaced the issue).
3. Re-run the Reality Checker with updated evidence.

<HARD-GATE>
Max 2 NEEDS WORK cycles. If the Reality Checker returns NEEDS WORK a third time:
- **Interactive:** Present all remaining issues to user. Ask for direction.
- **Autonomous:** Log remaining issues to `docs/plans/build-log.md`. Proceed to Phase 7 with a warning in the completion report.
Do not loop forever.
</HARD-GATE>

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 7: Ship

### Step 7.0 — Pre-Ship Verification

Run the Verification Protocol (`protocols/verify.md`). All checks must pass before documenting and shipping. If FAIL persists after 3 fix attempts, return to Phase 6.

### Step 7.0b — Requirements Coverage Report

Call the Agent tool — description: "Requirements coverage check" — prompt: "Re-read the original Design Document (docs/plans/*.md design doc) and the user journeys + NFRs from docs/plans/sprint-tasks.md. For EVERY feature listed in the MVP scope, verify: (1) it has a corresponding implemented task, (2) it has a passing test or behavioral verification, (3) it is reachable and functional in the running app. Produce a coverage table:

| MVP Feature | Task | Test | Verified | Status |
|-------------|------|------|----------|--------|

Mark each as COVERED, PARTIAL (implemented but untested), or MISSING. Any MISSING feature is a blocker — report it immediately."

If any features are MISSING: spawn implementation agents to build them, then re-run verification. This is the final safety net before shipping — it catches requirements that were planned but somehow never built.

### Step 7.1 — Documentation

Call the Agent tool — description: "Documentation" — mode: "bypassPermissions" — prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

### Step 7.2 — Metric Loop: Documentation Quality

Run the Metric Loop Protocol on documentation. Define a metric based on completeness and whether a new developer could follow the README. Max 3 iterations.

### Step 7.3 — Record Learnings

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

Mark all TodoWrite items complete. Update `docs/plans/.build-state.md`: "Phase: 7 COMPLETE."
