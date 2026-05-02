# iOS Fake Data Detector Protocol

You are the orchestrator. Phase 6.2d detects mock, fake, or hardcoded data masquerading as real functionality in iOS/Swift projects. This catches apps that look complete but run on canned responses, simulated delays, or placeholder content.

## When to Run

Run as a single agent in Phase 6.2d, after the eval harness and metric loop. CRITICAL findings block the Reality Checker in Step 6.3.

## Step 1: Static Analysis

Call the Agent tool — description: "Detect fake data (static, iOS)" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: M] Grep the codebase for fake data patterns. Exclude test targets (`*Tests/`, `*UITests/`), `#Preview` blocks (data defined AND consumed within the block), seed/fixture files (`**/Fixtures/`, `**/Seeds/`), `.xcconfig` files, and `Package.swift`. For each match, report file:line, the pattern matched, and why it is suspicious. Patterns to check:

1. `UUID()` generating business data IDs (prices, orders, transactions) — ignore SwiftUI view identity or test helpers
2. Hardcoded arrays/dictionaries posing as API responses (e.g., `let users = [User(name: "John"...)]` in production source, not inside `#Preview`)
3. `Task.sleep` / `Thread.sleep` faking async operations (simulating network latency or streaming that should be real API calls)
4. Strings: 'Lorem ipsum', 'placeholder', 'sample data', 'test data', 'TODO', 'FIXME' in user-facing `Text()`, `Label()`, `.navigationTitle()`, or `LocalizedStringKey`
5. `print()` / `debugPrint()` faking real output (e.g., `print("Order placed successfully")`) — ignore `#if DEBUG` guarded prints
6. Hardcoded URLs (`"https://..."`, `"http://..."`) not sourced from `Info.plist`, `.xcconfig`, `ProcessInfo.processInfo.environment`, or a config enum/struct
7. `#Preview` sample data leaking into production — data factories or static properties defined inside `#Preview` that are also referenced by production views or view models
8. Mock `URLSession` / `URLProtocol` subclasses included in the main app target (not test targets)
9. Hardcoded JSON strings as API response stubs (e.g., multi-line string literals containing `{` with key-value pairs used in `JSONDecoder().decode`)
10. `UserDefaults` storing structured domain data (arrays of models, user profiles, transaction history) that should live in SwiftData / CloudKit / a proper persistence layer"

## Step 2: Dynamic Analysis (Instruments / Network Trace)

Check `docs/plans/evidence/*/` for `.trace` or network capture files from Maestro/smoke tests. If none exist, skip to Step 3.

If trace files exist, call the Agent tool — description: "Detect fake data (dynamic, iOS)" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: S] Parse trace/network capture files in `docs/plans/evidence/*/`. Flag:

1. Zero external API calls during a full app exercise (all data local or hardcoded)
2. Identical response bodies across different endpoint calls
3. No error handling paths exercised (no non-200 status codes observed, no alert/error UI triggered)"

## Step 3: Classify Findings

| Severity | Criteria |
|----------|----------|
| CRITICAL | Production code using hardcoded data that should come from an API — business logic relies on `UUID()` for real IDs, hardcoded arrays substitute for real API responses |
| HIGH | Mock networking left in release target — `URLProtocol` subclass in main target, simulated delays via `Task.sleep` |
| MEDIUM | Placeholder strings in user-facing UI — 'Lorem ipsum' in `Text()`, 'TODO' in navigation titles |
| LOW | Debug prints in production code — `print()` / `debugPrint()` outside `#if DEBUG` |

## Step 4: Report

Write findings to `docs/plans/evidence/fake-data-audit.md`:

| # | File:Line | Pattern | Why Suspicious | Severity | Suggested Fix |
|---|-----------|---------|----------------|----------|---------------|

<HARD-GATE>
CRITICAL findings route through the Feedback Synthesizer (Step 5.4) and Fix loop (Step 5.5) — they do NOT block inline. The synthesizer classifies and routes them like all other finding streams.
</HARD-GATE>

---

## Rules

- ONE agent for static checks, ONE agent for dynamic checks. Do not combine.
- If no trace files exist, run static checks only. Do not fail the protocol for missing traces.
- Do NOT flag: test target code, data defined and consumed entirely within `#Preview`, seed/fixture data, `.xcconfig` values, `Package.swift` dependencies, or explicit dev mock servers behind `#if DEBUG` / compile-time flags.
- Every finding must include a file:line reference. No vague "the codebase has fake data" reports.
