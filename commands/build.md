---
description: "Full product build pipeline — orchestrates specialist agents through brainstorming, research, architecture, design, implementation, audit, launch review, and ship"
argument-hint: "Describe what to build, or path to a design doc. --autonomous for unattended mode. --resume to continue a previous build."
---

# /build

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

Every Agent tool call MUST include a `subagent_type` field unless the dispatch is explicitly marked INTERNAL (inline role-string). INTERNAL dispatches are orchestrator helpers: Brainstorm Facilitator, Research Synthesizer, Design Doc Writer, Prereq Collector, Task DAG Validator, Refs Indexer, Briefing Officer, Completion Report, Verify scaffolding dispatcher.

Missing `subagent_type` on a non-INTERNAL dispatch is a HARD-GATE violation. The orchestrator rejects dispatches that don't name a specific agent. If you catch yourself typing `description: "..."` without a `subagent_type:` line alongside it, STOP and look up the right agent from the per-phase dispatch tables further down in this file.
</HARD-GATE>

<HARD-GATE>
MODEL ROUTING — DO NOT OVERRIDE.

NEVER pass a `model` parameter on Agent tool calls. Each agent `.md` file declares `model:` in its YAML frontmatter (opus, sonnet, or haiku). Claude Code reads the frontmatter and routes to the correct model automatically. Passing `model:` on the invocation overrides the frontmatter and breaks cost routing. The orchestrator's only job is to pass the correct `agent_type` — the plugin handles model selection.
</HARD-GATE>

<HARD-GATE>
ARTIFACT WRITER-OWNER RULE.

Every shared artifact has ONE concurrent writer at any instant. The writer-owner table below defines which phase writes which file. Before any file write, the orchestrator verifies the current phase is the rightful writer. Non-owning phase writes are a HARD-GATE violation. For parallel-batch phases (e.g., Phase 4), intra-phase dispatches MUST NOT race on the same file — writes either target disjoint per-dispatch filenames OR route through an orchestrator-scribe handler (see `decisions.jsonl` handling below).

Live downstream docs (read across Phase 3+):
  - `CLAUDE.md`              — P1 writer (then auto-loaded into every subagent)
  - `docs/plans/design-doc.md` (PRD)    — P1 writer
  - `docs/plans/product-spec.md`        — P1 writer (Step 1.6), product-spec-writer writer
  - `docs/plans/architecture.md`        — P2 writer
  - `docs/plans/backend-tasks.md`        — P2 writer (backend/infra only; UI tasks come from page-specs in Phase 3)
  - `docs/plans/quality-targets.json`   — P2 writer
  - `docs/plans/phase-2-contracts/*.md`  — P2 writer (per-architect post-debate contract files)
  - `docs/plans/visual-dna-preview.md`  — P2 writer, design-brand-guardian writer, ios-swift-ui-design writer (directional DNA preview at Gate 2)
  - `DESIGN.md`                         — P3 writers: design-brand-guardian (Pass 1 at Step 3.0, both modes); design-ui-designer (Pass 2 at Step 3.4, web); ios-swift-ui-design (Pass 2 at Step 3.2-ios, iOS). Replaces former visual-dna.md + visual-design-spec.md pair (web) and ios-design-board.md (iOS). Repo root.
  - `docs/plans/component-manifest.md`  — P3 writer (web, HARD-GATE import source)
  - `docs/plans/design-references.md`   — visual-research writer (web, Step 3.1)
  - `docs/plans/design-references/**`   — visual-research writer (web, screenshots harvested by visual-research subagents)
  - `docs/plans/dna-persona-check.md`   — design-ux-researcher writer (web, Step 3.2b)
  - `docs/plans/ux-architecture.md`     — P3 writer (web)
  - `docs/plans/ux-flow-validation.md`  — design-ux-researcher writer (web, Step 3.3b)
  - `docs/plans/inclusive-visuals-audit.md` — P3 writer (web)
  - `docs/plans/page-specs/*.md`        — P3 writer, design-ux-architect writer (web, Step 3.3 — per-screen wireframes + layout specs)
  - `docs/plans/refs.json`              — P2 writer, P3 writer (P3 extends after visual spec lands)
  - `docs/plans/decisions.jsonl`        — orchestrator-scribe ONLY via `scribe_decision` MCP tool (subagents return `deviation_row` objects; the orchestrator forwards each row through the MCP, which owns ID allocation and atomic append)
  - `docs/plans/learnings.jsonl`        — P5 writer, P7 writer
  - `docs/plans/evidence/*.json`        — P5 writer (P4 contributes per-task, P6/P7 readers)
  - `docs/plans/evidence/*.md`          — P5 writer, design-brand-guardian writer (brand-drift findings, fake-data-audit)
  - `docs/plans/evidence/**/*.json`     — P4 writer, P5 writer, P6 writer (nested per-task/per-run evidence JSON)
  - `docs/plans/evidence/**/*.md`       — P4 writer, P5 writer (nested per-task/per-run evidence markdown)
  - `docs/plans/evidence/**/*.png`      — P3 writer, P4 writer, P5 writer (screenshots: Playwright, SwiftUI Preview, Maestro, design-reference)
  - `docs/plans/evidence/**/*.{txt,har}` — P4 writer, P5 writer (smoke-test HAR captures, DOM snapshots)
  - `docs/plans/evidence/lrr/*.json`    — code-reviewer writer, security-reviewer writer, engineering-sre writer, a11y-architect writer, design-brand-guardian writer, pr-test-analyzer writer (5 chapter verdicts + 1 sub-verdict)
  - `docs/plans/evidence/lrr-aggregate.json` — phase-6-aggregator writer (Aggregator only)
  - `docs/plans/evidence/lrr-incomplete.json` — phase-6-aggregator writer (file-completeness checkpoint)
  - `docs/plans/evidence/lrr-routing.json`    — phase-6-aggregator writer (BLOCK routing via decided_by)
  - `docs/plans/evidence/reality-check-manifest.json` — testing-reality-checker writer (evidence-sweep manifest)
  - `docs/plans/.build-state.json`      — orchestrator writer (every phase boundary)
  - `docs/plans/.build-state.md`        — auto-rendered-view writer (regenerated from .build-state.json on every update)
  - `docs/plans/.task-outputs/[task-id].json` — P4 writer (per-task output)
  - `docs/plans/build-log.md`           — every-phase writer (append on transition)
  - `docs/plans/.active-learnings.md`   — P0 writer (top-3 cross-run learnings for Phase 4 implementer briefings)
  - `docs/plans/ios-verify-report.md`   — P5 writer (iOS verify twin)
  - `docs/plans/ios-ux-review-report.md` — P5 writer (iOS ux-review twin)

Phase-internal scaffolding (lives in `docs/plans/phase1-scratch/` after Gate 1, never read by P3+):
  - `idea-draft.md`, `feature-intel.md`, `tech-feasibility.md`, `ux-research.md`, `business-model.md`, `findings-digest.md`, `suggested-questions.md`, `user-decisions.md`, `prereqs.json`

Phase 4 implementers never reference Phase 1 raw research files. They are SPENT after the Product Spec step (Step 1.6). The product spec is the LAST consumer of raw research. After Step 1.6, research insights survive in `product-spec.md`, `design-doc.md`, and `CLAUDE.md`.
</HARD-GATE>

> **Default-deny (Stage 2+):** Once Stage 2 of the SDK migration activates, any `Write|Edit` tool call targeting a path absent from this table will be denied by the `PreToolUse` hook with message `"path not in writer-owner table — please add to phase-graph.yaml or route through scribe MCP"`. This is a pre-announcement; actual hook wiring ships in Task 2.1.3.

<HARD-GATE>
CONTEXT HEADER — RENDER ONCE, HOIST AS STABLE PREFIX.

Every phase uses a CONTEXT header prepended to dispatch prompts. The orchestrator MUST render this header ONCE at the start of each phase by reading `.build-state.json` (and `DESIGN.md` `## Overview > ### Brand DNA` for web, Phase 4+) and resolving all values into concrete strings. The rendered header is then reused verbatim for every dispatch in that phase.

DO NOT paste `{read from .build-state.json}` placeholders into dispatch prompts. DO NOT re-read state files per dispatch. The values do not change within a phase.

**Canonical template** (orchestrator resolves before first dispatch of each phase):
```
CONTEXT:
  project_type: <resolved value>
  phase: <current phase number>
  dna: <resolved from DESIGN.md `## Overview > ### Brand DNA` (7 axis values only, ~100 tokens) — INCLUDE only if project_type=web AND phase >= 4>
  ios_features: <resolved from .build-state.json — INCLUDE only if project_type=ios>

TASK:
```

**Rendering procedure** (run once per phase boundary):
1. Read `docs/plans/.build-state.json`. Extract `project_type`, `ios_features`.
2. If `project_type=web` AND phase >= 4: read `DESIGN.md` and extract the DNA summary (first 5 lines or the `## Summary` section). Otherwise omit the `dna` field.
3. If `project_type=ios`: include `ios_features`. Otherwise omit.
4. Substitute all values into the template above. Store the result as `rendered_context_header`.
5. For every dispatch in this phase, prepend `rendered_context_header` — do NOT re-read or re-interpolate.

This keeps the prefix stable across parallel batches (enabling KV-cache reuse) and eliminates redundant state-file reads (~300K–1M tokens saved per build).
</HARD-GATE>

## SSOT Rule (machine-readable form is authoritative)

For every HARD-GATE promoted to code in Stages 2–5, the machine-readable form (`phase-graph.yaml`, `decisions.schema.json`, `state-schema.md`) is AUTHORITATIVE at runtime. Prose in `commands/build.md` and `protocols/*.md` is a narrative view of the machine-readable form. Prose edits without corresponding machine-readable edits are build-breaking PRs enforced by `eval/lint_phase_graph.py` in CI.

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

Phase 4 context pressure: With 20+ tasks, compact returns accumulate ~30-40K tokens in the orchestrator's context. The compaction checkpoint (dispatch_count >= 8) is the primary relief valve. If Phase 4 has more than 15 tasks, force a compaction checkpoint after every wave transition regardless of dispatch_count.

### Phase Boundary Eviction (Context Budget Protocol)

At every phase boundary (after gate approval, before starting the next phase):

1. **Write carry-forward summary.** Append to `.build-state.json.phase_summaries[]`:
   ```jsonc
   {
     "phase": <N>,
     "completed_at": "<ISO timestamp>",
     "artifacts": ["<paths of files this phase produced>"],
     "decisions": "<1-2 sentences: key decisions made>",
     "status": "<approved | approved_with_concerns | auto_approved>",
     "carry_forward": "<1-2 sentences: user feedback or constraints that affect future phases>"
   }
   ```
   Budget: max 500 tokens for the entire entry. If you can't fit it, you're including too much.

2. **Save state.** Call `state_save`.

3. **Drop prior-phase context.** After saving, you do NOT need to retain in working memory:
   - Agent dispatch prompts from the completed phase (already sent)
   - Agent returns from the completed phase (already processed, summary in state)
   - File contents read to compose prompts (still on disk, re-readable)
   - Metric loop intermediate scores (final score in state)
   - Gate presentation text (user already approved)

4. **Re-read for next phase.** Read `.build-state.json` fresh (contains `phase_summaries` — your structured memory of all prior phases). Then read only the input artifacts needed for the next phase:
   - Entering Phase 3: `architecture.md`, `backend-tasks.md`, `quality-targets.json`
   - Entering Phase 4: `feature-delegation-plan.json`, current wave's feature briefs
   - Entering Phase 5: `quality-targets.json`, feature list from state
   - Entering Phase 6: Phase 5 findings paths from state, `decisions.jsonl`
   - Entering Phase 7: LRR verdict from state

The `phase_summaries` array is your memory of prior phases. You do NOT need the raw conversation that produced them. If you need a specific fact from Phase 1 during Phase 5, read the artifact file — don't try to recall it.

**Cumulative-cost banner at phase boundaries:** When announcing a phase transition (e.g. "Phase N complete — proceeding to Phase N+1"), prefix the message with `[Cost so far: $X.XX • Y tokens]`. Source the values from the last-appended entry in `docs/plans/build-log.md`'s token-accounting lines (fields `cumulative_usd=...` plus the sum of `input_tokens=...` + `output_tokens=...`), written by `src/orchestrator/hooks/token-accounting.ts` (see module for exact schema). If the build-log has no token-accounting entries yet, omit the prefix rather than guessing.

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

<HARD-GATE>
HALT-CONDITION ASSERTIONS (audit fix #12): After the 7-check verify gate passes, the orchestrator MUST call `checkHaltConditions(projectDir)` from `src/orchestrator/halt-conditions.ts`. If `pass === false`, a project-specific "never do X" rule was violated. HALT the task — the implementer must fix the violation before proceeding. Halt-conditions are defined in `docs/plans/halt-conditions.json` (written by Phase 2 architect or Phase 3 designer). Format: `[{id, description, pattern, glob?, severity}]`.
</HARD-GATE>

### Decision Log (callable service)

`docs/plans/decisions.jsonl` — append-only, ORCHESTRATOR-SCRIBE ONLY via the `scribe_decision` MCP tool. Subagents return `deviation_row` objects in their structured result; the orchestrator forwards each row through `scribe_decision`, which allocates `D-{phase}-<seq>` IDs and atomically appends. The orchestrator MUST NOT Write or Edit this file directly. Row-producing phases (audit fix #10 — scribe across all phases that make consequential, revisitable choices, not just 0–2): Phase 1 synthesis (3 rows fixed), Phase 2 architecture synthesis (4 rows fixed), Phase 3 (0–4 rows: DNA lock, primitive/manifest deviations, design-critic threshold gap), Phase 4 implementers (0–N rows on deviation; PO 4.1 wave sequencing; PO 4.3 acceptance gap), Phase 5 (0–N: synthesizer routing override + fix-loop max-cycle exhaustion), Phase 6 (1 row always for Customer Reality Judge verdict + 0–1 for proceed-despite-BLOCKED when build proceeds after cycle 2), Phase 7 (0–1 ship-vs-hold + 0–1 deploy outcome). Per-phase row caps in `protocols/decision-log.md`; total per build remains ~10–18. Readers: Phase 0 resume handler, Phase 5 dissent-log-revisit pass, Phase 6 Customer Reality routing (the ⭐⭐ backward-routing read uses `decisions.jsonl` to find `decided_by` for each finding's `target_phase`). Schema at `protocols/decision-log.md`. Dispatch flow: see Phase 4 "Orchestrator-scribe dispatch" section (canonical pattern). Phases 3, 5, 6, 7 each have a per-phase scribe dispatch block at their end mirroring this pattern.

### Learnings (callable service)

`docs/plans/learnings.jsonl` — append-only cross-run learnings store. Writers: Phase 5 reality sweep, Phase 7. Readers: Phase 0 Learnings Loader (Step 0.1d) and Phase 5 reality sweep.

### Refs-Not-Pastes Rule

For Phase 3+ agents, the orchestrator passes REFS to live downstream docs (`design-doc.md`, `architecture.md`, `DESIGN.md`, `backend-tasks.md`, `quality-targets.json`, `decisions.jsonl`) — NOT pasted content. The orchestrator reads `docs/plans/refs.json` (produced by the Phase 2 Refs Indexer), resolves the task topic against the flat anchor index, and passes a short ref list to the agent. The agent uses the Read tool to pull refs it needs. This keeps orchestrator context lean and lets the agent widen its view on demand. Phase 1-2 agents still receive full documents because the architecture anchors don't exist yet.

**refs.json mutation invalidates sprint-context hash (Stage 6 / task 6.3.2).** Any orchestrator update to `docs/plans/refs.json` (Phase 2 Refs Indexer initial write, Phase 3 extension after `DESIGN.md` lands, or any subsequent correction) MUST be IMMEDIATELY followed by a `state_save` call that sets `.build-state.json.current_sprint_context_hash = null`. This invalidates the cached Phase 4 sprint-scoped shared-context block so the next subagent dispatch re-renders with fresh references. See `src/orchestrator/phase4-shared-context.ts#shouldInvalidate` for how the hash is consulted at render time. Skipping this invalidation causes Phase 4 implementers to read stale anchor indices — a silent correctness failure.

### Mode-Specific Tool Stacks

Mode-specific tool stacks, per-phase branches, and persona rules live in separate files. Load ONE based on `project_type`:
- iOS: `protocols/ios-phase-branches.md` (includes iOS Mode Tool Stack)
- Web: `protocols/web-phase-branches.md` (web defaults)

### Backward Edges — Routing Fix

When a later phase finds a problem whose root cause lives earlier, control flows BACKWARD to the authoring phase. The orchestrator codifies these edges so problems are fixed where they were introduced, not patched locally.

```
PROBLEM FOUND AT                                              ROUTES BACK TO
──────────────────────────────────────────────────────────────────────────────────
Gate 1 (human says "no")                                  →   Phase 1 Step 1.0 with feedback
Gate 2 (human says "no")                                  →   Phase 2 with feedback
phase-3.step-3.2b-DNA-persona-mismatch                    →   phase-3.step-3.0
Phase 5 Audit (code issue)                                →   Phase 4 target task
Phase 5 Audit (design issue)                              →   Phase 3 target step
Phase 5 Audit (spec issue)                                →   phase-2
phase-5-dogfood-classified                                →   target_phase-per-classified-findings.json
phase-5-dogfood-feedback-synthesizer                      →   phase-4.target-task
Phase 6 LRR BLOCK (⭐⭐)                                   →   authoring-phase (per decisions.jsonl.decided_by)
LRR-BLOCK-decided_by==architect                           →   phase-2
LRR-BLOCK-decided_by==design-brand-guardian-or-phase-3-writer →   phase-3
Phase 6 LRR NEEDS_WORK (code)                             →   Phase 4 target feature (via BO re-planning)
LRR-NEEDS_WORK-code-level                                 →   phase-4.target-task
phase-6-LRR-NEEDS_WORK-structural                        →   phase-2-or-phase-3
```

The ⭐⭐ star rule: when Phase 6's Customer Reality routing classifies a finding to a target phase, it can additionally consult `decisions.jsonl` to find a `related_decision_id` (when set) — looking up the `decided_by` field tells the orchestrator which authoring agent should be re-dispatched within the target phase. Infrastructure already exists (decision IDs, author tracking) — preserved from the v1 LRR design.

**Re-entry halt rule (Stage 4 A7).** Before dispatching any backward routing (LRR BLOCK to Phase N re-open, Reality Checker BLOCK to Phase M re-entry, Gate "no" to Phase 1/2 re-entry, etc.), check `.build-state.json.backward_routing_count` AND the per-target-phase variant `.build-state.json.backward_routing_count_by_target_phase[<N>]`. If the new (post-increment) value of EITHER counter for the target phase would exceed `max_cycles` (currently 2, from `phase-graph.yaml:routing.max_cycles`) — i.e., on the attempted third backward iteration — the orchestrator MUST halt and escalate to the user instead of dispatching. The Stage 4 `cycle_counter_check` MCP is the authoritative enforcer at runtime — it increments atomically and returns `escalate_to_user` once the new value exceeds `max_cycles`. This prose documents the behavior for the markdown-mode rollback path and for human readers.

**Phase-entry `in_flight_backward_edge` clear (Stage 4 A3 / task 4.3.3).** On the FIRST `state_save` after any phase entry — whether forward progression or backward-edge re-entry — the orchestrator MUST explicitly set `.build-state.json.in_flight_backward_edge = null`. This is the "successful landing" signal that closes the atomic crash-seam opened by `cycle_counter_check` (which writes `in_flight_backward_edge` in the same atomic state_save that increments the counter). If the runtime crashes between edge dispatch and landing, `--resume` in `bin/buildanything-runtime.ts` observes a stale `in_flight_backward_edge` (age > 60s) and decrements the counter (see task 4.3.4). See `src/orchestrator/mcp/cycle-counter.ts#clearInFlightEdge` for the runtime primitive.

---

## Phase 0: Pre-flight (state read only)

Phase 0 is thin. No agent dispatch. No human input. Instant. The orchestrator reads state files and applies universal checks.

### Step 0.0 — Dependency Pre-flight

Run **before anything else** — before resume detection, before state reads. No agent dispatch. Takes under 10 seconds.

**Check 1 — Orchestrator MCP** (HARD STOP if missing)

Attempt to call the `state_read` MCP tool (server: `orchestrator`). If the tool is absent or returns a connection error:

> **STOP. Do not proceed.**
> The orchestrator MCP server is not connected. It powers state saves, cycle-counter rails, and decision scribing — the pipeline cannot run without it.
> Fix: run `/buildanything:setup`, then **restart Claude Code** (MCP servers spawn on session start). After restarting, re-run your `/buildanything:build` command.

**Check 2 — Graph MCP** (HARD STOP if missing)

Attempt to call the `graph_list_features` MCP tool (server: `graph`). Apply the same HARD STOP as Check 1 if unavailable.

**Check 3 — CLI tools** (run via Bash)

| Tool | Command | On failure |
|------|---------|------------|
| `tsx` | `which tsx` | HARD STOP — run `/buildanything:setup` |
| `agent-browser` | `which agent-browser` | WARN only — Phase 5 browser automation degrades |
| `maestro` | `which maestro` | WARN only — iOS E2E flows will be skipped |

**Check 4 — iOS MCP servers** (WARN only)

Run `claude mcp list`. Check for `xcodebuildmcp` and `apple-docs`. If either is absent:

> ⚠ iOS MCP servers not configured. iOS builds will fail at Phase -1. Run `/buildanything:setup` (idempotent — safe to re-run) to install them, then restart Claude Code.

Do NOT stop for missing iOS MCPs. Log the warning and continue.

**On HARD STOP:** Print the diagnostic above. Do not write `.build-state.json`. Do not proceed.

**On WARN-only issues:** Append a `dependency_warning` entry to `docs/plans/build-log.md` (create it if it doesn't exist), then continue to the resume check.

---

**Resuming?** If the input contains `--resume` OR if context was just compacted (SessionStart hook fired with active state):
1. Read `docs/plans/.build-state.json` (source of truth) — verify it exists and has a `resume_point` field. Fall back to reading `docs/plans/.build-state.md` (rendered view) if the JSON file is missing but the markdown exists (graceful migration path from pre-W1-2 builds).
   If neither exists, OR neither has a Resume Point, warn the user: 'No previous build state found. Starting fresh.' Then proceed to Step 0.1 as a new build.
2. Re-read this file and all protocol files in `protocols/`.
3. Re-read live downstream docs: `docs/plans/backend-tasks.md`, `docs/plans/architecture.md`, `docs/plans/design-doc.md`, `DESIGN.md` (if exists), `CLAUDE.md`.
4. Read `docs/plans/decisions.jsonl` if it exists. Surface two slices into Phase 0 rehydration context: (a) top 5 most recent rows filtered to the current phase and upstream phases, and (b) ALL rows where `status: "triggered"` regardless of phase (these are revisit-criteria the Phase 5 Reality Checker fired — the new build should re-evaluate them per `protocols/decision-log.md` Dissent Log Revisit Pass). Pass short row fields + `ref` anchors only — not full row prose.
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
| **Decision brief** | An idea-sweep brief with verdicts and product definition | Phase 1 skips Step 1.1 research (already done). Brainstorming refines the brief into a design. |
| **Partial context** | Some notes, conversation, rough sketch | Phase 1 runs fully. Feed context into brainstorming + research. |
| **Raw idea** | One-line build request, no prior work | Phase 1 runs fully from scratch. |

### Step 0.1b — Project Type Classification (iOS vs Web)

Scan the build request AND any context from Step 0.1 for iOS signals. Keywords: **iOS, iPhone, iPad, SwiftUI, Swift, App Store, TestFlight, Xcode, Apple, Liquid Glass, watchOS, visionOS, SwiftData, HIG**.

To avoid false positives (e.g., a web app mentioning "Apple Pay" or "Sign in with Apple"), require at least 2 iOS keywords OR 1 keyword + existing Swift/Xcode files before triggering the iOS confirmation prompt.

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

### Step 0.1d — Learnings Loader (PITFALL replay)

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
2. Write `docs/plans/.build-state.json` per the schema in `protocols/state-schema.md`. Required top-level fields: `project_type`, `phase`, `step`, `input`, `context_level`, `prerequisites`, `dispatch_count`, `last_save_phase`, `autonomous`, `session_id`, `session_started`, `completed_tasks[]`, `metric_loop_scores[]`, `decisions_next_id` (object keyed by phase number — see Phase 4 orchestrator-scribe handler), `resume_point { phase, step, completed_tasks, git_branch }`, `backward_routing_count_by_target_phase` (object), `feature_delegation_plan_path`, `current_wave`, `completed_features[]`, `feature_acceptance{}`, `feature_briefs{}`. See `protocols/state-schema.md` for the complete and authoritative field list. This inline list is a summary. Then regenerate `docs/plans/.build-state.md` from the JSON as a **read-only rendered view**.
3. Go to Phase 1 (or Phase 2 if context level is "Full design").

**NO prereq collection in Phase 0.** Stack isn't decided yet. Prereqs move to Step 1.5, after Gate 1. Asking for creds before the stack is picked means asking for wrong creds or re-asking on rejection.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase -1: iOS Bootstrap (iOS-only, greenfield only)

**If `project_type=ios` AND no `.xcodeproj` exists:** follow `protocols/ios-phase-branches.md` §Phase -1 — iOS Bootstrap. Otherwise skip entirely.

iOS structural changes are out of scope for this orchestrator migration.

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

**CONTEXT header:** Render `rendered_context_header` for phase 1 per the canonical template (see CONTEXT HEADER HARD-GATE above). Prepend to every Phase 1 research prompt below.

1. Description: "Feature intel" — agent_type: `feature-intel` — subagent_type: `feature-intel` — Prompt: "[CONTEXT header above] Extract competitor feature matrix for: [build request]. Idea draft: read docs/plans/phase1-scratch/idea-draft.md with your Read tool. Walk 5-10 rivals. Return must-haves (features present in >=80% of rivals — table stakes) + stand-outs (features unique to individual rivals — differentiation opportunities), sorted by competitor. Save to `docs/plans/phase1-scratch/feature-intel.md`. **Audit fix #15:** ALSO produce `docs/plans/phase1-scratch/competitive-differentiation.md` per the schema in your agent file — closest 1-3 alternatives, what this product does better/worse on the core job, implications for the first surface. This artifact is REQUIRED — Step 1.6 will halt without it."

2. Description: "Tech feasibility" — agent_type: `tech-feasibility` — subagent_type: `tech-feasibility` — Prompt: "[CONTEXT header above] Evaluate hard technical problems (Solved/Hard/Unsolved), build-vs-buy decisions, stack validation for: [build request]. Idea draft: read docs/plans/phase1-scratch/idea-draft.md with your Read tool. Verify APIs and libraries from the draft exist and are maintained. Save to `docs/plans/phase1-scratch/tech-feasibility.md`. Report with a Technical Verdict."

3. Description: "UX research" — agent_type: `design-ux-researcher` — subagent_type: `design-ux-researcher` — Prompt: "[CONTEXT header above] Analyze target persona, jobs-to-be-done, current alternatives, and behavioral barriers for: [build request]. Idea draft: read docs/plans/phase1-scratch/idea-draft.md with your Read tool. Save to `docs/plans/phase1-scratch/ux-research.md`. Report with a User Verdict."

4. Description: "Business model" — agent_type: `business-model` — subagent_type: `business-model` — Prompt: "[CONTEXT header above] Light-touch revenue/channels/unit-economics analysis for: [build request]. Idea draft: read docs/plans/phase1-scratch/idea-draft.md with your Read tool. Surface product-impact conclusions only — which features the business model requires, which channels gate the feature set. Do not write full financial modeling. Save to `docs/plans/phase1-scratch/business-model.md`."

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
  - Scope — Features in scope (must-haves + chosen stand-outs), explicit Out-of-Scope boundary
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
[What's in scope vs. deferred. Hard boundaries.]

## Rules
[Project-specific hard rules derived from the product and user context.]
```

<HARD-GATE>
CLAUDE.md must be under 200 lines. Not a wiki, not a conventions doc, not a dump of everything. Minimum context an agent needs to make correct decisions about this specific product.
</HARD-GATE>

Return 3 decision rows in your structured result under a `phase_1_decisions` field — one each for tech stack, data model, and scope boundary. Each row shape: `{phase: 1, author: \"architect\", type: \"tech-stack\" | \"data-model\" | \"scope-boundary\", summary, rationale, related_files: [\"docs/plans/design-doc.md\"]}`. The orchestrator forwards each row through the `scribe_decision` MCP tool (see Phase 4 "Orchestrator-scribe dispatch"). DO NOT write `decisions.jsonl` directly."

**Writes:** `docs/plans/design-doc.md` (PRD), `CLAUDE.md`. Decision rows flow through the orchestrator's `scribe_decision` MCP calls.

**Post-Step 1.4 — CLAUDE.md size enforcement (mechanical check):**
After the Design Doc Writer returns, run `wc -l < CLAUDE.md` and capture the line count. If the count exceeds 200 lines:
1. FAIL the step. Log to `docs/plans/build-log.md`: `"CLAUDE.md size violation: {count} lines (limit: 200)"`.
2. Re-dispatch the Design Doc Writer with this additional instruction prepended: `"CLAUDE.md EXCEEDED 200 LINES ({count} lines). Rewrite CLAUDE.md to ≤200 lines. Cut aggressively — keep only what a subagent needs to make correct product decisions. No conventions, no wiki content, no boilerplate."`.
3. Max 2 retries. If still over 200 after 2 retries, HARD-FAIL and surface to user: `"CLAUDE.md is {count} lines after 2 rewrites. Please manually trim to ≤200 lines before proceeding — this file is auto-loaded into every subagent and bloat here multiplies across all Phases 2-7 dispatches."`.

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

### Step 1.6 — PRODUCT SPEC

<HARD-GATE>
**Audit fix #15 precondition:** Before dispatching the product-spec-writer, verify `docs/plans/phase1-scratch/competitive-differentiation.md` exists and is non-empty (`test -s`). If missing, HALT — re-dispatch `feature-intel` with the directive "your previous run did not produce competitive-differentiation.md; produce it now per your agent file's `## Competitive differentiation on the core job` section." This file is the utility-first forcing function the spec-writer reads. Phase 1 must answer "what does this product do better than the closest 1-3 alternatives on the core job" in writing before mechanics get specified.
</HARD-GATE>

Call the Agent tool — description: "Product spec" — agent_type: `product-spec-writer` — subagent_type: `product-spec-writer` — prompt: "[CONTEXT header above] Write `docs/plans/product-spec.md` following the structure in `protocols/product-spec-schema.md` (note the required `## First 60 Seconds` top-level section per audit fix #16). Read ALL of these via your Read tool before writing (do NOT expect pasted content):
  - `docs/plans/design-doc.md` — PRD: features, persona, JTBD, value prop, scope, tech stack
  - `docs/plans/phase1-scratch/findings-digest.md` — research synthesis
  - `docs/plans/phase1-scratch/ux-research.md` — behavioral patterns, pain points
  - `docs/plans/phase1-scratch/feature-intel.md` — competitive matrix, table-stakes vs differentiators
  - `docs/plans/phase1-scratch/competitive-differentiation.md` — *(audit fix #15 — REQUIRED)* closest alternatives + what this product does better/worse on the core job + implications for the first surface. Headline-utility features in your spec MUST cite at least one constraint from this file.
  - `docs/plans/phase1-scratch/business-model.md` — revenue model implications
  - `docs/plans/phase1-scratch/tech-feasibility.md` — technical constraints, rate limits, API limitations
  - `docs/plans/phase1-scratch/user-decisions.md` — user's product decisions from informed brainstorm
**Cognitive Protocol Step 0 (UTILITY-FRAMING — audit fix #15)** runs before Step 1 (STATES) for every feature. Open every feature with one paragraph naming its core-job contribution; headline-utility features cite a constraint from `competitive-differentiation.md`. Self-check before returning: count lines per feature and confirm utility features land in the upper half. **`## First 60 Seconds`** is required (one `### Persona: {Name}` subsection per persona table row, each with a single `**First-encounter promise**:` field ≥ 50 chars that contains a comparison marker — `vs`, `than`, `compared to`, `instead of`, `rather than`, or `unlike` — referencing an external alternative typically named in `competitive-differentiation.md`). Step 1.6.idx will BLOCK on missing comparisons. This is the LAST step that reads raw research files. Every actionable insight must survive in product-spec.md in structured, queryable form. Commit: 'feat: product spec'."

#### Step 1.6.idx — Slice 1 graph index

After `product-spec-writer` returns and `docs/plans/product-spec.md` is on disk, index it into the build graph. Slice 1 graph index — required for downstream agents.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/product-spec.md`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents (BO, PO, implementers) require the graph — do not proceed without a successful index.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 2: Plan / Architect — TEAM of 4 + sequence + security review

**Goal**: Convert the PRD into a concrete architecture and ordered task list with explicit dependencies. Every architect receives the PRD (design-doc.md) + the Research Digest + its domain's raw research file (hybrid routing).

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 2 (replaces Backend/Frontend dispatch with SwiftUI/SwiftData/Concurrency/iOS security; adds Feature Flag Resolution at end of phase).
- `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 2 — Architecture (web branch additions). Includes Step 2.9 Visual DNA Directional Preview (dispatch before Gate 2 prompt).

### Step 2.1 — Explore existing codebase (only if existing code)

If existing code, call the Agent tool — description: "Explore codebase" — INTERNAL inline role-string — prompt: "Explore existing codebase. Map architecture layers, file conventions, testing patterns, existing features, integration points. Return a compact summary suitable for architects to consume — not a full dump."

If greenfield, skip to Step 2.2.

### Step 2.2 — Architecture Design (TEAM of 4 architects coordinating via SendMessage)

The 4 architects design as a TEAM — not 4 isolated subagents. Cross-domain contract boundaries (Backend↔Frontend on API shape, Performance↔Backend+Data on query shapes, Frontend↔Performance on bundle budgets) are caught at design time via peer SendMessage, not absorbed silently by a downstream stitcher.

Security is NOT in the team — it runs as a separate review pass after synthesis (Step 2.4) to avoid the coordination overhead of its dense cross-check pairings.

**On re-entry from Phase 6 (Customer Reality) backward routing:** If Phase 2 is being re-opened via the re-entry dispatch template (Phase 6 Step 6.2), skip team creation if the original `phase-2-architects` team is still live from this build; otherwise recreate it. Pass the re-entry payload (`{blocking_finding, prior_output: "docs/plans/architecture.md", decision_row}`) into the dispatch prompt of the architect(s) whose domain matches `decision_row.author` — only those architects re-run, not all 4. The re-dispatched architect revises its `docs/plans/phase-2-contracts/<name>.md` in place, SendMessages peers on any contract boundary it now changes, and the synthesizer re-runs once to re-stitch `architecture.md`. Do NOT redo unaffected domains.

After the synthesizer re-stitches `architecture.md`, re-run the Refs Indexer (Step 2.3 dispatch #4) to update `docs/plans/refs.json` with fresh anchors, and re-run the DAG Validator (Step 2.3 dispatch #3) to verify backend-tasks.md still references valid architecture sections. Invalidate the sprint-context hash per the refs.json mutation rule.

**Step 2.2a — Create the team.**

Call `TeamCreate` with `team_name: "phase-2-architects"`. This team scopes the SendMessage channel for the 4 architects below. Capture the team id in `.build-state.json` for teardown.

**Step 2.2b — Dispatch 4 architects as teammates (ONE message).**

Call the Agent tool 4 times in a single message. Each call passes `team_name: "phase-2-architects"` and a unique `name` (listed below). Each architect receives: `docs/plans/design-doc.md` (PRD) + `docs/plans/phase1-scratch/findings-digest.md` + ITS DOMAIN'S RAW RESEARCH FILE (hybrid routing) + the team roster + cross-check pairings + the per-architect output file path.

Shared brief appended to every architect prompt:

```
TEAM: phase-2-architects
ROSTER:
  - backend-architect         (owns services, API contracts, DB schema)
  - frontend-architect        (owns component hierarchy, state mgmt, routing)
  - data-engineer             (owns ETL/ELT, schema versioning, query patterns)
  - performance-benchmarker   (owns quality-targets.json, bundle + latency budgets)

CROSS-CHECK PAIRINGS (mandatory — if your design touches one of these boundaries, SendMessage the peer before you finalize):
  - Backend ↔ Frontend         on API contract shape (REST vs GraphQL, request/response schemas, error envelope)
  - Performance ↔ Backend+Data on query shapes (N+1 risk, indexing strategy, bundle impact of data layer choices)
  - Frontend ↔ Performance     on bundle budgets (per-Scope classification, animation strategy, MapLibre/heavy-lib placement)

COORDINATION RULES:
  - Plain text in your output file is INVISIBLE to teammates. If a contract boundary intersects another architect's domain, you MUST `SendMessage` to that peer using the exact `name` from the roster above. Do not assume they will read your file.
  - If a peer SendMessage challenges a decision you have written, revise your output file and SendMessage back with the resolution — do not silently ignore.
  - Max 2 rounds of cross-check per pairing. After round 2, document the disagreement in your output file under `### Unresolved Tensions` and idle. The synthesizer resolves remaining tensions.
  - Idle (exit) only after: (1) your initial read + draft is complete, AND (2) all cross-check pairings touching your domain have either been resolved via SendMessage, confirmed non-intersecting, or hit the 2-round cap.

OUTPUT:
  Write your findings to `docs/plans/phase-2-contracts/<your-name>.md` (e.g., `docs/plans/phase-2-contracts/backend-architect.md`). This file is the authoritative record of your post-debate position — include both your initial decisions AND any revisions driven by peer SendMessage.
```

Per-architect dispatches:

**CONTEXT header:** Render `rendered_context_header` for phase 2 per the canonical template (see CONTEXT HEADER HARD-GATE above). Prepend to every Phase 2 architect prompt below.

All architects use model: **sonnet**.

1. Description: "Backend architecture" — agent_type: `engineering-backend-architect` — subagent_type: `engineering-backend-architect` — model: `sonnet` — team_name: `phase-2-architects` — name: `backend-architect` — Prompt: "[CONTEXT header above] Design system architecture. Read these files via your Read tool before starting — do NOT expect pasted content:\n  - PRD: `docs/plans/design-doc.md`\n  - PRODUCT SPEC: `docs/plans/product-spec.md` (## App Overview, ## Screen Inventory, ## Permissions & Roles, per-feature behavioral sections — feature behaviors are the source of truth your architecture must support)\n  - DIGEST: `docs/plans/phase1-scratch/findings-digest.md`\n  - YOUR DOMAIN RAW: `docs/plans/phase1-scratch/tech-feasibility.md`, `docs/plans/phase1-scratch/feature-intel.md`\nInclude services, data models, API contracts, database schema, integration points. Respect stack choices from PRD. Map per-feature Business Rules and States to specific endpoints, persistence schemas, and validation logic — every State the product spec defines must have a backend behavior.\n\n[paste shared team brief above]"

2. Description: "Frontend architecture" — agent_type: `engineering-frontend-developer` — subagent_type: `engineering-frontend-developer` — model: `sonnet` — team_name: `phase-2-architects` — name: `frontend-architect` — Prompt: "[CONTEXT header above] Design frontend architecture. Read these files via your Read tool before starting — do NOT expect pasted content:\n  - PRD: `docs/plans/design-doc.md`\n  - PRODUCT SPEC: `docs/plans/product-spec.md` (## App Overview, ## Screen Inventory, ## Permissions & Roles, per-feature behavioral sections — feature behaviors are the source of truth your architecture must support)\n  - DIGEST: `docs/plans/phase1-scratch/findings-digest.md`\n  - YOUR DOMAIN RAW: `docs/plans/phase1-scratch/ux-research.md`, `docs/plans/phase1-scratch/feature-intel.md`\nInclude component hierarchy, layout strategy, responsive approach, state management, routing. Align UX with the persona from research. Map the Screen Inventory to your component hierarchy — every screen the product spec lists must have a routable view, and per-feature States must drive the component-state matrix.\n\n[paste shared team brief above]"

3. Description: "Data engineering" — agent_type: `engineering-data-engineer` — subagent_type: `engineering-data-engineer` — model: `sonnet` — team_name: `phase-2-architects` — name: `data-engineer` — Prompt: "[CONTEXT header above] Design data architecture. Read these files via your Read tool before starting — do NOT expect pasted content:\n  - PRD: `docs/plans/design-doc.md`\n  - PRODUCT SPEC: `docs/plans/product-spec.md` (## App Overview, ## Screen Inventory, ## Permissions & Roles, per-feature behavioral sections — feature behaviors are the source of truth your architecture must support)\n  - DIGEST: `docs/plans/phase1-scratch/findings-digest.md`\n  - YOUR DOMAIN RAW: `docs/plans/phase1-scratch/tech-feasibility.md`\nInclude ETL/ELT patterns, schema versioning, query patterns, indexing strategy, data lineage, migration plan. Per-feature data requirements from the product spec drive your schema — derived fields, denormalizations, and access patterns must serve specific feature flows.\n\n[paste shared team brief above]"

4. Description: "Performance constraints" — agent_type: `testing-performance-benchmarker` — subagent_type: `testing-performance-benchmarker` — model: `sonnet` — team_name: `phase-2-architects` — name: `performance-benchmarker` — Prompt: "[CONTEXT header above] Define quality targets for this build. Read these files via your Read tool before starting — do NOT expect pasted content:\n  - PRD: `docs/plans/design-doc.md`\n  - PRODUCT SPEC: `docs/plans/product-spec.md` (## App Overview, ## Screen Inventory, ## Permissions & Roles, per-feature behavioral sections — feature behaviors are the source of truth your architecture must support)\n  - DIGEST: `docs/plans/phase1-scratch/findings-digest.md`\n  - YOUR DOMAIN RAW: `docs/plans/phase1-scratch/tech-feasibility.md`\nWrite `docs/plans/quality-targets.json` covering bundle budget, LCP, TTI, API p95, Lighthouse scores. Use per-Scope budgets: Marketing 500KB / Product 300KB / Dashboard 400KB / Internal 200KB gzipped. Per-feature critical-path performance derives from the product spec's Happy Path latency expectations.\n\n[paste shared team brief above]"

**Step 2.2c — Wait for all 4 teammates to idle**, then proceed to synthesis. The `docs/plans/phase-2-contracts/*.md` files now contain post-debate positions (initial draft plus any SendMessage-driven revisions). The orchestrator does NOT read these files — the synthesizer below does.

After all 4 teammates are idle, the 4 raw research files are **SPENT**. They sit on disk for audit but no downstream phase reads them — they are NOT in the `refs.json` index. The orchestrator MOVES them to `docs/plans/phase1-scratch/` if not already there, to make the distinction physically obvious.

**Step 2.2d — Team teardown.** After the synthesizer dispatch at Step 2.3 returns, call `TeamDelete` on `phase-2-architects` to clean up the team channel.

### Step 2.3 — Sequence: Implementation Blueprint → Sprint Breakdown → DAG Validator → Refs Indexer

Four sequential dispatches.

**CONTEXT header:** Reuse `rendered_context_header` from phase 2 (already rendered above). Prepend to Step 2.3 synthesizer + sprint-breakdown prompts.

1. Description: "Implementation blueprint" — agent_type: `code-architect` — subagent_type: `code-architect` — Prompt: "[CONTEXT header above] Implementation blueprint. Read the PRD via your Read tool: `docs/plans/design-doc.md`. Read the product spec: `docs/plans/product-spec.md` (Screen Inventory + per-feature behavioral sections — your blueprint's file-and-build-order list must cover every feature in the spec). Read all 4 post-debate architect positions via your own Read tool from `docs/plans/phase-2-contracts/`:\n  - `backend-architect.md`\n  - `frontend-architect.md`\n  - `data-engineer.md`\n  - `performance-benchmarker.md`\n\nThese files are the authoritative team positions AFTER any SendMessage-driven revisions — the architects already cross-checked each other's contract boundaries, so you can stitch without re-debating. Your job is to assemble the 4 positions into a coherent architecture. Where positions conflict OUTSIDE the 3 mandatory cross-check pairings, flag the contradiction explicitly in `architecture.md` under a `### Unresolved Tensions` section and pick the safer default. Do not silently absorb contradictions. Include specific files to create/modify, build sequence, dependency order. Write `docs/plans/architecture.md` with stable section anchors per `protocols/architecture-schema.md`. Required top-level sections: Overview, Frontend, Backend, Data Model, Security, Infrastructure, Scope, Out of Scope. Scope to the boundary from the PRD. Every API endpoint heading in the Backend section MUST include feature attribution annotations — e.g. `**POST /api/orders** (provides: order-placement)` — using the feature kebab names from `product-spec.md`. These annotations are required for the graph indexer to emit cross-feature dependency edges."

2. Description: "Backend task breakdown" — agent_type: `planner` — subagent_type: `planner` — Prompt: "[CONTEXT header above] Break the architecture into ordered, atomic BACKEND/INFRA tasks ONLY. This file covers: database migrations, RLS policies, RPCs/API endpoints, auth setup, rate limits, cron jobs, and infrastructure scaffolding. UI tasks are NOT produced here — they come from page-specs/*.md in Phase 3. Each task needs: description, acceptance criteria, **dependencies** (list of task IDs this depends on), size (S/M/L), **Behavioral Test** field (curl-based acceptance test for API tasks, or migration/RLS verification command), **Feature** — the exact feature name from product-spec.md (e.g. 'Order Placement', 'Auth') that must match a `## Feature: X` heading in product-spec.md (use '—' for infrastructure tasks that don't belong to a specific feature). Read these files via your Read tool before starting:\n  - ARCHITECTURE: `docs/plans/architecture.md`\n  - PRODUCT SPEC: `docs/plans/product-spec.md` (per-feature behavioral sections — every feature in the spec must have at least one backend task)\n  - PRD: `docs/plans/design-doc.md`\nSave to `docs/plans/backend-tasks.md`. The table must have these columns in order: Task ID, Title, Size, Dependencies, Behavioral Test, Owns Files, Implementing Phase, Feature. Dependencies field is load-bearing — Phase 4 uses it to batch independent tasks in parallel.\n\n**CRITICAL FORMAT CONSTRAINT — graph-index parser schema:**\nThe downstream graph-index parser (`backend-tasks.ts` / legacy `sprint-tasks.ts`) will reject the file if ANY of these are violated:\n- Output MUST be a single markdown pipe table. Do NOT include any other pipe tables in the file (wave tables, summary tables, etc.) — the parser scans ALL tables and rejects any with fewer than 8 columns.\n- Exactly 8 columns, lowercase in header: `| task id | title | size | dependencies | behavioral test | owns files | implementing phase | feature |`\n- Size column MUST be exactly `S`, `M`, or `L` (uppercase, single letter).\n- Use `—` (em-dash) for empty cells, not blank.\n- Task IDs must be unique.\n- Example row: `| T-001 | Setup project scaffold | S | — | Run `npm start`, verify dev server on localhost:3000 | package.json, src/index.ts | Phase 4 | — |`\nDo NOT wrap the table in prose paragraphs that contain pipe characters. Keep non-table content as headings and bullet lists only."

3. Description: "Task DAG validator" — INTERNAL inline role-string — Prompt: "You are the Task DAG Validator. Read `docs/plans/backend-tasks.md`. Validate for DAG correctness:
  - No circular dependencies
  - All referenced task IDs in the Dependencies field exist
  - Sizing is consistent (S/M/L)
  - Dependencies match the architecture document (don't depend on a task that builds a component you don't need)
  - Every API/infra task has a curl-based or verification test
Report any violations. If clean, return PASS. If violations, return a list of fix requests — Backend Task Breakdown re-dispatches once with the fix list."

4. Description: "Refs indexer" — INTERNAL inline role-string — Prompt: "You are the Refs Indexer. Generate `docs/plans/refs.json` covering ALL live downstream docs:
  - `docs/plans/design-doc.md` (PRD)
  - `docs/plans/architecture.md`
  - `docs/plans/backend-tasks.md`
  - `docs/plans/quality-targets.json`
  - `DESIGN.md` (if it exists yet — Phase 3 extends refs.json after it writes this file)

For each doc, extract section anchors into a flat index. Schema: `[{\"anchor\": \"design-doc.md#persona\", \"topic\": \"user persona\", \"file_path\": \"docs/plans/design-doc.md\"}, ...]`. This index is consumed by the Phase 4 Briefing Officer for per-task context maps. Do NOT include Phase 1 scratch files — they are SPENT."

**Architecture Metric Loop (callable service):** Run the Metric Loop Protocol (`protocols/metric-loop.md`) on `architecture.md`. Define a metric: coverage of PRD requirements, specificity, consistency across the 4 architects, and **simplicity** — is this the simplest architecture that meets the requirements? Could any service, abstraction, or dependency be eliminated? Penalize over-engineering. Max 3 iterations.

#### Step 2.3.1.idx — Architecture graph index

After `code-architect` returns from the Implementation Blueprint dispatch (#1 above) AND the Architecture Metric Loop exits with `architecture.md` on disk, index it into the build graph. Slice 4 graph index — required for downstream agents.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/architecture.md`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

<HARD-GATE>
SKIP is NOT an allowed outcome for Step 2.3.1.idx. The orchestrator MUST NOT
write a `decisions.jsonl` row with `action=graph-index-architecture outcome=SKIP`.
On parser failure, return to Step 2.3 dispatch #1 with the parser error message
attached and re-run code-architect. Recovery is fix-the-source, not skip-the-index.
Downstream consumers (Phase 4 Briefing Officer, Track B auditor, Phase 6 routing)
read this slice as the single source of truth — a SKIP row corrupts every later
phase's substrate.
</HARD-GATE>

#### Step 2.3.2.idx — Backend tasks graph index

After `planner` returns from the Backend Task Breakdown dispatch (#2 above) AND the Task DAG Validator (#3 above) returns PASS, index `backend-tasks.md` into the build graph. Slice 4 graph index — best-effort.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/backend-tasks.md`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

<HARD-GATE>
SKIP is NOT an allowed outcome for Step 2.3.2.idx. The orchestrator MUST NOT
write a `decisions.jsonl` row with `action=graph-index-backend-tasks outcome=SKIP`.
On parser failure, return to Step 2.3 dispatch #2 with the parser error message
attached and re-run the Backend Task Breakdown. Recovery is fix-the-source.
</HARD-GATE>

#### Step 2.3.4.idx — Decisions re-index (end of Phase 2)

After the four Step 2.3 dispatches complete and the orchestrator finishes routing the 4 Phase 2 `deviation_row` objects through `scribe_decision`, re-index `decisions.jsonl` so the Slice 4 fragment reflects every Phase 2 decision before the LRR aggregator or feedback synthesizer can read it. Skip silently if `docs/plans/decisions.jsonl` does not exist (no decisions written yet).

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/decisions.jsonl`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. The decisions graph fragment must be current before downstream consumers query it.

<HARD-GATE>
SKIP is NOT an allowed outcome for Step 2.3.4.idx. On parser failure, fix the
malformed `decisions.jsonl` line(s) the parser flagged and re-run the index.
Recovery is fix-the-source, not skip-the-index.
</HARD-GATE>

**Architecture decisions:** The Implementation Blueprint synthesizer returns 4 `deviation_row` objects (or a `phase_2_decisions` array of row objects) in its structured result — one per cross-cutting Phase 2 decision (API contract, persistence layer, auth model, framework choice). The orchestrator forwards each row through the `scribe_decision` MCP tool (see Phase 4 "Orchestrator-scribe dispatch"); the MCP allocates `D-2-<seq>` IDs and atomically appends to `docs/plans/decisions.jsonl`. Author = `architect`. Each row carries a `ref` anchor pointing into `architecture.md` per `protocols/decision-log.md`. Total: 4 rows.

### Step 2.4 — Security Review (post-synthesis, NOT in team)

Security runs as a standalone subagent AFTER the architecture is synthesized. It reviews the complete picture rather than debating piecemeal during the team phase. This eliminates the coordination overhead of security's dense cross-check pairings while preserving full security coverage.

Description: "Security architecture review" — agent_type: `engineering-security-engineer` — subagent_type: `engineering-security-engineer` — model: `sonnet` — Prompt: "[CONTEXT header above] Security review of the synthesized architecture. Read these files via your Read tool before starting — do NOT expect pasted content:\n  - ARCHITECTURE: `docs/plans/architecture.md` (the synthesized output — this is your primary input)\n  - PRD: `docs/plans/design-doc.md`\n  - PRODUCT SPEC: `docs/plans/product-spec.md` (## Permissions & Roles is your auth model source of truth)\n  - BACKEND CONTRACT: `docs/plans/phase-2-contracts/backend-architect.md`\n  - FRONTEND CONTRACT: `docs/plans/phase-2-contracts/frontend-architect.md`\n\nReview the architecture for: auth model completeness, input validation coverage, secrets management, threat model, CSRF/XSS/injection surface, RLS policy design, dependency hygiene, client-side auth posture (token storage, secure cookies). Use the product spec's ## Permissions & Roles section to verify every role maps to enforceable permissions.\n\nWrite `docs/plans/phase-2-contracts/security-engineer.md` with your findings. Structure: auth model, RLS policies, threat model, input validation rules, secrets management, security headers, and a `### Required Revisions` section listing any changes needed to `architecture.md`. If no revisions needed, state 'No revisions required.'\n\nIf `### Required Revisions` is non-empty, the synthesizer will re-run once to incorporate your findings."

**Post-security revision (conditional):** If the security review's `### Required Revisions` section is non-empty, re-dispatch the Implementation Blueprint synthesizer (Step 2.3 dispatch #1) with an additional instruction: "Read `docs/plans/phase-2-contracts/security-engineer.md` § Required Revisions and incorporate into `architecture.md`. Do not re-read other contracts — only apply the security revisions." Then re-run the Refs Indexer. Max 1 revision cycle.

**Writes:** `docs/plans/architecture.md`, `docs/plans/backend-tasks.md`, `docs/plans/quality-targets.json`, `docs/plans/refs.json`. Decision rows (4) flow through the orchestrator's `scribe_decision` MCP calls.

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

Phase 4 WILL NOT START without `DESIGN.md` (Pass 1 + Pass 2 complete). If the artifact does not exist, return here.
</HARD-GATE>

**Mode-specific branch files drive Phase 3 in detail:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 3 (HIG + App Store + screenlane harvest → iOS Design Board, SwiftUI Preview QA loop).
- `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 3 — this file contains the NEW structure with steps 3.0-3.7 covering Visual DNA Selection (Brand Guardian as DNA owner at 3.0), Visual Research, Component Library Mapping, UX Architecture, Visual Design Spec, Inclusive Visuals Check, Style Guide Implementation (wrapped in Design Critic metric loop), and A11y Design Review. See the Component Library Mapping step in that protocol for the component library strategy.

**Phase 3 branch-file dispatch table (subagent_type references for SSOT lint):**
- Step 3.0 Visual DNA Selection: agent_type: `design-brand-guardian` — subagent_type: `design-brand-guardian` (web)
- Step 3.1 Visual Research (2 parallel): agent_type: `visual-research` — subagent_type: `visual-research` (web, competitive-audit + inspiration-mining)
- Step 3.2 Component Library Mapping: agent_type: `design-ui-designer` — subagent_type: `design-ui-designer` (web)
- Step 3.2b DNA Persona Check: agent_type: `design-ux-researcher` — subagent_type: `design-ux-researcher` (web, may route to 3.0)
- Step 3.3 UX Architecture: agent_type: `design-ux-architect` — subagent_type: `design-ux-architect` (web)
- Step 3.5 Inclusive Visuals Check: agent_type: `design-inclusive-visuals-specialist` — subagent_type: `design-inclusive-visuals-specialist` (web)
- Step 3.2-ios iOS Design Board: agent_type: `ios-swift-ui-design` — subagent_type: `ios-swift-ui-design` (iOS)

**Phase 3 write discipline:** Phase 3 is the writer for `DESIGN.md` (web) and extends `docs/plans/refs.json` to cover the visual spec anchors once it lands. Phase 3 does NOT write to `architecture.md` or `backend-tasks.md` — those are Phase 2's.

<HARD-GATE>
LRR BLOCK backward edge: `LRR BLOCK authoring=Phase 3 → back to Phase 3`. The ⭐⭐ star rule routes BLOCK findings via Aggregator decisions.jsonl `decided_by` lookup; if `decided_by == design-brand-guardian` or any Phase 3 writer, the build re-opens Phase 3 with the finding as input.
</HARD-GATE>

**On re-entry from Phase 6 (Customer Reality) backward routing:** When Phase 3 is re-opened via the re-entry dispatch template (Phase 6 Step 6.2), the orchestrator passes the re-entry payload (`{blocking_finding, prior_output: "DESIGN.md", decision_row}`) into the specific Phase 3 step named by `decision_row.author`. That step revises the prior output to address `blocking_finding` only — DESIGN.md Pass 1 (Step 3.0), component manifest (Step 3.2), or DESIGN.md Pass 2 (Step 3.4) — and emits a new decision_row. Unaffected steps are NOT re-run. Mode-specific branch files (`protocols/web-phase-branches.md` / `protocols/ios-phase-branches.md`) define which step owns which `decided_by` value.

#### Orchestrator-scribe dispatch (Phase 3 — audit fix #10)

After all Phase 3 steps complete and before the compaction checkpoint, collect deviation_rows from the Phase 3 agent returns and forward each through `scribe_decision` MCP. Same mechanics as Phase 4's Orchestrator-scribe dispatch (`commands/build.md` §"Orchestrator-scribe dispatch"). Row triggers (cap totals shown — only emit when condition fires; uneventful runs emit zero):

- **Step 3.0 — Brand Guardian DNA lock** (cap 1): emit when the locked 7-axis DNA card materially differs from the directional defaults inferred from the persona digest. `decided_by: design-brand-guardian`. `summary` = locked axes + directional kill rationale (the loudest rejected axis pair). `ref` = `DESIGN.md#overview-brand-dna`.
- **Step 3.2 — UI Designer component primitive choice** (cap 1, often 0): emit only when the chosen primitive library / tree-shaking strategy departs from a sensible default for the project's stack. `decided_by: design-ui-designer`. `summary` = library + variant strategy. `ref` = `DESIGN.md#components` or `docs/plans/component-manifest.md`.
- **Step 3.4 — Component manifest closure** (cap 0–1): emit when the closed manifest deviates from the auto-derived manifest from page-specs. `decided_by: design-ui-designer`. `summary` = which slots got non-default fills + why.
- **Step 3.6 — Design Critic verdict gap** (cap 0–1): emit only when the orchestrator accepts a critic verdict below threshold (terminal score gap). `decided_by: design-critic`. `summary` = which axis fell short + the rationale for accepting.

Total Phase 3 cap: ~4 rows. Re-entry runs (revising a prior output) emit one new row keyed to the re-entered step.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 4: Build — THREE-TIER FEATURE-BASED EXECUTION

<HARD-GATE>
Before starting Phase 4:
- Phase 2 must be approved.
- Phase 3 must have produced the design artifact (`DESIGN.md` — Pass 1 + Pass 2 complete; broken-refs lint == 0).
- `docs/plans/page-specs/` must contain at least one file (web).
- The Slice 3 graph index `*.buildanything/graph/slice-3-pages.json` must exist (Step 3.3.idx ran with exit 0). A missing slice-3-pages.json means the Briefing Officer's `graph_query_screen()` will return null and Phase 4 will halt at Step 4.2.a.gate. Recovery is fix-the-source: re-dispatch `design-ux-architect` and re-run the indexer. Do NOT proceed.
- After each Briefing Officer dispatch within a wave, `docs/plans/feature-briefs/{feature}.md` must exist before the corresponding implementer batch dispatches (enforced at Step 4.2.a.gate).

You MUST call the Agent tool for EVERY task. No exceptions.
</HARD-GATE>

**Goal**: Scaffold project, then execute backend tasks organized by FEATURE with product adherence checked per-feature during build. Three tiers: Product Owner (product quality) → Briefing Officers (task planning per feature) → Execution Agents (code). The orchestrator drives all dispatches — PO and BO are planning agents that write artifacts to disk.

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 4 for scaffold details and execution agent prompts.
- `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 4 for scaffold details and execution agent prompts.

**Phase 4 dispatch table (subagent_type references for SSOT lint):**
- Product Owner (planning): agent_type: `product-owner` — subagent_type: `product-owner`
- Product Owner (acceptance): agent_type: `product-owner` — subagent_type: `product-owner`
- Briefing Officer (per feature): agent_type: `briefing-officer` — subagent_type: `briefing-officer`
- Web UI (S/M): agent_type: `engineering-frontend-developer` — subagent_type: `engineering-frontend-developer`
- Web UI (L): agent_type: `engineering-senior-developer` — subagent_type: `engineering-senior-developer`
- Web backend: agent_type: `engineering-backend-architect` — subagent_type: `engineering-backend-architect` OR `engineering-senior-developer`
- Web AI/ML: agent_type: `engineering-ai-engineer` — subagent_type: `engineering-ai-engineer`
- iOS UI planner: agent_type: `ios-swift-ui-design` — subagent_type: `ios-swift-ui-design`
- iOS UI impl: agent_type: `engineering-senior-developer` — subagent_type: `engineering-senior-developer`, `engineering-mobile-app-builder`
- iOS Foundation Models: agent_type: `ios-foundation-models-specialist` — subagent_type: `ios-foundation-models-specialist`
- iOS StoreKit: agent_type: `ios-storekit-specialist` — subagent_type: `ios-storekit-specialist`
- iOS Swift review: agent_type: `swift-reviewer` — subagent_type: `swift-reviewer`
- Security review: agent_type: `security-reviewer` — subagent_type: `security-reviewer`
- Cleanup: agent_type: `code-simplifier` — subagent_type: `code-simplifier`, `refactor-cleaner`
- Code review: agent_type: `code-reviewer` — subagent_type: `code-reviewer`, `silent-failure-hunter`

### Step 4.0 — Scaffold (unchanged)

Scaffolding is project skeleton + design system + acceptance test stubs. Three sequential dispatches (full details in the mode-specific branch file):

**CONTEXT header:** Render `rendered_context_header` for phase 4 per the canonical template (see CONTEXT HEADER HARD-GATE above). Includes `dna` field for web projects. Prepend to every Phase 4 prompt below.

1. Description: "Project scaffolding" — agent_type: `engineering-rapid-prototyper` — subagent_type: `engineering-rapid-prototyper` — mode: "bypassPermissions" — prompt per branch file.

2. Description: "Design system setup" — agent_type: `engineering-frontend-developer` — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt per branch file. Implements design tokens from `DESIGN.md`.

3. Description: "Scaffold acceptance tests" — INTERNAL inline role-string — mode: "bypassPermissions" — prompt: "[CONTEXT header above] Scaffold acceptance tests from backend-tasks.md and page-specs/*.md. Use Page Object Model. For every backend task with a Behavioral Test field, create a test stub. For every page-spec, create a Playwright test stub (web) or Maestro flow stub (iOS). Stubs must FAIL right now. Commit: 'test: scaffold acceptance tests from backend tasks + page specs'."

**Scaffold verification:** Run the Verify Protocol with `scope: static` (checks 1-3 and 6 only: Build, Type-Check, Lint, Diff Review). Test stubs are designed to fail at this point — do not run checks 4, 5, or 7 until after task implementation.

### Step 4.1 — Product Owner: Feature Planning

Dispatch the Product Owner in planning mode. It reads the full artifact set via graph queries, groups tasks by feature, sequences features into dependency-ordered waves, and writes a delegation plan.

Call the Agent tool — description: "Product Owner: feature planning" — agent_type: `product-owner` — subagent_type: `product-owner` — prompt: "[CONTEXT header above] MODE: planning.

Read these artifacts via graph queries:
- `docs/plans/product-spec.md` — feature list, cross-feature interactions, screen inventory
- `docs/plans/backend-tasks.md` — backend/infra task breakdown with dependencies
- `docs/plans/architecture.md` — cross-feature API contracts, shared data entities
- `docs/plans/page-specs/*.md` — one page-spec per UI screen (each is one unit of UI work)
- `docs/plans/quality-targets.json` — NFRs

Produce `docs/plans/feature-delegation-plan.json` per the schema in `agents/product-owner.md`. For each feature: list assigned backend tasks (from backend-tasks.md) and UI page-specs (from page-specs/*.md), write a product_context summary (~100-200 tokens: persona constraints, key business rules, critical error scenarios, competitive differentiators), extract cross-feature contracts, list page-spec refs (web: `page-specs/*.md` paths; iOS: `DESIGN.md` section anchors). Sequence features into waves by dependency order. Wave 1 = backend tasks from backend-tasks.md. Wave 2+ = UI pages from page-specs/*.md (each page-spec is one unit of UI work)."

Output: `docs/plans/feature-delegation-plan.json`. Update `.build-state.json`: set `feature_delegation_plan_path`, initialize `current_wave: 1`, `completed_features: []`, `feature_acceptance: {}`.

### Step 4.2 — Wave Execution (repeat for each wave)

Read `feature-delegation-plan.json`. For each wave, execute all features. Features within a wave are independent and their Briefing Officers can be dispatched in parallel.

#### 4.2.a — Briefing Officer dispatch (one per feature, parallel within wave)

For each feature in the current wave, dispatch a Briefing Officer. If the wave has multiple independent features, dispatch all BOs in ONE message (parallel).

Call the Agent tool — description: "Briefing Officer: [feature name]" — agent_type: `briefing-officer` — subagent_type: `briefing-officer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above] FEATURE DELEGATION from Product Owner:

Feature: [feature name]
Product context: [paste product_context from delegation plan]
Cross-feature contracts: [paste contracts from delegation plan]
Assigned tasks: [paste task IDs]
Page spec refs: [paste page_spec_refs from delegation plan]

Read the full feature spec via graph query. For backend tasks: read task rows from `docs/plans/backend-tasks.md`. For UI work: read page-specs via graph_query_screen(full: true). Read architecture, component manifest, visual design spec for this feature's screens.

Write `docs/plans/feature-briefs/[feature].md` per the schema in `agents/briefing-officer.md`. For each task: specify agent type, skills, structured context payload (layout, components, API contract, error states, business rules, persona constraints), and acceptance criteria."

Output: `docs/plans/feature-briefs/[feature].md`. Update `.build-state.json.feature_briefs[feature]` with the path.

#### 4.2.a.gate — Brief existence gate (orchestrator)

After each Briefing Officer dispatch returns, verify `docs/plans/feature-briefs/[feature].md` exists and is non-empty. Use the Bash tool: `test -s docs/plans/feature-briefs/[feature].md && echo PASS || echo BLOCKED`.

<HARD-GATE>
On gate failure (file missing or empty):
  1. Log to `docs/plans/build-log.md`: `phase=4 step=4.2.a.gate feature=[name] outcome=BLOCKED reason=brief-not-written`.
  2. Re-dispatch the Briefing Officer ONCE with the additional directive in the prompt:
     "Your previous run did not produce `docs/plans/feature-briefs/[feature].md`.
      Write the file before returning. The orchestrator will halt Phase 4 if it
      is still missing. If you halted because of a graph-query failure, write
      the file with a `## STATUS: BLOCKED` block naming the missing slice so
      the orchestrator can re-dispatch the producing agent."
  3. On a second gate failure, STOP the build and surface the BO's last response
     to the user.
  4. Do NOT dispatch implementers without a brief on disk. The empty
     `feature-briefs/` failure mode (Phase 4 implementers ran with no per-feature
     load-bearing context, see `docs/known-issues-2026-05-06.md` Issue 1) is the
     specific regression this gate exists to close.
</HARD-GATE>

After PASS, update `.build-state.json.feature_briefs[feature]` with the verified path before proceeding to 4.2.b.

#### 4.2.b — Task execution (orchestrator reads BO brief, dispatches per task)

After the Briefing Officer writes the feature brief AND Step 4.2.a.gate has confirmed the file exists, the orchestrator reads it and executes each task. Tasks within a feature are executed in DAG-parallel batches (topological ordering from the Dependencies field — independent siblings run in parallel, yielding ~30-50% wall-clock saving). The per-task pipeline is unchanged in structure — only the input to the execution agent changes.

**For each task in the feature brief:**

**1. Implementer dispatch** — The orchestrator reads the task's execution spec from the feature brief and pastes the structured context directly into the execution agent's prompt. See mode-specific branch file (`protocols/web-phase-branches.md` §Phase 4 or `protocols/ios-phase-branches.md` §Phase 4) for the exact prompt template.

Call the Agent tool — description: "[task-id] [task name]" — agent_type: [from BO brief] — subagent_type: [from BO brief] — mode: "bypassPermissions" — prompt: "[CONTEXT header above].

[Paste the full structured context payload from the feature brief — TASK, FEATURE CONTEXT, PAGE LAYOUT, COMPONENTS, API CONTRACT, ERROR STATES, BUSINESS RULES, SKILLS ASSIGNED, ACCEPTANCE. See branch file for exact format.]

## Prior Learnings
[paste contents of `docs/plans/.active-learnings.md` if it exists, otherwise omit this section]

## Deviation Reporting
If your implementation deviates from the planned architecture, return a `deviation_row` object per the schema in `protocols/decision-log.md`. If no deviation, return `deviation_row: null`. Do NOT write `decisions.jsonl` directly.

Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

**2. Per-task security review (auth/PII tasks only)** — unchanged from prior design.

Call the Agent tool — description: "Security review for [task-id]" — agent_type: `security-reviewer` — subagent_type: `security-reviewer` — prompt: "[CONTEXT header above] Review changed files from [task-id] for security issues. Scope: auth logic, input validation, secrets handling, dependency hygiene, OWASP Top 10 for web (or iOS Keychain / ATS / data protection for iOS). Return blocking findings only — 80%+ confidence threshold. Files to review: [list from implementer's changeset]."

**3. Senior Dev cleanup** — unchanged. Two-pass, changeset-scoped.

1. Call the Agent tool — description: "Simplify [task-id]" — agent_type: `code-simplifier` — subagent_type: `code-simplifier` — mode: "bypassPermissions" — prompt: "[CONTEXT header above] Simplify changed files from [task-id]. Remove dead code, unused imports, redundant abstractions. Do NOT add features. Do NOT change architecture. Do NOT touch files outside the changeset. Files: [list]."

2. If TS/JS task: Call the Agent tool — description: "Refactor [task-id]" — agent_type: `refactor-cleaner` — subagent_type: `refactor-cleaner` — mode: "bypassPermissions" — prompt: "[CONTEXT header above] Run knip/depcheck/ts-prune on changed files from [task-id]. Changeset only. Files: [list]."

**4. Per-task code review (parallel pair)** — unchanged.

Call the Agent tool 2 times in one message:

1. Description: "Code review for [task-id]" — agent_type: `code-reviewer` — subagent_type: `code-reviewer` — Prompt: "[CONTEXT header above] Review changed files from [task-id]. 80%+ confidence threshold. Changeset only. Files: [list]."

2. Description: "Silent failure hunt for [task-id]" — agent_type: `silent-failure-hunter` — subagent_type: `silent-failure-hunter` — Prompt: "[CONTEXT header above] Hunt silent failures in changed files from [task-id]. Files: [list]."

**5. Metric Loop** — unchanged. Authoritative behavioral check per `protocols/metric-loop.md`. Max 5 iterations.

**6. Verify Service** — unchanged. Static checks only (type-check, lint, build). Max 2 fix attempts.

**7. After each task completes** — Update TodoWrite and `.build-state.json`. Write summary to `docs/plans/.task-outputs/[task-id].json`.

**8. Orchestrator-scribe** — After all tasks in a feature complete, collect deviation_rows and forward through `scribe_decision` MCP. Same mechanics as before.

### Step 4.3 — Product Owner: Feature Acceptance

After all tasks for a feature complete, dispatch the Product Owner in acceptance mode. It checks whether the built feature matches the product spec.

Call the Agent tool — description: "Product Owner: accept [feature name]" — agent_type: `product-owner` — subagent_type: `product-owner` — prompt: "[CONTEXT header above] MODE: acceptance. FEATURE: [feature name].

Read the feature's acceptance criteria and business rules via graph query. Read the feature's page spec(s) from `docs/plans/page-specs/`. Use agent-browser (web) or XcodeBuildMCP + Maestro (iOS) to verify the built feature.

Check: (1) Does the feature implement the product spec's happy path? (2) Are business rules correct? (3) Are error states from the product spec handled? (4) Does the layout match the page spec? (5) Does component usage match the manifest?

Write verdict: ACCEPTED or NEEDS_REVISION with specific findings citing product-spec sections."

**Verdict routing:**
- `ACCEPTED` → mark feature complete in `.build-state.json.feature_acceptance`. Proceed.
- `NEEDS_REVISION` → orchestrator re-dispatches the Briefing Officer for this feature with the findings. BO writes an updated brief targeting only the failing tasks. Orchestrator re-executes those tasks. Max 2 revision cycles per feature. After 2nd NEEDS_REVISION: interactive → present findings to user. Autonomous → accept with gap note in build-log.md AND append a structured gap entry to `.build-state.json.feature_acceptance[feature].gaps[]` with shape `{finding, severity, accepted_at_cycle}`. **Audit fix #10 — also emit a Phase 4 deviation row** via `scribe_decision`: `{phase: 4, step_id: \"4.3\", decided_by: \"product-owner\", summary: \"Accepted [feature] with N gaps after 2 revision cycles\", rationale: <brief reason — usually one or more gap descriptions>, ref: \"docs/plans/.build-state.json#feature_acceptance.[feature].gaps\"}`. One row per accepted-with-gaps feature; the per-Phase-4 cap is implicit (one per feature that hits the gap path). This row is the backward-routing anchor if Phase 6 Customer Reality later surfaces the gap as a `doesnt_deliver` or `confusing_or_illogical` finding.

### Step 4.3.5 — Wave-End Gate (audit fixes #4, #5, #11, #13, #14, #17)

After every feature in the current wave returns `ACCEPTED` from Step 4.3, BUT before the wave transitions to the next wave at Step 4.4, the orchestrator runs a wave-end gate. The gate's purpose is to catch integration-level and spec-adherence issues that per-task verify cannot see — bugs that only manifest with the wave's full output assembled. Wave-end findings route to a wave-scoped fix loop (max 2 cycles per gate-check, mirroring PO acceptance retry semantics) and resolve INSIDE this wave, NOT forward to Phase 5. Phase 5 is the broad-net audit; the wave-end gate is the narrow-net forcing function.

**Why a separate step.** The broken-build at `tables2.1.1` shipped because Phase 5 caught 192 findings at end-of-build, the fix loop ran out of cycles, and ~80 HIGH findings were deferred. Per-wave gates catch ~70% of those bugs while they are still cheap to fix.

**Composition: cheap tier (parallel) → expensive tier (sequential).** Cheap-tier checks are deterministic shell + grep + SQL — no LLM judgment. Expensive-tier checks need the running app + agent-browser, so they share the dev-server lifecycle. Run cheap tier first; if anything blocks, fix and re-run cheap tier. Only proceed to expensive tier when cheap tier is green.

#### Cheap tier — parallel, ONE message

Three deterministic checks. Wall-clock target: 1–3 min combined.

1. **Production-mode build (audit fix #4)** — INTERNAL inline role-string — Bash dispatch: web → `NODE_ENV=production npm run build` (or `pnpm build` per `protocols/verify.md` package-manager detection); iOS → `xcodebuild -scheme <Scheme> build` per `protocols/ios-phase-branches.md:226`. The wave-level build runs after the cleanup pass + cross-feature shared-file reconciliation, so it sees the wave's *final* state. Production mode catches lint-only-in-prod errors and integration-level type drift across feature boundaries. On non-zero exit: BLOCK the wave, capture stderr, route to the feature whose changeset most likely introduced the error (use the per-task `owns_files` union to attribute), max 2 wave-fix cycles.

2. **Halt-condition assertions (audit fix #12 — already wired at Step per-task verify; re-runs at wave-end as integration check)** — call `checkHaltConditions(projectDir)` from `src/orchestrator/halt-conditions.ts`. Per-task verify catches single-file violations; wave-end re-runs to catch combined patterns (e.g., a rule file that became a violation only after another task's edit). On `pass: false`: BLOCK the wave, route to BO of the feature owning the violating file. Halt-conditions are the user's explicit "never do X" rules — treat as critical-severity always.

3. **A11y assertion (audit fix #11b — promoted from old LRR A11y chapter)** — INTERNAL inline role-string — Bash dispatch: web → run `npx @axe-core/cli http://localhost:3000` (or equivalent against the wave's pages); iOS → XcodeBuildMCP accessibility audit. Block on findings with severity `critical` or `serious`. Log `moderate` and `minor` to `docs/plans/evidence/wave-a11y/{wave_n}/log.md` for forwarding to the Phase 6 Customer Reality Judge as supporting context. Mechanical a11y fires here at wave-end (deterministic) so the judge at Phase 6 only flags a11y when it manifests as customer confusion ("I can't tab to this button" / "I can't read this on mobile"). Replaces the v1 LRR A11y chapter that ran end-of-build.

4. **Schema/code execution (audit fix #13)** — INTERNAL inline role-string — Bash dispatch: walk `supabase/migrations/*.sql` (or equivalent for non-Supabase) and build a column manifest `{table_name → [column_name, ...]}`. Then grep all source files for SQL queries (`.from('...')`, `.select('...')`, `query: SELECT ... FROM`) and assert each referenced column exists in the manifest. For dynamic queries, execute `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'` against the running local Supabase (orchestrator already starts one for Phase 5 dogfood — extend startup to wave-end gate). On column mismatch (code references `companion_outfits.unlock_level` but no migration has it): BLOCK the wave, route to BO of the feature owning the migration OR the consumer code — gate emits both candidates; BO picks. The `tables2.1.1` companion_outfits schema mismatch (`name`, `unlock_level`, `sprite_sheet_url` queried but absent from migrations) is the regression target.

If cheap tier passes (all three return PASS), proceed to expensive tier. If any cheap-tier check fails, halt expensive tier, route the failures to wave-fix per gate-check (max 2 cycles), then re-run cheap tier.

#### Expensive tier — sequential, after cheap tier PASS

Four LLM + agent-browser checks sharing the running dev-server. Wall-clock target: 10–20 min combined.

4. **Brand-drift gate (audit fix #11)** — Description: "Brand drift wave gate" — agent_type: `design-brand-guardian` — subagent_type: `design-brand-guardian` — mode: "bypassPermissions" — Prompt: "[CONTEXT header above — phase: 4] **Phase 4 wave-drift gate.** You score this wave's UI pages against the locked DNA card with **blocking authority** (different from your Phase 5 observer-only role). Capture screenshots of each page-spec affected by this wave's features via agent-browser. Score each page on the 7 DNA axes per `agents/design-critic.md` rubric. Total possible 140; wave-pass requires ≥ 100 (≥ 71% — slightly looser than design-critic's 195/240 ≈ 81% to account for Phase 4 not being a /design-system route). Drift findings BLOCK the wave the same way PO `NEEDS_REVISION` does — route to the BO of the offending feature with the gap list. Output: `docs/plans/evidence/wave-drift/{wave_n}/findings.json` with shape `[{page_spec, axis, score_/20, finding}, ...]` and `docs/plans/evidence/wave-drift/{wave_n}/wave-drift.md` summary."

5. **PO Mode 2 visual acceptance (audit fix #5)** — Description: "PO wave acceptance" — agent_type: `product-owner` — subagent_type: `product-owner` — Prompt: "[CONTEXT header above] MODE: wave-acceptance. WAVE: [wave_n]. FEATURES: [feature list]. For each feature, capture screenshots of all page-specs via agent-browser. For each page-spec, write `docs/plans/evidence/feature-acceptance/{feature_id}/screenshots/{page_spec_basename}.png` (capture from running app). Compare each screenshot to the page-spec's `## ASCII Wireframe` section: layout, component hierarchy, dominant element, spacing, content placement. Write `docs/plans/evidence/feature-acceptance/{feature_id}/wireframe-diff.md` (ASCII side-by-side: spec wireframe left, observed structure right, section-by-section). Write `docs/plans/evidence/feature-acceptance/{feature_id}/verdict.json` with shape `{feature_id, verdict: \"ACCEPTED\" | \"NEEDS_REVISION\", page_spec_comparisons: [...], business_rule_checks: [...], audited_at}`. The orchestrator confirms ALL THREE artifacts exist on disk with non-zero size before marking the feature `ACCEPTED` for wave-pass — missing artifacts → automatic `NEEDS_REVISION` regardless of verdict text. This closes the `feature_acceptance: {}` loophole from `tables2.1.1`."

   **Post-dispatch verification:** for each feature in the wave, `test -s` against `verdict.json`, `wireframe-diff.md`, and at least one `screenshots/*.png`. Any feature with a missing artifact: treat as `NEEDS_REVISION`, route to BO. Any `verdict.json` with `verdict: NEEDS_REVISION`: route to BO. Update `.build-state.json.feature_acceptance[feature]` from the on-disk `verdict.json` (preserves the existing `gaps[]` field that audit fix #10's Phase 4 row reads).

6. **Security wave-execute (audit fix #14)** — Description: "Security wave execute" — agent_type: `engineering-security-engineer` — subagent_type: `engineering-security-engineer` — mode: "bypassPermissions" — Prompt: "[CONTEXT header above] **Phase 4 wave-execute mode.** Generate **executable proof of exploitability** for the canonical vulnerability classes against the running app. Scope: ONLY the endpoints / RPCs / forms that this wave introduced or modified (use the wave's `owns_files` union to filter). Vulnerability classes to attempt: IDOR on auth-protected RPCs/endpoints (e.g., `curl /rest/v1/rpc/<rpc_name> -d '{p_user_id: <other_uuid>}' -H 'Authorization: Bearer <other_user_jwt>'` returning the other user's data), SQL injection on form fields, missing rate limit on mutating endpoints, open-redirect on auth flows, CSRF on state-changing actions, missing/weak CSP. For each class, produce a curl or agent-browser script. Run each. Severity-CRITICAL findings WITHOUT executable proof are downgraded to severity-HIGH-unverified. Findings WITH executable proof BLOCK the wave. Output: `docs/plans/evidence/wave-security/{wave_n}/findings.json` with shape `[{vuln_class, endpoint_or_form, severity, proof_of_exploit: <script + observed result> | null, file_ref}, ...]`. Only findings with `proof_of_exploit: <non-null>` block. The `tables2.1.1` SEC-001 IDOR (`api.visited_map(p_user_id uuid)` SECURITY DEFINER, no `auth.uid()` check) would have been caught here at Wave 1 (backend RPCs)."

7. **Holistic dogfood per-wave (audit fix #17)** — Description: "Wave dogfood" — agent_type: `testing-evidence-collector` — subagent_type: `testing-evidence-collector` — mode: "bypassPermissions" — Prompt: "[CONTEXT header above] **Wave-mode dogfood** (NOT the Phase 5 full-app dogfood — narrower scope, faster feedback). Wave-mode budget: 5–10 min wall-clock; CRITICAL findings BLOCK the wave, HIGH findings route to fix the same way; MEDIUM/LOW are logged and forwarded to Phase 5 dogfood for ratification. Inputs: this wave's feature list and pages introduced this wave + the full feature-delegation-plan for prior waves' completed features (so dogfood knows what's *supposed* to work end-to-end up to this point). Behavior: navigate the new pages, exercise critical user flows that traverse the new pages plus any prior-wave pages they depend on, report findings as severity-tagged blocks. Output: `docs/plans/evidence/wave-dogfood/{wave_n}/findings.json`. The `tables2.1.1` Edge Runtime crypto crash CF-001 (blocked every route) would have surfaced in Wave 1 on the first navigation."

#### Wave-end gate failure routing (max 2 cycles per gate-check)

If any check (cheap or expensive tier) returns BLOCKING findings:

1. Log to `docs/plans/build-log.md`: `phase=4 step=4.3.5 wave=[n] gate=[name] outcome=BLOCKED finding_count=N`.
2. Route to the BO of the affected feature(s) with the wave-fix payload: `{wave: n, gate: name, blocking_findings: [...], cycle: 1}`. The BO writes an updated brief targeting only the failing tasks; orchestrator re-executes those tasks.
3. After fix dispatch, re-run only the failed gate-check (not the entire gate).
4. Max 2 wave-fix cycles per gate-check. After 2nd failure: autonomous → annotate `.build-state.json.wave_gate[wave_n][gate_name].gaps[]` and proceed (these gaps surface to Phase 5 audit and may be re-flagged at Phase 6 Customer Reality); interactive → present remaining gate-fail list to user.

**Wave-gate decision rows (audit fix #10):** For every gate-fail that gets accepted-with-gap (autonomous after cycle 2), emit a `deviation_row` via `scribe_decision`: `{phase: 4, step_id: \"4.3.5\", decided_by: \"orchestrator\", summary: \"Accepted wave [n] with gaps in gate [name] after 2 fix cycles\", rationale: <one-line gap list>, ref: \"docs/plans/.build-state.json#wave_gate.[wave_n].[gate_name].gaps\"}`. This is the backward-routing anchor if Phase 6 LRR later flags the wave-gap as BLOCK.

#### Wave-gate cost notes

Per-wave overhead estimate (one wave = 3–5 features): cheap tier ~5K tokens, expensive tier ~145K tokens (~$1.50–3 per build at Sonnet medium pricing). Net negative vs the cost of a single Phase 5 fix-loop cycle that exhausts (the failure mode in `tables2.1.1`). Cheap-tier-first ordering is the primary cost control: broken waves never run the expensive checks.

### Step 4.4 — Wave Transition

After all features in the current wave are ACCEPTED **AND Step 4.3.5 wave-end gate passes**:

1. Update `.build-state.json`: add features to `completed_features`, increment `current_wave`.
2. Handle shared file mutations: if any BO flagged shared file changes needed by the next wave, apply them now. The orchestrator identifies shared files from BO cross-feature contract fields. For each shared file flagged by multiple features in the next wave, dispatch a single `code-architect` agent to reconcile the mutations before wave execution begins. Do NOT let multiple BOs independently modify the same shared file.
3. Run a quick Verify Protocol (static checks) to confirm the wave didn't break anything.
4. Proceed to next wave. Repeat Steps 4.2–4.4.

After all waves complete, Phase 4 is done.

#### Step 4.4.idx — Decisions re-index (end of wave)

After each wave's deviation rows have been routed through `scribe_decision` (per the Orchestrator-scribe dispatch below), re-index `decisions.jsonl` so the Slice 4 fragment reflects every wave-level decision before the next wave's BOs query open decisions. Skip silently if `docs/plans/decisions.jsonl` does not exist.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/decisions.jsonl`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. The next wave's BOs require current decision data.

**Writes:** source code, `docs/plans/.task-outputs/`, `docs/plans/feature-delegation-plan.json`, `docs/plans/feature-briefs/*.md`. Deviation rows flow through the orchestrator's `scribe_decision` MCP calls.

<HARD-GATE>
DECISIONS.JSONL — ORCHESTRATOR-SCRIBE ONLY via `scribe_decision` MCP. Only the orchestrator may cause appends to `docs/plans/decisions.jsonl`, and it does so exclusively by invoking the `scribe_decision` MCP tool. Any dispatch prompt asking a subagent to write this file is a bug. The orchestrator itself MUST NOT Write or Edit the file directly. Subagents return `deviation_row` objects in their structured result; the orchestrator forwards them through the MCP, which owns ID allocation and atomic append.
</HARD-GATE>

#### Orchestrator-scribe dispatch (route deviation rows through `scribe_decision` MCP)

Runs after each feature's tasks complete. Same mechanics as before:

1. Collect non-null `deviation_row` from each subagent return.
2. For each row, invoke `scribe_decision` MCP. One call per row.
3. MCP allocates `decision_id`, stamps timestamp, validates, atomically appends.
4. Regenerate `.build-state.md`.

**On resume:** scribe MCP reconstructs its ID allocator by scanning `decisions.jsonl`. The `decisions_next_id` field in `.build-state.json` is deprecated (scribe owns ID allocation).

<HARD-GATE>
LRR NEEDS_WORK backward edge: `LRR NEEDS_WORK (code-level) → back to Phase 4 target feature`. The Aggregator classifies the finding and routes to the specific feature's Briefing Officer via `related_decision_id` lookup. The BO re-plans the affected task(s), orchestrator re-executes. Product-level issues route to the Product Owner, who re-delegates to the relevant BO.
</HARD-GATE>

**Compaction checkpoint.** Update `.build-state.json` per the format above. Feature-level state (`completed_features`, `current_wave`, `feature_acceptance`, `feature_briefs`) survives compaction — all planning artifacts are on disk.

---

## Phase 5: Audit — Track A (engineering reality) + Track B (product reality) + cross-cutting

<HARD-GATE>
Before starting Phase 5: run the Verify Protocol (7 checks) one more time. All checks must pass before expensive audit agents fire.
</HARD-GATE>

**Goal**: Surface quality issues before Launch Review. Phase 5 runs in three layers: Track A audits the engineering envelope (API / perf / a11y / security / brand drift), Track B audits the built product against `product-spec.md` per-feature (states, transitions, business rules, happy path, persona constraints, wiring, manifest coverage), and Cross-cutting checks (E2E user journeys, autonomous dogfood, fake-data detector) catch what neither track anticipates. Findings from all three layers route through one Feedback Synthesizer (Step 5.4) and one Fix loop (Step 5.5).

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 5 for iOS-adapted Track A/B + cross-cutting (XcodeBuildMCP + Maestro execution surface). Steps 5.1–5.3 are defined in the iOS protocol; Steps 5.4–5.5 below are shared.
- `project_type=web`: continue below.

### Step 5.1 — Track A: Engineering Reality (5 parallel auditors, ONE message)

Read the NFRs from `docs/plans/quality-targets.json`. Pass the relevant targets to each audit agent so they have concrete thresholds, not generic checks.

**CONTEXT header:** Render `rendered_context_header` for phase 5 per the canonical template (see CONTEXT HEADER HARD-GATE above). Prepend to every Step 5.X dispatch prompt below.

Call the Agent tool 5 times in one message:

1. Description: "API testing" — agent_type: `testing-api-tester` — subagent_type: `testing-api-tester` — Prompt: "[CONTEXT header above] Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. NFR targets: Read `docs/plans/quality-targets.json` via your Read tool for performance and reliability thresholds. Report findings with severity counts."

2. Description: "Performance audit" — agent_type: `testing-performance-benchmarker` — subagent_type: `testing-performance-benchmarker` — Prompt: "[CONTEXT header above] Measure response times, identify bottlenecks, flag performance issues. NFR targets: Read `docs/plans/quality-targets.json` via your Read tool for performance thresholds. Bundle size per-Scope budgets apply (Marketing 500KB / Product 300KB / Dashboard 400KB / Internal 200KB gzipped). Report benchmarks AGAINST these targets, not generic metrics."

3. Description: "A11y audit" — agent_type: `a11y-architect` — subagent_type: `a11y-architect` — Prompt: "[CONTEXT header above] Light-touch accessibility sweep — flag only Critical and Serious WCAG 2.2 AA violations (blatant ADA issues). Skip Moderate/Minor. Keep the report concise. WCAG 2.2 AA runtime compliance audit on all interfaces. Check screen reader, keyboard nav, contrast, focus order, touch targets (>=44px), reduced-motion variants. Report issues with severity (Critical/Serious/Moderate/Minor)."

4. Description: "Security audit" — agent_type: `engineering-security-engineer` — subagent_type: `engineering-security-engineer` — Prompt: "[CONTEXT header above] Security review at app level: auth, input validation, data exposure, dependency vulnerabilities. NFR targets: Read `docs/plans/quality-targets.json` via your Read tool for security thresholds. Report findings with severity."

5. Description: "Brand Guardian drift check" — agent_type: `design-brand-guardian` — subagent_type: `design-brand-guardian` — Prompt: "[CONTEXT header above] You are the Phase 5 drift check. Read DESIGN.md (the DNA card locked at Phase 3.0) + the actually-built pages via Playwright screenshots under docs/plans/evidence/. Score whether Phase 4 implementers stayed true to the DNA or drifted away from it. Specifically check: does the built Character axis match the DNA? Does Density match? Is Material consistent? Is Motion aligned? Report drift count and specific elements. Save findings to docs/plans/evidence/brand-drift.md. Note: this is a drift check only — the Phase 6 LRR Brand Guardian chapter does the verdict. You do NOT issue a pass/fail here, only surface findings."

### Step 5.2 — Track B: Product Reality (parallel per-feature, ONE message)

Track B audits the built app against `product-spec.md` on a per-feature basis. Each feature gets its own auditor; all auditors run in parallel.

**CONTEXT header:** Render `rendered_context_header` for phase 5 per the canonical template (see CONTEXT HEADER HARD-GATE above). Prepend to every Step 5.X dispatch prompt below.

**Feature enumeration:** Before dispatch, query the graph for the full feature inventory:

- Call `mcp__plugin_buildanything_graph__graph_list_features` (no arguments) to get the full feature inventory. Returns an array of `{id, label, kebab_anchor}` for every feature in the indexed product-spec. The orchestrator OWNS this enumeration — auditors never enumerate themselves.
- If the call fails, STOP. Log `TRACK B BLOCKED: graph_list_features failed` to `docs/plans/build-log.md` and report the error. The graph must be indexed correctly before Track B can run.

**Zero-feature gate:** If feature enumeration returns zero features, STOP. This indicates either the graph indexer is broken or `product-spec.md` has no recognizable `## Feature:` sections — neither is a Phase 5 problem. Log `TRACK B BLOCKED: zero features enumerated` to `docs/plans/build-log.md` and route the build back to Step 1.6 (product-spec-writer) via the standard backward-routing template. Do NOT proceed with Cross-cutting (Step 5.3) on a feature-less Track B run.

**Dispatch:** Call the Agent tool N times in ONE message — one per `feature_id`:

- Description: "Product Reality Audit: {feature_label}"
- agent_type: product-reality-auditor — subagent_type: product-reality-auditor
- Prompt: "[CONTEXT header above] Audit feature_id: {feature_id}. Follow your Cognitive Protocol (ABSORB → QUERY → SYNTHESIZE → EXECUTE → CLASSIFY → SCORE → WRITE). Write evidence to docs/plans/evidence/product-reality/{feature_id}/. Report manifest of evidence paths back."

**Post-dispatch verification:** After all Track B auditors return, verify each feature has the four evidence files (`tests-generated.md`, `results.json`, `findings.json`, `coverage.json`) AND that each JSON file parses as valid JSON. If any feature is missing a file or has a malformed JSON file, log `TRACK B EVIDENCE MISSING/MALFORMED: {feature_id}: {path}` to `docs/plans/build-log.md` and re-dispatch that feature's auditor once (this distinguishes the retry from the first attempt). If the second attempt still fails, emit a synthetic finding with `target_phase: 1, target_task_or_step: "1.6"` (the auditor failing twice on the same feature is a strong signal the spec for that feature is malformed) and let it route through the existing spec-gap path at Step 5.4.

**1:1 coverage diff (audit fix #8):** After post-dispatch verification, the orchestrator MUST diff the dispatched feature_ids against the on-disk evidence folders. The bug class this closes is the `tables2.1.1` shape where Auth was a feature in product-spec.md but no `evidence/product-reality/auth-dev-stub/` folder existed — Track B silently skipped the feature. Procedure:

1. Build `dispatched_ids` = the set of feature_ids you dispatched in this Step 5.2 (from the dispatch loop).
2. Build `disk_ids` = `ls docs/plans/evidence/product-reality/` filtered to directories.
3. Build `spec_ids` = the feature_id list returned by `graph_list_features` at the top of Step 5.2.
4. Compare:
   - **`spec_ids \ disk_ids`** (spec feature with no evidence folder): emit one synthetic finding per missing feature with shape `{finding_id: "track-b-coverage-missing-{feature_id}", source: "track-a", severity: "block", target_phase: 5, target_task_or_step: "5.2", description: "Track B did not produce evidence for spec feature {feature_label} ({feature_id}). Re-dispatch product-reality-auditor for this feature_id."}`. The Phase 5.5 fix loop will route these `target_phase: 5` findings back into Step 5.2 for re-dispatch.
   - **`disk_ids \ spec_ids`** (folder with no spec feature, e.g. `infra/`): log `TRACK B EXTRA EVIDENCE: {disk_id}` to `docs/plans/build-log.md` as WARN. Extra evidence is not a contract violation — could be infra-only audit or stale folder. Do NOT block.
   - **`spec_ids \ dispatched_ids`** (spec feature you forgot to dispatch): this is an orchestrator bug. Log `TRACK B DISPATCH GAP: {missing_id}` to `docs/plans/build-log.md` and emit the same synthetic finding above with `severity: "block"`. The diff catches both forgot-to-dispatch and dispatched-but-failed-to-write cases.

If any synthetic findings are emitted, write them to `docs/plans/evidence/track-b-coverage-gaps.json` (one array of finding objects) BEFORE Step 5.4 dispatches — the synthesizer reads this file as part of its Track A finding stream.

**Note on the metric loop:** The Metric Loop callable service is no longer wired as a primary Phase 5 step. It can still be invoked ad-hoc by Track A audit fixes via Step 5.5 if a single check class needs iterative tightening, but the structured per-feature audit replaces the orchestrator-improvised eval cases that the previous Step 5.2 (Eval Harness → Metric Loop) drove.

### Step 5.3 — Cross-cutting (3 parallel, ONE message)

Call the Agent tool 3 times in one message:

1. Description: "E2E runner" — INTERNAL inline role-string — mode: "bypassPermissions" — Prompt: "Run Playwright E2E test generation, execution, and stability check per `protocols/web-phase-branches.md` Phase 5 E2E steps (generate and run E2E tests for User Journeys, 3 mandatory iterations for flakiness detection). Report results + artifact paths. Records results to `docs/plans/evidence/e2e/iter-3-results.json`. Scope: multi-feature User Journeys ONLY (login → browse → buy, signup → onboarding → first-action). Single-feature happy paths are covered by Track B per-feature auditors at Step 5.2 — do NOT duplicate. Additionally, read the `## Cross-Feature Interactions` section from `docs/plans/product-spec.md`. For each cross-feature rule (e.g., 'Auth → Checkout: user must be authenticated'), generate a targeted E2E test that verifies the rule holds. These are NOT user journeys — they are specific behavioral contracts between features."

2. Description: "Dogfood the app" — agent_type: `testing-evidence-collector` — subagent_type: `testing-evidence-collector`

3. Description: "Fake-data detector" — agent_type: `silent-failure-hunter` — subagent_type: `silent-failure-hunter` — mode: "bypassPermissions" — Prompt: "Run the Fake Data Detector Protocol (`protocols/fake-data-detector.md`). Static analysis: grep for Math.random() in business data paths, hardcoded API responses, setTimeout faking async, placeholder text. Dynamic analysis: inspect HAR files from `docs/plans/evidence/` for missing real API calls, static responses, absent WebSocket traffic. Write findings to `docs/plans/evidence/fake-data-audit.md` with file:line refs and severity."

### Step 5.4 — Feedback Synthesizer

The Dogfood findings used to dead-end. Now route them to fix loops.

**Pre-dispatch: finding count check.**
Before dispatching the synthesizer, count total findings across all 5 input streams:
- Count lines in each `evidence/product-reality/*/findings.json`
- Count findings in `evidence/dogfood/findings.md` (count `### Finding` headings or JSON array length)
- Count entries in `evidence/track-a/*.json`
- Count failures in `evidence/e2e/iter-3-results.json`
- Count findings in `evidence/fake-data-audit.md`

If total findings ≤ 40: dispatch the synthesizer as a single pass (existing behavior below).

If total findings > 40: split into two sequential dispatches:
- **Pass 1 (mechanical routing):** Track B findings (pre-routed, validate only) + Track A findings (static routing) + E2E failures (route to phase 4) + fake-data findings (route to phase 4). These require minimal graph queries. Output: `docs/plans/evidence/dogfood/classified-findings-pass1.json`.
- **Pass 2 (graph-heavy classification):** Dogfood findings only (need full graph-based classification). Input includes pass-1 output for dedup. Output: merge pass-1 + pass-2 into final `docs/plans/evidence/dogfood/classified-findings.json`.

Call the Agent tool — description: "Synthesize all findings" — agent_type: `product-feedback-synthesizer` — subagent_type: `product-feedback-synthesizer` — Prompt: "[CONTEXT header above] Interpret findings from Track A, Track B, and Cross-cutting streams. Inputs:

- `docs/plans/evidence/dogfood/findings.md` — autonomous exploration findings, each requires classification + routing
- `docs/plans/evidence/product-reality/*/findings.json` — one per feature (web uses agent-browser evidence; iOS uses XcodeBuildMCP + Maestro evidence). Each Track B finding ALREADY CARRIES `target_phase` and `target_task_or_step` set by the product-reality-auditor. VALIDATE these against the graph (same `graph_query_dependencies` walk used for dogfood findings) and pass through if valid; only re-route if validation fails (e.g., the targeted task no longer exists in the task DAG).
- E2E test failures: `docs/plans/evidence/e2e/iter-3-results.json` — failures that persisted through 3 Playwright iterations. For each, set `source: "e2e"`, classify severity, route to `target_phase: 4`.
- Fake-data findings: `docs/plans/evidence/fake-data-audit.md` — hardcoded/mock data in production paths. For each, set `source: "fake-data"`, classify severity, route to `target_phase: 4`.
- Track A audit findings: `docs/plans/evidence/brand-drift.md`, `docs/plans/evidence/track-a/*.json` (API contract, performance, a11y, security). Web uses Playwright/Lighthouse; iOS uses XcodeBuildMCP/Instruments. These are engineering-focused findings. For each Track A finding, set `source: "track-a"`, classify severity, and route: API/perf/security findings → `target_phase: 4` (implementation fix); a11y findings → `target_phase: 4` (implementation fix); brand-drift findings → `target_phase: 3` (design fix, re-run Brand Guardian at Step 3.0).
- Track B coverage gaps: `docs/plans/evidence/track-b-coverage-gaps.json` (audit fix #8 — synthetic findings emitted by Step 5.2 when a spec feature has no evidence folder). For each, set `source: "track-a"` (these are coverage failures not feature behavior), preserve `severity: "block"` and `target_phase: 5, target_task_or_step: "5.2"`. The Phase 5.5 fix loop re-dispatches Track B for the missing feature.

For each finding, ensure it ends up classified with:
  - Code-level bug (broken feature, failing logic, fake data) → `target_phase: 4`, assign to the specific task that owns the affected file
  - Visual/design issue (styling drift, missing state, a11y gap) → `target_phase: 3`, assign to the Phase 3 step that owns the relevant artifact
  - Structural/architecture issue (missing feature, wrong data flow, API mismatch) → `target_phase: 2`, assign to the architecture section
  - Spec-gap (acceptance criteria too vague, persona constraint not measurable) → `target_phase: 1, target_task_or_step: "1.6"`

Output: `docs/plans/evidence/dogfood/classified-findings.json` with shape `[{finding_id, source: \"dogfood\" | \"product-reality\" | \"track-a\" | \"e2e\" | \"fake-data\", severity, target_phase, target_task_or_step, description, evidence_ref, related_decision_id?: string}, ...]`. The `source` field distinguishes the five input streams. The file also carries a footer object with: `graph_used: boolean` (false if any graph call failed and grep fallback ran), `re_routed_findings: [{finding_id, original_target, new_target, reason}, ...]` (Track B findings whose routing the synthesizer overrode after graph validation failed — empty array if none), `source_counts: {dogfood: N, product_reality: M, track_a: P, e2e: N, fake_data: N}` (count by input stream). This file is read by the Phase 5 fix loop and by Phase 6 Customer Reality routing for backward-routing context.

LEARNINGS EMISSION (audit fix #9 — broader writer): In addition to writing `classified-findings.json`, you ALSO append rows to `docs/plans/learnings.jsonl` so the next build's Phase 0 Learnings Loader (Step 0.1d) can replay them. Append (do NOT overwrite — Phase 7 also writes late-learning rows). Schema per row:

```json
{\"row_id\": \"L-5-<seq>\", \"schema_version\": \"1\", \"run_id\": \"<from .build-state.json.session_id>\", \"timestamp\": \"<ISO8601>\", \"project_type\": \"web|ios\", \"phase_where_learning_surfaced\": \"5.4\", \"pattern_type\": \"PITFALL|PATTERN|HEURISTIC\", \"top_issue\": \"<one sentence>\", \"fix_applied\": \"<one sentence>\", \"score_delta\": <number, optional>, \"metric\": \"<optional metric name>\", \"provenance\": {\"decision_id\": \"<optional D-N-M back-ref>\", \"finding_id\": \"<optional from classified-findings.json>\", \"evidence_ref\": \"<optional file path>\"}}
```

Derivation rules — emit one row per match:

1. **Track B coverage gaps** (`source: \"track-a\"` rows that came from `track-b-coverage-gaps.json`): emit a PITFALL row with `top_issue: \"Track B skipped feature {feature_label} ({feature_id})\", fix_applied: \"Re-dispatched product-reality-auditor at Step 5.2 (re-entry from Phase 5.5 fix loop)\"`, provenance `{finding_id: <coverage gap finding_id>}`. Lessons-learned signal for next build: feature enumeration discipline.

2. **Fake-data findings promoted to CRITICAL severity**: emit a PITFALL row with `top_issue: \"Fake/mock data shipped in production path: {file:line}\", fix_applied: \"<the fix-loop dispatch description if available, else 'flagged for Phase 4 re-implementation'>\"`, provenance `{finding_id: <fake-data finding_id>, evidence_ref: \"docs/plans/evidence/fake-data-audit.md\"}`. Top signal — fake-data shipping is the highest-leverage drift class.

3. **E2E test instability** (failure that took all 3 Playwright iterations to surface or that flaked): emit a HEURISTIC row with `top_issue: \"E2E flake / late-iteration failure on test: <test name>\", fix_applied: \"Captured in iter-3-results.json — flaky-test quarantine recommended\"`, provenance `{evidence_ref: \"docs/plans/evidence/e2e/iter-3-results.json\"}`. Helps next build's E2E generator pre-quarantine known flake patterns.

4. **Fix-loop pass-on-cycle-1** (build-state shows `metric_loop_scores[]` entry where `target_phase: 4` ran a single cycle and the verify gate passed without re-dispatch): emit a PATTERN row with `top_issue: \"Fix-loop converged in cycle 1 for {feature_id} {fix_target}\", fix_applied: \"Pattern: <briefly describe what worked — e.g., focused diff scope, single-file change>\"`, provenance `{evidence_ref: \".build-state.json\"}`. Captures what's working — too easy to only log failures.

After deriving all rows: append each line to `docs/plans/learnings.jsonl` (atomic append, one JSON object per line, newline-terminated). Allocate `row_id` as `L-5-<seq>` where `<seq>` is the next integer past any existing `L-5-*` rows already in the file (the orchestrator-scribe pattern doesn't apply here because synthesizer is single-instance per build). If no rows match the derivation rules (clean build, no learnings), STILL emit a single sentinel row `{pattern_type: \"PATTERN\", top_issue: \"no learnings surfaced — build was clean\", fix_applied: \"none\", provenance: {evidence_ref: \".build-state.json\"}}` so the Phase 5 → Phase 6 learnings gate (`learningsGate()`) accepts the file. The Phase 5 → Phase 6 gate is the enforcement point: it BLOCKs the build if `learnings.jsonl` is missing or empty. Phase 7 may append additional `L-7-*` rows for late learnings discovered during ship."

### Step 5.5 — Fix loop

For each CRITICAL/HIGH classified finding, dispatch the appropriate fix agent based on `target_phase`. Max 2 fix cycles. Routing template at the bottom of this file ("Re-entry dispatch template"). Findings with `target_phase: 1, target_task_or_step: "1.6"` route back to `product-spec-writer` to tighten the spec, which re-triggers Track B for the affected feature on the next loop.

<HARD-GATE>
FIX-LOOP EXIT GATE (audit fix #6): After each fix cycle, the orchestrator MUST call `fixLoopGate(findings, currentCycle)` from `src/orchestrator/fix-loop-gate.ts`. If `may_exit === false`, cycle 2 is MANDATORY — the loop cannot exit with HIGH or CRITICAL findings still open after only 1 cycle. After cycle 2 (max): interactive → present remaining findings to user. Autonomous → proceed with gap note.
</HARD-GATE>

**Writes:** `docs/plans/evidence/*.json`, `docs/plans/evidence/fake-data-audit.md`, `docs/plans/evidence/dogfood/classified-findings.json`, `docs/plans/evidence/product-reality/*/{tests-generated.md, results.json, findings.json, coverage.json, screenshots/}`, `docs/plans/learnings.jsonl` (reality sweep writes PITFALL/PATTERN rows — see `protocols/decision-log.md` for the Dissent Log Revisit Pass path).

#### Step 5.5.5 — Dissent Log Revisit Pass (relocated from old Phase 6.0)

After the fix loop closes and before the compaction checkpoint, the orchestrator runs the Dissent Log Revisit Pass directly (no agent dispatch — mechanical):

1. Read `docs/plans/decisions.jsonl`.
2. For every row where `status == "open"` and `revisit_criterion` is non-empty, evaluate the criterion against current evidence (the row's `revisit_criterion` may reference specific evidence files like `evidence/track-a/*.json` or `evidence/dogfood/classified-findings.json` — read those and check whether the criterion fired).
3. If a criterion is triggered:
   - Mark the decision row's `status` as `triggered` (via `scribe_decision` update flow if available, otherwise by appending a successor row with `supersedes: <decision_id>`).
   - Append a PITFALL row to `docs/plans/learnings.jsonl` via the synthesizer's existing learnings-write path: `{pattern_type: "PITFALL", top_issue: "[decision] — [criterion]", fix_applied: "[what build did instead]", provenance: {decision_id: "D-N-M"}}`.

This is the housekeeping step that ensures the learnings file captures revisit-criteria signals, which Phase 0 of the next build replays. The revisit pass used to live at Phase 6.0; it moves here under v2.4-fix because the v1 LRR Reality Checker that hosted it has been replaced.

#### Orchestrator-scribe dispatch (Phase 5 — audit fix #10)

After the Dissent Log Revisit Pass and before the compaction checkpoint, collect deviation_rows and forward through `scribe_decision`. Row triggers:

- **Step 5.4 — Synthesizer routing override** (cap 0–N): for each entry in the synthesizer's `re_routed_findings[]` footer (Track B routing the synthesizer overrode after graph validation failed), emit one row. `decided_by: product-feedback-synthesizer`. `summary` = `original_target → new_target`. `provenance.finding_id` = the re-routed finding_id. Cap implicit: synthesizer can return at most a handful of overrides per build — Reality Checker reads these as part of revisit-criteria scan.
- **Step 5.5 — Fix-loop max-cycle exhaustion** (cap 0–1 per route target): emit one row per `target_phase` if cycle 2 ended with HIGH still open after the fix-loop-gate (`fixLoopGate`) reports `may_exit: true` because of the cycle ceiling rather than zero-findings. `decided_by: orchestrator`. `summary` = `Fix loop exhausted at cycle 2 with N HIGH findings open for target_phase X`. `provenance.finding_id` = the synthetic blocker finding_id (per audit fix #6 — these surface to Phase 6 Customer Reality routing if they manifest as customer-perceptible issues).

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 6: Customer Reality Check

<HARD-GATE>
LEARNINGS GATE (audit fix #9): Before starting Phase 6, the orchestrator MUST call `learningsGate(projectDir)` from `src/orchestrator/learnings-gate.ts`. If `pass === false`, Phase 5 failed to emit learnings. HALT — return to Phase 5 and dispatch the Reality Checker's Dissent Log Revisit Pass to emit at least one PITFALL/PATTERN row. This build cannot teach the next build if learnings.jsonl is empty.
</HARD-GATE>

**Goal**: A single Customer Reality Judge walks the running app as a brand-new customer and reports what doesn't deliver what the user asked for + what's confusing or illogical. **Replaces** the old 5-chapter LRR (v2.4-fix). The technical envelope (build, security, brand drift, PO acceptance, dogfood) is now owned by the per-wave gate at Step 4.3.5; what's left for Phase 6 is the gestalt question the chapters could not answer: would a real customer be served by this product?

Why a single judge: the 5 chapters checked sub-properties (tests, security, a11y, brand, SRE) but none was positioned to ask "would a real customer pay for this." Worse, every chapter read evidence files that summarized the build's prior framing — they confirmed the build matched its plan rather than questioning whether the plan was good. The Customer Reality Judge has deliberately narrow inputs (user's brief + Q&A + competitive-differentiation + the running app) and is explicitly forbidden from reading product-spec.md / architecture.md / page-specs / evidence files. The simplicity of the brief is the forcing function: a judge with one clear question (compare app to brief, not app to plan) catches coherence failures the chapter system structurally couldn't see.

#### Step 6.0.idx — Decisions re-index (pre-LRR backfill)

Before dispatching the Customer Reality Judge (Step 6.0), re-index `decisions.jsonl` so the Slice 4 fragment reflects any decisions appended since the last Phase 4 wave transition. The orchestrator's classification + backward-routing walk at Step 6.1 / 6.2 consults the indexed fragment via `graph_query_decisions` to enrich findings with `related_decision_id` — running this once here catches any drift from hand-edits or out-of-band scribe writes. Skip silently if `docs/plans/decisions.jsonl` does not exist.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/decisions.jsonl`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. The LRR aggregator's backward-routing walk requires current decision data.

### Step 6.0 — Customer Reality Judge dispatch

A single agent walks the running app fresh, with deliberately narrow inputs, and reports findings in two lists. Default outcome: empty lists = PASS. Any non-empty list = BLOCKED.

**CONTEXT header:** Render `rendered_context_header` for phase 6 per the canonical template (see CONTEXT HEADER HARD-GATE above). Prepend.

**Pre-dispatch:** Verify the running app is reachable. Web: dev-server URL responds 200 (`curl -o /dev/null -w '%{http_code}' http://localhost:3000`). iOS: simulator running with the app installed (`xcrun simctl list devices booted` returns a device, app launchable via XcodeBuildMCP). If the app is not reachable, the judge cannot do its job — STOP and report.

Call the Agent tool — description: "Customer Reality Judge" — agent_type: `customer-reality-judge` — subagent_type: `customer-reality-judge` — mode: "bypassPermissions" — Prompt: "[CONTEXT header above] Walk the running app as a first-time customer who has read the marketing brief.

Read ONLY: `docs/plans/phase1-scratch/idea-draft.md`, `docs/plans/phase1-scratch/user-decisions.md`, `docs/plans/phase1-scratch/competitive-differentiation.md`. DO NOT read product-spec.md, architecture.md, page-specs/, design-doc.md, DESIGN.md, evidence/, feature-briefs/. These would prime confirmation bias toward 'build matches plan' when your job is 'is the plan good.'

Open the running app (web: agent-browser at the dev URL; iOS: simulator via XcodeBuildMCP, walk Maestro flows or interact directly). Try to do the thing the user said they wanted to do. Take a screenshot of every major surface you reach.

Output two lists per the schema in `agents/customer-reality-judge.md`:
- `doesnt_deliver`: surfaces where the brief said one thing and the app does another (or nothing). Each finding cites a verbatim quote from the brief that the build failed to honor.
- `confusing_or_illogical`: surfaces where a customer would close the tab and go back to the closest alternative. Each finding cites what the alternative does differently.

Empty lists = PASS. Any non-empty list = the build is not customer-ready. No verdict score, no rubric, no severity gradation — just the two lists.

Write findings to `docs/plans/evidence/customer-reality-findings.json`. Save screenshots under `docs/plans/evidence/customer-reality-screenshots/`."

**Output:** `docs/plans/evidence/customer-reality-findings.json` per the customer-reality-judge schema. Screenshot files under `docs/plans/evidence/customer-reality-screenshots/`.

### Step 6.1 — Findings classification (orchestrator-internal)

After the judge returns, the orchestrator reads `customer-reality-findings.json` and classifies each finding to a target phase via a small mechanical rule. NO LLM dispatch — the judge produces findings, the orchestrator routes.

Classification rules (applied per finding):

1. Every entry in `doesnt_deliver[]` → `target_phase: 1, target_step: "1.6"` (product-spec re-scope; the build didn't deliver what the brief promised).
2. Every entry in `confusing_or_illogical[]` → `target_phase: 3, target_step: "3.3"` (page-spec re-design; the layout / IA doesn't communicate or doesn't make sense).
3. **Architectural escape hatch:** if a finding's `description` matches the regex `/\b(performance|latency|throughput|schema|data model|API contract)\b/i`, override the default to `target_phase: 2, target_step: "2.3"`. Narrow exception for the rare case where a customer-perceptible issue traces back to architecture (e.g., "feed loads in 12 seconds, customer abandons before content arrives" — that's perf and routes to Phase 2).
4. **Implementation drift escape hatch:** if a finding clearly cites that the rendered code doesn't match its stated intent (rare here — wave-gate should have caught it), classify as `target_phase: 4, target_step: "4.3.5"`.

Write `docs/plans/evidence/customer-reality-routing.json` with shape:

```json
[
  {
    "finding_id": "CR-DD-001 | CR-CI-001",
    "source_list": "doesnt_deliver | confusing_or_illogical",
    "target_phase": 1 | 2 | 3 | 4,
    "target_step": "1.6 | 2.3 | 3.3 | 4.3.5",
    "description": "<copied from finding>",
    "screenshot_path": "<copied from finding>"
  }
]
```

### Step 6.2 — Verdict resolution

Verdict logic is binary, no middle rung (closes Group 2 #7 softening risk by eliminating the rung that could be drifted into):

- `doesnt_deliver[]` empty AND `confusing_or_illogical[]` empty → **PRODUCTION READY**. Log aggregate path to `.build-state.json` and `build-log.md`. Proceed to Phase 7.
- Either list non-empty → **BLOCKED**. Apply backward routing per `customer-reality-routing.json`. NEVER proceed to Phase 7 with BLOCKED.

There is no `NEEDS WORK` rung at Phase 6 anymore. The judge's two lists are binary on each list (empty/non-empty); the verdict is binary on the union.

**Cycle limit:** Max 2 customer-reality cycles per build. After cycle 2 still BLOCKED:
- Interactive: present remaining findings to the user. Ask for direction.
- Autonomous: log remaining findings to `build-log.md`. Proceed to Phase 7 with a Verification Gap section in the Completion Report.

**Re-entry dispatch template (Phase 6 → Phase 1 / Phase 2 / Phase 3 / Phase 4):** the orchestrator assembles the re-entry payload from `customer-reality-routing.json` + `decisions.jsonl` + the prior artifact path, then invokes the target phase's "on re-entry" branch. Phase 1 re-entry → product-spec-writer with `doesnt_deliver` findings as input. Phase 3 re-entry → design-ux-architect with `confusing_or_illogical` findings as input. Phase 2 re-entry (rare) → architecture re-think with the perf/schema finding. Phase 4 re-entry (rare) → wave-gate re-run for the affected feature. Each target phase revises its prior output to address findings without redoing unaffected work, and emits a new `decision_row` documenting the revision rationale.

**Aggregate output:** Write `docs/plans/evidence/customer-reality-aggregate.json` with shape:

```json
{
  "schema_version": "1",
  "combined_verdict": "PRODUCTION READY | BLOCKED",
  "doesnt_deliver_count": <int>,
  "confusing_or_illogical_count": <int>,
  "cycle": <int>,
  "routing_targets": [<entries from customer-reality-routing.json>],
  "judged_at": "<ISO-8601>"
}
```

<HARD-GATE>
The Customer Reality Judge is the ONLY agent that emits findings at Phase 6. No other agent self-issues a verdict at this stage.

VERDICT VALIDATION (audit fix #7 carry-forward): After the verdict is computed, the orchestrator MUST call `validateAggregateResult(result)` from `src/lrr/aggregator.ts`. The function continues to enforce the verdict enum (`PRODUCTION READY | NEEDS WORK | BLOCKED`) and reject any softening. Under v2.4-fix the only legal Phase 6 verdicts are PRODUCTION READY and BLOCKED — NEEDS WORK is unreachable from the binary mechanic above, but the validator continues to enforce the enum so future changes don't drift outside it.

Max 2 cycles per the cycle-limit above. Do not loop forever.
</HARD-GATE>

**Why no NEEDS WORK rung.** The old LRR's NEEDS_WORK was a softening hatch in disguise — chapters returned BLOCK, aggregator wrote NEEDS_WORK, the build proceeded with "minor" gaps that turned out to be major. Replacing it with a binary verdict at Phase 6 (PRODUCTION READY / BLOCKED) makes the rule unambiguous: any customer-perceptible failure blocks the build until it's fixed or explicitly accepted with a gap row in `decisions.jsonl`.

**Writes:** `docs/plans/evidence/customer-reality-findings.json`, `docs/plans/evidence/customer-reality-routing.json`, `docs/plans/evidence/customer-reality-aggregate.json`, `docs/plans/evidence/customer-reality-screenshots/*.png`.

#### Orchestrator-scribe dispatch (Phase 6 — audit fix #10 carry-forward)

After the Customer Reality Judge returns and verdict resolution completes (Step 6.2) — before the compaction checkpoint — forward decision rows through `scribe_decision`:

- **Step 6.2 — Customer Reality verdict** (cap 1, always): emit one decision row capturing the binary verdict. `decided_by: customer-reality-judge`. `summary` = `combined_verdict: <PRODUCTION READY | BLOCKED>; doesnt_deliver: N; confusing_or_illogical: N`. `ref: "docs/plans/evidence/customer-reality-aggregate.json"`. The orchestrator constructs this row directly from the aggregate file (no `decisions_rows` return contract from the judge — the verdict is mechanical from the two-list shape).
- **Step 6.2 — Proceed-despite-BLOCKED** (cap 0–1): emit only when the build proceeds to Phase 7 with `combined_verdict: BLOCKED` after cycle 2 (interactive: user accepted; autonomous: gap-accept). `decided_by: orchestrator` if autonomous, `human` if interactive. `summary` = which findings were accepted as ship-blockers and why proceed.

The orchestrator forwards each row exactly once via `scribe_decision`. `customer-reality-aggregate.json` is for the rest-of-pipeline consumers; `decisions.jsonl` is for backward-routing.

**Compaction checkpoint.** Update `.build-state.json` per the format above.

---

## Phase 7: Ship

**Pre-ship Verify gate:** Run the Verify Protocol (INTERNAL inline — "Verify scaffolding") before any Step 7.1 dispatch. All 7 checks (Build → Type-Check → Lint → Test → Security → Diff Review → Artifacts) must pass. If any check FAILS, dispatch a fix agent with the error, re-verify. Max 2 fix attempts. Do not proceed to Step 7.1 until PASS.

**Mode-specific branch:**
- `project_type=ios`: follow `protocols/ios-phase-branches.md` §Phase 7 — ship pipeline is optional (simulator-only is a valid end-state). If shipping, run asc-* agents + fastlane.
- `project_type=web`: follow `protocols/web-phase-branches.md` §Phase 7 (Step 7.1 documentation + deploy notes).

### Step 7.1 — Sequence: Documentation → Doc Metric Loop → ASO (iOS) → Deploy → Completion Report

**CONTEXT header:** Render `rendered_context_header` for phase 7 per the canonical template (see CONTEXT HEADER HARD-GATE above). Prepend to every Phase 7 prompt below.

1. Description: "Technical Writer" — agent_type: `engineering-technical-writer` — subagent_type: `engineering-technical-writer` — mode: "bypassPermissions" — Prompt: "[CONTEXT header above] Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. The README is the first thing a new developer reads — optimize for that reader. Commit: 'docs: project documentation'. Deployment target per the PRD (Vercel/Netlify/Railway/Fly.io/etc.) — include the deploy flow specific to that target in the README."

2. Documentation Metric Loop: Run the Metric Loop Protocol (callable service) on documentation. Define a metric based on completeness and whether a new developer could follow the README end-to-end. Max 3 iterations.

3. Description: "App Store Optimizer" (iOS only, conditional on ship) — agent_type: `marketing-app-store-optimizer` — subagent_type: `marketing-app-store-optimizer` — Prompt per `protocols/ios-phase-branches.md` §Phase 7 (asc-* flow — app name, subtitle, keywords, description, screenshots, privacy labels). Prepend CONTEXT header above. Skip entirely for web.

4. Description: "Deploy" — agent_type: `engineering-devops-automator` — subagent_type: `engineering-devops-automator` — mode: "bypassPermissions" — Prompt: "[CONTEXT header above] Deploy the app to the target from the PRD (`docs/plans/design-doc.md#tech-stack`). Run pre-deploy checks: build, env vars, secrets. Execute deploy. Verify the deployed URL returns 200 and serves the built app (not the placeholder). Report deploy URL and any smoke-test findings."

5. Description: "Completion Report" — INTERNAL inline role-string — Prompt: "[CONTEXT header above] You are the Completion Report writer. Draw verification surface from THREE sources: the Customer Reality verdict (`docs/plans/evidence/customer-reality-aggregate.json`), the Customer Reality findings (`docs/plans/evidence/customer-reality-findings.json` — the two-list output), and the build state (`docs/plans/.build-state.json` — for backward-routing counts and mode transitions per state-schema v2). Do NOT draw from orchestrator summary prose. Present:

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
| Behavioral Tests declared in spec | from backend-tasks.md + page-specs/*.md | — |
| Behavioral Tests with non-stub bodies | from Eng-Quality findings | PASS if equal |
| Behavioral evidence files written | count from manifest | — |
| Maestro flows present (iOS) | count of maestro/*.yaml | — |
| Test-stub detector flagged files | from Eng-Quality findings | PASS if 0 |
| Combined verdict | from lrr-aggregate.json | — |
| LRR chapter verdicts | list of chapter:verdict pairs | — |
| LRR follow-ups spawned | count | — |
| LRR triggered rule | rule number 1-6 | — |

```
QUALITY METRICS (from .build-state.json schema v2)
================================================
Backward routing: <total> events
  by target phase: <\"2\": N, \"3\": N, \"4\": N>
  top decisions re-opened: <decision_id: N> (up to 3)

Mode transitions: <count> (autonomous ↔ interactive)
<if count > 0: list each transition timestamp + direction>

Interpretation:
- Backward routing count is a quality signal — fewer means Phase 1-3 caught issues earlier.
- A target phase appearing 3+ times suggests structural rework (re-architect or re-design); investigate the related decisions.
- Mode transitions ≥ 2 in autonomous mode indicates the build hit a manual-review threshold — review the LRR rule that triggered.
```

If there's a Verification Gap (declared != passing, or stub-flagged > 0), surface a top-level 'Verification Gap' section BEFORE writing the report to disk. Ask user: 'Write Completion Report with this verification gap surfaced? [YES/NO]'. In autonomous mode: write but flag prominently.

Create final commit. Mark all TodoWrite items complete. Update `.build-state.json`: 'Phase: 7 COMPLETE'."

**Writes:** `docs/plans/learnings.jsonl` (late learnings only — doc friction, deploy blockers, late-surfacing gaps). If no late learnings surfaced, skip. Row schema: `{run_id, timestamp, project_type, phase_where_learning_surfaced: \"7.x\", metric, top_issue, fix_applied, score_delta, pattern_type}`.

#### Orchestrator-scribe dispatch (Phase 7 — audit fix #10)

Before the Completion Report's final commit, forward Phase 7 decision rows through `scribe_decision`. Row triggers:

- **Step 7.1 — Ship-vs-hold on NEEDS WORK** (cap 0–1): emit only when the build ships despite an LRR `combined_verdict: NEEDS WORK` and the user (interactive) or orchestrator (autonomous gap-accept) chose to proceed. `decided_by: orchestrator` or `human`. `summary` = which gaps were accepted as ship-blockers and the rationale.
- **Step 7.1 — Deploy outcome non-trivial** (cap 0–1): emit only when the deploy step made a non-routine choice — target swap, deploy retry after failure, env-config drift discovered at deploy time. `decided_by: engineering-devops-automator`. `summary` = the choice + outcome. Routine successful deploys emit no row.

Add `engineering-devops-automator` to the Phase 6 backward-routing known-author registry per `protocols/decision-log.md` so future Phase 7 rows backward-route correctly.

**Compaction checkpoint.** Update `.build-state.json` per the format above.
