# Task Breakdown — Shape B Migration (FINAL plan)

**Companion to:** `MIGRATION-PLAN-FINAL.md` (the LOCKED plan from R3 CEO verdict 2026-04-18, avg 9.11)
**Purpose:** Leaf-level task list for distributed execution. Each task has a parallelization marker so less-capable agents can safely work in parallel without clobbering load-bearing files.

---

## How to use this document

1. **Read `MIGRATION-PLAN-FINAL.md` first** for specs, pass criteria, rollback semantics. This doc is an index, not a replacement.
2. **Pick tasks marked `P`** to hand to parallel agents — they touch new, isolated files with clear specs.
3. **Tasks marked `S`** need a single coordinated owner — they touch shared load-bearing files (`hooks/session-start`, `commands/build.md`, `phase-graph.yaml`, `.claude-plugin/plugin.json`).
4. **Respect `D:` dependencies** — a task can't start until its dependency IDs complete.
5. **Each task lists its artifact path and spec reference** — pointer to `FINAL §X.Y` gives the authoritative spec.

---

## Legend

| Marker | Meaning |
|---|---|
| **P** | **Parallel-safe** — new file or isolated module. Clear spec. Less-capable agents can run concurrently without coordination. |
| **S** | **Serial** — touches shared load-bearing files or requires architectural judgment. Assign one owner. |
| **D: X.Y.Z** | Depends on task X.Y.Z completing first. |
| **(CRITICAL)** | Blocks subsequent stage from shipping. Prioritize. |

---

## Parallelization summary

| Stage | Total tasks | P (parallel-safe) | S (serial) | Est. serial chain length |
|---|---|---|---|---|
| Stage 1 | 28 | 17 | 11 | ~5 serial steps |
| Stage 2 | 12 | 7 | 5 | ~3 serial steps |
| Stage 3 | 14 | 9 | 5 | ~3 serial steps |
| Stage 4 | 18 | 11 | 7 | ~4 serial steps |
| Stage 5 | 9 | 6 | 3 | ~2 serial steps |
| Stage 6 | 12 | 8 | 4 | ~3 serial steps |
| **Total** | **93** | **58 (62%)** | **35 (38%)** | ~20 serial bottleneck steps across 6 stages |

62% of tasks can be handed to parallel agents. Serial tasks cluster around `hooks/session-start`, `commands/build.md`, `.claude-plugin/plugin.json`, and `phase-graph.yaml` — the load-bearing shared files. One senior owner per stage for S tasks; N parallel agents for P tasks.

---

# Stage 1 — Bootstrap + SSOT lint + rollback

**Spec:** `FINAL §4` Stage 1. Expected ~115 LOC + 1 Python file + 7 tests. ~2 weeks with focused attention.

## 1.1 — SDK dependency + runtime wiring

- **1.1.1** Add `@anthropic-ai/claude-agent-sdk` to `package.json`. **S** — shared root manifest. Spec: `FINAL §4` Stage 1 original items.
- **1.1.2** Create `bin/buildanything-runtime.ts` entrypoint skeleton. **S** — new binary, but referenced from `plugin.json`. Spec: `FINAL §5.3`.
- **1.1.3** `hooks/session-start` npm-install-and-probe block (A1, ~18 LOC). **S** — shared hook, replaces v2 `|| rm -f` idiom. Spec: `FINAL §4 A1`. D: 1.1.5.
- **1.1.4** Disk-backed `$SDK_STATE_FILE` protocol in `bin/buildanything-runtime.ts`. **S** — D: 1.1.2, 1.1.3.
- **1.1.5** Add `.claude-plugin/plugin.json` config fields: `sdkStateFile`, `claudeCodeHostRange`, `sdkVersion`. **S** — shared manifest.

## 1.2 — Scribe MCP (decisions.jsonl single-writer)

- **1.2.1** `src/orchestrator/mcp/scribe.ts` — `scribe_decision` handler. **P** — new file. Spec: `FINAL §4` Stage 1.
- **1.2.2** Schema validation against `decisions.schema.json`. **P** — D: 1.2.1.
- **1.2.3** ID allocation + exclusive-write lock. **P** — D: 1.2.1.
- **1.2.4** Wire scribe via `createSdkMcpServer` in runtime. **S** — D: 1.1.2, 1.2.1.
- **1.2.5** Dual-write shadow mode (agents still write markdown; scribe shadows). **S** — coupled to agent dispatch path.

## 1.3 — iOS `apple-docs-mcp` check (A2)

- **1.3.1** 3-line `claude mcp list | grep` insert at `hooks/session-start:10`. **S** — shared hook. Spec: `FINAL §4 A2`. D: 1.1.3 (both edit same file).
- **1.3.2** Wire missing-probe into `DEPS_WARNING` envelope. **S** — D: 1.3.1.

## 1.4 — SDK/host compat matrix (A4)

- **1.4.1** Semver `satisfies()` check in `bin/buildanything-runtime.ts`. **S** — D: 1.1.2.
- **1.4.2** Fallback-to-markdown warning path. **S** — D: 1.4.1.
- **1.4.3** [KIRO] Create `docs/migration/sdk-host-compat.md` — compat matrix, one row per SDK pin. **P** — new doc, no code touch.

## 1.5 — SSOT lint infrastructure (A8, CRITICAL — blocks Stage 2)

- **1.5.1** SSOT spec text in `FINAL §5.2` + mirror to `commands/build.md` top-matter. **S** — shared prose authority.
- **1.5.2** `eval/lint_phase_graph.py` (~60 LOC Python):
  - **1.5.2.1** [KIRO] Writer-owner table parser (`commands/build.md:32-50`). **P** — new Python module.
  - **1.5.2.2** [KIRO] Artifacts section parser (`phase-graph.yaml:13-85`). **P**.
  - **1.5.2.3** [KIRO] subagent_type mappings parser (`commands/build.md:676-678`). **P**.
  - **1.5.2.4** [BOBCLAUDE - DONE] Agents registry parser (`docs/migration/agents.yaml`). **P**.
  - **1.5.2.5** [BOBCLAUDE - DONE] Backward-routing topology parser (`commands/build.md:174-186`, `phase-graph.yaml:1000-1025`). **P**.
  - **1.5.2.6** [BOBCLAUDE - DONE] Structured diff emitter + exit codes. **P** — D: 1.5.2.1 through 1.5.2.5.
- **1.5.3** Pre-commit CI hook triggering lint on relevant paths. **S** — touches CI config.
- **1.5.4** Default-deny policy for unknown paths — placeholder prepared, wired in Stage 2.1.3. **S** — spec only; implementation in 2.1.3.

## 1.6 — Rollback dry-run test (G4)

- **1.6.1** [KIRO] `tests/rollback/full-revert-dryrun.test.ts` (~30 LOC). **P** — new test. D: 1.1.3, 1.1.4 spec lockdown.

## 1.7 — Reference-build dual-write smokes

- **1.7.1** [KIRO] `tests/reference-builds/habita-dual-write.test.ts`. **P** — new test.
- **1.7.2** [KIRO] `tests/reference-builds/pacely-dual-write.test.ts`. **P** — new test (iOS).

## 1.8 — Install/startup tests

- **1.8.1** [KIRO] `tests/install/session-start.test.ts` including restricted-host simulation. **P** — new test.
- **1.8.2** [KIRO] `tests/install/sdk-host-compat.test.ts`. **P** — new test.
- **1.8.3** [KIRO] `tests/mcp/scribe-basic.test.ts`. **P** — new test.
- **1.8.4** `tests/drift/yaml-prose-consistency.test.ts`. **P** — new test. D: 1.5.2.6.
- **1.8.5** [KIRO] `tests/invariants/writer-owner-unknown-path.test.ts` — placeholder (active Stage 2). **P** — new test.

**Stage 1 pass criteria:** `FINAL §4` Stage 1 pass criteria — P3 timing, dual-write sanity, P1 no regression, `--resume` works, restricted-host sim, compat probe, iOS preflight, lint CI gate, rollback dry-run all pass.

---

# Stage 2 — Writer-owner hook + write lease (A5)

**Spec:** `FINAL §4` Stage 2. Cannot ship until Stage 1 **AND 1.5 (A8 SSOT lint)** complete.

## 2.1 — PreToolUse writer-owner hook

- **2.1.1** Hook handler matching `Write|Edit` tools. **S** — coupled to Claude Code hook system.
- **2.1.2** Load writer-owner table from `phase-graph.yaml` at session boot. **S** — D: 2.1.1.
- **2.1.3** Activate default-deny for unknown paths (wires 1.5.4 placeholder). **S** — D: 2.1.1, 1.5.4.

## 2.2 — Scribe enforcement (remove Stage 1 dual-write)

- **2.2.1** Remove markdown `decisions.jsonl` writes from agent prompts. **S** — touches agent prompt bodies.
- **2.2.2** Scribe becomes single writer. **S** — D: 2.2.1.

## 2.3 — `acquire_write_lease` MCP (A5)

- **2.3.1** `src/orchestrator/mcp/write-lease.ts` — `acquire_write_lease(task_id, file_paths[])` handler. **P** — new file. Spec: `FINAL §4 A5`.
- **2.3.2** `.build-state.json.active_write_leases[]` schema field. **P** — new schema addition, isolated.
- **2.3.3** `lease_conflict` error semantics + caller-abort behavior. **P** — D: 2.3.1.
- **2.3.4** Wire via `createSdkMcpServer`. **S** — D: 1.2.4, 2.3.1.

## 2.4 — Lease-aware writer-owner hook extension

- **2.4.1** Extend hook from 2.1.1: consult `active_write_leases` in addition to writer-owner table. **S** — D: 2.1.1, 2.3.1.
- **2.4.2** Derive `task_id` from `parent_tool_use_id` per SDK subagent propagation. **S** — D: 2.4.1.

## 2.5 — Auto-release on SubagentStop

- **2.5.1** `SubagentStop` hook handler clearing leases by `task_id`. **S** — shared hook system. D: 2.3.1.

## 2.6 — Tests

- **2.6.1** [KIRO] `tests/invariants/writer-owner.test.ts` — 7 P4 cases + iOS `project.pbxproj`. **P** — new test.
- **2.6.2** [KIRO] `tests/invariants/scribe-single-writer.test.ts` — 5 agent callers denied raw writes. **P** — new test.
- **2.6.3** [KIRO] `tests/fuzz/writer-owner-fuzzer.test.ts` — 50 cross-writer attempts. **P** — new test.
- **2.6.4** `tests/invariants/phase4-parallel-file-collision.test.ts` (A5). **P** — new test.
- **2.6.5** Activate `tests/invariants/writer-owner-unknown-path.test.ts` from 1.8.5. **P** — D: 2.1.3.

---

# Stage 3 — Atomic state + CONTEXT hoist + token accounting + dogfood

**Spec:** `FINAL §4` Stage 3. Highest cache-reuse impact stage.

## 3.1 — SubagentStart CONTEXT render-once

- **3.1.1** `SubagentStart` hook handler reading `.build-state.json`. **S** — shared hook system.
- **3.1.2** CONTEXT header renderer + hash-cache. **P** — new module. Spec: `FINAL §4` Stage 3.
- **3.1.3** Injection into subagent prompt. **S** — D: 3.1.1, 3.1.2.

## 3.2 — Atomic state save

- **3.2.1** `src/orchestrator/mcp/state-save.ts` — `state_save(path, state)` MCP. **P** — new file.
- **3.2.2** write-to-`.tmp` + fsync + `os.replace()` protocol. **P** — D: 3.2.1.
- **3.2.3** SHA-256 integrity checksum. **P** — D: 3.2.2.
- **3.2.4** Wire via `createSdkMcpServer`. **S** — D: 3.2.1.

## 3.3 — Writer-owner extension to `.build-state.json`

- **3.3.1** Hook denies raw `Write|Edit` on `.build-state.json`, routes via `state_save`. **S** — D: 2.4.1, 3.2.1.

## 3.4 — Token accounting hook (G3)

- **3.4.1** `src/orchestrator/hooks/token-accounting.ts` — subscribe to `usage` fields. **P** — new file. Spec: `FINAL §4 G3`.
- **3.4.2** Phase-boundary + Task-completion emission to `docs/plans/build-log.md`. **P** — D: 3.4.1.
- **3.4.3** Cumulative-cost display in orchestrator phase-boundary messages. **S** — touches `commands/build.md` phase-complete banner prose.

## 3.5 — G2 dogfood (process, 0 LOC)

- **3.5.1** Run Habita end-to-end: Lighthouse ≥85, Playwright smoke, Stripe webhook. **P** — execution task, runs in isolated env.
- **3.5.2** Run Pacely end-to-end: xcodebuild zero-warning, Maestro smoke, Preview captures. **P** — execution task.
- **3.5.3** [KIRO] Record results to `docs/migration/sdk-hybrid/03-adversarial/stage3-dogfood-results.md`. **P** — new doc.

## 3.6 — Tests

- **3.6.1** `tests/hooks/context-header-render-once.test.ts`. **P** — new test.
- **3.6.2** `tests/state-save/atomic-write.test.ts`. **P** — new test.
- **3.6.3** `tests/invariants/state-save-single-writer.test.ts`. **P** — new test.
- **3.6.4** `tests/hooks/token-accounting.test.ts`. **P** — new test.
- **3.6.5** `tests/reference-builds/ios-context-header-invalidate.test.ts`. **P** — new iOS test.

---

# Stage 4 — Gen/critic + backward-routing counter + crash-seam + schema bump

**Spec:** `FINAL §4` Stage 4. Closes P4 backward-routing gap + adversarial A3/A6/A7.

## 4.1 — Generator/critic separation

- **4.1.1** TS helper calling `query()` twice with disjoint `allowedTools`. **P** — new module.
- **4.1.2** Generator gets `Write|Edit`; critic does not. **P** — D: 4.1.1.

## 4.2 — `cycle_counter_check` MCP (A6 semantic)

- **4.2.1** `src/orchestrator/mcp/cycle-counter.ts` handler. **P** — new file. Spec: `FINAL §4 A6`, authoritative semantic `> max_cycles`.
- **4.2.2** Atomic read/increment via `state_save` protocol. **P** — D: 4.2.1, 3.2.1.
- **4.2.3** Return `allow | escalate_to_user`. **P** — D: 4.2.1.
- **4.2.4** Wire via `createSdkMcpServer`. **S** — D: 4.2.1.

## 4.3 — A3 crash-seam: `in_flight_backward_edge`

- **4.3.1** Schema field `.build-state.json.in_flight_backward_edge?`. **P** — new schema field.
- **4.3.2** Single atomic `state_save` combining counter increment + in_flight write. **P** — D: 4.2.2, 4.3.1.
- **4.3.3** Target-phase first `state_save` on re-entry clears field. **S** — touches phase-entry flow.
- **4.3.4** `--resume` in `bin/buildanything-runtime.ts`: 60s staleness decrement. **S** — D: 1.1.2, 4.3.1.

## 4.4 — A6 per-target-phase counter + sequentialize

- **4.4.1** Schema field `backward_routing_count_by_target_phase`. **P** — new schema field.
- **4.4.2** Dual-counter escalation: EITHER exceeds cap triggers escalate. **P** — D: 4.2.1, 4.4.1.
- **4.4.3** Sequentialize aggregator dispatch when multiple BLOCKs. **S** — touches Stage 5 aggregator handoff.

## 4.5 — A7 schema version bump 1→2

- **4.5.1** Amend `protocols/state-schema.md` — version table + migration. **S** — shared protocol doc.
- **4.5.2** Session-start state-read forward-reject on `schema_version > max_supported`. **S** — D: 1.1.2, 4.5.1.

## 4.6 — A7 markdown compat block

- **4.6.1** `commands/build.md` re-entry flow — halt if `backward_routing_count` max ≥ cap. **S** — shared prose doc, ~10 LOC.

## 4.7 — A7 flag-flip annotation

- **4.7.1** `hooks/session-start` writes `.build-state.json.mode_transitions[]` on flag detect. **S** — shared hook. D: 1.1.3.
- **4.7.2** Log to `build-log.md`. **S** — D: 3.4.2, 4.7.1.

## 4.8 — Tests

- **4.8.1** `tests/invariants/gen-critic-separation.test.ts`. **P** — new test.
- **4.8.2** `tests/invariants/author-bias-elimination.test.ts`. **P** — new test.
- **4.8.3** `tests/state-machine/backward-routing-counter.test.ts`. **P** — new test.
- **4.8.4** `tests/state-machine/backward-routing-phase-target-counter.test.ts` (A6). **P** — new test.
- **4.8.5** `tests/state-machine/backward-routing-crash-seam.test.ts` (A3). **P** — new test.
- **4.8.6** `tests/rollback/stage4-to-markdown-flag-flip.test.ts` (A7). **P** — new test.
- **4.8.7** `tests/state-schema/schema-version-forward-reject.test.ts` (A7). **P** — new test.

---

# Stage 5 — LRR aggregator + schema bump 2→3

**Spec:** `FINAL §4` Stage 5.

## 5.1 — LRR aggregator

- **5.1.1** `src/lrr/aggregator.ts` — read `lrr/*.json`, apply 6 rules + ⭐⭐ star rule. **P** — new file.
- **5.1.2** Emit `lrr-aggregate.json`. **P** — D: 5.1.1.

## 5.2 — Writer-owner extension to LRR files

- **5.2.1** Hook extends to `lrr/<chapter>.json` — chapter-judge subagent only; aggregator read-only on chapters; orchestrator read-only on aggregate. **S** — D: 2.4.1.

## 5.3 — Follow-up flow

- **5.3.1** Security/SRE BLOCK-only follow-ups gated by TS switch with SDK `maxTurns: 15`. **S** — touches LRR dispatch flow.

## 5.4 — A7 schema bump 2→3

- **5.4.1** `protocols/state-schema.md` migration table update. **S** — D: 4.5.1.
- **5.4.2** New fields: `lrr_cycle_state`, aggregator output fields. **P** — new schema.

## 5.5 — Tests

- **5.5.1** `tests/lrr/aggregator.test.ts`. **P** — new test.
- **5.5.2** `tests/lrr/star-rule.test.ts`. **P** — new test.
- **5.5.3** `tests/lrr/followup-flow.test.ts`. **P** — new test.
- **5.5.4** `tests/reference-builds/pacely-lrr-testflight.test.ts` — simulated-submission. **P** — new test.

---

# Stage 6 — Sprint-context hoisting (G1(b) commitment)

**Spec:** `FINAL §4` Stage 6 + `FINAL §11`. **Ships only if P6 probe passes** — see pass-criteria table in `FINAL §11.3`.

## 6.1 — `phase4-shared-context.ts` renderer

- **6.1.1** `src/orchestrator/phase4-shared-context.ts` — sprint-scoped block generator. **P** — new file.
- **6.1.2** Input: `.build-state.json` + refs.json + architecture.md + quality-targets.json. **P** — D: 6.1.1.
- **6.1.3** Output: sprint-scoped shared block string. **P** — D: 6.1.2.

## 6.2 — SubagentStart hook extension for Phase 4

- **6.2.1** Extend 3.1.1 handler to inject block when `current_phase === 4`. **S** — D: 3.1.1, 6.1.1.

## 6.3 — `current_sprint_context_hash` field + invalidation

- **6.3.1** Schema field `.build-state.json.current_sprint_context_hash: string`. **P** — new schema.
- **6.3.2** Invalidation callback on refs.json mutation (via `state_save`). **S** — D: 3.2.1, 6.3.1.

## 6.4 — Phase 4 dispatch-body shrinkage

- **6.4.1** `commands/build.md:660-760` Phase 4 per-task prompts remove full refs block. **S** — shared prose doc, ~20 LOC prose.
- **6.4.2** Replace with pointer: "Sprint context is prepended; focus on this task." **S** — D: 6.4.1.

## 6.5 — Schema bump 3→4

- **6.5.1** `protocols/state-schema.md` migration entry. **S** — D: 4.5.1, 5.4.1.

## 6.6 — P6 probe (pass-criteria gate)

- **6.6.1** [KIRO] `eval/migration-probes/p6_sprint_context_cost.py`. **P** — new Python script.
- **6.6.2** [KIRO] Method: baseline Stage 5 vs Stage 6 enabled, 3-run median. **P** — D: 6.6.1.
- **6.6.3** [KIRO] Outcome classifier per `FINAL §11.3` table (strong/marginal/single-fail/dual-fail). **P** — D: 6.6.1.

## 6.7 — Tests

- **6.7.1** `tests/phase4/sprint-context-render.test.ts`. **P** — new test.
- **6.7.2** `tests/phase4/sprint-context-cache-hit.test.ts`. **P** — new test.
- **6.7.3** `tests/phase4/sprint-context-ios-flags.test.ts`. **P** — new iOS test.
- **6.7.4** `tests/reference-builds/habita-stage6-cost.test.ts`. **P** — new test.
- **6.7.5** `tests/reference-builds/pacely-stage6-cost.test.ts`. **P** — new iOS test.

---

# Parallelization zones (for distributed agent assignment)

These are groups where all tasks can run simultaneously by different agents with zero coordination risk:

## Zone A — All test files (any stage)
45 test files across Stages 1-6. Each is a new file under `tests/*`. Parallel-safe regardless of stage — just share the pass-criteria spec. Tasks: **1.6.1, 1.7.1–1.7.2, 1.8.1–1.8.5, 2.6.1–2.6.5, 3.6.1–3.6.5, 4.8.1–4.8.7, 5.5.1–5.5.4, 6.7.1–6.7.5.**

## Zone B — New MCP handlers (Stages 1-4)
Four independent new files. Parallel-safe. Tasks: **1.2.1–1.2.3 (scribe), 2.3.1–2.3.3 (write-lease), 3.2.1–3.2.3 (state-save), 4.2.1–4.2.3 (cycle-counter).**

## Zone C — SSOT lint parsers (Stage 1)
Six parser modules for `eval/lint_phase_graph.py`. All new Python code, isolated. Tasks: **1.5.2.1–1.5.2.5** (1.5.2.6 aggregates, D:1–5).

## Zone D — New docs (any stage)
Three new doc files, zero code coupling. Tasks: **1.4.3, 3.5.3, 6.6.1** (P6 script is also self-contained).

## Zone E — Stage 6 renderer module
Self-contained TS module + tests, isolated from outer loop. Tasks: **6.1.1–6.1.3, 6.3.1, 6.6.1–6.6.3.**

---

# Serial bottleneck owners (assign ONE senior per)

These files are touched repeatedly across stages. Assign a single owner per file to avoid merge conflicts:

| File | Tasks that touch it | Recommended owner |
|---|---|---|
| `hooks/session-start` | 1.1.3, 1.3.1, 4.7.1 | Stage 1 lead |
| `commands/build.md` | 1.5.1, 3.4.3, 4.6.1, 6.4.1, 6.4.2 | Orchestrator owner |
| `.claude-plugin/plugin.json` | 1.1.5 + config updates | Stage 1 lead |
| `bin/buildanything-runtime.ts` | 1.1.2, 1.1.4, 1.4.1, 1.4.2, 4.3.4, 4.5.2 | Runtime owner |
| `protocols/state-schema.md` | 4.5.1, 5.4.1, 6.5.1 | Schema owner |
| `phase-graph.yaml` | writer-owner table updates per stage | Phase-graph owner |
| MCP registration (`createSdkMcpServer` wiring) | 1.2.4, 2.3.4, 3.2.4, 4.2.4 | Runtime owner |

---

# Recommended execution strategy

## Week 1–2: Stage 1 critical path

- **Single senior** owns: 1.1 (all), 1.3 (all), 1.4.1–1.4.2, 1.5.1, 1.5.3.
- **Parallel agents** (4+) own: 1.2.1–1.2.3 (scribe, Zone B), 1.5.2.1–1.5.2.5 (Zone C), 1.4.3 (Zone D), all of 1.6–1.8 (Zone A).
- Stage 1 cannot ship until both tracks land. Critical path is usually the serial chain: 1.1.1 → 1.1.2 → 1.1.4 → 1.1.3 → 1.3.1 → 1.5.3.

## Week 3+: Stage 2 onward

- Each stage has ~3-5 serial steps and 7-11 parallel tasks. Same pattern: 1 senior owner for S tasks, N agents for P tasks.
- Stages 3, 4, 5 can partially overlap if Stage 2 sign-off is clean (Stage 3's SubagentStart hook doesn't conflict with Stage 4's cycle counter module). Coordinate via the serial bottleneck owner table above.
- **Stage 6 waits for Stage 3 infrastructure** (pre-req). After Stage 3 ships, Stage 6 parallel work can begin while Stage 4/5 continue.

---

# Handoff checklist for parallel agents

When handing a task to a less-capable agent, give them:

1. **This doc section** (the task ID + description)
2. **`MIGRATION-PLAN-FINAL.md` §4 for the relevant stage** (spec + pass criteria + rollback flag)
3. **Any dependency task's completed artifact** (e.g. schema files, MCP handlers)
4. **A concrete acceptance test** — the test file they're implementing OR the pass criterion they must demonstrate

Do NOT give them:
- The whole plan to read (too much context)
- Architectural decisions to make (route back to senior)
- Tasks marked `S` (requires judgment the agent doesn't have)

---

**End of task breakdown.** 93 tasks, 58 parallel-safe (62%), 35 serial-coordinated. Aligned with `MIGRATION-PLAN-FINAL.md` stages and pass criteria. Update this doc when stages ship to mark task completion.
