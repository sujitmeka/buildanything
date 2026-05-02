# Verification Protocol

You are the orchestrator. You are about to run a deterministic verification gate — a fast, sequential pass/fail check that catches regressions before expensive audit agents run.

## When to Run

Run this protocol at every phase boundary: after scaffolding, after each task, before final review. It is cheap. Run it often.

## Step 1: Detect Stack

Before running checks, detect the project's stack from manifest files:

| Manifest | Stack | Build | Types | Lint | Test | Security |
|----------|-------|-------|-------|------|------|----------|
| `package.json` | Node | `npm run build` | `npx tsc --noEmit` | `npm run lint` | `npm test` | `npm audit` |
| `requirements.txt` / `pyproject.toml` | Python | — | `mypy .` | `ruff check .` | `pytest` | `pip audit` |
| `go.mod` | Go | `go build ./...` | (included in build) | `golangci-lint run` | `go test ./...` | `govulncheck ./...` |
| `Cargo.toml` | Rust | `cargo build` | (included in build) | `cargo clippy` | `cargo test` | `cargo audit` |

Behavioral check: if `tests/e2e/acceptance/` exists, run `npx playwright test tests/e2e/acceptance/ --reporter=list`. If agent-browser is available, also run `agent-browser errors` to check for runtime exceptions.

A check **does not apply** when the project structurally cannot run it (e.g., Type-Check on JavaScript without TypeScript, Build on a pure Python script, Behavioral on a project with no `tests/e2e/acceptance/` AND no `cap*Tests/` AND no test directory anywhere). A check that does not apply is logged as `N/A — [reason]`, NOT as PASS.

A check that **applies but the tooling is missing** (e.g., npm test on a project with package.json but no `test` script defined, xcodebuild test on an iOS project with no test target) is **NOT skipped**. It is logged as BLOCKED and the orchestrator dispatches a fix agent to make it runnable, MAX 2 attempts, before failing the verification.

`PASS` requires *successful execution*, not absence of execution. A check that did not run is never PASS.

## Step 2: Run Checks Sequentially

Call the Agent tool — description: "Verify [phase name]" — mode: "bypassPermissions" — prompt:

"Run the Verification Protocol. Execute all 7 checks sequentially, stop on first failure. Report: VERIFY: PASS (7/7) or VERIFY: FAIL at step [N] — [check name]: [reason]."

The agent runs these checks in order, stopping on the first FAIL:

| # | Check | What it does |
|---|-------|-------------|
| 1 | Build | Project compiles/bundles without errors |
| 2 | Type-Check | No type errors (tsc, mypy, etc.) |
| 3 | Lint | No lint violations |
| 4 | Test | All tests pass |
| 5 | Security | No known vulnerabilities in deps |
| 6 | Diff Review | `git diff` of uncommitted changes — no debug code, no secrets, no obvious regressions |
| 7 | Behavioral | Acceptance tests pass against running app. Verify the test directory matches the project mode: web requires `tests/e2e/acceptance/`, iOS requires `cap*Tests/` or named test target with non-stub bodies (per `protocols/verify.md` Step 2 stub detector). If no test directory exists in either path AND `sprint-tasks.md` has any non-N/A Behavioral Test fields, FAIL with directive: "Behavioral Test fields are declared but no test directory exists. Either implement the tests or downgrade the fields to N/A." |

<HARD-GATE>
ONE AGENT, ONE PASS: The orchestrator spawns exactly ONE agent for the entire verification. This is a single Agent tool call, not 6 separate agents. The agent runs each check as a sequential shell command and evaluates the result before proceeding.
</HARD-GATE>

**Scope macros** (the caller selects which subset of the 7 checks to run):

| Scope | Checks included |
|-------|-----------------|
| `full` | All 7 checks (default) |
| `build` | Check 1 only |
| `types` | Check 2 only |
| `lint` | Check 3 only |
| `test` | Check 4 only |
| `security` | Check 5 only |
| `diff` | Check 6 only |
| `behavioral` | Check 7 only |
| `static` | Checks 1, 2, 3, 6 (build, types, lint, diff — no test/security/behavioral) |
| `ci` | Checks 1, 2, 3, 4 (build, types, lint, test — no security/diff/behavioral) |

The `static` macro is the standard Phase 6 post-metric-loop scope — the metric loop owns behavioral evaluation, so Phase 6 verify skips checks 4 (test), 5 (security), and 7 (behavioral).

The `ci` macro is for CI pipeline integration — it runs the four deterministic, automatable checks and skips security (often handled by separate CI tooling), diff review (no uncommitted changes in CI), and behavioral (requires a running app).

If no scope is specified, default to `full`.

## Step 2b — Test stub detector

After running the Test check in Step 2, AND after running it as PASS, the orchestrator MUST run the test-stub detector. The detector greps every test file in the project's test directory and fails the verification if any file matches a stub pattern.

**Detection rules — a file is a STUB if ANY of:**

1. **Size threshold:** file size < 500 bytes (capdotai's `capTests.swift` was 358 bytes / 17 lines as the unmodified Apple Xcode 26 template; a real test with one assertion + setup + teardown is ≥ 600 bytes).

2. **Apple template marker grep — Swift Testing:**
   - Contains `Use XCTAssert and related functions`
   - Contains `Write your test here`
   - Contains `XCUIApplication Documentation`
   - Contains `Swift Testing Documentation`
   - Contains `// https://developer.apple.com/documentation/testing`
   - Contains `// https://developer.apple.com/documentation/xcuiautomation`

3. **JavaScript test placeholder grep:**
   - Contains `it.todo(`
   - Contains `test.todo(`
   - Contains `expect(true).toBe(true)`
   - Function body is a single comment + nothing else

4. **Zero assertions:** no `#expect`, `XCTAssert`, `XCTAssertEqual`, `XCTAssertTrue`, `expect(`, `assert(`, `expect_eq!`, `assertEquals` calls anywhere outside comments. (A test file with declarations but no assertions is a stub.)

**The detector:**

```bash
# pseudocode — actual implementation can be inline grep or a tiny dispatched subagent
EXIT=0
for f in $(find . -path '*/cap*Tests/*.swift' -o -path '*Tests*/*.swift' -o -path '*/__tests__/*.{js,ts}' -o -path '*/tests/*.py' -type f); do
  size=$(wc -c < "$f")
  has_template=$(grep -cE 'Use XCTAssert and related functions|Write your test here|XCUIApplication Documentation|Swift Testing Documentation|developer\.apple\.com/documentation/testing|developer\.apple\.com/documentation/xcuiautomation|it\.todo\(|test\.todo\(|expect\(true\)\.toBe\(true\)' "$f")
  has_assertions=$(grep -cE '#expect\(|XCTAssert|expect\(|assert\(|expect_eq!|assertEquals' "$f")

  if [ "$size" -lt 500 ]; then
    echo "STUB: $f (size $size bytes < 500)"
    EXIT=1
  elif [ "$has_template" -gt 0 ]; then
    echo "STUB: $f (Apple template markers detected)"
    EXIT=1
  elif [ "$has_assertions" -eq 0 ]; then
    echo "STUB: $f (zero assertion calls)"
    EXIT=1
  fi
done
exit $EXIT
```

**Behavior on stub detection:**

- Spawn a fix agent with the SPECIFIC directive: "Test stub detected at [file_path]. The corresponding spec field in `sprint-tasks.md` is [Behavioral Test field]. Implement the test body — write the named test, no other changes. Do not modify production code. Do not modify other test files. Return when the stub detector passes for this file."
- Re-run the stub detector after the fix agent returns.
- MAX 2 fix attempts per stub file. If still a stub after 2 attempts, FAIL the verification with a hard directive to the user that the spec declared a Behavioral Test the implementer agent could not implement.

**Why size+content+assertion-count combined:** each rule alone has false positives. Size alone misses the case where the developer kept the function name `testExample` but wrote real assertions inside. Template markers alone miss the case where someone deleted the comments but left the body empty. Zero assertions alone catches the most cases but would false-positive on a "test fixtures" file that defines helpers without assertions. Composite check catches the high-confidence cases (capdotai matches all three) and only false-positives on files that are deliberately small AND deliberately template-marked AND deliberately assertion-free — which is structurally impossible for a real test.

## Step 3: Handle Result

**On PASS:** Return `VERIFY: PASS (N/N)` to the caller via stdout. State persistence is the orchestrator's responsibility (`.build-state.json.verification` is Reality Checker's field, not the gate's). Proceed to next phase.

**On FAIL:** Read the failure reason and spawn a targeted fix agent:

**Fix-agent dispatch mode (SDK-gated — matches `commands/build.md:946`):**

- **`BUILDANYTHING_SDK=on` (default):** dispatch the fix agent through `claude-agent-sdk` with `maxTurns: 15`. This is a hard safety rail preventing runaway remediation loops. If a fix exceeds 15 turns, the orchestrator flags to user (interactive mode) or logs a warning and fails the verify (autonomous mode) — do NOT let the subagent churn indefinitely.
- **`BUILDANYTHING_SDK=off`:** fall back to Agent tool dispatch with a self-reported 15-tool-call cap (surfaced via `tool_calls_used` in the agent's return). Same enforcement policy as SDK mode.

| Failed Check | Fix Strategy |
|-------------|-------------|
| Build / Type-Check / Lint | Run the Build-Fix Protocol (`protocols/build-fix.md`). It isolates the first error, fixes it, rebuilds, detects cascade resolution, and reverts bad fixes automatically. |
| Test | Spawn fix agent: "Fix the failing test: [test name]. Read the test, read the implementation, fix the implementation — not the test — unless the test is wrong." |
| Security | Spawn fix agent: "Resolve vulnerability: [advisory]. Update the dependency or apply the recommended remediation." |
| Diff Review | Spawn fix agent: "Remove debug code / hardcoded secrets / regressions found in diff review: [details]." |
| Behavioral | Spawn fix agent: "The acceptance test expects [expected] but the app does [actual]. Read the failing test in tests/e2e/acceptance/, read the implementation, fix the implementation to match the expected behavior." |

After the fix agent completes, re-run verification from Step 2.

**Token accounting (Stage 3 G3):** each fix-agent dispatch emits a cost line to `docs/plans/build-log.md` via `src/orchestrator/hooks/token-accounting-emitter.ts`. Under `BUILDANYTHING_SDK=on`, the emitter subscribes to SDK `usage` messages automatically. Under markdown fallback, the orchestrator writes the line using the subagent's self-reported token count. Verify's fix loop is a known cost hotspot and must be attributed to the parent phase.

<HARD-GATE>
MAX 3 FIX ATTEMPTS: If verification fails 3 times on the same phase:
- **Interactive mode:** present the failure history to the user. Ask for direction.
- **Autonomous mode:** log the failure to `docs/plans/build-log.md` and proceed with a warning.
Do not loop forever.
</HARD-GATE>
