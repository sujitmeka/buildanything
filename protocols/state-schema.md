# .build-state.json Schema

## Purpose

`docs/plans/.build-state.json` is the **typed source of truth** for build state. The human-readable `docs/plans/.build-state.md` file is an **auto-rendered view** regenerated on every state change — it is never edited directly. This document defines the required fields, their types, the rendering contract that produces the markdown view, and the validation rules a well-formed state file must satisfy. Introduced in Wave 1 (W1-2) to eliminate the drift observed in freeform markdown state (duplicate `Autonomous:` fields, Phase Progress append-instead-of-replace, mode branch collisions) and to give the Wave 2 `PreToolUse` schema lint hook something concrete to validate against.

## Required fields

```json
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
  "app_name": "cap",
  "bundle_id": "com.capdotai.cap",
  "xcodeproj_path": "/Users/sujit/projects/capdotai/cap/cap.xcodeproj",
  "build_request": "iOS app blocker that uses on-device AI to gate access to distracting apps.",
  "context_level": "raw_idea",
  "git_branch": "main",
  "completed_tasks": [
    {
      "task_id": "M3-T04",
      "task_name": "Implement Foundation Models allow/deny classifier",
      "status": "done",
      "evidence_files": [
        "cap/Features/Chat/GateClassifier.swift",
        "capTests/GateClassifierTests.swift"
      ],
      "completed_at": "2026-04-13T10:52:11Z"
    }
  ],
  "in_progress_task": {
    "task_id": "M3-T05",
    "task_name": "Wire classifier into shield handoff flow",
    "started_at": "2026-04-13T11:30:00Z"
  },
  "pending_tasks": ["M3-T06", "M3-T07", "M4-T01"],
  "phase_artifacts": {
    "design_doc_path": "docs/plans/2026-04-05-capdotai-design.md",
    "research_brief_path": "docs/plans/research-brief.md",
    "architecture_path": "docs/plans/architecture.md",
    "sprint_tasks_path": "docs/plans/sprint-tasks.md",
    "design_board_path": "docs/plans/design-board.md"
  },
  "metric_loop_history": [
    {
      "phase": 2,
      "iteration": 1,
      "score": 86,
      "target": 85,
      "top_issue": "Shield handoff data contract underspecified",
      "timestamp": "2026-04-13T10:05:00Z"
    }
  ],
  "dispatch_counter": {
    "dispatches_since_save": 7,
    "last_save_phase": 2
  },
  "ios_features": {
    "widgets": false,
    "liveActivities": false,
    "appIntents": false,
    "foundationModels": true,
    "storekit": false,
    "healthkit": false,
    "push": true,
    "cloudkit": false,
    "siri": false,
    "location": false,
    "background": false,
    "cameraPhoto": false,
    "microphone": false,
    "contacts": false,
    "calendar": false,
    "appleWatch": false
  },
  "phase_progress": {
    "phase_minus_1": true,
    "phase_0": true,
    "phase_1": true,
    "phase_2": true,
    "phase_3": true,
    "phase_4": true,
    "phase_5": true,
    "phase_6": false,
    "phase_7": false
  },
  "resume_point": {
    "phase": 6,
    "step": "6.4",
    "autonomous": false,
    "completed_summary": "Phases -1..5 done; Reality Check in progress",
    "git_branch": "main"
  },
  "verification": {
    "last_verify_result": "NEEDS_WORK",
    "last_verify_timestamp": "2026-04-13T11:40:12Z"
  },
  "blockers": [
    {
      "id": "B-001",
      "description": "Simulator launch fails on entitlements mismatch",
      "surfaced_at": "2026-04-13T11:35:00Z",
      "type": "build"
    }
  ]
}
```

## Field definitions

- `schema_version` (integer, required) — version of this schema document. Currently `1`. Bump on breaking changes.
- `project_type` (enum, required) — `"ios"` or `"web"`. Drives mode-branch routing.
- `phase` (integer, required) — current phase, one of `-1, 0, 1, 2, 3, 4, 5, 6, 7`.
- `step` (string, required) — dotted step identifier within the phase (e.g., `"5.3b"`, `"6.4"`).
- `session_id` (string, required) — UUID generated at session start; stable across compactions within a session.
- `session_started` (ISO 8601 string, required) — when the current session began.
- `session_last_saved` (ISO 8601 string, required) — timestamp of the most recent state write.
- `autonomous` (boolean, required) — whether `--autonomous` was passed.
- `mode` (enum, required) — `"interactive"` or `"autonomous"`. Must agree with `autonomous` (interactive iff `autonomous === false`).
- `app_name` (string, iOS only, optional) — app display name; present iff `project_type === "ios"`.
- `bundle_id` (string, iOS only, optional) — bundle identifier; present iff `project_type === "ios"`.
- `xcodeproj_path` (string, iOS only, optional) — absolute path to the `.xcodeproj`; present iff `project_type === "ios"`.
- `build_request` (string, required) — original user prompt that initiated the build.
- `context_level` (enum, required) — `"raw_idea"`, `"decision_brief"`, `"partial_context"`, or `"full_design"`.
- `git_branch` (string, required) — current branch; `"main"` if uninitialized.
- `completed_tasks` (array, required) — tasks finished. Each element: `{task_id, task_name, status, evidence_files[], completed_at}`. May be empty `[]`.
- `in_progress_task` (object, optional) — task currently executing. `{task_id, task_name, started_at}`.
- `pending_tasks` (array of strings, required) — `task_id`s still to be dispatched. May be empty `[]`.
- `phase_artifacts` (object, required) — paths to persisted phase outputs. All properties optional; empty object `{}` is valid.
- `metric_loop_history` (array, required) — scored iterations across all phases. Each: `{phase, iteration, score, target, top_issue, timestamp}`. May be empty.
- `dispatch_counter` (object, required) — `{dispatches_since_save, last_save_phase}`. Used by the "save every N dispatches" heuristic.
- `ios_features` (object, iOS only, optional) — YAML-in-JSON mirror of the resolved feature flags (widgets, liveActivities, foundationModels, etc.). Exactly 16 boolean keys. Present iff `project_type === "ios"`.
- `phase_progress` (object, required) — boolean per phase (`phase_minus_1` through `phase_7`). `phase_minus_1` is optional (iOS only).
- `resume_point` (object, required) — `{phase, step, autonomous, completed_summary, git_branch}`. Snapshot used by Phase-0 resume logic.
- `verification` (object, required) — `{last_verify_result, last_verify_timestamp}`. `last_verify_result` is one of `"PRODUCTION_READY"`, `"NEEDS_WORK"`, `"BLOCKED"`, or `null`.
- `blockers` (array, optional) — open blockers. Each: `{id, description, surfaced_at, type}`. Type is `"build"`, `"design"`, `"dep"`, or `"external"`. May be omitted or empty.

## Rendering contract

`.build-state.md` is regenerated from `.build-state.json` on every state change by the orchestrator's state-save routine. It is a view, not a source. The rendering is deterministic: same JSON in → same markdown out.

The rendered markdown MUST contain these sections in this order:

1. **Header** — one line: `# Build State`
2. **Current Phase** — `**project_type:** {project_type}`, `**Phase:** {phase} — {phase_name}`, `**Step:** {step}`, `**Mode:** {mode}`, `**Autonomous:** {autonomous}`. iOS builds also render `**app_name:**`, `**bundle_id:**`, `**xcodeproj:**`.
3. **Input** — `**Build request:** {build_request}` and `**Context Level:** {context_level}`.
4. **Dispatch Counter** — two lines: `- dispatches_since_save: {n}`, `- last_save: Phase {k}`.
5. **Metric Loop Scores** — table rendered from `metric_loop_history`. Columns: Phase, Iteration, Score, Target, Top Issue. Rows sorted by phase then iteration.
6. **Resume Point** — bulleted `resume_point` fields.
7. **Phase Artifacts** — bulleted list of `phase_artifacts` entries that are non-null.
8. **iOS Features** (iOS only) — YAML fenced block mirroring `ios_features`.
9. **Phase Progress** — checkbox list `[x]`/`[ ]` per phase from `phase_progress`. Rendered **once**, replacing any prior block. Never appended.
10. **Blockers** (only if non-empty) — bulleted list of blocker descriptions with id and type.

The renderer MUST replace the entire file on write — never append, never diff-edit. This guarantees that drift introduced by partial writes (the capdotai `Phase Progress` duplication bug) is impossible by construction.

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
