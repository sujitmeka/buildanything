# Eval Harness Protocol

You are the orchestrator. Phase 6.1 audits are complete. Before running the metric loop, define formal eval cases that are concrete, executable, and reproducible. This replaces subjective narrative audits with deterministic pass/fail tests.

## How This Differs from the Metric Loop

The metric loop answers "how good is this?" (qualitative score 0-100, iterative improvement).
The eval harness answers "does this specific behavior work reliably?" (binary pass/fail, deterministic).

They are complementary: eval harness failures become specific issues for the metric loop to fix.

## Step 0: Define Eval Cases

YOU (the orchestrator) define eval cases based on:
- Audit findings from Phase 6.1 (highest-severity items first)
- Architecture doc (API contracts, auth model, data validation rules)
- Design doc (core user flows, edge cases)

Write eval cases to `docs/plans/.build-state.md` under `## Eval Harness`:

| # | Name | Action | Expected Result | pass@k | Severity |
|---|------|--------|-----------------|--------|----------|

**Severity thresholds (non-negotiable):**
- CRITICAL: pass@5 (must pass 5/5 — 100% reliability)
- HIGH: pass@4 (must pass 4/5 — 80% reliability)
- MEDIUM: pass@3 (must pass 3/5 — 60% reliability)

Aim for 8-15 eval cases. Cover: auth boundaries, input validation, error handling, core happy path, primary edge cases.

**Eval cases must be concrete and executable** — actual commands (curl, function calls, UI interactions), not descriptions. Bad: "Auth should work." Good: "curl -X GET /api/recipes without Authorization header → expect 401."

## Step 1: Run Eval

Call the Agent tool — description: "Run eval harness" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: M] Run these eval cases. For each case, execute the action the specified number of times (k). Report per case: PASS (N/k passed, meets threshold) or FAIL (N/k passed, below threshold). Include the actual result on failures. [paste eval case table]"

<HARD-GATE>
The eval agent RUNS cases. It does NOT define them. Case definition is the orchestrator's job.
</HARD-GATE>

## Step 2: Score

Count PASS cases / total cases. This is the eval baseline. Record to `docs/plans/.build-state.md`.

## Step 3: Feed into Metric Loop

Any FAIL case with severity CRITICAL or HIGH becomes a candidate issue for the Phase 6.2 metric loop. Pass the failure details (case name, action, expected vs actual) as context when defining the metric loop's metric.

## Step 4: Re-evaluate After Metric Loop

After the Phase 6.2 metric loop exits, re-run the eval harness. All CRITICAL cases must now pass. If any CRITICAL case still fails, flag it for the Reality Checker in Step 6.3.

---

## Rules

- Eval cases are defined by the ORCHESTRATOR, not by the eval agent.
- pass@k thresholds are non-negotiable per severity level.
- Re-run eval after metric loop to verify fixes — this is the exit gate.
- Eval failures feed into the metric loop as specific, concrete issues — not vague audit findings.
