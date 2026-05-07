# Phase 6 Customer Reality Check Protocol (v2.4)

> **Replaces** the v1 5-chapter Launch Readiness Review. The chapter system was structurally blind to the failure class the plugin's customers cared about — illogical buttons, disconnected features, layouts with no reason to exist. None of the 5 chapters (Eng-Quality, Security, SRE, A11y, Brand Guardian) was positioned to ask "would a real customer be served by this product?" — each checked a sub-property and inherited the build's own framing from evidence files. With Group 4's wave-end gate now owning the technical envelope (build, security with proof-of-exploit, brand-drift, PO Mode 2, dogfood per wave) and a11y promoted to wave-gate cheap tier, the chapters became redundant on what they were good at while never owning product coherence.
>
> Phase 6 under v2.4-fix is a single Customer Reality Judge with deliberately narrow inputs (user's brief + Q&A + competitive-differentiation + the running app) and a binary verdict (PRODUCTION READY or BLOCKED — no NEEDS_WORK softening rung). See `docs/specs/v2.4-fix/lrr-replacement.md` for the migration rationale.

## Purpose

Walk the running app as a brand-new customer who has read the marketing brief. Compare what the app does against what the user said they wanted in `idea-draft.md` + `user-decisions.md` and against `competitive-differentiation.md`'s closest-alternative standard. Report two lists of findings — `doesnt_deliver` and `confusing_or_illogical`. Empty lists = ship-ready. Non-empty = block until fixed.

## Inputs (the judge reads ONLY these)

- `docs/plans/phase1-scratch/idea-draft.md` — user's original brief
- `docs/plans/phase1-scratch/user-decisions.md` — Q&A from the informed brainstorm
- `docs/plans/phase1-scratch/competitive-differentiation.md` — closest 1–3 alternatives + what this product must do better/worse on the core job
- The running app (web: dev-server URL via agent-browser; iOS: simulator via XcodeBuildMCP)

## Inputs the judge MUST NOT read

`product-spec.md`, `architecture.md`, `page-specs/*`, `design-doc.md`, `DESIGN.md`, `feature-briefs/`, anything under `evidence/`. These would prime confirmation bias toward "build matches plan" when the question is "is the plan good."

## Output schema

`docs/plans/evidence/customer-reality-findings.json`:

```json
{
  "schema_version": "1",
  "judged_at": "<ISO-8601>",
  "project_type": "web | ios",
  "doesnt_deliver": [
    {
      "finding_id": "CR-DD-001",
      "surface": "<page or screen path>",
      "description": "<one sentence>",
      "screenshot_path": "docs/plans/evidence/customer-reality-screenshots/<file>.png",
      "brief_quote": "<verbatim from idea-draft.md or user-decisions.md>",
      "brief_source": "idea-draft.md | user-decisions.md"
    }
  ],
  "confusing_or_illogical": [
    {
      "finding_id": "CR-CI-001",
      "surface": "<page or screen path>",
      "description": "<one sentence>",
      "screenshot_path": "docs/plans/evidence/customer-reality-screenshots/<file>.png",
      "alternative_comparison": "<one sentence about what the closest alternative does differently>"
    }
  ],
  "summary": "<2-3 sentences — overall impression as a customer. Would you ship this to a friend?>"
}
```

No verdict score, no rubric, no severity gradation. The two-list shape is the only signal.

## Aggregate output

`docs/plans/evidence/customer-reality-aggregate.json`:

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

## Routing rules (orchestrator at Step 6.1)

Per finding, mechanical classification — no LLM dispatch:

| Source list | Default target phase | Default target step |
|---|---|---|
| `doesnt_deliver[]` | Phase 1 | `1.6` (product-spec re-scope) |
| `confusing_or_illogical[]` | Phase 3 | `3.3` (page-spec re-design) |

Escape hatches (regex-detected from the finding's `description`):

- `/\b(performance\|latency\|throughput\|schema\|data model\|API contract)\b/i` → Phase 2 (`2.3`)
- Finding clearly cites code/spec mismatch → Phase 4 (`4.3.5`)

Output: `docs/plans/evidence/customer-reality-routing.json`.

## Verdict rules (Step 6.2)

Binary, audit-fix-#7-strict:

- Both lists empty AND no escape-hatch findings → `combined_verdict: PRODUCTION READY`. Proceed to Phase 7.
- Either list non-empty → `combined_verdict: BLOCKED`. Apply backward routing per `customer-reality-routing.json`.

There is no `NEEDS WORK` rung. The verdict is binary on the union of the two lists.

## Cycle limit

Max 2 customer-reality cycles per build. After cycle 2 still BLOCKED:

- Interactive: present remaining findings to the user. Ask for direction.
- Autonomous: log remaining findings to `build-log.md`. Proceed to Phase 7 with a Verification Gap section. Emit a Phase 6 deviation row to `decisions.jsonl` documenting the proceed-despite-BLOCKED choice.

## Re-entry dispatch template (Phase 6 → target phase)

```
On re-entry from Phase 6 BLOCKED:
  INPUT passed to the re-opened phase:
    blocking_finding: {finding_id, source_list, surface, description, screenshot_path, brief_quote OR alternative_comparison}
    prior_output: path to the phase's previous artifact
    decision_row: optional — the row from decisions.jsonl found via star-rule lookup using related_decision_id (when set)
    cycle_number: current backward-routing cycle count for this target phase
  TASK for the re-opened phase:
    Revise prior_output to address blocking_finding. Do NOT redo unaffected work.
    Emit a new decision_row documenting the revision rationale.
```

## Verdict validation

Under v2.4-fix the only legal Phase 6 verdicts are `PRODUCTION READY` and `BLOCKED`. The orchestrator MUST call `validateAggregateResult(result)` from `src/lrr/aggregator.ts` after writing the aggregate. The validator continues to enforce the full enum (`PRODUCTION READY | NEEDS WORK | BLOCKED`) so any drift outside it (e.g., `CONDITIONAL_SHIP`) is rejected.

## Why no NEEDS WORK rung

The v1 LRR's `NEEDS WORK` was a softening hatch in disguise — chapters returned `BLOCK`, the aggregator wrote `NEEDS WORK`, the build proceeded with "minor" gaps that turned out to be major. Replacing it with a binary verdict at Phase 6 makes the rule unambiguous: any customer-perceptible failure blocks the build until it's fixed or explicitly accepted with a deviation row.

## v1 deprecation notes

- The 5-chapter system (Eng-Quality, Security, SRE, A11y, Brand Guardian) is removed from the orchestrator dispatch flow.
- `src/lrr/aggregator.ts` `aggregate()` is marked `@deprecated`. Kept temporarily for legacy test fixtures and rollback safety.
- A11y mechanical checks moved to wave-end gate cheap tier (Step 4.3.5).
- The Reality Checker's Dissent Log Revisit Pass moved to Phase 5 closeout (Step 5.5.5).
- `lrr-aggregate.json` and `lrr-routing.json` are no longer written by the orchestrator. Consumers that read them (e.g., Completion Report) now read `customer-reality-aggregate.json` and `customer-reality-routing.json`.
