# Decision Log Protocol

This is the append-only decision log that captures rejected alternatives alongside the chosen approach, with a natural-language revisit criterion for each rejection. It feeds two loops: the learnings pipeline at Step 6.0.1 (cross-run PITFALL capture) and the Phase 0 resume handler (preserving the *why* across build sessions). Without this log the build remembers *what* it chose but forgets *what it rejected and under what conditions to reconsider*.

## Schema

Rows live in `docs/plans/decisions.jsonl`, one JSON object per line, append-only. NEVER rewrite or truncate this file.

```json
{
  "decision_id": "D-<phase>-<seq>",
  "phase": "2.2",
  "timestamp": "<ISO8601>",
  "decision": "chose SQLite over Postgres for MVP persistence",
  "chosen_approach": "SQLite with single-file .db in project root",
  "rejected_alternatives": [
    {
      "approach": "Postgres via Supabase",
      "reason": "adds infra setup to Phase 0 prereqs; overkill for single-user MVP",
      "revisit_criterion": "multi-user access OR >10k rows OR concurrent writes"
    }
  ],
  "decided_by": "<agent-role-string>",
  "ref": "architecture.md#backend/persistence",
  "status": "open"
}
```

`decided_by` is a free-form string naming the agent role that authored the decision (e.g., `architect`, `implementer`, `design-brand-guardian`, `ux-architect`, `human`, `design-critic`). The orchestrator does not validate against a fixed enum — the set of writing agents changes as new phases ship, and a brittle whitelist would force a schema migration every time. The LRR Aggregator matches on the string value directly against its known-agent registry; unknown values fall through to the legacy classification path in Step 4.

Findings in LRR chapter verdicts may reference a decision row via the `related_decision_id` field, which the LRR Aggregator uses for backward routing (see `protocols/launch-readiness.md` Aggregator Step 3). The `related_decision_id` lives on the **finding** object inside a chapter verdict, not on the decision row itself — it is the pointer from a finding back to the decision that authored the choice being violated.

The `status` field takes one of three values:

- `open` — decision stands, revisit criterion has not fired
- `triggered` — Reality Checker matched the revisit criterion against current evidence this build
- `resolved` — a later decision row supersedes this one; the log still shows both

## Hard Field Constraints

- Max **3 rejected alternatives** per decision row
- Max **2 sentences** per `reason` field
- Max **1 sentence** per `revisit_criterion` (natural language assertion)
- Max **5 decision rows per phase** (typical 2-3)
- Total per build: **15-25 rows max, ~500-1000 tokens worst case**
- File path: `docs/plans/decisions.jsonl` — append-only, NEVER rewrite or truncate

A row that exceeds any of these limits is a bug in the writing agent, not a permission to raise the limit. Split one decision into two rows before relaxing the constraints.

## Natural-Language `revisit_criterion` Format

The criterion is a one-sentence assertion the Reality Checker can semantically match against build evidence. Write it as the condition under which the rejected alternative would become correct. Do NOT write it as a metric threshold tied to a Phase 6 vocabulary that may not exist yet.

Examples:

- `"multi-user access OR >10k rows OR concurrent writes"`
- `"user requests server-side rendering"`
- `"bundle size exceeds 500KB gzipped"`
- `"first-paint latency regresses below 2s on 4G"`

If you cannot write the criterion in one sentence, the rejection is probably not yet crisp enough to log — revisit the decision first, log it second.

## Author Assignment

Author = the agent that made the call. The orchestrator NEVER writes decision rows itself.

| Phase | Writer | Example decisions |
|-------|--------|-------------------|
| 1 (Brainstorm) | Brainstorm synthesis agent | Tech stack, data model, scope boundary |
| 2.2 (Architecture) | Architecture synthesizer | API contract, service boundary, persistence, auth model |
| 3 (Design) | [DEFERRED — currently no author until Phase 3 changes ship] | Visual direction kill rationales |
| 4 (Build) | Implementer — ONLY if deviating from planned task | Deviation rationale |

Phases 0, 6, 7 do not write decisions.

## Readers

Three consumers, each reads a bounded slice:

1. **Phase 0 Resume Handler (on `--resume`)** — reads the top 5 most recent rows sorted by `decision_id` desc, filtered to the current phase and upstream phases. Injects short fields + `ref` anchor into rehydration context alongside `architecture.md`. Never reads all rows.

2. **Step 6.0 Reality Checker (Dissent Log Revisit Pass)** — reads all rows where `status == "open"` and `revisit_criterion` is non-empty. Semantically evaluates each criterion against the current build's evidence manifest. For any triggered row, emits a structural finding of the form `"revisit-criterion-triggered: D-N-M — [criterion]"` in `specific_findings[]` and contributes to `combined_verdict` (triggered → at minimum NEEDS WORK).

3. **Step 6.0.1 Learnings Harvester** — reads the Reality Checker's triggered findings and appends one PITFALL row per trigger to `learnings.jsonl` with `provenance.decision_id` back-referencing the source row. This is the cross-run PITFALL capture path, distinct from the in-run metric-loop post-hoc harvest.

## Subagents Never Write Directly

Subagents return `deviation_row` objects in their structured result. The orchestrator forwards each row through the `scribe_decision` MCP tool — the single writer for `docs/plans/decisions.jsonl`. The MCP owns `decision_id` allocation (`D-{phase}-<seq>`), stamps `timestamp` and `status: "open"`, validates against `decisions.schema.json`, and atomically appends the line. The orchestrator MUST NOT Write or Edit this file directly; subagents MUST NOT either. Specialist agents still author the row fields to preserve original language — they just don't touch the file.

## Worked Examples

**Phase 2.2 architecture — persistence layer (cross-domain deviation):**

```json
{
  "decision_id": "D-2-03",
  "phase": "2.2",
  "timestamp": "2026-04-13T16:05:41Z",
  "decision": "chose SQLite over Postgres for MVP persistence",
  "chosen_approach": "SQLite with single-file .db in project root, migrations via drizzle-kit",
  "rejected_alternatives": [
    {
      "approach": "Postgres via Supabase",
      "reason": "adds infra setup to Phase 0 prereqs; overkill for single-user MVP.",
      "revisit_criterion": "multi-user access OR >10k rows OR concurrent writes"
    },
    {
      "approach": "JSON file on disk",
      "reason": "no query layer, no migrations, no referential integrity.",
      "revisit_criterion": "schema stabilizes AND row count stays under 500"
    }
  ],
  "decided_by": "architect",
  "ref": "architecture.md#backend/persistence",
  "status": "open"
}
```

## Token Budget

| Item | Budget |
|------|--------|
| decisions.jsonl on disk per build | 500-1000 tokens worst case |
| Reality Checker read (Step 6.0) | ~200 tokens |
| Resume handler read (Phase 0) | ~300 tokens |
| Learnings harvester read (Step 6.0.1) | ~200 tokens |
| **Total per build** | **~1.2-1.7K tokens** |

## Ref Field Convention

Every row carries a `ref` anchor (e.g., `architecture.md#backend/persistence` or `visual-design-spec.md#<anchor>`) that downstream readers use to widen context without pasting prose. The resume handler passes the row's short fields *plus* the ref — the resumed agent reads the anchor via its own Read tool if it needs the full context. This matches the existing `refs.json` pattern in `commands/build.md` (primary/secondary anchors handed to implementers instead of pasted content), and keeps rehydration token cost bounded to ~300 tokens for the top 5 rows regardless of how much architectural prose sits behind each anchor.
