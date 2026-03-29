# Fake Data Detector Protocol

You are the orchestrator. Phase 6.2d detects mock, fake, or hardcoded data masquerading as real functionality. This catches projects that look complete but run on canned responses, simulated delays, or placeholder content.

## When to Run

Run as a single agent in Phase 6.2d, after the eval harness and metric loop. CRITICAL findings block the Reality Checker in Step 6.3.

## Step 1: Static Analysis

Call the Agent tool — description: "Detect fake data (static)" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: M] Grep the codebase for fake data patterns. Exclude test files (`**/*.test.*`, `**/*.spec.*`, `__tests__/`), seed files (`**/seed*`, `**/migrate*`), Storybook (`**/*.stories.*`), and `.env.example`. For each match, report file:line, the pattern matched, and why it is suspicious. Patterns to check:

1. `Math.random()` generating business data (prices, scores, metrics) — ignore ID/key generation
2. Hardcoded arrays/objects posing as API responses (e.g., `const users = [{id: 1, name: "John"...}]` in production source)
3. `setTimeout`/`setInterval` faking async operations (simulating streaming, polling, or delays that should be real network calls)
4. Strings: 'lorem ipsum', 'placeholder', 'sample data', 'test data' in production source
5. `console.log` faking real output (e.g., `console.log("Trade executed: +$500")`)
6. Fetch/axios calls to `localhost` or hardcoded URLs that should be env vars
7. WebSocket connections that never process real data (`new WebSocket` with no `onmessage` handler or a handler that ignores the event)"

## Step 2: Dynamic Analysis (HAR Files)

Check `docs/plans/evidence/*/` for `.har` files from smoke tests. If none exist, skip to Step 3.

If HAR files exist, call the Agent tool — description: "Detect fake data (dynamic)" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: S] Parse HAR files in `docs/plans/evidence/*/`. Flag:

1. Zero external API calls during a full app exercise (everything served locally)
2. All API responses with identical structure and timing (cached/hardcoded)
3. No WebSocket frames when app claims to stream data
4. API calls returning 200 with identical response bodies across multiple requests"

## Step 3: Classify Findings

Assign severity to each finding:

| Severity | Criteria |
|----------|----------|
| CRITICAL | Production data is fake — business logic relies on `Math.random()`, hardcoded objects substitute for real API calls |
| HIGH | Mock data in production code path — simulated delays, placeholder strings in user-facing output |
| MEDIUM | Suspicious pattern — hardcoded localhost URLs, WebSocket stubs that may be development leftovers |

## Step 4: Report

Write findings to `docs/plans/.build-state.md` under `## Fake Data Detector`:

| # | File:Line | Pattern | Why Suspicious | Severity | Suggested Fix |
|---|-----------|---------|----------------|----------|---------------|

<HARD-GATE>
CRITICAL findings block the Reality Checker (Step 6.3). Do not proceed past Phase 6.2d until all CRITICAL findings are resolved or explicitly accepted by the user.
</HARD-GATE>

---

## Rules

- ONE agent for static checks, ONE agent for dynamic checks. Do not combine.
- If no HAR files exist, run static checks only. Do not fail the protocol for missing HAR files.
- Do NOT flag: seed/migration data, test fixtures, `.env.example`, Storybook demos, or explicit dev mock servers (MSW, json-server).
- Every finding must include a file:line reference. No vague "the codebase has fake data" reports.
