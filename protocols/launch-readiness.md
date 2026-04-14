# Launch Readiness Review Protocol

You are the orchestrator. You are about to run a Launch Readiness Review (LRR) — a multi-chapter, independent-verdict gate that sits between the Phase 6 Reality Check and Phase 7.

## Purpose

LRR replaces the monolithic Reality Checker verdict authority with five independent chapter verdicts plus a mechanical aggregator. The current Reality Checker collapses code quality, security, reliability, accessibility, and product completeness into a single verdict from a single agent — the exact failure mode matrix organizations exist to prevent. LRR splits that authority into Eng, QA, Sec, SRE, and Design chapters, each running fresh-context with its own evidence slice. Independence matters most for Sec and SRE: production incidents from those chapters are asymmetric in consequence — a security finding that goes unchallenged is a breach; a reliability finding is an outage. That asymmetry justifies the extra dispatch power and the pessimistic-block fallback, neither of which apply to Eng or QA.

## Chapters

LRR runs **five chapters**: Eng, QA, Sec, SRE, and Design.

PM is **not** a separate LRR dispatch. The existing `commands/build.md` Step 7.0b Requirements Coverage Report already reads Design Doc + sprint-tasks MVP scope and produces COVERED/PARTIAL/MISSING — it IS a PM verdict in everything but name. Step 7.0b's output is renamed to `docs/plans/evidence/lrr/pm.json` so the aggregator reads it uniformly alongside the five dispatched chapters.

### Primary evidence inputs

| Chapter | Primary evidence inputs |
|---|---|
| Eng | `architecture.md`, `task-outputs/`, `verify.md` check outputs, test results |
| QA | `evidence/e2e/iter-3-results.json`, smoke-test `evidence/`, behavioral-test stub detector output |
| Sec | `evidence/fake-data-audit.md`, security section of Step 6.1 5-agent audit, eval-harness security cases |
| SRE | performance-audit outputs, NFRs from `sprint-tasks.md`, reliability checks |
| Design | `docs/plans/visual-design-spec.md` (verify exists via Glob first), Phase 3 metric loop final score from `.build-state.json`, Playwright screenshots in `docs/plans/evidence/` matching design routes, living style guide path from visual-design-spec.md |

### Why each chapter cannot be folded

- **Eng:** Code-quality and test-coverage judgment; no existing dedicated independent agent.
- **QA:** Behavioral verdict today is mechanical; QA chapter does the judgment call on test adequacy.
- **Sec:** Step 6.1's 5-agent audit produces a security section, but it gets synthesized into a metric score — independent Sec veto is lost today.
- **SRE:** NFR thresholds are passed to audit agents, but no agent independently says "this is production-ready under load."
- **Design:** Craft judgment on visual/UX decisions that metric scores alone can't verify.

## Chapter verdict schema

Each chapter agent runs fresh-context, reads its own slice of the evidence manifest, and writes a verdict file with this shape:

```json
{
  "chapter": "eng|qa|sec|sre|pm|design",
  "verdict": "PASS | CONCERNS | BLOCK",
  "override_blocks_launch": false,
  "evidence_files_read": ["docs/plans/evidence/..."],
  "findings": [
    {"severity": "block|concern|info", "description": "...", "evidence_ref": "path"}
  ],
  "follow_up_spawned": false,
  "follow_up_findings": null
}
```

<HARD-GATE>
SCHEMA CONTRACT:

- `verdict` MUST be one of `PASS | CONCERNS | BLOCK`. `CONCERNS` means "I have concerns but won't block" and is aggregated as NEEDS WORK. `BLOCK` means "this fails my chapter's criteria" and is aggregated as NEEDS WORK unless `override_blocks_launch: true`.
- `override_blocks_launch: true` is a veto-of-vetoes — no other chapter's PASS can override it. Only legal when `verdict == BLOCK`.
- `evidence_files_read` MUST be non-empty. A verdict file with empty `evidence_files_read` is treated as malformed. "Looks good to me" verdicts are not permitted.
- `follow_up_spawned` is only legal for the Sec and SRE chapters.
</HARD-GATE>

## Design chapter rules

The Design chapter is scored mechanically against three signals: spec existence, Phase 3 metric loop final score, and screenshot evidence from Phase 3 visual QA.

- **PASS** if: `docs/plans/visual-design-spec.md` exists AND Phase 3 metric loop final score >= 80 AND at least one Playwright screenshot exists from Phase 3 visual QA.
- **CONCERNS** if: `visual-design-spec.md` exists BUT score is 65-79, OR screenshot count is 0 despite spec existing.
- **BLOCK** if: `visual-design-spec.md` missing OR Phase 3 final score < 65.

Note: This Design chapter is a provisional implementation. A future iteration may replace it with a Taste-Keeper final-surface pass (see `docs/plans/debate-round2/round2/phase3-resolution.md` if that gets built), which would write the same `lrr/design.json` verdict file with the same schema.

## Follow-up investigation flow (Sec and SRE only)

Sec and SRE — and only these chapters — may spawn one read-only follow-up investigation per LRR round. Eng and QA with concerns write a CONCERNS verdict and rely on the existing NEEDS_WORK loop.

```
Sec/SRE chapter agent runs → reads evidence manifest + 2-3 targeted files
  |
  If verdict = PASS or CONCERNS → write lrr/{chapter}.json, done (1 dispatch)
  |
  If verdict = BLOCK or "suspicious, need to verify" → CAN spawn ONE follow-up
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
- **Read-only.** Allowed tools: Read, Grep, Glob. No Write, no Edit, no Bash write ops. If the follow-up finds a real fix, it documents it — the fix is executed in a separate Phase 6.4 NEEDS_WORK cycle, never inline.
- **15 tool call cap, self-reported via `tool_calls_used`.** Parent chapter validates `tool_calls_used <= 15` before accepting the follow-up output.
- **Only Sec and SRE have the power.** Eng and QA chapters with concerns write a CONCERNS verdict; they do not spawn follow-ups.
</HARD-GATE>

## Fallback on malformed or timed-out follow-up

<HARD-GATE>
DEFAULT: HARD BLOCK WITH `override_blocks_launch: true`.

If a Sec/SRE follow-up times out, returns invalid JSON, or reports `tool_calls_used > 15`, the parent chapter writes:

```json
{
  "chapter": "sec|sre",
  "verdict": "BLOCK",
  "reason": "follow_up_malformed",
  "override_blocks_launch": true,
  "detail": "Follow-up returned {timeout|invalid_json|cap_violation} — cannot verify security/reliability claim, blocking per pessimistic default"
}
```

A security or reliability check that cannot produce a typed result is itself a signal — pessimistic-block is the only safe default. You cannot ship a build whose security check is unverifiable.
</HARD-GATE>

## LRR Aggregator

The Reality Checker keeps its evidence-manifest sweep role but its verdict generation is replaced by LRR aggregation. It reads all verdict files under `docs/plans/evidence/lrr/`, then applies these six aggregation rules:

1. **ANY `override_blocks_launch: true`** → `combined_verdict = BLOCKED`, regardless of other verdicts. This is the veto-of-vetoes rule.
2. **ALL verdicts `PASS` AND zero follow-ups spawned** → `combined_verdict = PRODUCTION READY`.
3. **ANY verdict `BLOCK` with `override_blocks_launch: false`** → `combined_verdict = NEEDS WORK`, with that chapter's findings routed into the existing fix-and-retest loop.
4. **ANY verdict `CONCERNS`** → `combined_verdict = NEEDS WORK`, concerns logged to `build-log.md` for later triage.
5. **Follow-up spawned AND `follow_up.confirmed: true`** → treat the parent chapter's verdict as if it were `BLOCK` (since the follow-up confirmed the concern).
6. **Contradictions between chapters on typed fields** → `combined_verdict = BLOCKED` with the specific finding "cross-chapter contradiction: {field} differs between {chapter_a} and {chapter_b}".

### Rule 6 — cross-chapter detection without anchoring cost

Rule 6 is the load-bearing mechanism that gives us cross-chapter conflict detection **without the anchoring cost of cross-chapter review**. A naive matrix-org design would have Sec read QA's draft to catch disagreements — that reintroduces the exact anchoring bias that fresh-context-per-chapter is designed to prevent (Madaan et al. Self-Refine; Gou et al. CRITIC). Instead, the aggregator does the cross-chapter check mechanically on typed fields only. If Eng's verdict says `tests_passing: true` and QA's verdict says `tests_passing: false`, that is a structured contradiction the aggregator can detect without either chapter reading the other's draft. Typed fields are mechanically diffable; free-form findings prose is not — and the prose is where the anchoring bias would come from. This gives us independent fresh-context judgment plus cross-chapter conflict detection.

## File paths

- Chapter verdicts: `docs/plans/evidence/lrr/{eng,qa,sec,sre,pm,design}.json`
- Aggregator output: `docs/plans/evidence/lrr-aggregate.json`

Why under `evidence/`: the existing evidence manifest sweep picks up anything under `docs/plans/evidence/` for free, and these files ARE evidence — typed attestations from independent chapters. Putting them elsewhere would create a second manifest path the aggregator has to know about separately.

## Token budget

~8-12K tokens per LRR cycle: four-to-five chapter dispatches at 2-3K each, plus one aggregator at 1-2K. Cheaper than the current monolithic Reality Checker in most runs.

## Contingency clause

If a future iteration replaces the Design chapter with a Phase 3 Taste-Keeper final-surface pass, the aggregator is unchanged — it reads whichever `lrr/design.json` file exists under `docs/plans/evidence/lrr/`. The schema is identical, the aggregation rules are identical, and the chapter count is identical. The design is robust to either implementation.
