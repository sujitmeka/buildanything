---
description: "Full product build pipeline — orchestrates specialist agents through brainstorming, research, architecture, design, implementation, audit, launch review, and ship"
argument-hint: "Describe what to build, or path to a design doc. --autonomous for unattended mode. --resume to continue a previous build."
---

<HARD-GATE>
YOU ARE AN ORCHESTRATOR. YOU COORDINATE AGENTS. YOU DO NOT WRITE CODE.

Every step below tells you to call the Agent tool. DO IT. Do not role-play as the agent. Do not write implementation code yourself. Do not skip the Agent tool call "because it's faster." If you are typing code instead of calling the Agent tool, STOP — you are violating this process.

"Launch an agent" = call the Agent tool (the actual tool in your toolbar, the one that spawns a subprocess).

For implementation agents, set mode: "bypassPermissions".
For parallel work, put multiple Agent tool calls in ONE message.

Exception: Brainstorming in Phase 1 Step 1.0 and Step 1.3 uses an INTERNAL Brainstorm Facilitator role — the orchestrator relays between the facilitator sub-agent and the user, never role-plays the agent itself.
</HARD-GATE>

<HARD-GATE>
SUBAGENT_TYPE REQUIRED.

Every Agent tool call MUST include a `subagent_type` field unless the dispatch is explicitly marked INTERNAL (inline role-string). INTERNAL dispatches are listed in `docs/plans/agent-dispatch-audit.md` — they are orchestrator helpers (Brainstorm Facilitator, Research Synthesizer, Design Doc Writer, Prereq Collector, Task DAG Validator, Refs Indexer, Briefing Officer, Dogfood runner, Fake-Data Detector, PM chapter, LRR Aggregator, Completion Report, Verify scaffolding dispatcher).

Missing `subagent_type` on a non-INTERNAL dispatch is a HARD-GATE violation. The orchestrator rejects dispatches that don't name a specific agent. If you catch yourself typing `description: "..."` without a `subagent_type:` line alongside it, STOP and look up the right agent from the dispatch audit.
</HARD-GATE>

<HARD-GATE>
ARTIFACT WRITER-OWNER RULE.

Every shared artifact has ONE writer per phase. The writer-owner table in `docs/plans/orchestration-proposed-state.md` §6 defines which phase writes which file. Before any file write, the orchestrator verifies the current phase is the rightful writer. Non-owning phase writes are a HARD-GATE violation.

Live downstream docs (read across Phase 3+):
  - `CLAUDE.md`              — P1 writer (then auto-loaded into every subagent)
  - `design-doc.md` (PRD)    — P1 writer
  - `architecture.md`        — P2 writer
  - `sprint-tasks.md`        — P2 writer
  - `quality-targets.json`   — P2 writer
  - `visual-design-spec.md`  — P3 writer (web) / `ios-design-board.md` P3 writer (iOS)
  - `refs.json`              — P2 writer + P3 writer (P3 extends after visual spec lands)
  - `decisions.jsonl`        — P1, P2, P4 writers (P4 only on deviation rows)
  - `learnings.jsonl`        — P5, P7 writers
  - `evidence/*.json`        — P5 writer (P4 contributes per-task, P6/P7 readers)
  - `lrr/*.json`             — P6 writer (1 per chapter + Aggregator)
  - `lrr-aggregate.json`     — P6 writer (Aggregator only)

Phase-internal scaffolding (lives in `docs/plans/phase1-scratch/` after Gate 1, never read by P3+):
  - `idea-draft.md`, `feature-intel.md`, `tech-feasibility.md`, `ux-research.md`, `business-model.md`, `findings-digest.md`, `suggested-questions.md`, `user-decisions.md`, `prereqs.json`

Phase 4 implementers never reference Phase 1 raw research files. They are SPENT after Phase 2 dispatch.
</HARD-GATE>

### Orchestrator Discipline

Your context window is precious. Protect it.

**You are a DISPATCHER, not a DOER.** Your job is: read state → decide next step → compose agent prompt → dispatch → process compact return → decide next step.

**Two types of agents — handle their results differently:**

| Agent Type | Examples | What you keep |
|-----------|----------|---------------|
| **Research/analysis** | Architecture design, audits, measurement, chapter verdicts | **Compact return only** — save full output to `docs/plans/`, keep the filename + headline verdict in context. Phase 1 research goes through the Research Synthesizer — the orchestrator never reads raw research. |
| **Implementation** | Code writing, fixes, cleanup, verification, scaffolding | **Summary only** — their work product lives in the codebase. Keep: what was done, files changed, test results, pass/fail. Discard: code snippets, full build logs. |

**Never do these yourself:**
- Read source code files to understand implementation details — spawn an INTERNAL inline exploration agent (see Step 2.1)
- Write or edit code — spawn an implementation agent
- Debug failures — spawn a fix agent with the error message
- Read raw Phase 1 research files — the Research Synthesizer (Step 1.2) reads them; you only read the digest

If you catch yourself typing code or reading source files: STOP. You are wasting context. Spawn an agent.

**Dispatch Counter:** Track agent dispatches in `docs/plans/.build-state.json` (source of truth) under the `dispatch_count` and `last_save_phase` fields:
- `dispatch_count: [N]`
- `last_save_phase: [Phase.Step]`
Increment after each agent returns (parallel dispatch of 6 agents = +6). Reset to 0 after each compaction save. The rendered markdown view (`.build-state.md`) is regenerated from the JSON on every update — never edit the markdown directly.

**Compaction checkpoint format:** At every phase boundary, check `dispatch_count` in `docs/plans/.build-state.json`. If >= 8: save ALL state (current phase, task statuses, metric loop scores, decisions) to `docs/plans/.build-state.json` and regenerate `.build-state.md` as the rendered view. Reset `dispatch_count` to 0. TodoWrite does NOT survive compaction — rebuild it from the JSON state file on resume. See `protocols/state-schema.md` for the full schema and rendering contract.

Input: $ARGUMENTS

### Autonomous Mode

If the input contains `--autonomous` or `--auto`, this build runs **unattended**. The user will not be present to approve quality gates. In autonomous mode:
- Quality gates auto-approve. Do NOT pause and wait for user input.
- Brainstorming runs in autonomous mode (Brainstorm Facilitator synthesizes directly from build request + available context).
- Metric loops that stall accept at >= 60% of target, skip below that.

If `--autonomous` is NOT present, all quality gates require user approval as described below.

When combining `--resume` with `--autonomous`: the current invocation's flags take precedence over saved state. If you resume a previously interactive build with `--autonomous`, it continues in autonomous mode.

### Always-On Build Log

`docs/plans/build-log.md` is written in **BOTH interactive and autonomous mode**. Every phase transition writes a one-line entry with the shape: `{timestamp, phase, step, action, outcome}`. Append to this file at EVERY phase boundary, EVERY LRR chapter dispatch, EVERY metric-loop iteration, and EVERY quality gate decision. In autonomous mode, ALSO log every auto-approval decision here so the user can review later.

### Metric Loop (callable service)

Every phase can invoke the **metric-driven iteration loop** as a service to drive quality. Read the full protocol at `protocols/metric-loop.md`. Called by Phase 3 (Design Critic loop), Phase 4 (per-task quality), Phase 5 (metric fix loop on failing audits), Phase 7 (documentation quality). Critical rules (survive compaction):

1. YOU define a metric for this phase based on context. The metric is NOT predefined.
2. Spawn a **measurement/critic agent** to score the artifact 0-100. Read its compact return.
3. Pick the ONE highest-impact issue. Spawn a separate **fix/generator agent** with ONLY that issue + file paths.
4. Re-measure. Repeat until: target met, stalled (2 consecutive delta <= 0), or max iterations.
5. Track all scores in `docs/plans/.build-state.json` — this is your lifeline across compaction.

<HARD-GATE>
METRIC LOOP NON-NEGOTIABLES:
- Measurement/critic agent and fix/generator agent are SEPARATE Agent tool calls — never share context (author-bias elimination).
- Fix agent gets ONLY the top issue + file paths + acceptance criteria. NOT the full measurement findings.
- One fix per iteration. Measure impact before fixing the next thing.
- Each measurement is fresh — don't accumulate findings across iterations.
</HARD-GATE>

### Verify Protocol (callable service)

The 7-check verification gate is called by Phase 2 (architecture check), Phase 4 (per task), Phase 5 (audit), and Phase 7 (pre-ship). Full protocol at `protocols/verify.md`. Phase-internal — dispatched as INTERNAL inline role-string "Verify scaffolding" with agent running 7 checks sequentially: Build → Type-Check → Lint → Test → Security → Diff Review → Artifacts.

### Decision Log (callable service)

`docs/plans/decisions.jsonl` — append-only. Writers: Phase 1 synthesis (3 rows), Phase 2 architecture synthesis (4 rows), Phase 4 implementers (only on deviation). Readers: Phase 0 resume handler, Phase 5 Reality Checker, Phase 6 LRR Aggregator (the ⭐⭐ backward-routing read). Schema at `protocols/decision-log.md`.

### Learnings (callable service)

`docs/plans/learnings.jsonl` — append-only cross-run learnings store. Writers: Phase 5 reality sweep, Phase 7. Readers: Phase 0 Learnings Loader (Step 0.1c) and Phase 5 reality sweep.

### Refs-Not-Pastes Rule

For Phase 3+ agents, the orchestrator passes REFS to live downstream docs (`design-doc.md`, `architecture.md`, `visual-design-spec.md`, `sprint-tasks.md`, `quality-targets.json`, `decisions.jsonl`) — NOT pasted content. The orchestrator reads `docs/plans/refs.json` (produced by the Phase 2 Refs Indexer), resolves the task topic against the flat anchor index, and passes a short ref list to the agent. The agent uses the Read tool to pull refs it needs. This keeps orchestrator context lean and lets the agent widen its view on demand. Phase 1-2 agents still receive full documents because the architecture anchors don't exist yet.

### Complexity Routing (Advisory)

Tag agent prompts with `[COMPLEXITY: S/M/L]` based on task size from `docs/plans/sprint-tasks.md`. This is advisory — the tag documents intent for future model routing support.

### Mode-Specific Tool Stacks

Mode-specific tool stacks, per-phase branches, and persona rules live in separate files. Load ONE based on `project_type`:
- iOS: `protocols/ios-phase-branches.md` (includes iOS Mode Tool Stack)
- Web: `protocols/web-phase-branches.md` (web defaults)

### Backward Edges — Routing Fix

When a later phase finds a problem whose root cause lives earlier, control flows BACKWARD to the authoring phase. The orchestrator codifies these edges so problems are fixed where they were introduced, not patched locally.

```
PROBLEM FOUND AT                    ROUTES BACK TO
─────────────────────────────────────────────────────────────────
Gate 1 (human says "no")        →   Phase 1 Step 1.0 with feedback
Gate 2 (human says "no")        →   Phase 2 with feedback
Phase 5 Audit (code issue)      →   Phase 4 target task
Phase 5 Audit (design issue)    →   Phase 3 target step
Phase 5 Audit (spec issue)      →   Phase 2 re-architect
Phase 6 LRR BLOCK (⭐⭐)         →   Aggregator reads decisions.jsonl
                                     by related_decision_id →
                                     authoring phase → re-open
Phase 6 LRR NEEDS_WORK (code)   →   Phase 4 target task
Phase 6 LRR NEEDS_WORK (struct) →   Phase 2 or Phase 3
```

The ⭐⭐ star rule: when the LRR Aggregator receives a BLOCK verdict, it reads the `related_decision_id` on the blocker, looks up that row in `decisions.jsonl`, finds which phase authored the decision (the `decided_by` field), and re-opens that phase with the finding as input. Infrastructure already exists (decision IDs, author tracking) — wired here.

---

## Phase 0: Pre-flight (state read only)

Phase 0 is thin. No agent dispatch. No human input. Instant. The orchestrator reads state files and applies universal checks.

**Resuming?** If the input contains `--resume` OR if context was just compacted (SessionStart hook fired with active state):
1. Read `docs/plans/.build-state.json` (source of truth) — verify it exists and has a `resume_point` field. Fall back to reading `docs/plans/.build-state.md` (rendered view) if the JSON file is missing but the markdown exists (graceful migration path from pre-W1-2 builds).
   If neither exists, OR neither has a Resume Point, warn the user: 'No previous build state found. Starting fresh.' Then proceed to Step 0.1 as a new build.
2. Re-read this file and all protocol files in `protocols/`.
3. Re-read live downstream docs: `docs/plans/sprint-tasks.md`, `docs/plans/architecture.md`, `docs/plans/design-doc.md`, `docs/plans/visual-design-spec.md` (if exists), `CLAUDE.md`.
4. Read `docs/plans/decisions.jsonl` if it exists (top 5 most recent rows, filtered to the current phase and upstream phases). Pass short row fields + `ref` anchors into Phase 0 rehydration context — not the full row prose. See `protocols/decision-log.md`.
5. Rebuild TodoWrite from the state file (TodoWrite does NOT survive compaction or session breaks).
6. Reset `dispatches_since_save` to 0 (fresh context window).
7. Resume from the saved phase and step. Skip Phase 0.

### Step 0.1 — Read the Room

Scan for existing context:

- Check if the input is a file path (e.g., `docs/plans/brainstorm.md`). If so, read it.
- Check if `docs/plans/` or `docs/briefs/` exist with prior brainstorming, design docs, decision briefs, or research. Read them.
- Check if there's existing code in the project. If so, this is an enhancement, not greenfield.
- Check the conversation history — has the user been discussing this idea already?

**Classify what you found:**

| Context Level | What You Have | What Happens |
|---|---|---|
| **Full design** | Design doc with decisions, scope, tech stack, data models | Skip Phase 1. Feed design into Phase 2. |
| **Decision brief** | An idea-sweep brief with verdicts and MVP definition | Phase 1 skips Step 1.1 research (already done). Brainstorming refines the brief into a design. |
| **Partial context** | Some notes, conversation, rough sketch | Phase 1 runs fully. Feed context into brainstorming + research. |
| **Raw idea** | One-line build request, no prior work | Phase 1 runs fully from scratch. |

### Step 0.1b — Project Type Classification (iOS vs Web)

Scan the build request AND any context from Step 0.1 for iOS signals. Keywords: **iOS, iPhone, iPad, SwiftUI, Swift, App Store, TestFlight, Xcode, Apple, Liquid Glass, watchOS, visionOS, SwiftData, HIG**.

| Signal | Action |
|---|---|
| iOS keywords present in prompt | Confirm with user: "This looks like an iOS app — confirm? [y/n]" |
| User confirms OR says iOS during brainstorming | Set `project_type: ios` in `docs/plans/.build-state.json` (regenerate markdown view) |
| `.xcodeproj` / `Package.swift` / `*.swift` files in existing codebase | Set `project_type: ios` automatically |
| No iOS signals, no Swift files | Default `project_type: web` |

**Autonomous mode:** skip the confirmation prompt. If iOS keywords are present, set `project_type: ios` and log the inference to `docs/plans/build-log.md`.

**Conditional branch-file load:**
- `project_type=ios`: load `protocols/ios-phase-branches.md` AND `protocols/ios-context.md`. Reference `protocols/ios-frameworks-map.md` by path only.
- `project_type=web`: load `protocols/web-phase-branches.md`.
- Load only ONE branch file.

Record the classification in `docs/plans/.build-state.json` as the top-level `project_type` field. Regenerate `.build-state.md` after the write. This field survives compaction and gates every branching block below.

**Mode-specific additions to Phase 0:** See `protocols/ios-phase-branches.md` §Phase 0 additions (iOS only).

### Step 0.1c — Learnings Loader (PITFALL replay)

Read `docs/plans/learnings.jsonl` (cross-run learnings store). If the project-local file does not exist, fall back to `~/.claude/buildanything/learnings.jsonl`. If neither exists, proceed with an empty active-learnings file and skip the rest of this step.

If a learnings file exists:
1. Parse each line as a JSON row with the schema written at Phase 5 reality sweep: `{run_id, timestamp, project_type, phase_where_learning_surfaced, metric, top_issue, fix_applied, score_delta, pattern_type}`.
2. Filter entries where `project_type` matches the current build's classification.
3. Rank the filtered entries by composite score: prefer entries matching expected `pattern_type` (PITFALL > PATTERN > HEURISTIC), then by `phase_where_learning_surfaced` (earlier phases first), then by `score_delta` magnitude.
4. Select the top 3 most relevant entries.
5. Write them to `docs/plans/.active-learnings.md` as a short markdown section downstream agents inject into their prompts. Format:

```markdown
## Prior Learnings (top 3 relevant)

- **PITFALL (phase 4.x, iOS):** [top_issue] — fix: [fix_applied]
- **PATTERN (phase 5.x, web):** [top_issue] — fix: [fix_applied]
- **HEURISTIC (phase 4.x, iOS):** [top_issue] — fix: [fix_applied]
```

Phase 4 implementer dispatch reads `.active-learnings.md` and injects its contents into every implementer prompt under a `## Prior Learnings` section. This is how learnings from build N flow into build N+1.

### Step 0.2 — Initialize

0. Create `docs/plans/` directory if it doesn't exist (greenfield projects won't have it).
1. Create a TodoWrite checklist with Phases 0-7.
2. Write `docs/plans/.build-state.json` per the schema in `protocols/state-schema.md`. Required top-level fields: `project_type`, `phase`, `step`, `input`, `context_level`, `prerequisites`, `dispatch_count`, `last_save_phase`, `autonomous`, `session_id`, `session_started`, `completed_tasks[]`, `metric_loop_scores[]`, `resume_point { phase, step, completed_tasks, git_branch }`. Then regenerate `docs/plans/.build-state.md` from the JSON as a **read-only rendered view**.
3. Go to Phase 1 (or Phase 2 if context level is "Full design").

**NO prereq collection in Phase 0.** Stack isn't decided yet. Prereqs move to Step 1.5, after Gate 1. Asking for creds before the stack is picked means asking for wrong creds or re-asking on rejection.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase -1: iOS Bootstrap (iOS-only, greenfield only)

**If `project_type=ios` AND no `.xcodeproj` exists:** follow `protocols/ios-phase-branches.md` §Phase -1 — iOS Bootstrap. Otherwise skip entirely.

iOS structural changes are out of scope for this orchestrator migration (per proposed-state §7).

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 1: Discover — BRAINSTORM ↔ RESEARCH loop

**Goal**: Turn the raw idea into a validated Design Document (the PRD) grounded in research. This ensures Phase 2 architects receive a PRD, not a guess.

**Skip if** Step 0.1 classified context as "Full design" — go straight to Phase 2.

**Orchestrator discipline in Phase 1**: Dispatch → wait → read compact return → dispatch next. No synthesis. No reasoning. No raw artifact reads. Keep it thin. The Research Synthesizer (Step 1.2) is the only agent that reads raw research files.

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 1 (iOS skill bundle, ios-swift-architect, App Store/TestFlight/iOS 26 research angles).
- `project_type=web`: no additional branch instructions.

### Step 1.0 — INITIAL BRAINSTORM

Dispatch the Brainstorm Facilitator as an INTERNAL inline role-string — NO `subagent_type`. The facilitator drives a conversation to capture the raw idea: what it is, who it's for, what problem it solves, hard constraints.

Call the Agent tool — description: "Initial brainstorm" — INTERNAL inline role-string — prompt: "You are the Brainstorm Facilitator (round 1). Your job is to drive a conversation with the user to capture the raw idea. Ask questions one at a time in plain language. Topics to cover: WHAT is being built (product/feature), WHO it's for (persona), WHAT problem it solves, HARD CONSTRAINTS (budget, timeline, platform, integrations). Keep it to 4-8 questions. Write the raw idea to `docs/plans/phase1-scratch/idea-draft.md` with a header and a section per topic. Orchestrator relays your questions to the user and relays the user's answers back to you."

**Autonomous mode:** facilitator synthesizes directly from build request + available context without asking questions. Logs rationale to `docs/plans/build-log.md`.

**Returns:** `docs/plans/phase1-scratch/idea-draft.md`

### Step 1.1 — RESEARCH (TEAM of 4 parallel agents, ONE message)

Skip if context level is "Decision brief" (research already done).

Call the Agent tool 4 times in a single message. Each gets the build request + `docs/plans/phase1-scratch/idea-draft.md`. Each writes its own output file. Raw files are NOT read by the orchestrator in Step 1.2 — a separate Research Synthesizer reads them. They ARE routed by domain to Phase 2 architects (hybrid routing — see Phase 2 Step 2.2).

1. Description: "Feature intel" — subagent_type: `feature-intel` — Prompt: "Extract competitor feature matrix for: [build request]. Idea draft: [paste idea-draft.md]. Walk 5-10 rivals. Return must-haves (features present in >=80% of rivals — table stakes) + stand-outs (features unique to individual rivals — differentiation opportunities), sorted by competitor. Save to `docs/plans/phase1-scratch/feature-intel.md`."

2. Description: "Tech feasibility" — subagent_type: `tech-feasibility` — Prompt: "Evaluate hard technical problems (Solved/Hard/Unsolved), build-vs-buy decisions, MVP scope, stack validation for: [build request]. Idea draft: [paste idea-draft.md]. Verify APIs and libraries from the draft exist and are maintained. Save to `docs/plans/phase1-scratch/tech-feasibility.md`. Report with a Technical Verdict."

3. Description: "UX research" — subagent_type: `design-ux-researcher` — Prompt: "Analyze target persona, jobs-to-be-done, current alternatives, and behavioral barriers for: [build request]. Idea draft: [paste idea-draft.md]. Save to `docs/plans/phase1-scratch/ux-research.md`. Report with a User Verdict."

4. Description: "Business model" — subagent_type: `business-model` — Prompt: "Light-touch revenue/channels/unit-economics analysis for: [build request]. Idea draft: [paste idea-draft.md]. Surface product-impact conclusions only — which features the business model requires, which channels gate the feature set. Do not write full financial modeling. Save to `docs/plans/phase1-scratch/business-model.md`."

### Step 1.2 — RESEARCH DIGEST (context protection)

Dispatch the Research Synthesizer as an INTERNAL inline role-string — NO `subagent_type`. The synthesizer reads all 4 raw research files IN ITS OWN context, synthesizes, and returns a compact digest + dynamic questions. The orchestrator never loads the raw files. Saves ~3-5K tokens of orchestrator context per build.

Call the Agent tool — description: "Research digest" — INTERNAL inline role-string — prompt: "You are the Research Synthesizer. Read these 4 raw research files with your own Read tool:
  - `docs/plans/phase1-scratch/feature-intel.md`
  - `docs/plans/phase1-scratch/tech-feasibility.md`
  - `docs/plans/phase1-scratch/ux-research.md`
  - `docs/plans/phase1-scratch/business-model.md`

Synthesize a compact findings digest (~500 words, no padding) covering:
  - Feature landscape summary (must-haves, stand-outs, gaps)
  - Technical verdict with hard-problem callouts
  - Persona + JTBD highlights
  - Business-model implications for product scope

Then generate a DYNAMIC list of 4-8 brainstorm questions tuned to what actually surfaced — not a fixed script. Example: if tech-feasibility found an unsolved problem, surface a scope question. If UX research says persona is time-poor, surface a flow-simplification question.

Write:
  1. `docs/plans/phase1-scratch/findings-digest.md` (~500 words)
  2. `docs/plans/phase1-scratch/suggested-questions.md` (4-8 dynamic questions)

Return a compact summary to the orchestrator. The orchestrator does NOT read the raw files."

### Step 1.3 — INFORMED BRAINSTORM

Dispatch the Brainstorm Facilitator (round 2) as an INTERNAL inline role-string. This is a dynamic conversation — questions adapt to what research surfaced, not a fixed script. User makes product decisions WITH research in hand.

Call the Agent tool — description: "Informed brainstorm" — INTERNAL inline role-string — prompt: "You are the Brainstorm Facilitator (round 2). Read `docs/plans/phase1-scratch/findings-digest.md` + `docs/plans/phase1-scratch/suggested-questions.md` via the Read tool. Drive a DYNAMIC conversation with the user using those questions — adapt based on answers, don't run a fixed script. Topics to cover (wording is dynamic, tuned to what surfaced):
  - Which must-have features to include vs. cut
  - Which stand-out features for differentiation
  - Any persona / JTBD adjustments
  - Does business model suggest specific features (e.g., freemium needs a free tier UI)

Orchestrator relays your questions to the user and relays answers back. Write decisions to `docs/plans/phase1-scratch/user-decisions.md`."

**Autonomous mode:** facilitator picks pragmatic defaults from the digest without asking questions. Logs rationale to `docs/plans/build-log.md`.

### Step 1.4 — DESIGN DOC + CLAUDE.md

Dispatch the Design Doc Writer as an INTERNAL inline role-string. Writes TWO outputs. The design doc is explicitly named **THE PRD** — the authoritative product document read by every Phase 2-7 agent via `refs.json` anchors, no full pastes.

Call the Agent tool — description: "Design doc and CLAUDE.md" — INTERNAL inline role-string — prompt: "You are the Design Doc Writer. Read with your own Read tool:
  - `docs/plans/phase1-scratch/idea-draft.md`
  - `docs/plans/phase1-scratch/findings-digest.md`
  - `docs/plans/phase1-scratch/user-decisions.md`

Write TWO outputs.

OUTPUT 1 — `docs/plans/design-doc.md` — **THE PRD** (authoritative product document). Header MUST begin with `# [Product Name] — PRD`. Structure:
  - Product — what it is, core value prop, success criteria
  - User — persona, JTBD, hard constraints
  - Scope — MVP features (must-haves + chosen stand-outs), explicit Out-of-Scope boundary
  - Tech Stack — chosen stack with 1-line rationale
  - Data Model — shape of core entities
  - Decisions — links to `decisions.jsonl` rows

This doc is read by all Phase 2-7 agents via `refs.json` anchors. Section headers should be stable (don't rename them later) so anchors survive.

OUTPUT 2 — `CLAUDE.md` (project root, NOT `docs/plans/`). <200-line product brain, auto-loaded into every spawned subagent context by Claude Code. The orchestrator NEVER pastes it. Structure:

```
## Product
[1-3 sentences: what this is, core value prop, what success looks like]

## User
[Primary persona: who they are, what they care about, pain points, technical sophistication]

## Tech Stack
[Stack choices with 1-line rationale for each]

## Scope
[What's in MVP vs. deferred. Hard boundaries.]

## Rules
[Project-specific hard rules derived from the product and user context.]
```

<HARD-GATE>
CLAUDE.md must be under 200 lines. Not a wiki, not a conventions doc, not a dump of everything. Minimum context an agent needs to make correct decisions about this specific product.
</HARD-GATE>

Also write `docs/plans/decisions.jsonl` with 3 rows — tech stack, data model, scope boundary — per `protocols/decision-log.md`. Each row carries `decided_by: architect` and a `ref` anchor into `design-doc.md`. Bounded per the protocol's hard field constraints."

**Writes:** `docs/plans/design-doc.md` (PRD), `CLAUDE.md`, `docs/plans/decisions.jsonl` (3 rows)

### Quality Gate 1

**Interactive:** Present Design Doc summary + Research Digest findings to user. Ask: "Approve this design, or adjust?"

<HARD-GATE>
Gate 1 rejection path is codified:
  - On NO → loop back to Phase 1 Step 1.0 with user feedback passed back to Brainstorm Facilitator (round 1 re-invocation).
  - On YES → proceed to Step 1.5.
  - DO NOT PROCEED without user approval in interactive mode.
</HARD-GATE>

**Autonomous:** Log design-doc path + digest path to `docs/plans/build-log.md`. Auto-approve. Proceed.

Update TodoWrite and `.build-state.json`.

### Step 1.5 — PREREQ COLLECTOR (post-Gate 1)

Dispatch the Prereq Collector as an INTERNAL inline role-string. Reads `design-doc.md` to determine which credentials are actually needed for the chosen stack. Asks the user ONLY for stack-specific creds.

Call the Agent tool — description: "Prereq collection" — INTERNAL inline role-string — prompt: "You are the Prereq Collector. Read `docs/plans/design-doc.md` with your own Read tool — focus on the Tech Stack section. Determine which credentials the chosen stack actually needs (do NOT ask for a generic laundry list — ask ONLY for what this stack uses).

Example: 'You chose Next.js + Supabase + Vercel — I need your Supabase URL, Supabase anon key, and Vercel auth token.' Skip anything the stack doesn't use.

Output: `docs/plans/phase1-scratch/prereqs.json` with shape `{supabase_url, supabase_anon_key, ...}`. Ask the user once. If they don't have a credential, mark it as `null` and note in the JSON that Phase 4 will surface it as a blocker if hit."

**Autonomous mode:** Create `.env.example` with required keys. Proceed. Log missing keys as blockers if hit during build.

**Why here:** at Phase 0 we don't yet know the stack (it's decided in Step 1.3). Asking for creds before Gate 1 means asking for wrong creds or re-asking on rejection.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 2: Plan / Architect — TEAM of 6 + sequence

**Goal**: Convert the PRD into a concrete architecture and ordered task list with explicit dependencies. Every architect receives the PRD (design-doc.md) + the Research Digest + its domain's raw research file (hybrid routing).

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 2 (replaces Backend/Frontend dispatch with SwiftUI/SwiftData/Concurrency/iOS security; adds Feature Flag Resolution at end of phase).
- `project_type=web`: no additional branch instructions.

### Step 2.1 — Explore existing codebase (only if existing code)

If existing code, call the Agent tool — description: "Explore codebase" — INTERNAL inline role-string — prompt: "Explore existing codebase. Map architecture layers, file conventions, testing patterns, existing features, integration points. Return a compact summary suitable for architects to consume — not a full dump."

If greenfield, skip to Step 2.2.

### Step 2.2 — Architecture Design (TEAM of 6 parallel architects, ONE message)

Call the Agent tool 6 times in a single message. Each receives: `docs/plans/design-doc.md` (PRD) + `docs/plans/phase1-scratch/findings-digest.md` + ITS DOMAIN'S RAW RESEARCH FILE (hybrid routing).

1. Description: "Backend architecture" — subagent_type: `engineering-backend-architect` — Prompt: "Design system architecture. PRD: [paste docs/plans/design-doc.md]. DIGEST: [paste docs/plans/phase1-scratch/findings-digest.md]. YOUR DOMAIN RAW: [paste tech-feasibility.md + feature-intel.md]. Include services, data models, API contracts, database schema, integration points. Respect stack choices from PRD."

2. Description: "Frontend architecture" — subagent_type: `engineering-frontend-developer` — Prompt: "Design frontend architecture. PRD: [paste design-doc.md]. DIGEST: [paste findings-digest.md]. YOUR DOMAIN RAW: [paste ux-research.md + feature-intel.md]. Include component hierarchy, layout strategy, responsive approach, state management, routing. Align UX with the persona from research."

3. Description: "Data engineering" — subagent_type: `engineering-data-engineer` — Prompt: "Design data architecture. PRD: [paste design-doc.md]. DIGEST: [paste findings-digest.md]. YOUR DOMAIN RAW: [paste tech-feasibility.md]. Include ETL/ELT patterns, schema versioning, query patterns, indexing strategy, data lineage, migration plan."

4. Description: "Security architecture" — subagent_type: `engineering-security-engineer` — Prompt: "Security review. PRD: [paste design-doc.md]. DIGEST: [paste findings-digest.md]. Cover auth model, input validation, secrets management, threat model, dependency hygiene. Note: no raw research file routed — digest only (security architecture is a cross-cutting concern)."

5. Description: "A11y constraints" — subagent_type: `a11y-architect` — Prompt: "Accessibility-driven architecture constraints. PRD: [paste design-doc.md]. DIGEST: [paste findings-digest.md]. YOUR DOMAIN RAW: [paste ux-research.md]. Identify WCAG 2.2 AA requirements that affect component choice, navigation structure, form patterns, focus management, landmark regions."

6. Description: "Performance constraints" — subagent_type: `testing-performance-benchmarker` — Prompt: "Define quality targets for this build. PRD: [paste design-doc.md]. DIGEST: [paste findings-digest.md]. YOUR DOMAIN RAW: [paste tech-feasibility.md]. Write `docs/plans/quality-targets.json` covering bundle budget, LCP, TTI, API p95, Lighthouse scores. Use per-Scope budgets from `orchestration-proposed-state.md` §11: Marketing 500KB / Product 300KB / Dashboard 400KB / Internal 200KB gzipped."

After Phase 2 dispatch returns, the 4 raw research files are **SPENT**. They sit on disk for audit but no downstream phase reads them — they are NOT in the `refs.json` index. The orchestrator MOVES them to `docs/plans/phase1-scratch/` if not already there, to make the distinction physically obvious.

The 6 architect outputs are synthesized by Step 2.3 below into `architecture.md`. Each architect writes a compact return; the Implementation Blueprint agent stitches them together.

### Step 2.3 — Sequence: Implementation Blueprint → Sprint Breakdown → DAG Validator → Refs Indexer

Four sequential dispatches.

1. Description: "Implementation blueprint" — subagent_type: `code-architect` — Prompt: "Implementation blueprint. PRD: [paste design-doc.md]. Architecture outputs from the 6 architects: [paste compact returns from Step 2.2]. Include specific files to create/modify, build sequence, dependency order. Write `docs/plans/architecture.md` with stable section anchors per `protocols/architecture-schema.md`. Required top-level sections: Overview, Frontend, Backend, Data Model, Security, Infrastructure, MVP Scope, Out of Scope. Scope to MVP boundary from the PRD."

2. Description: "Sprint breakdown" — subagent_type: `planner` — Prompt: "Break this architecture into ordered, atomic tasks. Each task needs: description, acceptance criteria, **dependencies** (list of task IDs this depends on), size (S/M/L), **Behavioral Test** field for every UI task (concrete interaction: 'Navigate to [page], click [element], verify [outcome]') or curl-based acceptance test for API tasks. ARCHITECTURE: [paste docs/plans/architecture.md]. PRD: [paste docs/plans/design-doc.md]. Scope to MVP only. Save to `docs/plans/sprint-tasks.md`. Dependencies field is load-bearing — Phase 4 uses it to batch independent tasks in parallel."

3. Description: "Task DAG validator" — INTERNAL inline role-string — Prompt: "You are the Task DAG Validator. Read `docs/plans/sprint-tasks.md`. Validate for DAG correctness:
  - No circular dependencies
  - All referenced task IDs in the Dependencies field exist
  - Sizing is consistent (S/M/L)
  - Dependencies match the architecture document (don't depend on a task that builds a component you don't need)
  - Every UI task has a Behavioral Test field; every API task has a curl-based test
Report any violations. If clean, return PASS. If violations, return a list of fix requests — Sprint Breakdown re-dispatches once with the fix list."

4. Description: "Refs indexer" — INTERNAL inline role-string — Prompt: "You are the Refs Indexer. Generate `docs/plans/refs.json` covering ALL live downstream docs:
  - `docs/plans/design-doc.md` (PRD)
  - `docs/plans/architecture.md`
  - `docs/plans/sprint-tasks.md`
  - `docs/plans/quality-targets.json`
  - `docs/plans/visual-design-spec.md` (if it exists yet — Phase 3 extends refs.json after it writes this file)

For each doc, extract section anchors into a flat index. Schema: `[{\"anchor\": \"design-doc.md#persona\", \"topic\": \"user persona\", \"file_path\": \"docs/plans/design-doc.md\"}, ...]`. This index is consumed by the Phase 4 Briefing Officer for per-task context maps. Do NOT include Phase 1 scratch files — they are SPENT."

**Architecture Metric Loop (callable service):** Run the Metric Loop Protocol (`protocols/metric-loop.md`) on `architecture.md`. Define a metric: coverage of PRD requirements, specificity, consistency across the 6 architects, and **simplicity** — is this the simplest architecture that meets the requirements? Could any service, abstraction, or dependency be eliminated? Penalize over-engineering. Max 3 iterations.

**Architecture decisions:** Architecture synthesizer appends decision rows to `docs/plans/decisions.jsonl` for cross-cutting Phase 2 decisions — API contract, persistence layer, auth model, framework choice. Author = `architect`. Each row carries a `ref` anchor pointing into `architecture.md` per `protocols/decision-log.md`. Total: 4 rows.

**Writes:** `docs/plans/architecture.md`, `docs/plans/sprint-tasks.md`, `docs/plans/quality-targets.json`, `docs/plans/refs.json`, `docs/plans/decisions.jsonl` (4 new rows).

### Quality Gate 2

**Interactive:** Present Architecture + Sprint Task List (with dependency graph). Ask: "Approve to start designing + building, or flag changes?"

<HARD-GATE>
Gate 2 rejection path is codified:
  - On NO → loop back to Phase 2 with user feedback.
  - On YES → proceed to Phase 3.
  - DO NOT PROCEED without user approval in interactive mode.
  - Also codifies the LRR BLOCK backward edge: `LRR BLOCK authoring=Phase 2 → back to Phase 2`. The ⭐⭐ star rule routes BLOCK findings via Aggregator decisions.jsonl `decided_by` lookup; if `decided_by == architect`, the build re-opens Phase 2 with the finding as input.
</HARD-GATE>

**Autonomous:** Log to `docs/plans/build-log.md`. Auto-approve. Proceed.

Update TodoWrite and `.build-state.json`.

**iOS feature flag resolution:** if `project_type=ios`, resolve `ios_features` before leaving Phase 2 per `protocols/ios-phase-branches.md` §Phase 2 → Feature Flag Resolution.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 3: Design (DNA-first SEQUENCE)

**Goal**: Lock Visual DNA first, then research against it, then compose from library, then spec, then implement, then critique, then a11y.

**NOTE:** Runs AFTER Phase 2. Cannot parallelize — design decisions depend on architecture outcomes.

**Skip if** the project has no user-facing frontend (CLI tools, pure APIs, backend services).

<HARD-GATE>
UI/UX IS THE PRODUCT. This phase is a full peer to Architecture and Build — not a footnote, not an afterthought. Do NOT skip, compress, or rush this phase for any reason.

Phase 4 WILL NOT START without `docs/plans/visual-design-spec.md` (web) or `docs/plans/ios-design-board.md` (iOS). If the artifact does not exist, return here.
</HARD-GATE>

**Mode-specific branch files drive Phase 3 in detail:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 3 (HIG + App Store + screenlane harvest → iOS Design Board, SwiftUI Preview QA loop).
- `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 3 — this file contains the NEW structure with steps 3.0-3.7 covering Visual DNA Selection (Brand Guardian as DNA owner at 3.0), Visual Research, Component Library Mapping, UX Architecture, Visual Design Spec, Inclusive Visuals Check, Style Guide Implementation (wrapped in Design Critic metric loop), and A11y Design Review. See `orchestration-proposed-state.md` §11 for the component library strategy.

**Phase 3 write discipline:** Phase 3 is the writer for `docs/plans/visual-design-spec.md` (web) and extends `docs/plans/refs.json` to cover the visual spec anchors once it lands. Phase 3 does NOT write to `architecture.md` or `sprint-tasks.md` — those are Phase 2's.

<HARD-GATE>
LRR BLOCK backward edge: `LRR BLOCK authoring=Phase 3 → back to Phase 3`. The ⭐⭐ star rule routes BLOCK findings via Aggregator decisions.jsonl `decided_by` lookup; if `decided_by == design-brand-guardian` or any Phase 3 writer, the build re-opens Phase 3 with the finding as input.
</HARD-GATE>

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 4: Build — PARALLEL BATCHES by task dependencies

<HARD-GATE>
Before starting Phase 4: Phase 2 must be approved, Phase 3 must have produced the design artifact for this mode (`visual-design-spec.md` web / `ios-design-board.md` iOS). You MUST call the Agent tool for EVERY task. No exceptions.
</HARD-GATE>

**Goal**: Scaffold project + execute sprint tasks in dependency-ordered batches. Independent sibling tasks run in parallel (~30-50% wall-clock saving on typical sprint).

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 4 (entitlements generator + Info.plist hardening, XcodeBuildMCP folder structure, SwiftUI design tokens, Maestro flow stubs).
- `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 4 (web project scaffolding, CSS design system tokens, Playwright acceptance test stubs).

### Step 4.0 — Scaffold (old Phase 4 Foundation merged here)

Scaffolding is project skeleton + design system + acceptance test stubs. Three sequential dispatches (full details in the mode-specific branch file):

1. Description: "Project scaffolding" — subagent_type: `engineering-rapid-prototyper` — mode: "bypassPermissions" — prompt per branch file (web: Next.js/Vite/etc; iOS: Xcode project from bootstrap). [COMPLEXITY: M]

2. Description: "Design system setup" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt per branch file. Implements design tokens from `visual-design-spec.md` or `ios-design-board.md`. The living style guide from Phase 3 is the reference implementation — components must match. [COMPLEXITY: M]

3. Description: "Scaffold acceptance tests" — INTERNAL inline role-string — mode: "bypassPermissions" — prompt: "Scaffold acceptance tests from sprint-tasks.md. Use Page Object Model. Read `docs/plans/sprint-tasks.md`. For every task with a Behavioral Test field, create a Playwright test stub (web) or Maestro flow stub (iOS). Each stub: navigate → interact → assert. Stubs must FAIL right now (features aren't built yet) — that's correct. Commit: 'test: scaffold acceptance tests from sprint tasks'."

**Scaffold verification:** Run the Verify Protocol (INTERNAL inline — "Verify scaffolding") — 7 checks sequentially, stop on first FAIL. Do not proceed to Step 4.1 until PASS.

### Step 4.1+ — Task execution in dependency-ordered batches

Expand TodoWrite with each sprint task.

Build a DAG from `sprint-tasks.md` Dependencies fields. Execute in batches: the next batch is the set of all tasks whose dependencies are all complete. Dispatch each batch as parallel Agent tool calls in ONE message.

**Per-task flow (runs for every task in every batch):**

#### Briefing Officer (INTERNAL inline)

Dispatch before every implementer. Assembles a compact <40-line context map that tells the implementer EXACTLY where to look for each kind of context. Refs not pastes.

Call the Agent tool — description: "Briefing for [task name]" — INTERNAL inline role-string — prompt: "You are the Briefing Officer. Read `docs/plans/refs.json` and the task row for [task-id] from `docs/plans/sprint-tasks.md`. Build a compact context map (~40 lines max) in this exact shape:

```
CONTEXT MAP — [task-id] [task name]
  persona / JTBD     → design-doc.md#persona
  product scope      → design-doc.md#scope
  visual tokens      → visual-design-spec.md#tokens
  component variants → component-manifest.md#[category]
  auth model         → architecture.md#auth
  data schema        → architecture.md#data-model
  sibling task deps  → sprint-tasks.md#[dep-id-1], #[dep-id-2]
  prior decisions    → decisions.jsonl rows [row-id-1], [row-id-2]
  quality targets    → quality-targets.json (full file)
```

CLAUDE.md is NOT in the map — it auto-loads into every subagent. Raw Phase 1 research is NOT in the map — it is SPENT. The implementer reads refs on-demand using the Read tool; no full pastes."

The Briefing Officer's output is the handoff payload for the implementer — not for the orchestrator to re-paste.

#### Implementer dispatch (subagent_type by task type)

Dispatch by task type and complexity:
- UI tasks: `subagent_type: engineering-frontend-developer` (S/M) or `subagent_type: engineering-senior-developer` (L)
- Backend tasks: `subagent_type: engineering-backend-architect` (L) or `subagent_type: engineering-senior-developer` (M)
- Hard / complex / cross-cutting tasks: `subagent_type: engineering-senior-developer`

Call the Agent tool — description: "[task-id] [task name]" — subagent_type per above — mode: "bypassPermissions" — prompt: "[COMPLEXITY: S/M/L from sprint-tasks.md]. TASK: [task description + acceptance criteria from sprint-tasks.md]. CONTEXT MAP from Briefing Officer: [paste Briefing Officer output]. Use the Read tool to pull refs as needed — do NOT expect pasted architecture content.

## Prior Learnings
[paste contents of `docs/plans/.active-learnings.md` if it exists, otherwise omit this section]

## Decision Log Schema (use ONLY on deviation)
If your implementation deviates from the planned task — e.g., the acceptance criteria force a different approach than `architecture.md` assumes — append ONE row to `docs/plans/decisions.jsonl` with this exact schema:
```json
{\"decision_id\": \"D-4-<seq>\", \"phase\": \"4\", \"timestamp\": \"<ISO8601>\", \"decision\": \"<what you changed>\", \"chosen_approach\": \"<short sentence>\", \"rejected_alternatives\": [{\"approach\": \"<planned approach>\", \"reason\": \"<why it didn't work>\", \"revisit_criterion\": \"<1 sentence>\"}], \"decided_by\": \"implementer\", \"ref\": \"sprint-tasks.md#[task-id]\", \"status\": \"open\"}
```
Do NOT write a decision row for on-plan work. Deviation rows only.

Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

#### Per-task security review (auth/PII tasks only)

FOR tasks touching auth, PII, secrets, or payment flows — add a per-task security review BEFORE Senior Dev cleanup:

Call the Agent tool — description: "Security review for [task-id]" — subagent_type: `security-reviewer` — prompt: "Review changed files from [task-id] for security issues. Scope: auth logic, input validation, secrets handling, dependency hygiene, OWASP Top 10 for web (or iOS Keychain / ATS / data protection for iOS). Return blocking findings only — 80%+ confidence threshold. Files to review: [list from implementer's changeset]."

#### Senior Dev cleanup (simplifier + refactor-cleaner if TS)

Two-pass cleanup. Scope is sacred: ONLY files from the implementation changeset. Zero exceptions.

1. Call the Agent tool — description: "Simplify [task-id]" — subagent_type: `code-simplifier` — mode: "bypassPermissions" — prompt: "Simplify changed files from [task-id]. Remove dead code, unused imports, redundant abstractions. Do NOT add features. Do NOT change architecture. Do NOT touch files outside the changeset. If simplification breaks acceptance criteria, revert and skip. Files: [list]."

2. If TS/JS task: Call the Agent tool — description: "Refactor [task-id]" — subagent_type: `refactor-cleaner` — mode: "bypassPermissions" — prompt: "Run knip/depcheck/ts-prune on changed files from [task-id]. Remove orphaned exports, unused deps, dead files. Same scope rules as simplifier — changeset only. Files: [list]."

Skip cleanup if trivial (< 20 lines, single file).

#### Per-task code review (parallel pair)

Call the Agent tool 2 times in one message after Senior Dev cleanup:

1. Description: "Code review for [task-id]" — subagent_type: `code-reviewer` — Prompt: "Review changed files from [task-id]. Report findings with 80%+ confidence threshold only — skip low-confidence nitpicks. Scope: changeset only. Acceptance criteria: [paste from task]. Files: [list]."

2. Description: "Silent failure hunt for [task-id]" — subagent_type: `silent-failure-hunter` — Prompt: "Hunt silent failures in changed files from [task-id]. Targets: empty catch blocks, try/catch returning null, swallowed errors, unhandled promise rejections, assertions disabled in production. Files: [list]. Report blocking findings only."

#### Metric Loop (generator/critic)

Run the Metric Loop Protocol (callable service) on the task implementation. Define a metric based on the task's acceptance criteria. For UI-facing tasks, include behavioral verification per the mode-specific branch file (web: agent-browser; iOS: SwiftUI Preview captures). Max 5 iterations.

Generator: same implementer agent re-invoked. Critic: measurement agent dispatched fresh. Never share context.

On target met: mark task complete. On stall: accept if score >= 60% of target (autonomous) or present to user (interactive).

#### Verify Service (7-check gate)

Run the Verify Protocol (INTERNAL inline — "Verify scaffolding") after the task completes. All 7 checks must pass before the task is marked done in TodoWrite. If FAIL, dispatch a fix agent with the error, re-verify. Max 3 fix attempts.

#### After each task completes

Update TodoWrite and `.build-state.json`. Write a compact summary to `docs/plans/.task-outputs/[task-id].json` with {files-changed, tests-passing, verify-status}.

**Writes:** source code, `docs/plans/.task-outputs/`, `docs/plans/decisions.jsonl` (ONLY on deviation rows, schema given in dispatch prompt above). During parallel task batches, deviation writes serialize through the orchestrator.

<HARD-GATE>
LRR NEEDS_WORK backward edge: `LRR NEEDS_WORK (code-level) → back to Phase 4 target task`. The Aggregator classifies the finding and routes to the specific task via `related_decision_id` lookup; Phase 4 re-opens that task with the finding as input.
</HARD-GATE>

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 5: Audit — TEAM of 6 + eval harness + 3 parallel + feedback synth

<HARD-GATE>
Before starting Phase 5: run the Verify Protocol (7 checks) one more time. All checks must pass before expensive audit agents fire.
</HARD-GATE>

**Goal**: Surface quality issues before Launch Review. Split from old Phase 6 — old 6.1-6.3 (5-agent audit, eval harness, E2E + dogfood + fake-data) live here. Old 6.4-6.5 (Reality Check + LRR) move to Phase 6.

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 5 (iOS twin commands: `/buildanything:verify` → `/buildanything:ux-review` → `/buildanything:fix` in sequence; Maestro smoke tests). Skip the web TEAM below and jump to Step 5.4 Feedback Synthesizer with iOS evidence.
- `project_type=web`: continue below.

### Step 5.1 — TEAM of 6 parallel auditors (ONE message)

Read the NFRs from `docs/plans/quality-targets.json`. Pass the relevant targets to each audit agent so they have concrete thresholds, not generic checks.

Call the Agent tool 6 times in one message:

1. Description: "API testing" — subagent_type: `testing-api-tester` — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. NFR targets: [paste from quality-targets.json]. Report findings with severity counts."

2. Description: "Performance audit" — subagent_type: `testing-performance-benchmarker` — Prompt: "Measure response times, identify bottlenecks, flag performance issues. NFR targets from quality-targets.json: [paste]. Bundle size per-Scope budgets apply (Marketing 500KB / Product 300KB / Dashboard 400KB / Internal 200KB gzipped). Report benchmarks AGAINST these targets, not generic metrics."

3. Description: "A11y audit" — subagent_type: `a11y-architect` — Prompt: "WCAG 2.2 AA runtime compliance audit on all interfaces. Check screen reader, keyboard nav, contrast, focus order, touch targets (>=44px), reduced-motion variants. Report issues with severity (Critical/Serious/Moderate/Minor)."

4. Description: "Security audit" — subagent_type: `engineering-security-engineer` — Prompt: "Security review at app level: auth, input validation, data exposure, dependency vulnerabilities. NFR targets: [paste security section from quality-targets.json]. Report findings with severity."

5. Description: "UX quality audit" — subagent_type: `design-ux-researcher` — Prompt: "UX quality review of every user-facing page. First, screenshot the living style guide at /design-system (web) as your reference. Then review every product page: loading states (every async action shows a loading indicator), error states (every form and API call shows user-friendly feedback), empty states (lists/tables handle zero items), mobile responsiveness (test at 375px — touch targets >= 44px, no horizontal scroll), form validation (inline feedback, not alert()), transition smoothness, visual consistency vs style guide (buttons, inputs, cards, colors, spacing should match). Report issues with page, severity, and screenshot."

6. Description: "Brand Guardian drift check" — subagent_type: `design-brand-guardian` — Prompt: "You are the Phase 5 drift check. Read docs/plans/visual-dna.md (the DNA card locked at Phase 3.0) + the actually-built pages via Playwright screenshots under docs/plans/evidence/. Score whether Phase 4 implementers stayed true to the DNA or drifted away from it. Specifically check: does the built Character axis match the DNA? Does Density match? Is Material consistent? Is Motion aligned? Report drift count and specific elements. Save findings to docs/plans/evidence/brand-drift.md. Note: this is a drift check only — the Phase 6 LRR Brand Guardian chapter does the verdict. You do NOT issue a pass/fail here, only surface findings."

### Step 5.2 — Sequence: Eval Harness → Metric Loop

Run the Eval Harness Protocol (`protocols/eval-harness.md`). Define 8-15 concrete, executable eval cases from the audit findings and architecture doc. Run the eval agent. Record baseline pass rate. CRITICAL and HIGH failures feed into the Metric Loop as specific issues to fix.

Run the Metric Loop Protocol (callable service) on the full codebase using audit findings as initial input. Define a composite metric based on what this project needs. Max 4 iterations. When fixing, dispatch to the RIGHT specialist — security → `security-reviewer`, a11y → `engineering-frontend-developer`, perf → `testing-performance-benchmarker`. Don't send everything to one agent.

Re-run the Eval Harness after the metric loop exits. All CRITICAL eval cases must now pass. If any CRITICAL case still fails, include it as evidence for Phase 6.

### Step 5.3 — TEAM of 3 parallel (ONE message)

Call the Agent tool 3 times in one message:

1. Description: "E2E runner" — INTERNAL inline role-string — mode: "bypassPermissions" — Prompt: "Run Playwright E2E test generation, execution, and stability check per `protocols/web-phase-branches.md` Phase 5 E2E steps (generate and run E2E tests for User Journeys, 3 mandatory iterations for flakiness detection). Report results + artifact paths. Records results to `docs/plans/evidence/e2e/iter-3-results.json`."

2. Description: "Dogfood the app" — INTERNAL inline role-string + agent-browser skill — mode: "bypassPermissions" — Prompt: "You are the Dogfood runner. Run the agent-browser dogfood skill against the running app at http://localhost:[port]. Explore every reachable page. Click every button. Fill every form. Check console for errors. Report a structured list of issues with severity ratings, screenshots, repro steps. Write findings to `docs/plans/evidence/dogfood/findings.md`. Do NOT classify or route findings — that's the Feedback Synthesizer's job at Step 5.4."

3. Description: "Fake-data detector" — INTERNAL inline role-string — mode: "bypassPermissions" — Prompt: "Run the Fake Data Detector Protocol (`protocols/fake-data-detector.md`). Static analysis: grep for Math.random() in business data paths, hardcoded API responses, setTimeout faking async, placeholder text. Dynamic analysis: inspect HAR files from `docs/plans/evidence/` for missing real API calls, static responses, absent WebSocket traffic. Write findings to `docs/plans/evidence/fake-data-audit.md` with file:line refs and severity."

### Step 5.4 — Feedback Synthesizer

The Dogfood findings used to dead-end. Now route them to fix loops.

Call the Agent tool — description: "Synthesize dogfood findings" — subagent_type: `product-feedback-synthesizer` — Prompt: "Interpret Dogfood output. Input: `docs/plans/evidence/dogfood/findings.md`. For each finding, classify it and assign a target phase for the fix:
  - Code-level bug (broken feature, failing logic, fake data) → `target_phase: 4`, assign to the specific task that owns the affected file
  - Visual/design issue (styling drift, missing state, a11y gap) → `target_phase: 3`, assign to the Phase 3 step that owns the relevant artifact
  - Structural/architecture issue (missing feature, wrong data flow, API mismatch) → `target_phase: 2`, assign to the architecture section

Output: `docs/plans/evidence/dogfood/classified-findings.json` with shape `[{finding_id, severity, target_phase, target_task_or_step, description, evidence_ref}, ...]`. This file is read by the Phase 5 fix loop and by the Phase 6 LRR Aggregator for backward routing."

**Phase 5 fix loop:** For each CRITICAL/HIGH classified finding, dispatch the appropriate fix agent based on `target_phase`. Max 2 fix cycles.

**Writes:** `docs/plans/evidence/*.json`, `docs/plans/evidence/fake-data-audit.md`, `docs/plans/evidence/dogfood/classified-findings.json`, `docs/plans/learnings.jsonl` (reality sweep writes PITFALL/PATTERN rows — see `protocols/decision-log.md` for the Dissent Log Revisit Pass path).

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 6: Launch Readiness Review

**Goal**: 5 independent chapter judges + mechanical aggregator with file-completeness checkpoint + author-aware backward routing on BLOCK.

Split from old Phase 6. Old 6.4 (Reality Check) and 6.5 (LRR) merged and restructured. Reality Checker keeps its evidence sweep role only — the combined verdict authority moved to the LRR Aggregator.

### Step 6.0 — Reality Check (evidence sweep + dissent log revisit pass)

Reality Checker runs its existing evidence sweep per `commands/build.md` precondition list. Writes the manifest to `docs/plans/evidence/reality-check-manifest.json`. Does NOT issue a combined verdict.

<HARD-GATE>
PRECONDITION (orchestrator-side, BEFORE dispatching Reality Checker):

REQUIRED EVIDENCE FOR ALL PROJECTS:
  - `docs/plans/.build-state.json` exists, contains current build session id, contains a recent `VERIFY: PASS` line from this session.

REQUIRED EVIDENCE FOR `project_type=web`:
  - `docs/plans/evidence/eval-harness/baseline.json` (non-empty)
  - `docs/plans/evidence/eval-harness/final.json` (non-empty)
  - `docs/plans/evidence/e2e/iter-3-results.json` (non-empty)
  - `docs/plans/evidence/dogfood/findings.md` (non-empty)
  - `docs/plans/evidence/dogfood/classified-findings.json` (non-empty)
  - `docs/plans/evidence/fake-data-audit.md` (non-empty)
  - `docs/plans/evidence/manifest.json`

REQUIRED EVIDENCE FOR `project_type=ios`:
  - `docs/plans/ios-verify-report.md` (non-empty)
  - `docs/plans/ios-ux-review-report.md` (non-empty)
  - At least one `*.yaml` file in `maestro/`
  - At least one `*.png` screenshot in `docs/plans/evidence/maestro-runs/` from this build session
  - `docs/plans/evidence/manifest.json`

If any required file does not exist or is empty, do NOT dispatch Reality Checker. Log "REALITY CHECK BLOCKED" with missing-file list. Interactive: present blocker to user. Autonomous: return to the failing step and re-dispatch once; if still missing, abort.
</HARD-GATE>

Call the Agent tool — description: "Evidence sweep" — subagent_type: `code-reviewer` — Prompt: "You are the Reality Checker — evidence-sweep role only. Default verdict: NONE. You receive evidence by FILE PATH only — never by paste. Use Read and Glob tools to verify each file exists, is non-empty, was modified within this build session, contains no placeholder strings ('TODO', 'PLACEHOLDER', 'TBD', 'FIXME', 'XXX').

Evidence paths to verify: [orchestrator pastes the precondition list per project_type].

For every Behavioral Test field in `docs/plans/sprint-tasks.md`, verify a corresponding evidence file exists in `docs/plans/evidence/[task-slug]/` AND that the test-stub-detector (per `protocols/verify.md` Step 2) does not flag the corresponding test file as a stub.

For every architecture MUST in `docs/plans/architecture.md`, verify the implementation file exists via Glob AND contains the named symbol via Grep.

**Dissent Log Revisit Pass:** Read `docs/plans/decisions.jsonl`. For every row where `status == \"open\"` and `revisit_criterion` is non-empty, semantically evaluate the criterion against current evidence. If triggered:
  1. Emit a structural finding in the manifest: `revisit-criterion-triggered: D-N-M — [criterion]`
  2. Append a PITFALL row to `docs/plans/learnings.jsonl` with `{pattern_type: \"PITFALL\", top_issue: \"[decision] — [criterion]\", fix_applied: \"[what build did instead]\", provenance: {decision_id: \"D-N-M\"}}`
  3. Flag the triggered decision — this feeds LRR as a potential cross-chapter concern

Write the evidence manifest to `docs/plans/evidence/reality-check-manifest.json` with fields `{file_path, sha256, byte_count, modified_time, verdict_contribution}` per file. Emit any structural findings surfaced during the sweep. DO NOT issue a combined verdict — that authority moved to the LRR Aggregator at Step 6.1 below."

### Step 6.1 — LRR: 5 chapter judges in parallel (ONE message)

Follow the Launch Readiness Review Protocol (`protocols/launch-readiness.md`). The net-5 panel: Eng-Quality (merged Eng+QA with PM chapter folded in), Security, SRE (includes Performance), A11y (NEW SEAT), Brand Guardian (REPLACES old Design mechanical check).

Dispatch 5 chapter judges in parallel. Each receives fresh context, its own evidence slice, and the chapter verdict schema from `protocols/launch-readiness.md`.

Call the Agent tool 5 times in ONE message. Note: the Eng-Quality chapter dispatches `code-reviewer` as primary, with a parallel `pr-test-analyzer` sub-dispatch for test-coverage adequacy evidence that feeds into the Eng-Quality verdict file.

1. Description: "LRR Eng-Quality chapter" — subagent_type: `code-reviewer` — Prompt: "You are the Eng-Quality chapter of the Launch Readiness Review. Your natural tendency is to be encouraging. Fight it. Default verdict: NEEDS WORK.

Read: `docs/plans/architecture.md`, `docs/plans/.task-outputs/`, `protocols/verify.md` check outputs from `.build-state.json`, test results from Phase 4 and 5, eval-harness results from `docs/plans/evidence/eval-harness/`, and `docs/plans/evidence/lrr/pm.json` (Requirements Coverage verdict from Step 7.0 — folded into Eng-Quality as a sub-input). Also read `docs/plans/decisions.jsonl` for cross-chapter context.

Before writing the final verdict, spawn a parallel subagent dispatch: description: 'LRR test coverage adequacy' — subagent_type: `pr-test-analyzer` — prompt: 'You are a test-coverage auditor for the Eng-Quality LRR chapter. Read the test files under tests/, task-outputs/, and behavioral-test stub detector output. Evaluate: (1) do declared behavioral tests have non-stub bodies, (2) does coverage match the PR diff scope, (3) are edge cases covered, (4) are any tests flaky markers set. Return a JSON summary with test_coverage_score (0-100), stub_flagged_count, edge_case_gap_count, recommendations[]. Save to docs/plans/evidence/lrr/eng-quality-coverage.json.' Read the resulting eng-quality-coverage.json and fold its findings into your verdict.

Evaluate code quality + test coverage adequacy + architecture conformance + requirements coverage TOGETHER (single coherent view — merged from old Eng + QA chapters). Check: do declared behavioral tests actually exercise the features? Are there stub-flagged tests? Do tests match task acceptance criteria? Does the built code match architecture MUSTs? Are PM MVP features all COVERED?

Write verdict to `docs/plans/evidence/lrr/eng-quality.json` per `protocols/launch-readiness.md` schema. Fields: `chapter=eng-quality`, `verdict` (PASS|CONCERNS|BLOCK), `override_blocks_launch` (false unless BLOCK), `evidence_files_read` (non-empty, MUST include eng-quality-coverage.json), `findings[]` (each with `severity`, `description`, `evidence_ref`, `related_decision_id` if blocker ties to a decisions.jsonl row), `follow_up_spawned=false`, `follow_up_findings=null`. Eng-Quality CANNOT spawn follow-ups."

2. Description: "LRR Security chapter" — subagent_type: `security-reviewer` — Prompt: "You are the Security chapter of the LRR. Read: `docs/plans/evidence/fake-data-audit.md`, Phase 5 security audit output (from Step 5.1), eval-harness security cases. Also read `docs/plans/decisions.jsonl` for context.

Evaluate auth model, input validation, secrets management, dependency vulnerabilities. Write verdict to `docs/plans/evidence/lrr/security.json` per schema. Fields: `chapter=security`, `verdict`, `override_blocks_launch`, `evidence_files_read` (non-empty), `findings[]` (with `related_decision_id` when applicable), `follow_up_spawned` (boolean), `follow_up_findings` (null or typed object).

Security MAY spawn ONE read-only follow-up investigation, but ONLY if verdict would be BLOCK — NOT on suspicion. This is tightened from current behavior. Follow-up: read-only, Read/Grep/Glob only, max 15 tool calls, self-report tool_calls_used. See `protocols/launch-readiness.md` for follow-up flow."

3. Description: "LRR SRE chapter" — subagent_type: `engineering-sre` — Prompt: "You are the SRE chapter of the LRR. Read: performance-audit outputs from Phase 5 (Step 5.1 performance auditor + Step 5.2 eval-harness perf cases), Performance Benchmarker evidence, NFRs from `docs/plans/quality-targets.json` and `docs/plans/sprint-tasks.md`, reliability checks. Also read `docs/plans/decisions.jsonl` for context.

Evaluate whether the build meets NFR targets (response time, load handling, error rates) and is production-ready under load. Bundle-size budget violations (>25% over Scope budget) auto-block. Write verdict to `docs/plans/evidence/lrr/sre.json` per schema.

SRE MAY spawn ONE read-only follow-up investigation, but ONLY if verdict would be BLOCK. Same caps as Security."

4. Description: "LRR A11y chapter" — subagent_type: `a11y-architect` — Prompt: "You are the A11y chapter of the LRR (NEW SEAT in this panel — closes the biggest coverage gap). Read: Phase 5 a11y audit output (from Step 5.1), WCAG 2.2 AA runtime check, per-page accessibility findings, `docs/plans/quality-targets.json` a11y section.

Scoring rules:
  - PASS if zero Serious + zero Critical findings
  - CONCERNS if 1-3 Serious + 0 Critical
  - BLOCK if any Critical OR >3 Serious

Write verdict to `docs/plans/evidence/lrr/a11y.json` per schema. A11y CANNOT spawn follow-ups."

5. Description: "LRR Brand Guardian chapter" — subagent_type: `design-brand-guardian` — Prompt: "You are the Brand Guardian chapter of the LRR (REPLACES the old Design mechanical check — real taste judgment, not a 15-line mechanical gate). Your natural tendency is to be encouraging. Fight it. Default verdict: NEEDS WORK.

Read: `docs/plans/visual-design-spec.md`, `docs/plans/visual-dna.md` (the 6-axis DNA card locked at Phase 3.0), `docs/plans/design-references.md`, Playwright screenshots under `docs/plans/evidence/` matching production pages, Phase 3.6 Design Critic final score from `.build-state.json`.

Evaluate DRIFT: did the built product stay true to the DNA card locked at Phase 3.0? Score the gap on 6 DNA axes (Scope, Density, Character, Material, Motion, Type) + 5 craft dimensions (whitespace rhythm, visual hierarchy, motion coherence, color harmony, typographic refinement). Cite specific elements ('the hero padding at landing.tsx:42 is 32px but DNA calls for Airy density — should be 48px+') — never vague ('needs polish').

Write verdict to `docs/plans/evidence/lrr/brand-guardian.json` per schema. Fields per protocol. Brand Guardian CANNOT spawn follow-ups."

### Step 6.1a — PM chapter fold-in

PM chapter is NOT a separate dispatch. The existing Step 7.0 Requirements Coverage (now runs at end of Phase 6, see Phase 7 Step 7.0) produces a PM verdict written to `docs/plans/evidence/lrr/pm.json`. The LRR Aggregator treats `pm.json` as an Eng-Quality sub-input, not a 6th chapter. Chapter count stays 5.

If Step 7.0 has not yet run (first LRR iteration), the Aggregator proceeds with 5 chapter files + pm.json placeholder; re-runs after Step 7.0 completes and pm.json is written.

### Step 6.2 — LRR Aggregator (sequential, after all 5 chapter files exist)

Call the Agent tool — description: "LRR Aggregator" — INTERNAL inline role-string — Prompt: "You are the LRR Aggregator. You mechanically apply the 6 aggregation rules from `protocols/launch-readiness.md`. You may NOT self-approve — you cite the triggering rule number on every verdict.

**STEP 1 — FILE-COMPLETENESS CHECKPOINT:** Before applying any aggregation rule, use Glob to list `docs/plans/evidence/lrr/*.json` and verify ALL 5 expected chapter files exist and parse as valid JSON:
  - `eng-quality.json`
  - `security.json`
  - `sre.json`
  - `a11y.json`
  - `brand-guardian.json`

(Plus `pm.json` as an Eng-Quality sub-input.)

If any are missing or malformed, log 'LRR INCOMPLETE' with the missing file list, write a partial status to `docs/plans/evidence/lrr-incomplete.json`, and STOP — do not emit a combined verdict. This is the file-completeness checkpoint that closes the partial-glob race the current Aggregator is vulnerable to.

**STEP 2 — APPLY 6 RULES per `protocols/launch-readiness.md`:**
  1. ANY `override_blocks_launch: true` → combined_verdict = BLOCKED
  2. ALL verdicts PASS AND zero follow-ups spawned → combined_verdict = PRODUCTION READY
  3. ANY verdict BLOCK (with override_blocks_launch: false) → combined_verdict = NEEDS WORK + findings routed to fix loop
  4. ANY verdict CONCERNS → combined_verdict = NEEDS WORK, concerns logged
  5. Follow-up spawned AND follow_up.confirmed: true → treat parent chapter verdict as if BLOCK
  6. Contradictions between chapters on typed fields → combined_verdict = BLOCKED with cross-chapter contradiction finding

**STEP 3 — ON BLOCK VERDICT (the ⭐⭐ star rule — backward routing):** For each BLOCK finding in any chapter, read the `related_decision_id` field. Look up that row in `docs/plans/decisions.jsonl`. Find the `decided_by` field (author of the decision — per the `decided_by` free-form role-string convention in `protocols/decision-log.md`. The Aggregator matches on the string value directly. Common values: `architect` (Phase 2 architecture decisions), `design-brand-guardian` (Phase 3 Visual DNA lock), `implementer` (Phase 4 deviation rows), `human` (Gate 1/2 user decisions)). Route BACKWARD to the authoring phase with the finding as input. This replaces the current 'stop and wait' BLOCK behavior with author-aware re-entry.

Write routing decisions to `docs/plans/evidence/lrr-routing.json` with shape `[{finding_id, chapter, related_decision_id, authoring_phase, action: \"re-open\"}, ...]`.

**STEP 4 — ON NEEDS_WORK:** Classify findings & route to Phase 4 (code-level — single-task fix) or Phase 2 (structural — re-architect) or Phase 3 (visual — re-design). Same routing file.

**STEP 5 — ON READY:** Write `docs/plans/evidence/lrr-aggregate.json` with shape:

```json
{
  \"combined_verdict\": \"PRODUCTION READY | NEEDS WORK | BLOCKED\",
  \"chapter_verdicts\": {\"eng-quality\": \"PASS|CONCERNS|BLOCK\", \"security\": \"...\", \"sre\": \"...\", \"a11y\": \"...\", \"brand-guardian\": \"...\"},
  \"triggered_rule\": <1-6>,
  \"findings\": [...aggregated from all chapters...],
  \"follow_ups_spawned\": [list of chapters that spawned follow-ups],
  \"backward_routing\": [...from lrr-routing.json if any...],
  \"timestamp\": \"ISO-8601\"
}
```

Forward to Phase 7.

Cite triggering rule number in output. No verdict is valid without citing the rule."

### Step 6.3 — Verdict resolution

The LRR Aggregator's `combined_verdict` is the authoritative verdict. Resolution rules:

  - **PRODUCTION READY** → log aggregate path to `.build-state.json` and `build-log.md`. Proceed to Phase 7.
  - **NEEDS WORK** → apply backward routing from `lrr-routing.json`. Re-open the authoring phase(s) with the finding as input. Max 2 NEEDS_WORK cycles before presenting to user (interactive) or proceeding with warning (autonomous).
  - **BLOCKED** → apply backward routing (⭐⭐ star rule). NEVER proceed to Phase 7 with BLOCKED.

<HARD-GATE>
The LRR Aggregator is the ONLY agent that may emit `combined_verdict`. No other agent — not the orchestrator, not Reality Checker, not individual chapters — may self-issue a combined verdict. This is the non-negotiable independence guarantee.

Max 2 NEEDS_WORK cycles. If LRR returns NEEDS_WORK a third time:
  - Interactive: present all remaining issues. Ask for direction.
  - Autonomous: log remaining issues. Proceed to Phase 7 with a warning in the Completion Report.
Do not loop forever.
</HARD-GATE>

**Writes:** `docs/plans/evidence/lrr/*.json`, `docs/plans/evidence/lrr-aggregate.json`, `docs/plans/evidence/lrr-routing.json`.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 7: Ship

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 7 — ship pipeline is optional (simulator-only is a valid end-state). If shipping, run asc-* agents + fastlane.
- `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 7 (Step 7.1 documentation + deploy notes).

### Step 7.0 — Requirements Coverage (PM chapter, folds into Phase 6 Eng-Quality)

Call the Agent tool — description: "Requirements coverage" — INTERNAL inline role-string — Prompt: "You are the PM chapter / Requirements Coverage Report. Read the original PRD at `docs/plans/design-doc.md` and the user journeys + NFRs from `docs/plans/sprint-tasks.md`. For EVERY feature listed in the MVP scope, verify: (1) it has a corresponding implemented task, (2) it has a passing test or behavioral verification, (3) it is reachable and functional in the running app. Produce a coverage table:

| MVP Feature | Task | Test | Verified | Status |
|-------------|------|------|----------|--------|

Mark each as COVERED, PARTIAL (implemented but untested), or MISSING.

Write a typed verdict file at `docs/plans/evidence/lrr/pm.json` per `protocols/launch-readiness.md` — `verdict=PASS` if all features COVERED, `CONCERNS` if any PARTIAL, `BLOCK` if any MISSING. Fields: `chapter=pm`, `verdict`, `override_blocks_launch=false`, `evidence_files_read` (the sprint-tasks / PRD paths read), `findings[]` (one per PARTIAL or MISSING feature), `follow_up_spawned=false`, `follow_up_findings=null`.

After writing `pm.json`, if the LRR Aggregator at Step 6.2 has not yet run with this file, the orchestrator re-dispatches the Aggregator so `pm.json` is folded into the Eng-Quality chapter evidence for the final combined verdict.

If any features are MISSING: spawn implementation agents to build them, then re-run verification."

PM chapter folds into the Phase 6 Eng-Quality evidence, not a separate chapter — chapter count stays 5.

### Step 7.1 — Sequence: Documentation → Doc Metric Loop → ASO (iOS) → Deploy → Completion Report

1. Description: "Technical Writer" — subagent_type: `engineering-technical-writer` — mode: "bypassPermissions" — Prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. The README is the first thing a new developer reads — optimize for that reader. Commit: 'docs: project documentation'. Deployment target per the PRD (Vercel/Netlify/Railway/Fly.io/etc.) — include the deploy flow specific to that target in the README."

2. Documentation Metric Loop: Run the Metric Loop Protocol (callable service) on documentation. Define a metric based on completeness and whether a new developer could follow the README end-to-end. Max 3 iterations.

3. Description: "App Store Optimizer" (iOS only, conditional on ship) — subagent_type: `marketing-app-store-optimizer` — Prompt per `protocols/ios-phase-branches.md` §Phase 7 (asc-* flow — app name, subtitle, keywords, description, screenshots, privacy labels). Skip entirely for web.

4. Description: "Deploy" — subagent_type: `engineering-devops-automator` — mode: "bypassPermissions" — Prompt: "Deploy the app to the target from the PRD (`docs/plans/design-doc.md#tech-stack`). Run pre-deploy checks: build, env vars, secrets. Execute deploy. Verify the deployed URL returns 200 and serves the built app (not the placeholder). Report deploy URL and any smoke-test findings."

5. Description: "Completion Report" — INTERNAL inline role-string — Prompt: "You are the Completion Report writer. Draw verification surface from the LRR Aggregator's structured output (`docs/plans/evidence/lrr-aggregate.json`) and the Reality Checker evidence manifest (`docs/plans/evidence/reality-check-manifest.json`) — NOT from orchestrator summary prose. Present:

```
BUILD COMPLETE
Project: [name] | Tasks: [done]/[total] | Tests: [count] passing
Agents used: [list distinct subagent_types] | Verdict: [combined_verdict from lrr-aggregate.json]
Metric loops run: [count] | Avg iterations: [N]
Remaining: [any NEEDS WORK items from lrr-routing.json]
```

**Verification table (MANDATORY — pulled from LRR aggregator output):**

| Metric | Count | Status |
|--------|-------|--------|
| Behavioral Tests declared in spec | from sprint-tasks.md | — |
| Behavioral Tests with non-stub bodies | from Eng-Quality findings | PASS if equal |
| Behavioral evidence files written | count from manifest | — |
| Maestro flows present (iOS) | count of maestro/*.yaml | — |
| Test-stub detector flagged files | from Eng-Quality findings | PASS if 0 |
| Combined verdict | from lrr-aggregate.json | — |
| LRR chapter verdicts | list of chapter:verdict pairs | — |
| LRR follow-ups spawned | count | — |
| LRR triggered rule | rule number 1-6 | — |

If there's a Verification Gap (declared != passing, or stub-flagged > 0), surface a top-level 'Verification Gap' section BEFORE writing the report to disk. Ask user: 'Write Completion Report with this verification gap surfaced? [YES/NO]'. In autonomous mode: write but flag prominently.

Create final commit. Mark all TodoWrite items complete. Update `.build-state.json`: 'Phase: 7 COMPLETE'."

**Writes:** `docs/plans/learnings.jsonl` (late learnings only — doc friction, deploy blockers, late-surfacing gaps). If no late learnings surfaced, skip. Row schema: `{run_id, timestamp, project_type, phase_where_learning_surfaced: \"7.x\", metric, top_issue, fix_applied, score_delta, pattern_type}`.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Service calls — reference

The 5 callable services (invoked from phases, not slotted into the pipeline):

| Service | Called by | Role |
|---------|-----------|------|
| **Verify Protocol** (7-check gate) | Phase 2 (architecture), Phase 4 (per-task), Phase 5 (pre-audit), Phase 7 (pre-ship) | Mechanical — spawn agent running 7 checks sequentially, stop on first FAIL |
| **Metric Loop** (generator/critic) | Phase 3 (Design Critic loop), Phase 4 (per-task quality), Phase 5 (metric fix), Phase 7 (doc loop) | Generator + critic separation to eliminate author bias |
| **Decision Log** (decisions.jsonl) | Writers: Phase 1 (3 rows), Phase 2 (4 rows), Phase 4 (deviation only). Readers: Phase 0 resume, Phase 5 reality sweep, Phase 6 LRR Aggregator | Append-only; orchestrator rejects writes from non-owning phases |
| **Learnings** (learnings.jsonl) | Writers: Phase 5 reality sweep, Phase 7 late learnings. Readers: Phase 0 Learnings Loader, Phase 5 reality sweep | Cross-run PITFALL/PATTERN/HEURISTIC capture |
| **LRR Machinery** (chapter template + aggregator rules) | Phase 6 (primary), callable otherwise | Single parameterized chapter prompt template; 6 mechanical aggregation rules; file-completeness checkpoint |

Services are invoked from phases, not slotted as numbered pipeline steps. Ownership is explicit per the writer-owner table at the top of this file.
