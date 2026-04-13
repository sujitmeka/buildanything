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

**Dispatch Counter:** Track agent dispatches in `docs/plans/.build-state.json` (source of truth) under the `dispatch_count` and `last_save_phase` fields:
- `dispatch_count: [N]`
- `last_save_phase: [Phase.Step]`
Increment after each agent returns (parallel dispatch of 4 agents = +4). Reset to 0 after each compaction save. The rendered markdown view (`.build-state.md`) is regenerated from the JSON on every update — never edit the markdown directly.

**Compaction checkpoint format:** At every phase boundary, check `dispatch_count` in `docs/plans/.build-state.json`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.json` and regenerate `.build-state.md` as the rendered view. Reset `dispatch_count` to 0. TodoWrite does NOT survive compaction — rebuild it from the JSON state file on resume. See `protocols/state-schema.md` for the full schema and rendering contract.

Input: $ARGUMENTS

### Autonomous Mode

If the input contains `--autonomous` or `--auto`, this build runs **unattended**. The user will not be present to approve quality gates. In autonomous mode:
- Quality gates auto-approve. Do NOT pause and wait for user input.
- Brainstorming runs in autonomous mode (see protocol).
- Metric loops that stall accept at >= 60% of target, skip below that.

If `--autonomous` is NOT present, all quality gates require user approval as described below.

When combining `--resume` with `--autonomous`: the current invocation's flags take precedence over saved state. If you resume a previously interactive build with `--autonomous`, it continues in autonomous mode.

### Always-On Build Log

`docs/plans/build-log.md` is written in **BOTH interactive and autonomous mode**. Every phase transition writes a one-line entry with the shape: `{timestamp, phase, step, action, outcome}`. Examples:

```
2026-04-13T19:00:01Z | Phase 0 | Step 0.1b | classified project_type=ios | ok
2026-04-13T19:02:14Z | Phase 1 | Step 1.2 | dispatched 5 research agents | 5/5 returned
2026-04-13T19:17:33Z | Phase 6 | Step 6.4 | Reality Checker verdict | PRODUCTION READY
```

This produces a readable build history that survives compaction, supports `--resume`, enables debugging, and gives the user a narrative of what happened during the build. Append to this file at EVERY phase boundary, EVERY Reality Checker dispatch, EVERY metric-loop iteration, and EVERY quality gate decision. In autonomous mode, ALSO log every auto-approval decision here so the user can review later.

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

1. **Relevant architecture refs** (Phase 5+) or relevant architecture section (Phase 1-2) — see rule below
2. **Previous agent's output** — what the upstream agent produced (if any)
3. **Acceptance criteria** — what "done" looks like for THIS agent

**Phase 5+ rule (refs not pastes):** For implementation agents, pass REFS to `architecture.md` and `visual-design-spec.md` / `ios-design-board.md` — NOT pasted content. The orchestrator reads `docs/plans/.refs.json` (produced by the Phase 2.3 architecture synthesizer per `protocols/architecture-schema.md`), resolves the task topic against the anchor index, and passes a short ref list to the implementer (primary anchor + optional secondary anchors). The implementer uses the Read tool to pull refs it needs. This keeps orchestrator context lean and lets the implementer widen its view on demand instead of being locked into whatever slice the orchestrator chose.

**Phase 1-2 rule (full document):** For research and architecture agents (brainstorm synthesis, market research, tech feasibility, architecture design), pass the FULL Design Document — these agents need complete context to do their analysis and the refs pattern is premature (the architecture anchors don't exist yet).

### Complexity Routing (Advisory)

Tag agent prompts with `[COMPLEXITY: S/M/L]` based on task size from `docs/plans/sprint-tasks.md`. This is advisory — the tag documents intent for future model routing support.

### Mode-Specific Tool Stacks

Mode-specific tool stacks, per-phase branches, and persona rules are in separate files — the orchestrator loads only ONE based on `project_type` (see Phase 0 Step 0.1b below):
- iOS: `protocols/ios-phase-branches.md` (includes iOS Mode Tool Stack)
- Web: `protocols/web-phase-branches.md` (web defaults)

---

## Phase 0: Context & Pre-Flight

**Resuming?** If the input contains `--resume` OR if context was just compacted (SessionStart hook fired with active state):
1. Read `docs/plans/.build-state.json` (source of truth) — verify it exists and has a `resume_point` field. Fall back to reading `docs/plans/.build-state.md` (rendered view) if the JSON file is missing but the markdown exists (graceful migration path from pre-W1-2 builds).
   If neither `docs/plans/.build-state.json` nor `docs/plans/.build-state.md` exists, OR neither has a Resume Point, warn the user: 'No previous build state found. Starting fresh.' Then proceed to Step 0.1 as a new build.
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

### Step 0.1b — Project Type Classification (iOS vs Web)

Scan the build request AND any context from Step 0.1 for iOS signals. Keywords: **iOS, iPhone, iPad, SwiftUI, Swift, App Store, TestFlight, Xcode, Apple, Liquid Glass, watchOS, visionOS, SwiftData, HIG**.

**Classification logic:**

| Signal | Action |
|---|---|
| iOS keywords present in prompt | Confirm with user: "This looks like an iOS app — confirm? [y/n]" |
| User confirms OR says iOS during brainstorming | Set `project_type: ios` in `docs/plans/.build-state.json` (regenerate markdown view) |
| `.xcodeproj` / `Package.swift` / `*.swift` files in existing codebase | Set `project_type: ios` automatically |
| No iOS signals, no Swift files | Default `project_type: web` (existing behavior) |

**Autonomous mode:** skip the confirmation prompt. If iOS keywords are present, set `project_type: ios` and log the inference to `docs/plans/build-log.md`.

**Conditional branch-file load:**
- If `project_type=ios`: load `protocols/ios-phase-branches.md` AND `protocols/ios-context.md` into session context. Reference `protocols/ios-frameworks-map.md` by path only (do NOT load — agents Read it on-demand).
- If `project_type=web`: load `protocols/web-phase-branches.md` into session context.
- Load only ONE branch file. The other mode's content is irrelevant to this build.

Record the classification in `docs/plans/.build-state.json` as the top-level `project_type` field: `"ios"` or `"web"`. Regenerate `.build-state.md` after the write. This field survives compaction and gates every branching block below.

**Mode-specific additions to Phase 0:** See `protocols/ios-phase-branches.md` §Phase 0 additions (iOS only). No web-specific Phase 0 additions.

### Step 0.1c — Learnings Loader

Read `docs/plans/learnings.jsonl` (the cross-run learnings store). If the project-local file does not exist, fall back to `~/.claude/buildanything/learnings.jsonl` (the plugin's persistent learnings directory). If neither exists, this is a first-time-ever build — proceed with an empty active-learnings file and skip the rest of this step.

If a learnings file exists:
1. Parse each line as a JSON row with the schema written at Step 6.4.1: `{run_id, timestamp, project_type, phase_where_learning_surfaced, metric, top_issue, fix_applied, score_delta, pattern_type}`.
2. Filter entries where `project_type` matches the current build's classification (set at Step 0.1b).
3. Rank the filtered entries by a composite score: prefer entries matching the current build's expected `pattern_type` (PITFALL > PATTERN > HEURISTIC for relevance), then by `phase_where_learning_surfaced` (earlier phases first — they apply to more of the build), then by `score_delta` magnitude (larger deltas indicate higher-impact learnings).
4. Select the top 3 most relevant entries.
5. Write them to `docs/plans/.active-learnings.md` as a short markdown section (one bullet per learning) that downstream agents can inject into their prompts. Format:

```markdown
## Prior Learnings (top 3 relevant)

- **PITFALL (phase 4.2b, iOS):** [top_issue] — fix: [fix_applied]
- **PATTERN (phase 5.1, web):** [top_issue] — fix: [fix_applied]
- **HEURISTIC (phase 6.2, iOS):** [top_issue] — fix: [fix_applied]
```

The Phase 5.1 implementer prompt assembly step (below) reads `.active-learnings.md` and injects its contents into every implementer dispatch under a `## Prior Learnings` section. This is how learnings from build N flow into build N+1.

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
2. Write `docs/plans/.build-state.json` as the **source of truth** per the schema in `protocols/state-schema.md`. Required top-level fields: `project_type`, `phase`, `step`, `input`, `context_level`, `prerequisites`, `dispatch_count`, `last_save_phase`, `autonomous`, `session_id`, `session_started`, `completed_tasks[]`, `metric_loop_scores[]`, `resume_point { phase, step, completed_tasks, git_branch }`. Then regenerate `docs/plans/.build-state.md` from the JSON as a **read-only rendered view** — this is what humans read on resume. The markdown is derived; the JSON is authoritative. See `protocols/state-schema.md` for the rendering contract (deterministic layout, one section per top-level JSON field, no free-form appends).
3. Go to Phase 1 (or Phase 2 if context level is "Full design").

**Orchestrator note:** Throughout this file, references to "update `docs/plans/.build-state.md`" mean: update `.build-state.json` as the source of truth, then regenerate `.build-state.md` as the rendered view. The `.build-state.md` path is preserved for backward compatibility with downstream readers (resume handlers, compaction hooks, user inspection) but it is no longer the authoritative file. See `protocols/state-schema.md`.

---

## Phase -1: iOS Bootstrap (iOS-only, greenfield only)

**If `project_type=ios` AND no `.xcodeproj` exists:** follow `protocols/ios-phase-branches.md` §Phase -1 — iOS Bootstrap. Otherwise skip entirely (including all of web mode).

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 1: Brainstorm & Research

**Goal**: Turn the raw idea into a validated Design Document grounded in research. This ensures Phase 2 architects receive a design, not a guess.

**Skip if** Step 0.1 classified context as "Full design" — go straight to Phase 2.

**Mode-specific branch:**
- If `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 1 (iOS skill bundle, ios-swift-architect, App Store/TestFlight/iOS 26 research angles)
- If `project_type=web`: no additional branch instructions — proceed with the steps below.

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

**Mode-specific branch:**
- If `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 2 (replaces Backend/Frontend architecture dispatch with SwiftUI/SwiftData/Concurrency/iOS security; adds Feature Flag Resolution at end of phase)
- If `project_type=web`: no additional branch instructions — proceed with the steps below.

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

**SYNTHESIS OUTPUT CONTRACT:** emit `architecture.md` with stable section anchors per `protocols/architecture-schema.md`. Required top-level sections: Overview, Frontend, Backend, Data Model, Security, Infrastructure, MVP Scope, Out of Scope. Required subsection anchors listed in `architecture-schema.md`. Also emit `docs/plans/.refs.json` as a flat JSON index of all anchors in the synthesized doc — shape: `[{ "anchor": "#frontend/checkout", "topic": "short topic string", "file_path": "docs/plans/architecture.md" }, ...]`. This refs index is consumed by Phase 5.1 implementer dispatches (refs not pastes — see Handoff Documents rule above and Step 5.1 prompt assembly below).

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

**iOS feature flag resolution:** if `project_type=ios`, resolve `ios_features` before leaving Phase 2 per `protocols/ios-phase-branches.md` §Phase 2 → Feature Flag Resolution.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 3: Design & Visual Identity

**Goal**: Transform architecture into a research-backed visual design system grounded in real references (competitor sites for web, HIG + App Store for iOS).

**Skip if** the project has no user-facing frontend (CLI tools, pure APIs, backend services).

<HARD-GATE>
UI/UX IS THE PRODUCT. This phase is a full peer to Architecture and Build — not a footnote, not an afterthought, not a "nice to have." Do NOT skip, compress, or rush this phase for any reason. Agents must research real references, make deliberate visual choices backed by that research, and iterate with verified visual QA before a single line of product code is written.

Phase 4 (Foundation) WILL NOT START without the design artifact for this mode (`docs/plans/visual-design-spec.md` for web, `docs/plans/ios-design-board.md` for iOS). If it does not exist, return here.
</HARD-GATE>

**Mode-specific branch:**
- If `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 3 (HIG + App Store + screenlane harvest → iOS Design Board, SwiftUI Preview QA loop, max 3 iterations)
- If `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 3 (competitor/Awwwards research → Visual Design Spec → living style guide at `/design-system` → Playwright visual QA, max 5 iterations)

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 4: Foundation

<HARD-GATE>
Before starting Phase 4: Phase 2 must be approved AND Phase 3 must have produced the design artifact for this mode.
- Web: `docs/plans/visual-design-spec.md` must exist.
- iOS: `docs/plans/ios-design-board.md` must exist.
If the artifact does not exist, DO NOT PROCEED. Return to Phase 3.
Step 4.2 (Design System) MUST implement from the design artifact — not generic architecture tokens.
</HARD-GATE>

**Mode-specific branch (Steps 4.1, 4.2, 4.2b):**
- If `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 4 (entitlements generator + Info.plist hardening, XcodeBuildMCP folder structure, SwiftUI design tokens, Maestro flow stubs)
- If `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 4 (web project scaffolding, CSS design system tokens, Playwright acceptance test stubs)

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
Before starting: Phase 2 must be approved, Phase 3 must produce `docs/plans/visual-design-spec.md` (web) or `docs/plans/ios-design-board.md` (iOS), Phase 4 must pass. You MUST call the Agent tool for EVERY task. No exceptions.
</HARD-GATE>

**Mode-specific branch (Step 5.1 implement, Step 5.2 metric loop, Step 5.3b smoke test):**
- If `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 5 (iOS skill bundle, feature-flag-gated skill loading, iOS implement prompt, SwiftUI Preview metric loop, Maestro smoke tests)
- If `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 5 (web implement prompt, agent-browser metric loop, localhost smoke tests)

Expand TodoWrite with each sprint task.

**For EACH task, run Steps 5.1 → 5.1b → 5.2 → 5.3 → 5.3b → 5.4 below.** Step 5.1 implementation prompt and Step 5.3b smoke test technology are defined in the mode-specific branch file. The remaining steps (cleanup, loop exit, verification) are mode-agnostic and live here.

### Step 5.1 — Implement

Per the mode-specific branch file referenced above. Pick the right developer framing: frontend, backend, AI, etc. Set `[COMPLEXITY: S/M/L]` based on the task's Size from sprint-tasks.md.

**Prompt assembly — pass refs, not pastes.** The orchestrator MUST NOT slice `architecture.md` or `visual-design-spec.md` sections and paste them into the implementer prompt. Instead:

1. Read `docs/plans/.refs.json` (generated by the Phase 2.3 architecture synthesizer per `protocols/architecture-schema.md`).
2. Resolve this task's topic against the anchor index — pick the primary anchor (section the task directly touches) and any secondary anchors (sections the task's dependencies reference).
3. Pass the implementer ONLY a ref list in the prompt, shaped like this:

```
ARCHITECTURE REFS:
  - architecture.md#<anchor1> (primary)
  - architecture.md#<anchor2> (secondary — read if touching X)
DESIGN REFS:
  - visual-design-spec.md#<anchor> (web only)
  - ios-design-board.md#<anchor> (iOS only)
PREVIOUS TASK: task-N → see docs/plans/.task-outputs/task-N.json for files-changed
```

4. Instruct the implementer: "Read the refs listed above via the Read tool as needed. Widen your view by reading additional refs from `docs/plans/.refs.json` if you discover a dependency not captured in the primary/secondary list. Do NOT expect pasted architecture content in this prompt."

5. **Inject prior learnings.** Read `docs/plans/.active-learnings.md` (written by the Phase 0 Learnings Loader at Step 0.1c) and paste its contents into the implementer prompt under a `## Prior Learnings` section. If the active-learnings file is empty or missing, skip this injection silently — first-time builds legitimately have no prior learnings.

This pattern respects the "dispatcher not doer" HARD-GATE at the top of this file: the orchestrator never reads `architecture.md` into its own context just to slice it.

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

Run the Metric Loop Protocol on the task implementation. Define a metric based on the task's acceptance criteria. For UI-facing tasks, include behavioral verification per the mode-specific branch file (web: agent-browser; iOS: SwiftUI Preview captures). Max 5 iterations.

### Step 5.3 — Loop Exit

On target met: mark task complete in TodoWrite, report "Task X/N: [name] — COMPLETE (score: [final], iterations: [count])".

On stall or max iterations:
- **Interactive:** present score history + top remaining issue to user.
- **Autonomous:** accept if score >= 60% of target, skip otherwise. Log to `docs/plans/build-log.md`.

After each task: update TodoWrite and `docs/plans/.build-state.md`.

### Step 5.3b — Behavioral Smoke Test

Skip if this task has no Behavioral Test criteria (API-only, config, infrastructure tasks).

Run the Smoke Test Protocol (`protocols/smoke-test.md`). Technology is mode-specific — follow the branch file (web: agent-browser + localhost; iOS: Maestro flow against simulator via XcodeBuildMCP). Evidence saved to `docs/plans/evidence/[task-name]/`.

On FAIL: spawn fix agent with the evidence (expected vs actual, errors, screenshots, relevant source files). Max 2 fix-and-retest cycles.

On PASS: proceed to Step 5.4.

### Step 5.4 — Post-Task Verification

Run the Verification Protocol (`protocols/verify.md`). If FAIL, fix before starting the next task.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 6: Harden — Metric-Driven Hardening

### Step 6.0 — Pre-Hardening Verification

Run the Verification Protocol (`protocols/verify.md`). All checks must pass before starting expensive audit agents.

**Mode-specific branch (Steps 6.1 → 6.2e):**
- If `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 6 — dispatch iOS twin commands (`/buildanything:verify` → `/buildanything:ux-review` → `/buildanything:fix`) in sequence. Skip Steps 6.1, 6.1b, 6.2, 6.2b, 6.2c, 6.2d, 6.2e. Then run Step 6.4 Reality Check below with iOS evidence.
- If `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 6 — run Steps 6.1 (5-agent audit), 6.1b (eval harness), 6.2 (metric loop), 6.2b (eval re-run), 6.2c (Playwright E2E, 3 mandatory iterations), 6.2d (agent-browser dogfood), 6.2e (fake data detector). Then run Step 6.4 Reality Check below.

### Step 6.4 — Reality Check

<HARD-GATE>
PRECONDITION (orchestrator-side, BEFORE dispatching the Reality Checker):

The orchestrator MUST verify ALL of the following evidence files exist and are non-empty before dispatching. If ANY are missing or empty, log "REALITY CHECK BLOCKED" to `docs/plans/.build-state.json` (and regenerate `.build-state.md`) with the missing-file list, and either:
  - Interactive mode: present the blocker to the user with the missing-file list. Ask: "Re-run the failing step, or abort?" Do NOT proceed to Phase 7 with BLOCKED.
  - Autonomous mode: return to the failing step (the one that should have produced the missing file) and re-dispatch it once. If still missing after one retry, log FAILED and abort the build. Do NOT proceed to Phase 7 with BLOCKED.

REQUIRED EVIDENCE FOR ALL PROJECTS:
  - `docs/plans/.build-state.json` exists, contains the current build session id, and contains a recent `VERIFY: PASS` line from this session.

REQUIRED EVIDENCE FOR `project_type=web`:
  - `docs/plans/evidence/eval-harness/baseline.json` (non-empty)
  - `docs/plans/evidence/eval-harness/final.json` (non-empty)
  - `docs/plans/evidence/e2e/iter-3-results.json` (non-empty)
  - `docs/plans/evidence/dogfood/findings.md` (non-empty)
  - `docs/plans/evidence/fake-data-audit.md` (non-empty)
  - `docs/plans/evidence/manifest.json` (the file manifest written by the smoke test protocol)

REQUIRED EVIDENCE FOR `project_type=ios`:
  - `docs/plans/ios-verify-report.md` (non-empty, from `/buildanything:verify` iOS twin)
  - `docs/plans/ios-ux-review-report.md` (non-empty, from `/buildanything:ux-review` iOS twin)
  - At least one `*.yaml` file in `maestro/` directory
  - At least one `*.png` screenshot in `docs/plans/evidence/maestro-runs/` from this build session
  - `docs/plans/evidence/manifest.json`

If any required file does not exist or is empty, do NOT dispatch the Reality Checker. STOP HERE.
</HARD-GATE>

Call the Agent tool — description: "Final verdict" — prompt: "You are the Reality Checker. Default verdict: NEEDS WORK. You receive evidence by FILE PATH only — never by paste. You must use the Read and Glob tools to verify each file exists, is non-empty, was modified within this build session (after timestamp `[build_session_start]`), and contains no placeholder strings ('TODO', 'PLACEHOLDER', 'TBD', 'FIXME', 'XXX').

Evidence paths to verify:
  - `docs/plans/.build-state.json`
  - `docs/plans/evidence/manifest.json` (READ this file; for every entry, verify the `file_path` exists and the `byte_count` matches the on-disk size)
  - [project-type-specific paths from the precondition above — orchestrator pastes the relevant list]

For every Behavioral Test field in `docs/plans/sprint-tasks.md`, verify a corresponding evidence file exists in `docs/plans/evidence/[task-slug]/` AND that the test-stub-detector (per `protocols/verify.md` Step 2) does not flag the corresponding test file as a stub. Use Grep and Glob to locate.

For every architecture MUST in `docs/plans/architecture.md`, verify the corresponding implementation file exists via Glob, AND that the file contains the named symbol via Grep.

After completing all reads, write an evidence manifest summarizing what you verified to `docs/plans/evidence/reality-check-manifest.json` with fields: `{ file_path, sha256, byte_count, modified_time, verdict_contribution }`.

Issue ONE of three verdicts:
  - **PRODUCTION READY**: every required evidence file exists, every Behavioral Test maps to a non-stub test file, every architecture MUST maps to an implementation, zero placeholders, zero CRITICAL findings.
  - **NEEDS WORK**: at least one fixable issue (failing test, missing implementation file for a non-critical task, fake-data finding) but the build is structurally complete. Return the specific list.
  - **BLOCKED**: at least one required evidence file is missing or empty despite the precondition check having passed. This indicates a bug in the precondition logic. Return the missing-file list and STOP — do not return PRODUCTION READY.

You may NOT issue PRODUCTION READY without having invoked the Read or Glob tool at least once. If your verdict reasoning does not cite specific file paths and specific contents you read, your verdict is invalid."

**Reality Checker output schema:** the Reality Checker MUST return a structured verdict with these fields:

```json
{
  "code_review_verdict": "PASS | FAIL",
  "behavioral_verdict": "PASS | FAIL | UNVERIFIED",
  "combined_verdict": "PRODUCTION READY | NEEDS WORK | BLOCKED",
  "evidence_manifest_path": "docs/plans/evidence/reality-check-manifest.json",
  "behavioral_test_count_declared": "<integer from sprint-tasks.md grep>",
  "behavioral_test_count_passing": "<integer from test runner output>",
  "behavioral_test_count_stub_flagged": "<integer from verify.md Step 2 stub detector>",
  "evidence_files_checked": ["<list of paths>"],
  "missing_evidence_files": ["<list of paths or empty>"],
  "specific_findings": ["<list of issues if NEEDS WORK>"]
}
```

**Combined verdict rules:**

- `combined_verdict = "PRODUCTION READY"` REQUIRES `code_review_verdict == "PASS"` AND `behavioral_verdict == "PASS"` AND `behavioral_test_count_stub_flagged == 0`.
- `combined_verdict = "NEEDS WORK"` if `code_review_verdict == "FAIL"` OR `behavioral_verdict == "FAIL"` OR `behavioral_test_count_stub_flagged > 0`.
- `combined_verdict = "BLOCKED"` if `len(missing_evidence_files) > 0`. NEVER PRODUCTION READY in this case.

**`behavioral_verdict = "UNVERIFIED"`** is a legal state for projects that legitimately have no behavioral tests (CLI tools, pure libraries, no UI). It is NEVER a synonym for PASS. The combined verdict in that case is NEEDS WORK with the specific finding "behavioral verification was not run" — and the user is presented with the option to either explicitly accept UNVERIFIED (which gets logged as "shipped without behavioral verification, user accepted") or downgrade to NEEDS WORK and provide tests.

<HARD-GATE>
Do NOT self-approve. Reality Checker must give the verdict.

Verdict resolution:
  - PRODUCTION READY → log verdict + manifest path. Proceed to Step 6.4.1 (Record Learnings), then Phase 7.
  - NEEDS WORK → existing fix-and-retest loop below (max 2 cycles).
  - BLOCKED → return to the step that should have produced the missing evidence, re-dispatch, re-run from precondition. NEVER proceed to Phase 7 with BLOCKED.
</HARD-GATE>

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

### Step 6.4.1 — Record Learnings (primary write)

Reached only after a successful Reality Check (combined_verdict == PRODUCTION READY, OR combined_verdict == NEEDS WORK with all issues resolved on retry). Append a JSON line to `docs/plans/learnings.jsonl` (create if it doesn't exist). This is the PRIMARY learnings write — Phase 7.3 is retained only for late learnings surfaced during Phase 7 itself.

Row schema (one line per learning, 3-5 rows per build):

```json
{"run_id": "[session_id]", "timestamp": "[ISO8601]", "project_type": "ios|web", "phase_where_learning_surfaced": "[N.x]", "metric": "[metric name]", "top_issue": "[short description]", "fix_applied": "[what was done]", "score_delta": [integer], "pattern_type": "PATTERN|PITFALL|HEURISTIC"}
```

Base rows on: metric loop stall patterns, build-fix frequency, phases that exceeded expected iterations, agent prompts that needed rework, Reality Checker NEEDS WORK findings that were resolved.

Use the same `learnings.jsonl` path referenced by the Phase 0 Learnings Loader (Step 0.1c). The store is append-only — never truncate or rewrite prior rows.

**Compaction checkpoint.** Update `docs/plans/.build-state.md` per the format above.

---

## Phase 7: Ship

**Mode-specific branch (Step 7.1 documentation + deploy):**
- If `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 7 — ship pipeline is optional (simulator-only is a valid end-state). If shipping, run asc-* agents + fastlane. Skip web Step 7.1 below.
- If `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 7 (Step 7.1 documentation + deploy notes).

### Step 7.0 — Pre-Ship Verification

Run the Verification Protocol (`protocols/verify.md`). All checks must pass before documenting and shipping. If FAIL persists after 3 fix attempts, return to Phase 6.

### Step 7.0b — Requirements Coverage Report

Call the Agent tool — description: "Requirements coverage check" — prompt: "Re-read the original Design Document (docs/plans/*.md design doc) and the user journeys + NFRs from docs/plans/sprint-tasks.md. For EVERY feature listed in the MVP scope, verify: (1) it has a corresponding implemented task, (2) it has a passing test or behavioral verification, (3) it is reachable and functional in the running app. Produce a coverage table:

| MVP Feature | Task | Test | Verified | Status |
|-------------|------|------|----------|--------|

Mark each as COVERED, PARTIAL (implemented but untested), or MISSING. Any MISSING feature is a blocker — report it immediately."

If any features are MISSING: spawn implementation agents to build them, then re-run verification. This is the final safety net before shipping — it catches requirements that were planned but somehow never built.

### Step 7.1 — Documentation

Per the mode-specific branch file referenced at the top of Phase 7.

### Step 7.2 — Metric Loop: Documentation Quality

Run the Metric Loop Protocol on documentation. Define a metric based on completeness and whether a new developer could follow the README. Max 3 iterations.

### Step 7.3 — Record Late Learnings (Phase 7 only)

**Note:** The primary learnings write happens after Phase 6.4 Reality Check (see Step 6.4 "Record Learnings" below). Step 7.3 is retained for any LATE learnings surfaced during Phase 7 itself (documentation friction, deployment blockers, requirements-coverage gaps surfaced in Step 7.0b).

If any late learnings surfaced during Phase 7, append them to `docs/plans/learnings.jsonl` using the same row schema as the primary write:

```json
{"run_id": "[session_id]", "timestamp": "[ISO8601]", "project_type": "ios|web", "phase_where_learning_surfaced": "7.x", "metric": "[metric name if applicable]", "top_issue": "[short description]", "fix_applied": "[what was done]", "score_delta": [integer or null], "pattern_type": "PATTERN|PITFALL|HEURISTIC"}
```

Base late learnings on: documentation friction, deployment blockers, requirements-coverage gaps, late-surfacing Verification Gap findings. If no late learnings surfaced, skip this step entirely — an empty Phase 7.3 is the expected state for a clean build.

### Completion Report

Create final commit. The Completion Report MUST draw its verification surface from the Reality Checker's structured output (`docs/plans/evidence/reality-check-manifest.json`) — NOT from orchestrator summary prose. Present:

```
BUILD COMPLETE
Project: [name] | Tasks: [done]/[total] | Tests: [count] passing
Agents used: [list] | Verdict: [combined_verdict from Reality Checker]
Metric loops run: [count] | Avg iterations: [N]
Remaining: [any NEEDS WORK items]
```

**Verification table (MANDATORY — pulled from Reality Checker structured output):**

| Metric | Count | Status |
|--------|-------|--------|
| Behavioral Tests declared in spec | `behavioral_test_count_declared` | — |
| Behavioral Tests with non-stub bodies | `behavioral_test_count_passing` | PASS if `== declared`, FAIL otherwise |
| Behavioral evidence files written | count from `evidence_files_checked[]` | — |
| Maestro flows present (iOS) | count of `maestro/*.yaml` | — |
| Test-stub detector flagged files | `behavioral_test_count_stub_flagged` | PASS if `== 0`, FAIL otherwise |
| Code review verdict | `code_review_verdict` | — |
| Behavioral verdict | `behavioral_verdict` | — |
| Combined verdict | `combined_verdict` | — |

**Verification Gap handling:** If `behavioral_test_count_passing < behavioral_test_count_declared` OR `behavioral_test_count_stub_flagged > 0`, the report MUST surface a top-level "Verification Gap" section BEFORE writing the report to disk:

```
## Verification Gap

The build declared [declared] behavioral tests but only [passing] have non-stub bodies.
Stub-flagged files: [list from reality-check-manifest.json]
Missing test bodies for tasks: [list from sprint-tasks.md grep of non-N/A Behavioral Test fields without matching non-stub test files]
```

Then ask the user: "Write the Completion Report with this verification gap surfaced? [YES/NO]" <HARD-GATE>DO NOT write the report to disk without explicit YES confirmation. In autonomous mode: still write but flag the gap prominently as the first section and log to `docs/plans/build-log.md`.</HARD-GATE>

Mark all TodoWrite items complete. Update `docs/plans/.build-state.json` (source of truth) and regenerate `docs/plans/.build-state.md` (rendered view): "Phase: 7 COMPLETE."
