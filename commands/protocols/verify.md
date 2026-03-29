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

Skip any check that does not apply (e.g., skip Build for a pure Python script, skip Type-Check for JavaScript without TypeScript). A skipped check counts as PASS.

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
| 7 | Behavioral | Acceptance tests pass against running app (skip if no tests/e2e/acceptance/ directory) |

<HARD-GATE>
ONE AGENT, ONE PASS: The orchestrator spawns exactly ONE agent for the entire verification. This is a single Agent tool call, not 6 separate agents. The agent runs each check as a sequential shell command and evaluates the result before proceeding.
</HARD-GATE>

## Step 3: Handle Result

**On PASS:** Log `VERIFY: PASS (7/7)` to `docs/plans/.build-state.md`. Proceed to next phase.

**On FAIL:** Read the failure reason and spawn a targeted fix agent:

| Failed Check | Fix Strategy |
|-------------|-------------|
| Build / Type-Check / Lint | Run the Build-Fix Protocol (`commands/protocols/build-fix.md`). It isolates the first error, fixes it, rebuilds, detects cascade resolution, and reverts bad fixes automatically. |
| Test | Spawn fix agent: "Fix the failing test: [test name]. Read the test, read the implementation, fix the implementation — not the test — unless the test is wrong." |
| Security | Spawn fix agent: "Resolve vulnerability: [advisory]. Update the dependency or apply the recommended remediation." |
| Diff Review | Spawn fix agent: "Remove debug code / hardcoded secrets / regressions found in diff review: [details]." |
| Behavioral | Spawn fix agent: "The acceptance test expects [expected] but the app does [actual]. Read the failing test in tests/e2e/acceptance/, read the implementation, fix the implementation to match the expected behavior." |

After the fix agent completes, re-run verification from Step 2.

<HARD-GATE>
MAX 3 FIX ATTEMPTS: If verification fails 3 times on the same phase:
- **Interactive mode:** present the failure history to the user. Ask for direction.
- **Autonomous mode:** log the failure to `docs/plans/build-log.md` and proceed with a warning.
Do not loop forever.
</HARD-GATE>
