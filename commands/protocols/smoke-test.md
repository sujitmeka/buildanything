# Smoke Test Protocol (Behavioral Verification via agent-browser)

You are the orchestrator. You are about to verify that a completed task actually works in a browser by interacting with it and collecting machine-readable evidence.

## When to Run

After a UI-affecting task passes the Verification Protocol. Skip for non-UI tasks (API-only, config, infrastructure, CLI tools). If the task has no behavioral acceptance criteria or no affected page/route, skip.

## Inputs

- **Acceptance criteria**: the task's behavioral acceptance criteria (e.g., "clicking Submit saves the form and shows a success toast").
- **Affected route**: the page or route to test (e.g., `/settings`).

## Step 0: Preflight

Check that `agent-browser` is available:

```
which agent-browser
```

If not installed, log "SMOKE: SKIPPED -- agent-browser not available" to `docs/plans/.build-state.md` and return. Do not block the build.

## Step 1: Start Dev Server

Detect the dev script from `package.json` (`dev`, `start`, or `serve`). If the server is already running on the expected port, skip. Otherwise start it in the background and wait for the port to be listening.

## Step 2: Capture Baseline

```
agent-browser open http://localhost:[port]/[affected-route]
agent-browser wait --load networkidle
agent-browser snapshot -i
```

Save the snapshot output as the "before" state. This is your baseline for diffing.

## Step 3: Execute Acceptance Criteria

For EACH behavioral acceptance criterion, sequentially:

1. **Interact** -- execute the required action (`agent-browser click`, `fill`, `select`, `press`, etc.).
2. **Diff** -- `agent-browser diff snapshot`. If the diff is empty after an interaction that should change the DOM, the feature is broken. Mark criterion FAIL.
3. **Wait for outcome** -- `agent-browser wait --text "expected outcome"` with a 10s timeout. Timeout means FAIL.
4. **Check network** -- `agent-browser network requests --status 4xx,5xx`. Any failed API call related to this criterion means FAIL.

After each page navigation, re-snapshot. Element refs (`@e1`, `@e2`, etc.) invalidate on navigation.

## Step 4: Collect Evidence

After all criteria are tested:

```
agent-browser errors
agent-browser screenshot --annotate
agent-browser network har stop
```

Save all evidence to `docs/plans/evidence/[task-name]/`:

| File | Content | Format |
|------|---------|--------|
| `before.snapshot.txt` | Baseline DOM snapshot | text |
| `after.snapshot.txt` | Final DOM snapshot | text |
| `screenshot.png` | Annotated screenshot of final state | image |
| `errors.txt` | Uncaught JS exceptions | text |
| `session.har` | Full network trace | HAR |

Start HAR capture (`agent-browser network har start`) at Step 2 and stop at Step 4. The HAR file is saved for Phase 6.2d fake data analysis -- do not parse it here.

## Step 5: Verdict

**PASS**: all criteria verified, zero uncaught exceptions, zero failed API calls. Log "SMOKE: PASS" to `docs/plans/.build-state.md`. Close the browser.

**FAIL**: spawn a fix agent with this prompt:

"Fix smoke test failure for [task-name]. EXPECTED: [criterion text]. ACTUAL: [what happened -- empty diff / timeout / network error]. Evidence: [annotated screenshot path], [snapshot diff], [error log], [failed network requests]. Fix the implementation to match the expected behavior."

After the fix agent completes, re-run from Step 2.

<HARD-GATE>
MAX 2 RETRY CYCLES: smoke -> fix -> re-smoke -> fix -> re-smoke. If still failing after 2 fix attempts:
- **Interactive mode:** present evidence to the user. Include the annotated screenshot, snapshot diff, and error log.
- **Autonomous mode:** log "SMOKE: FAILED after 2 retries" to `docs/plans/build-log.md` and proceed with a warning.
Do not loop further.
</HARD-GATE>

## Rules

- Use `agent-browser` CLI commands only. Not Playwright MCP, not Playwright directly.
- Evidence is for the agent, not humans. No video recording, no dashboards.
- Element refs (`@e1`, `@e2`) invalidate on every page change. Re-snapshot after any navigation.
- One criterion at a time. Measure each interaction's impact before moving to the next.
- HAR file is for downstream analysis (Phase 6.2d). This protocol does not parse it.
- `agent-browser close` before returning, regardless of pass/fail.
