# Metric Loop Protocol

You are the orchestrator. You are about to run a metric-driven iteration loop on an artifact (code, architecture, docs, etc.) to drive it toward a quality target.

## Step 0: Define Your Metric

Before iterating, YOU define the metric for this specific context. Consider:
- What is the artifact? (a task implementation, a security audit, an architecture doc, etc.)
- What does "good" look like? (all tests pass, zero critical vulns, all acceptance criteria met, etc.)
- Is the metric quantitative (test pass rate, vuln count, coverage %) or qualitative (architecture completeness, doc clarity)?

Write a **Metric Definition** block to `docs/plans/.build-state.md`:

```
## Active Metric Loop
Phase: [current phase]
Artifact: [what you're iterating on]
Metric: [what you're measuring, in one sentence]
How to measure: [what the measurement agent should do — run tests, audit code, check criteria, etc.]
Target: [score 0-100 at which you stop]
Max iterations: [hard cap, default 5]
Scoring Criteria Checklist: [extracted in Step 0.5 — see .build-state.json]
Extraction method: [mechanical | one-shot-dispatch | mixed]
```

Then create a score log table:

```
| Iter | Score | Delta | Top Issue | Files |
|------|-------|-------|-----------|-------|
```

When starting a new metric loop, REPLACE the previous Active Metric Loop section (if any). There is only ever ONE active metric loop. Previous loop results should already be recorded in their phase's section above. When the loop completes (Step 2 exit), rename the section header from `## Active Metric Loop` to `## Completed Metric Loop — [Phase N]` and leave it for historical reference.

If you are in Phase 5, also record the current sub-step for the overall task cycle (not all of these are within the metric loop itself):
```
Sub-step: [5.1 Implement | 5.1b Cleanup | 5.2 Metric Loop | 5.3 Loop Exit | 5.4 Verify]
```
This tells the orchestrator exactly where to resume after context compaction.

## Step 0.5: Extract Scoring Criteria

Before the first measurement, extract a **Scoring Criteria Checklist** from the stable reference docs. This checklist is the critic's scoring input for every iteration — it replaces raw doc injection.

### Why

Reference docs (DNA cards, design specs, architecture docs, acceptance criteria) do not change during the loop. Pre-injecting them into every critic prompt wastes ~20-30K tokens per iteration. The checklist extracts the exact scoring values once and passes ~1-2K tokens instead.

### Extraction mechanism (per doc type)

Use the cheapest mechanism that preserves fidelity:

| Source doc type | Structure | Extraction mechanism | Cost |
|-----------------|-----------|---------------------|------|
| Structured (named fields with explicit values) — e.g., `DESIGN.md` YAML front matter (`colors`, `typography`, `components`) and `## Overview > ### Brand DNA` axes, `sprint-tasks.md` Behavioral Test field | YAML/markdown with named axes, fields, or sections | **Mechanical** — orchestrator parses and copies the values directly. No LLM reasoning. | ~0 tokens |
| Semi-structured (values spread across prose sections) — e.g., `visual-design-spec.md`, Phase 5 audit findings | Long-form with explicit values in multiple sections | **One-shot extractor dispatch** — single agent call reads the full doc once and outputs the structured checklist. | ~20-25K one-time |
| Unstructured (visual references, screenshots, mood boards) — e.g., `design-references.md` | Screenshot URLs, visual comps | **Not extracted.** Referenced by path in the checklist. Iteration 1 MAY read on-demand; iteration 2+ MUST NOT unless diagnosis explicitly flags a visual-reference gap. | 0 tokens |

**Rule: if the source doc has named fields with explicit values, extraction is mechanical (no dispatch). If values are spread across prose sections, use a one-shot extractor dispatch. Never use orchestrator LLM reasoning for extraction — it burns the tokens you're trying to save.**

### Persist the checklist

Write the checklist to `.build-state.json` under `active_metric_loop.scoring_criteria_checklist`. Record the extraction method in `active_metric_loop.extraction_method` (one of: `mechanical`, `one-shot-dispatch`, `mixed`). The rendered `.build-state.md` view reflects it automatically.

### Checklist format

```
Scoring Criteria Checklist
Source docs: [list of source doc paths]
Extracted at: [timestamp]
Extraction method: [mechanical | one-shot-dispatch | mixed]

[Structured criteria with exact values, organized by scoring dimension]

Reference Anchors:
- [path] (iteration 1 MAY read; iteration 2+ MUST NOT unless diagnosis flags gap)
```

The format is flexible — adapt it to the phase and artifact. The protocol gives a template, not a rigid schema. What matters: exact values, not summaries; organized by scoring dimension; reference anchors for unstructured docs.

## Step 1: MEASURE

Call the Agent tool — description: "Measure [metric]" — prompt:

"SCORING CRITERIA CHECKLIST: [paste the checklist from Step 0.5 — NOT the raw reference docs]. [How to measure, from your metric definition]. Score the current state 0-100 against the checklist criteria. Return your response with a clear SCORE: [number] line, a list of FINDINGS, and the single TOP ISSUE most likely to improve the score if fixed."

> **Pass the Scoring Criteria Checklist (from Step 0.5) to the measurement agent. Do NOT paste full reference docs into the prompt. The agent retains Read access for on-demand lookups if the checklist doesn't cover a specific detail, but the prompt must not pre-inject stable docs.**

Read the agent's response. You need: the SCORE, the TOP ISSUE, and the file paths for diagnosis in Step 3. Record the score to `docs/plans/.build-state.md`. The full findings list is useful for diagnosis but does NOT need to persist in your context across iterations — once you've picked the top issue, the details of lower-priority findings can go. Append a row to the score log in `docs/plans/.build-state.md`:

| Iter | Score | Delta | Top Issue | Files |
|------|-------|-------|-----------|-------|

## Step 2: CHECK EXIT

Stop the loop if ANY of these:

- **Score >= target** → done. Log "Target met at iteration [N]."
- **Iter-1 short-circuit: score >= target + 10 on the first measurement** → done. Log "Short-circuit at iteration 1. Score: [N]." and record `exit_reason: "short_circuit_iter1"` in the loop state.
- **Iteration >= max** → done. Log "Max iterations reached. Final score: [N]."
- **Stall: last 2 scores show no improvement** (delta <= 0 twice in a row) → done. Log "Stalled at score [N]."

### Early exit — iter-1 short-circuit
If the first measurement (iter-1) scores >= `target + 10`, exit the loop immediately and commit the iter-1 output. Log `exit_reason: "short_circuit_iter1"` in the loop state. The 10-point margin guards against measurement noise at the boundary; a genuinely excellent first pass does not need rework.

On stall or max iterations:
- **Interactive mode:** present score history + top remaining issue to user. Ask for direction.
- **Autonomous mode:**
  - If score >= target: done (this branch is already handled in Step 2's exit conditions; included here for completeness).
  - If score >= 60% of target AND no CRITICAL issues remain in the measurement: accept with WARNING. Log to `docs/plans/build-log.md` with the warning text and the score history. The orchestrator may proceed to the next phase, but the warning MUST be surfaced in the Phase 7 Completion Report's "Verification Gap" section.
  - If score < 60% of target OR any CRITICAL issue remains: HALT. Do NOT skip. Log "METRIC LOOP: BLOCKED" to `docs/plans/.build-state.md` with the score history and the unresolved issues. Either (a) re-dispatch the fix agent with the unresolved issues, OR (b) abort the build with a directive to the user. The orchestrator may NOT silently proceed past a metric loop that did not converge.

If not exiting, continue to Step 3.

## Step 3: DIAGNOSE

Look at the findings from Step 1. Pick the ONE highest-impact issue — the single fix most likely to move the score. Do not try to fix everything at once. This is the autoresearch insight: one targeted change per iteration, measured impact.

## Step 4: IMPROVE

Call the Agent tool — description: "Fix [top issue]" — mode: "bypassPermissions" — prompt:

"TARGETED FIX: [specific issue to fix, from diagnosis]. CONTEXT: [relevant architecture/criteria]. Make this specific change. Do not refactor unrelated code. Commit: 'fix: [description]'."

> **Do NOT pass the measurement agent's full findings to this agent. Only pass the single diagnosed issue and relevant file paths.**

### Iteration-aware context rule

- **Iteration 1 generator** receives the full phase context header + task description (the generator needs full context for its first pass).
- **Iteration 2+ generator** receives ONLY: (a) the single top issue from diagnosis, (b) the relevant file paths, (c) the specific criteria values from the Scoring Criteria Checklist that relate to the top issue. The full `[CONTEXT header above]` preamble is NOT re-injected. The generator already has the codebase from iteration 1 — it only needs the delta.

## Step 5: LOOP

Return to Step 1. Re-measure the artifact after the fix.

---

## Rules

<HARD-GATE>
AUTHOR-BIAS ELIMINATION: The measurement agent and the fix agent must NEVER share context.
- They MUST be separate Agent tool calls (separate subprocesses, separate context windows).
- The fix agent receives ONLY: (a) the single top issue diagnosed in Step 3, (b) the relevant file paths, (c) the acceptance criteria. It does NOT receive the measurement agent's full findings, score breakdown, or other issues.
- The measurement agent in the next iteration does NOT know what the fix agent did — it measures the artifact fresh.
</HARD-GATE>
- One fix per iteration. Measure its impact before fixing the next thing.
- Track ALL scores in `docs/plans/.build-state.md` so the history survives context compaction.
- If context was compacted mid-loop: read `docs/plans/.build-state.md`, find the Active Metric Loop section, resume from the last recorded iteration.
- CONTEXT HYGIENE: Measurement agents are analysis agents — read their full output for diagnosis. But once you've picked the top issue (Step 3) and dispatched the fix (Step 4), the detailed findings from THAT iteration are spent. Don't accumulate findings across iterations — each measurement is fresh.
<STABLE-CONTEXT-RULE>
STABLE CONTEXT RULE: Reference docs that do not change during the loop (design specs, DNA cards, architecture docs, acceptance criteria) MUST be extracted into the Scoring Criteria Checklist at Step 0.5 and passed as the checklist — never re-injected as raw content into iteration 2+ prompts. Fresh artifacts (screenshots, test results, rendered output) are fetched each iteration. This is the primary token-saving mechanism: ~1-2K checklist vs ~20-30K raw docs per iteration.
</STABLE-CONTEXT-RULE>
- CHECKLIST FALLBACK: If no Scoring Criteria Checklist is provided (Step 0.5 was skipped or caller did not pass one), the critic falls back to raw doc reads. The orchestrator MUST log a WARN to `docs/plans/build-log.md`: "Metric loop iteration [N]: no scoring criteria checklist provided, falling back to raw doc reads." Callers SHOULD always provide a checklist. New callers that omit it will trigger the WARN, making silent regressions visible.
