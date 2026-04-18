# .build-state.json Schema

## Purpose

`docs/plans/.build-state.json` is the **typed source of truth** for build state. The human-readable `docs/plans/.build-state.md` file is an **auto-rendered view** regenerated on every state change — it is never edited directly. This document defines the required fields, their types, the rendering contract that produces the markdown view, and the validation rules a well-formed state file must satisfy. Introduced in Wave 1 (W1-2) to eliminate the drift observed in freeform markdown state (duplicate `Autonomous:` fields, Phase Progress append-instead-of-replace, mode branch collisions) and to give the Wave 2 `PreToolUse` schema lint hook something concrete to validate against.

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
| `schema_version` | integer | yes | Currently `1`. Bump on breaking changes. |
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
