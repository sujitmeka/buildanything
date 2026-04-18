# .build-state.json Schema

## Purpose

`docs/plans/.build-state.json` is the **typed source of truth** for build state. The human-readable `docs/plans/.build-state.md` file is an **auto-rendered view** regenerated on every state change — it is never edited directly. This document defines the required fields, their types, the rendering contract that produces the markdown view, and the validation rules a well-formed state file must satisfy. Introduced in Wave 1 (W1-2) to eliminate the drift observed in freeform markdown state (duplicate `Autonomous:` fields, Phase Progress append-instead-of-replace, mode branch collisions) and to give the Wave 2 `PreToolUse` schema lint hook something concrete to validate against.

**Machine-authoritative source:** `protocols/state-schema.json` is the SSOT (Stage 1 A8). If this prose doc and the JSON Schema diverge, the JSON Schema wins. Update both together; changes here that are not reflected there will be caught by the W2-2 lint hook.

## Schema versions

`schema_version` is a monotonically increasing integer bumped on each Shape-B migration stage. The runtime reads the incoming `.build-state.json` and compares `schema_version` against its compiled-in `MAX_SUPPORTED_SCHEMA_VERSION` constant.

| Version | Stage | Fields added | Rollback semantics |
|---|---|---|---|
| 1 | Stages 1-3 | initial schema (all pre-Stage-4 fields) | n/a |
| 2 | Stage 4 | `backward_routing_count` (newly typed), `backward_routing_count_by_target_phase`, `in_flight_backward_edge`, `mode_transitions[]` | A7 forward-reject on `schema_version > MAX_SUPPORTED_SCHEMA_VERSION`; A3 stale-edge decrement on `--resume` |
| 3 | Stage 5 | `lrr_cycle_state` (object; interior fields loose-typed pending Stage 5 iteration — see "Fields added at v3" below) | `BUILDANYTHING_SDK_LRR=false` reverts to markdown aggregator; `lrr_cycle_state` becomes an ignored field on the orchestrator read path (additive-only, no data loss on downgrade) |
| 4 | Stage 6 | `current_sprint_context_hash` | `BUILDANYTHING_SDK_SPRINT_CONTEXT=false` (web) and/or `BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS=false` (iOS parity gate) reverts Phase 4 to per-task refs re-send; `current_sprint_context_hash` becomes an ignored field on the orchestrator read path (additive-only, no data loss on downgrade) |

**A7 forward-reject rule.** When `bin/buildanything-runtime.ts` reads `.build-state.json` at session start, if `schema_version > MAX_SUPPORTED_SCHEMA_VERSION`, the runtime refuses to proceed and emits a clear error pointing to the compat matrix (`docs/migration/sdk-host-compat.md`). This is the A7 defense against silent schema drift — an old runtime must never silently ignore fields a newer runtime persisted. See **Task 4.5.2** for the runtime implementation (out of scope for this prose-only update).

## Required fields

```jsonc
{
  "schema_version": 1,
  "project_type": "ios",
  "phase": 6,
  "step": "6.4",
  "session_id": "6f3a9c82-7d4e-4b51-9f2a-1e8c6d3f4a0b",
  "session_started": "2026-04-13T09:12:00Z",
  "session_last_saved": "2026-04-13T11:47:33Z",
  "autonomous": false,
  "mode": "interactive",
  "build_request": "iOS app blocker that uses on-device AI to gate access to distracting apps.",
  "context_level": "raw_idea",
  "git_branch": "main",
  "completed_tasks": [
    { "task_id": "M3-T04", "task_name": "Implement Foundation Models allow/deny classifier", "status": "done", "evidence_files": ["cap/Features/Chat/GateClassifier.swift"], "completed_at": "2026-04-13T10:52:11Z" },
    { "task_id": "M3-T03", "task_name": "Create shield configuration UI", "status": "done", "evidence_files": ["cap/Features/Shield/ShieldConfigView.swift"], "completed_at": "2026-04-13T10:30:00Z" }
  ],
  "pending_tasks": ["M3-T06", "M3-T07"],
  "metric_loop_history": [
    { "phase": 2, "iteration": 1, "score": 86, "target": 85, "top_issue": "Shield handoff data contract underspecified", "timestamp": "2026-04-13T10:05:00Z" }
    // ... additional entries follow same pattern
  ],
  "resume_point": { "phase": 6, "step": "6.4", "autonomous": false, "completed_summary": "Phases -1..5 done; Reality Check in progress", "git_branch": "main" }
  // ... additional fields per schema below
}
```

## Field definitions

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema_version` | integer | yes | Currently `2` (Stage 4); see version table above. Bumped on each Shape-B migration stage. |
| `project_type` | enum | yes | `"ios"` or `"web"`. Drives mode-branch routing. |
| `phase` | integer | yes | Current phase, one of `-1, 0, 1, 2, 3, 4, 5, 6, 7`. |
| `step` | string | yes | Dotted step identifier within the phase (e.g., `"5.3b"`, `"6.4"`). |
| `session_id` | string | yes | UUID generated at session start; stable across compactions within a session. |
| `session_started` | ISO 8601 string | yes | When the current session began. |
| `session_last_saved` | ISO 8601 string | yes | Timestamp of the most recent state write. |
| `autonomous` | boolean | yes | Whether `--autonomous` was passed. |
| `mode` | enum | yes | `"interactive"` or `"autonomous"`. Must agree with `autonomous` (interactive iff `autonomous === false`). |
| `app_name` | string | iOS only | App display name; present iff `project_type === "ios"`. |
| `bundle_id` | string | iOS only | Bundle identifier; present iff `project_type === "ios"`. |
| `xcodeproj_path` | string | iOS only | Absolute path to `.xcodeproj`; present iff `project_type === "ios"`. |
| `build_request` | string | yes | Original user prompt that initiated the build. |
| `context_level` | enum | yes | `"raw_idea"`, `"decision_brief"`, `"partial_context"`, or `"full_design"`. |
| `git_branch` | string | yes | Current branch; `"main"` if uninitialized. |
| `completed_tasks` | array | yes | Tasks finished. Each: `{task_id, task_name, status, evidence_files[], completed_at}`. May be empty `[]`. |
| `in_progress_task` | object | no | Task currently executing. `{task_id, task_name, started_at}`. |
| `pending_tasks` | array of strings | yes | `task_id`s still to be dispatched. May be empty `[]`. |
| `phase_artifacts` | object | yes | Paths to persisted phase outputs. All properties optional; empty `{}` is valid. |
| `metric_loop_history` | array | yes | Scored iterations across all phases. Each: `{phase, iteration, score, target, top_issue, timestamp, scoring_criteria_checklist?, extraction_method?}`. May be empty. Optional `scoring_criteria_checklist` (string) records the extracted checklist for LRR audit trail. Optional `extraction_method` (`"mechanical"`, `"one-shot-dispatch"`, `"mixed"`). |
| `active_metric_loop` | object | no | Present only while a metric loop is running. Contains: `{phase, artifact, metric, target, max_iterations, scoring_criteria_checklist?, extraction_method?, current_iteration}`. Removed when the loop completes (results move to `metric_loop_history`). |
| `dispatch_counter` | object | yes | `{dispatches_since_save, last_save_phase}`. Used by the "save every N dispatches" heuristic. |
| `ios_features` | object | iOS only | YAML-in-JSON mirror of resolved feature flags (16 boolean keys). Present iff `project_type === "ios"`. |
| `phase_progress` | object | yes | Boolean per phase (`phase_minus_1` through `phase_7`). `phase_minus_1` is optional (iOS only). |
| `resume_point` | object | yes | `{phase, step, autonomous, completed_summary, git_branch}`. Snapshot used by Phase-0 resume logic. |
| `verification` | object | yes | `{last_verify_result, last_verify_timestamp}`. `last_verify_result` is one of `"PRODUCTION_READY"`, `"NEEDS_WORK"`, `"BLOCKED"`, or `null`. |
| `blockers` | array | no | Open blockers. Each: `{id, description, surfaced_at, type}`. Type is `"build"`, `"design"`, `"dep"`, or `"external"`. |

### Fields added at v2 (Stage 4)

These fields are present only when `schema_version >= 2`. They support the Shape-B SDK migration's backward-routing bookkeeping (A3, A6) and SDK/markdown mode-flip audit trail.

| Field | Type | Required | Added in | Notes |
|---|---|---|---|---|
| `backward_routing_count` | object (string → integer ≥ 0) | no | v2 | Per-decision backward-routing counter keyed by `decision_id`. Existed informally pre-v2; formally typed at v2 and paired with the by-phase counter below. Incremented atomically with `in_flight_backward_edge` on dispatch. |
| `backward_routing_count_by_target_phase` | object (string → integer ≥ 0) | no | v2 | **A6 off-by-one fix.** Per-target-phase backward-routing counter keyed by target phase number (e.g., `"4"`, `"5"`). Lets the max-backward-routes guard count by destination phase rather than by decision, which previously miscounted when a single decision routed back to multiple phases. |
| `in_flight_backward_edge` | object | no | v2 | **A3 crash-seam defense.** Present only while a backward-route dispatch is mid-flight. Written atomically with the counter increment; cleared by the target phase on re-entry. Fields: `decision_id` (string), `target_phase` (string), `counter_value` (integer ≥ 0), `started_at` (ISO 8601). On `--resume`, stale edges (>60s old) trigger a counter decrement so a crashed dispatch does not permanently inflate the guard. |
| `mode_transitions` | array of objects | no | v2 | SDK/markdown flag-flip audit trail (Task 4.7.1). Each entry: `{flag, old_value, new_value, post_flags?, session_id?, timestamp}` — `flag` is the env-var name (e.g., `"BUILDANYTHING_SDK"`, `"BUILDANYTHING_ENFORCE_WRITER_OWNER"`); `old_value`/`new_value` are the string-typed prior and new values; `post_flags` is an optional snapshot (string→string) of all tracked flag values AFTER this flip; `session_id` is nullable; `timestamp` is ISO 8601. Append-only within a session. **A7 adversarial fix:** the v2-initial narrow shape `{from, to, timestamp}` could not identify WHICH flag flipped, making the audit trail useless for schema-rollback debugging — widened to capture `flag` + full post-flip snapshot. Canonical emitter: `hooks/record-mode-transitions.ts`. |

### Fields added at v3 (Stage 5)

These fields are present only when `schema_version >= 3`. They support the Shape-B SDK migration's Lazy Reference Resolution (LRR) aggregator — the Phase 6 Launch Readiness Review aggregator promoted from prose to `src/lrr/aggregator.ts` (Task 5.1). The top-level shape is documented here; the aggregator's own output file `docs/plans/evidence/lrr-aggregate.json` is governed by `protocols/launch-readiness.md` and is NOT part of this state schema.

| Field | Type | Required | Added in | Notes |
|---|---|---|---|---|
| `lrr_cycle_state` | object | no | v3 | Per-cycle LRR bookkeeping written by the aggregator path (`src/lrr/aggregator.ts`). **Interior fields are intentionally loose-typed at v3** — the JSON Schema (`protocols/state-schema.json` `$defs.lrr_cycle_state` implied by `properties.lrr_cycle_state: {type: "object"}`) does not fix the field set because Stage 5 iteration on aggregator output fields (`combined_verdict`, `triggered_rule`, `star_rule_triggered`, `star_rule_decision_ids`, chapter-completion markers) is still in progress. Once Stage 5 lands, this entry will be tightened in a follow-up task (tracked under 5.4.2's "aggregator output fields" scope) and the `additionalProperties: true` implicit allowance will be removed. Present only when `BUILDANYTHING_SDK_LRR=true` (and hence `schema_version` has been bumped to `3`). |

**v3 migration concern — none in wild.** As of this task (5.4.1), Stage 5 has not shipped. No `.build-state.json` files with `schema_version: 3` exist outside development probes. `bin/buildanything-runtime.ts` `MAX_SUPPORTED_SCHEMA_VERSION_FALLBACK` is still `2` (see Task 4.5.2) — a v3 state file would currently be forward-rejected by A7, which is the intended pre-Stage-5 behavior. The runtime will be bumped to `3` as part of Stage 5 activation, not here.

**v3 rollback semantics.** Rollback is via `BUILDANYTHING_SDK_LRR=false` (see `MIGRATION-PLAN-FINAL.md` §Stage 5 rollback). Because `lrr_cycle_state` is additive and optional, a Stage 4 runtime reading a Stage 5 state file with `schema_version` downgraded to `2` will ignore the field without data loss on the read path. The persisted value survives in place until the next state write overwrites it; orchestrator code paths gated on `BUILDANYTHING_SDK_LRR` are responsible for not writing `lrr_cycle_state` under markdown aggregator mode.

### Fields added at v4 (Stage 6)

These fields are present only when `schema_version >= 4`. They support the Shape-B SDK migration's archetype-aware Phase 4 shared-context hoisting (Stage 6, `MIGRATION-PLAN-FINAL.md` §11) — a sprint-scoped shared-context block is rendered once per sprint by `src/orchestrator/phase4-shared-context.ts` (Task 6.1.1) and injected into Phase 4 implementer/reviewer/critic dispatches via the Stage 3 SubagentStart hook. The hash is persisted in state so re-renders only fire on sprint boundary (or when refs mutate mid-sprint via the `state_save` invalidation callback).

| Field | Type | Required | Added in | Notes |
|---|---|---|---|---|
| `current_sprint_context_hash` | string | no | v4 | 16-char SHA-256 prefix (per `phase4-shared-context.ts`) of the rendered sprint-scoped shared-context block. Written by the Phase 4 orchestrator path when `BUILDANYTHING_SDK_SPRINT_CONTEXT=true` (web) / `BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS=true` (iOS). Compared on each Phase 4 dispatch against a fresh render of `{buildState, refs, architecture, qualityTargets, iosFeatures?}`; mismatch forces re-render and rewrite before dispatch. Present only under Stage 6 flag; absent on markdown / Stage 5 runs. |

**v4 migration concern — none in wild.** As of this task (6.5.1), Stage 6 has not shipped. No `.build-state.json` files with `schema_version: 4` exist outside development probes (P6 Habita/Pacely evals per `MIGRATION-PLAN-FINAL.md` §11.3). `bin/buildanything-runtime.ts` `MAX_SUPPORTED_SCHEMA_VERSION_FALLBACK` is still `2` (see Task 4.5.2) — a v4 state file would currently be forward-rejected by A7, which is the intended pre-Stage-6 behavior. The runtime will be bumped to `4` as part of Stage 6 activation (after P6 probe gate passes), not here.

**v4 rollback semantics.** Rollback is via `BUILDANYTHING_SDK_SPRINT_CONTEXT=false` (web) and/or `BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS=false` (iOS parity gate; see `MIGRATION-PLAN-FINAL.md` §Stage 6 rollback and Risk 2). Because `current_sprint_context_hash` is additive and optional, a Stage 5 runtime reading a Stage 6 state file with `schema_version` downgraded to `3` will ignore the field without data loss on the read path — Phase 4 simply reverts to per-task refs re-send. The persisted value survives in place until the next state write overwrites it; orchestrator code paths gated on the Stage 6 flags are responsible for not writing `current_sprint_context_hash` under per-task-refs mode.

**SSOT note.** Kiro-owned `protocols/state-schema.json` is authoritative: `properties.current_sprint_context_hash` (string) is already declared, `schema_version.maximum` is already `4`, and the top-level `$comment` migration table already lists Stage 6. This prose mirrors that shape; any future interior fields (should the sprint-context module persist more than a hash) will be documented by tightening this entry alongside a JSON Schema update.

## Rendering contract

`.build-state.md` is regenerated from `.build-state.json` on every state change by the orchestrator's state-save routine. It is a view, not a source. The rendering is deterministic: same JSON in → same markdown out.

The rendered markdown MUST contain these sections in this order:

1. **Header** — one line: `# Build State`
2. **Current Phase** — `**project_type:** {project_type}`, `**Phase:** {phase} — {phase_name}`, `**Step:** {step}`, `**Mode:** {mode}`, `**Autonomous:** {autonomous}`. iOS builds also render `**app_name:**`, `**bundle_id:**`, `**xcodeproj:**`.
3. **Input** — `**Build request:** {build_request}` and `**Context Level:** {context_level}`.
4. **Dispatch Counter** — two lines: `- dispatches_since_save: {n}`, `- last_save: Phase {k}`.
5. **Metric Loop Scores** — table rendered from `metric_loop_history`. Columns: Phase, Iteration, Score, Target, Top Issue. Rows sorted by phase then iteration.
5a. **Active Metric Loop** (only if `active_metric_loop` is present) — render artifact, metric, target, current iteration, extraction method, and the scoring criteria checklist as a fenced block.
6. **Resume Point** — bulleted `resume_point` fields.
7. **Phase Artifacts** — bulleted list of `phase_artifacts` entries that are non-null.
8. **iOS Features** (iOS only) — YAML fenced block mirroring `ios_features`.
9. **Phase Progress** — checkbox list `[x]`/`[ ]` per phase from `phase_progress`. Rendered **once**, replacing any prior block. Never appended.
10. **Blockers** (only if non-empty) — bulleted list of blocker descriptions with id and type.

The renderer MUST replace the entire file on write — never append, never diff-edit. This guarantees that drift introduced by partial writes (the capdotai `Phase Progress` duplication bug) is impossible by construction.

## Atomic write protocol

Every orchestrator write to `.build-state.json` (and its rendered `.build-state.md` view) MUST use write-then-rename to survive mid-write interruption (compaction, crash, Ctrl-C):

1. Write the full new contents to `docs/plans/.build-state.json.tmp`.
2. Rename `.build-state.json.tmp` → `.build-state.json` (POSIX `mv`, which is atomic on the same filesystem).
3. If step 1 or 2 fails, delete the leftover `.tmp` file. Never leave `.tmp` behind on a failed write.

Direct writes to `.build-state.json` are prohibited — a partial write leaves unparseable JSON and the build cannot resume.

**Read-side recovery check:** on session start / resume, if `.build-state.json.tmp` exists and `.build-state.json` does not (or is empty), treat it as a corrupted interrupted write. Do not auto-parse the `.tmp` file. Surface to the user and halt — resuming from partial state is worse than stopping.

This section is the authoritative write contract. Other protocol/command files that say "write to `.build-state.json`" mean "via this protocol."

## Validation rules

A well-formed `.build-state.json` must satisfy:

1. **Required fields present** — every field marked required above exists and is non-null (except where explicitly `null`-allowed like `verification.last_verify_result`).
2. **No duplicate keys** — JSON parse succeeds with strict mode. (Addresses the duplicate-`Autonomous:` drift.)
3. **Type correctness** — every field matches the declared type. Integers are integers, booleans are booleans, ISO timestamps parse.
4. **Phase bounds** — `phase ∈ {-1, 0, 1, 2, 3, 4, 5, 6, 7}`. `phase === -1` only if `project_type === "ios"`.
5. **Step matches phase** — `step` starts with the current phase number (e.g., phase 5 → `"5.x"`). Exception: iOS bootstrap step `"-1.x"`.
6. **Mode/autonomous consistency** — `mode === "autonomous" iff autonomous === true`.
7. **iOS fields gating** — `app_name`, `bundle_id`, `xcodeproj_path`, `ios_features`, `phase_progress.phase_minus_1` exist iff `project_type === "ios"`. On web builds these must be absent.
8. **ios_features shape** — if present, contains exactly the 16 documented boolean keys. No extras, no omissions.
9. **Completed tasks well-formed** — each entry has all five sub-fields; `evidence_files` is an array (possibly empty); `status ∈ {"done", "skipped", "deferred"}`.
10. **Pending/in-progress disjoint** — `in_progress_task.task_id` (if present) does not appear in `pending_tasks` or `completed_tasks`.
11. **Resume point consistency** — `resume_point.phase` and `resume_point.step` must not be ahead of the top-level `phase`/`step`.
12. **Timestamps monotonic** — `session_last_saved >= session_started`.

The Wave 2 `PreToolUse` schema lint hook (W2-2) validates every Write|Edit to `.build-state.json` against these rules and denies writes that fail.
