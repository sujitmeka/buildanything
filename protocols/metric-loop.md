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

## Step 1: MEASURE

Call the Agent tool — description: "Measure [metric]" — prompt:

"[How to measure, from your metric definition]. Score the current state 0-100. Return your response with a clear SCORE: [number] line, a list of FINDINGS, and the single TOP ISSUE most likely to improve the score if fixed."

Read the agent's response. You need: the SCORE, the TOP ISSUE, and the file paths for diagnosis in Step 3. Record the score to `docs/plans/.build-state.md`. The full findings list is useful for diagnosis but does NOT need to persist in your context across iterations — once you've picked the top issue, the details of lower-priority findings can go. Append a row to the score log in `docs/plans/.build-state.md`:

| Iter | Score | Delta | Top Issue | Files |
|------|-------|-------|-----------|-------|

## Step 2: CHECK EXIT

Stop the loop if ANY of these:

- **Score >= target** → done. Log "Target met at iteration [N]."
- **Iteration >= max** → done. Log "Max iterations reached. Final score: [N]."
- **Stall: last 2 scores show no improvement** (delta <= 0 twice in a row) → done. Log "Stalled at score [N]."

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
