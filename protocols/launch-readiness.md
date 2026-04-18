# Launch Readiness Review Protocol

You are the orchestrator. You are about to run a Launch Readiness Review (LRR) — a multi-chapter, independent-verdict gate that sits between the Phase 6 Reality Check and Phase 7.

## Purpose

LRR replaces the monolithic Reality Checker verdict with five independent chapter verdicts plus a mechanical aggregator.

## Chapters

LRR runs **five chapters**: Eng-Quality, Security, SRE, A11y, and Brand Guardian.

Requirements coverage is evaluated as a sub-input of the Eng-Quality chapter. There is no separate PM chapter, no `pm.json` file, and the LRR Aggregator runs exactly once. The Eng-Quality chapter agent reads the Design Doc + `sprint-tasks.md` MVP scope directly alongside its other evidence and emits COVERED/PARTIAL/MISSING per feature inline on its own verdict (see the `requirements_coverage` field in the schema below). There is no separate Step 7.0 dispatch and no Aggregator re-run.

### Primary evidence inputs

| Chapter | Primary evidence inputs |
|---|---|
| Eng-Quality | `architecture.md`, `task-outputs/`, `verify.md` check outputs, test results, eval results, Design Doc + `sprint-tasks.md` MVP scope (read directly for the Requirements Coverage sub-input) |
| Security | `evidence/fake-data-audit.md`, Phase 5 security audit output, eval-harness security cases |
| SRE | Phase 5 performance-audit outputs, Performance Benchmarker evidence, NFRs from `sprint-tasks.md`, reliability checks |
| A11y | Phase 5 a11y audit output, Phase 3.7 `a11y-design-review.md`, WCAG 2.2 AA runtime findings, per-page accessibility findings |
| Brand Guardian | `docs/plans/visual-design-spec.md`, `docs/plans/visual-dna.md`, `docs/plans/design-references.md`, Playwright screenshots under `docs/plans/evidence/` matching product pages |

## Chapter verdict schema

Each chapter agent runs fresh-context, reads its own slice of the evidence manifest, and writes a verdict file with this shape:

```json
{
  "chapter": "eng-quality | security | sre | a11y | brand-guardian",
  "verdict": "PASS | CONCERNS | BLOCK",
  "override_blocks_launch": false,
  "evidence_files_read": ["docs/plans/evidence/..."],
  "findings": [
    {"severity": "block|concern|info", "description": "...", "evidence_ref": "path", "related_decision_id": "D-2-03"}
  ],
  "follow_up_spawned": false,
  "follow_up_findings": null
}
```

The **Eng-Quality** chapter additionally carries the Requirements Coverage sub-input inline on its verdict:

```json
{
  "requirements_coverage": [
    {"feature": "string", "status": "COVERED | PARTIAL | MISSING", "note": "optional string"}
  ]
}
```

This field carries the PM coverage signal directly on the Eng-Quality verdict — there is no separate `pm.json` file and no separate PM dispatch. The Eng-Quality chapter agent reads the Design Doc + `sprint-tasks.md` MVP scope as part of its own evidence sweep and emits the coverage list alongside its code-quality judgment.

<HARD-GATE>
SCHEMA CONTRACT:

- `verdict` MUST be one of `PASS | CONCERNS | BLOCK`. `CONCERNS` means "I have concerns but won't block" and is aggregated as NEEDS WORK. `BLOCK` means "this fails my chapter's criteria" and is aggregated as NEEDS WORK unless `override_blocks_launch: true`.
- `override_blocks_launch: true` is a veto-of-vetoes — no other chapter's PASS can override it. Only legal when `verdict == BLOCK`.
- `evidence_files_read` MUST be non-empty. A verdict file with empty `evidence_files_read` is treated as malformed. "Looks good to me" verdicts are not permitted.
- `follow_up_spawned` is only legal for the **Security** and **SRE** chapters. Brand Guardian and A11y chapters CANNOT spawn follow-ups — they render their verdict on what they can read and write it directly.
</HARD-GATE>

## A11y chapter rules

The A11y chapter gates on WCAG 2.2 AA runtime findings from the Phase 5 accessibility audit and the Phase 3.7 a11y design review.

- **PASS** if: zero Critical findings AND zero Serious findings AND zero failed WCAG 2.2 AA success criteria (runtime-measurable ones).
- **CONCERNS** if: zero Critical AND 1-3 Serious findings (reviewable but not blocking).
- **BLOCK** if: any Critical finding OR >3 Serious findings OR any failed WCAG 2.2 AA success criterion.

Runtime measurement is required — spec-only compliance is not sufficient. Evidence must come from a Playwright + axe-core sweep (or equivalent) run against the actual built product pages, not the design system route alone.

## Brand Guardian chapter rules

The Brand Guardian chapter gates on **DNA drift** — did the built product stay true to the 6-axis Visual DNA locked at Phase 3.0?

Prepend this anti-sycophancy preamble **verbatim** to the chapter dispatch prompt (stolen from ECC `gan-evaluator`):

> "Your natural tendency is to be encouraging. Fight it. Default verdict: NEEDS WORK. You are not here to validate — you are here to find the gap."

The chapter agent reads: `docs/plans/visual-dna.md` (the locked DNA card), `docs/plans/visual-design-spec.md`, `docs/plans/design-references.md`, and Playwright screenshots under `docs/plans/evidence/` matching **product pages** (not just `/design-system`).

Scoring — 6 DNA axes (20 pts each = 120) + 5 craft dimensions (20 pts each = 100) = **220 total**, target **≥ 180**.

- **PASS** if: DNA score ≥ 180 AND craft score ≥ 75 AND no single axis scoring < 12/20.
- **CONCERNS** if: DNA score 150-179 OR any single axis scoring 10-12/20.
- **BLOCK** if: DNA score < 150 OR any axis scoring < 10/20.

Every finding must cite a specific element with a `file:line` reference and reference either the DNA card or a `design-references.md` path. Vague findings ("the hero needs work") are not admissible — they are rejected by the Aggregator's schema check and the verdict defaults to CONCERNS. Brand Guardian is forbidden from rubber-stamping.

## Follow-up investigation flow (Security and SRE only)

Security and SRE — and only these chapters — may spawn one read-only follow-up investigation per LRR round. Eng-Quality, A11y, and Brand Guardian render their verdict on what they can read and rely on the existing NEEDS_WORK loop when concerns arise.

The trigger is now tightened: follow-ups fire **only on a BLOCK verdict**. The previous "or suspicious, need to verify" escape hatch is gone — suspicion without a BLOCK is recorded as a CONCERNS verdict, not as a follow-up spawn.

```
Security/SRE chapter agent runs → reads evidence manifest + 2-3 targeted files
  |
  If verdict = PASS or CONCERNS → write lrr/{chapter}.json, done (1 dispatch)
  |
  If verdict = BLOCK → CAN spawn ONE follow-up (no longer legal on "suspicion")
  |
  Follow-up agent spawned with:
    - Mode: read-only (no Write, no Edit, no Bash write ops)
    - Allowed tools: Read, Grep, Glob
    - Max tool calls: 15 (enforced via prompt + self-report)
    - Scope: single named concern from parent chapter's findings
    - Returns typed JSON (see below)
  |
  Parent chapter reads follow-up output + its own earlier findings,
  validates follow-up schema, writes FINAL lrr/{chapter}.json with
  follow_up_findings populated.
```

### Follow-up return schema

```json
{
  "confirmed": true,
  "evidence": ["path1", "path2"],
  "findings": [
    {"severity": "block|concern|info", "description": "...", "evidence_ref": "path"}
  ],
  "tool_calls_used": 12
}
```

<HARD-GATE>
HARD CAPS ON FOLLOW-UPS:

- **Max 1 follow-up per chapter per LRR round.** No follow-ups spawning follow-ups — investigation chains are banned because that is where dispatch counts actually explode.
- **Read-only.** Allowed tools: Read, Grep, Glob. No Write, no Edit, no Bash write ops. If the follow-up finds a real fix, it documents it — the fix is executed in a separate Phase 6 NEEDS_WORK cycle, never inline.
- **15 tool call cap, self-reported via `tool_calls_used`.** Parent chapter validates `tool_calls_used <= 15` before accepting the follow-up output.
- **Only Security and SRE have the power.** Eng-Quality, A11y, and Brand Guardian chapters with concerns write a CONCERNS verdict; they do not spawn follow-ups.
- **BLOCK-only trigger.** A follow-up can only be spawned when the parent chapter's verdict is BLOCK. Concerns without a BLOCK are logged as CONCERNS; they do not justify a second dispatch.
</HARD-GATE>

## Fallback on malformed or timed-out follow-up

<HARD-GATE>
DEFAULT: HARD BLOCK WITH `override_blocks_launch: true`.

If a Security/SRE follow-up times out, returns invalid JSON, or reports `tool_calls_used > 15`, the parent chapter writes:

```json
{
  "chapter": "security|sre",
  "verdict": "BLOCK",
  "reason": "follow_up_malformed",
  "override_blocks_launch": true,
  "detail": "Follow-up returned {timeout|invalid_json|cap_violation} — cannot verify security/reliability claim, blocking per pessimistic default"
}
```

A security or reliability check that cannot produce a typed result is itself a signal — pessimistic-block is the only safe default. You cannot ship a build whose security check is unverifiable.
</HARD-GATE>

## LRR Aggregator

The Reality Checker keeps its evidence-manifest sweep role but its verdict generation is replaced by LRR aggregation. The Aggregator now runs a **5-step flow**: file-completeness checkpoint → apply the 6 rules → BLOCK routing via the decision log → classification for NEEDS WORK findings → READY handoff.

### Step 1: File-completeness checkpoint (NEW barrier)

Before applying any aggregation rule, the Aggregator MUST Glob `docs/plans/evidence/lrr/*.json` and verify all 5 expected chapter files exist and parse as valid JSON:

- `eng-quality.json`
- `security.json`
- `sre.json`
- `a11y.json`
- `brand-guardian.json`

The Aggregator does **not** expect or read any `pm.json` file. Requirements coverage lives inline on the Eng-Quality verdict (`requirements_coverage` field) and is not a separate artifact.

If any of the 5 required files are missing, OR any file fails to parse as valid JSON, OR any file is missing required schema fields (`chapter`, `verdict`, non-empty `evidence_files_read`), the Aggregator:

1. Logs `LRR INCOMPLETE: missing [filename] / malformed [filename]` to `docs/plans/build-log.md`.
2. Writes `docs/plans/evidence/lrr-aggregate.json` with `combined_verdict = INCOMPLETE` and the list of missing/malformed files.
3. STOPS — does **NOT** proceed to the 6 aggregation rules.

This is the partial-glob race fix — the explicit roster check makes the race impossible: the Aggregator fails loudly instead of silently under-counting.

### Step 2: Apply the 6 aggregation rules

Once all 5 chapter files are present and parseable, the Aggregator applies these rules:

1. **ANY `override_blocks_launch: true`** → `combined_verdict = BLOCKED`, regardless of other verdicts. This is the veto-of-vetoes rule.
2. **ALL verdicts `PASS` AND zero follow-ups spawned** → `combined_verdict = PRODUCTION READY`.
3. **ANY verdict `BLOCK` with `override_blocks_launch: false`** → `combined_verdict = NEEDS WORK`, with that chapter's findings routed into the existing fix-and-retest loop.
4. **ANY verdict `CONCERNS`** → `combined_verdict = NEEDS WORK`, concerns logged to `build-log.md` for later triage.
5. **Follow-up spawned AND `follow_up.confirmed: true`** → treat the parent chapter's verdict as if it were `BLOCK` (since the follow-up confirmed the concern).
6. **Contradictions between chapters on typed fields** → `combined_verdict = BLOCKED` with the specific finding `cross-chapter contradiction: {field} differs between {chapter_a} and {chapter_b}`.

Rule 6 detects cross-chapter conflicts mechanically on typed fields only — no chapter reads another's draft, preserving fresh-context independence.

### Step 3: BLOCK routing via `decisions.jsonl` `decided_by` lookup

When the Aggregator determines `combined_verdict = BLOCKED` or `NEEDS WORK` via a BLOCK finding, it MUST NOT stop and wait. Instead:

1. For each BLOCK finding in the aggregated output, read the `related_decision_id` field on the finding.
2. Read `docs/plans/decisions.jsonl` and find the row with that `decision_id`.
3. Read the `decided_by` field — this is the phase that authored the original decision (e.g., `architect` or `design-brand-guardian`). Cross-reference with the `phase` field on the row to disambiguate between phases that share a `decided_by` value.
4. Route the finding BACKWARD to that phase as re-entry input. The build resumes at that phase with the BLOCK finding as a correction signal.

If no `related_decision_id` is present on the finding (legacy finding, or a non-decision-backed issue such as a runtime crash or a fresh test failure), fall back to the legacy routing: classify by severity and route to Phase 4 (code-level) or Phase 2 (structural) per Step 4 below.

This replaces "BLOCKED → return to failing step" with author-aware re-entry — a BLOCK on an auth model flaw routes to the Phase 2 architecture synthesizer who authored the decision, not the Phase 4 implementer.

### Step 4: Classification for NEEDS WORK findings

For any NEEDS WORK findings that did not carry a `related_decision_id` (and therefore fell through Step 3's `decided_by` lookup), the Aggregator applies the existing legacy classification:

- **code-level** findings (test failure, runtime error, lint/type error, per-file bug) → route to Phase 4 target task.
- **structural** findings (architectural mismatch, API contract violation, persistence model error, DNA drift at the component-library layer) → route to Phase 2 or Phase 3 per the finding's domain.
- **CONCERNS** entries (no BLOCK) → logged to `build-log.md` for triage, do not block launch on their own.

### Step 5: READY handoff

If Step 2 resolves to `combined_verdict = PRODUCTION READY`, the Aggregator writes `docs/plans/evidence/lrr-aggregate.json` with the combined verdict, per-chapter summaries, and forwards to Phase 7 (Launch). No backward routing is triggered — the build moves forward.

## File paths

- Chapter verdicts: `docs/plans/evidence/lrr/{eng-quality,security,sre,a11y,brand-guardian}.json`
- Aggregator output: `docs/plans/evidence/lrr-aggregate.json`

## Token budget

~12-17K tokens per LRR cycle, net of PM fold-in: five chapter dispatches at 2-3K each, plus the nested `pr-test-analyzer` sub-dispatch inside Eng-Quality at ~1.5-2K, plus one aggregator at 1-2K. The Aggregator runs exactly once per cycle.


## Design Notes (non-operational)

### Rationale: single-verdict failure mode

The current Reality Checker collapses code quality, security, reliability, accessibility, and product completeness into a single verdict from a single agent — the exact failure mode matrix organizations exist to prevent. Independence matters most for Security and SRE: production incidents from those chapters are asymmetric in consequence — a security finding that goes unchallenged is a breach; a reliability finding is an outage. That asymmetry justifies the extra dispatch power and the pessimistic-block fallback.

### Structural shifts from the prior 5-chapter panel

- **Eng and QA merged into Eng-Quality.** More than half of their evidence overlapped (tests, verify outputs, task-level quality signals), and two nearly-identical verdicts produced two-thirds the signal of one coherent view.
- **A11y is a new seat.** The WCAG gap was the biggest coverage hole in the prior panel — a mechanical contrast field on the old Design chapter is not a runtime accessibility check.
- **Brand Guardian replaces the Design mechanical check.** The prior Design chapter was a 15-line threshold on a Phase 3 metric score — theater, not judgment.

### Why each chapter cannot be folded

- **Eng-Quality:** Merged from the previous Eng+QA chapters because >50% of their evidence overlapped, which produced two near-identical verdicts instead of one stronger one.
- **Security:** Production breach risk is asymmetric, so an independent chapter runs fresh-context against security evidence with the power to veto launch outright.
- **SRE:** Now explicitly reads Performance Benchmarker evidence (previously unclear which chapter owned perf NFRs), plus reliability checks and NFR thresholds from `sprint-tasks.md`.
- **A11y:** The prior Design chapter had a mechanical contrast check and nothing runtime. A11y reads the Phase 5 runtime accessibility sweep and the Phase 3.7 design review, and gates on Critical/Serious finding counts.
- **Brand Guardian:** Reads the locked DNA card + rendered screenshots + visual design spec + design references, and judges drift from the DNA. Taste judgment, not checklist theater.

### Rule 6 — anchoring cost rationale

A naive matrix-org design would have Security read Eng-Quality's draft to catch disagreements — that reintroduces the exact anchoring bias that fresh-context-per-chapter is designed to prevent (Madaan et al. Self-Refine; Gou et al. CRITIC). Instead, the aggregator does the cross-chapter check mechanically on typed fields only. Typed fields are mechanically diffable; free-form findings prose is not — and the prose is where the anchoring bias would come from.

### Why under `evidence/`

The existing evidence manifest sweep picks up anything under `docs/plans/evidence/` for free, and these files ARE evidence — typed attestations from independent chapters. Putting them elsewhere would create a second manifest path the aggregator has to know about separately.
