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
| Iter | Score | Delta | Action |
|------|-------|-------|--------|
```

## Step 1: MEASURE

Call the Agent tool — description: "Measure [metric]" — prompt:

"[How to measure, from your metric definition]. Score the current state 0-100. Return your response with a clear SCORE: [number] line, a list of FINDINGS, and the single TOP ISSUE most likely to improve the score if fixed."

Record the score and findings. Append a row to the score log in `.build-state.md`.

## Step 2: CHECK EXIT

Stop the loop if ANY of these:

- **Score >= target** → done. Log "Target met at iteration [N]."
- **Iteration >= max** → done. Log "Max iterations reached. Final score: [N]."
- **Stall: last 2 scores show no improvement** (delta <= 0 twice in a row) → done. Log "Stalled at score [N]."

On stall or max iterations:
- **Interactive mode:** present score history + top remaining issue to user. Ask for direction.
- **Autonomous mode:** if score >= 60% of target, accept with warning. Otherwise skip. Log to `docs/plans/build-log.md`.

If not exiting, continue to Step 3.

## Step 3: DIAGNOSE

Look at the findings from Step 1. Pick the ONE highest-impact issue — the single fix most likely to move the score. Do not try to fix everything at once. This is the autoresearch insight: one targeted change per iteration, measured impact.

## Step 4: IMPROVE

Call the Agent tool — description: "Fix [top issue]" — mode: "bypassPermissions" — prompt:

"TARGETED FIX: [specific issue to fix, from diagnosis]. CONTEXT: [relevant architecture/criteria]. Make this specific change. Do not refactor unrelated code. Commit: 'fix: [description]'."

## Step 5: LOOP

Return to Step 1. Re-measure the artifact after the fix.

---

## Rules

- The measurement agent and the fix agent MUST be separate Agent tool calls. No grading your own homework.
- One fix per iteration. Measure its impact before fixing the next thing.
- Track ALL scores in `.build-state.md` so the history survives context compaction.
- If context was compacted mid-loop: read `.build-state.md`, find the Active Metric Loop section, resume from the last recorded iteration.
