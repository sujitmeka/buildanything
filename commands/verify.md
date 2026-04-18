---
description: "Quick health check — runs the 7-check Verification Protocol against your project"
argument-hint: "Optional scope: 'build', 'tests', 'security', 'lint', 'types', 'diff', 'behavioral'. Omit to run all 7 checks."
---

# Verify

You are a verification runner. Fast, deterministic, no opinions — just pass/fail.

## Project-type branching

Read `docs/plans/.build-state.md` → `project_type`.

- **If `project_type=web`** (or unset): run the existing web flow below (Steps 1–3).
- **If `project_type=ios`**: skip Steps 1–3 and jump to the **iOS Verify** section at the bottom of this file.

## Step 1: Determine Scope

Check the user's argument:

| Argument | Checks to Run |
|----------|--------------|
| _(none)_ | All 7 checks |
| `build` | Check 1 only |
| `types` | Check 2 only |
| `lint` | Check 3 only |
| `tests` | Check 4 only |
| `security` | Check 5 only |
| `diff` | Check 6 only |
| `behavioral` | Check 7 only |

Multiple scopes can be combined: `tests security` runs checks 4 and 5.

## Step 2: Run the Verification Protocol

Follow `protocols/verify.md` exactly:

1. **Detect stack** from manifest files (package.json, pyproject.toml, go.mod, Cargo.toml).
2. **Run checks** — either all 7 sequentially or the scoped subset. Stop on first failure.
3. **Report result**: `VERIFY: PASS (N/N)` or `VERIFY: FAIL at step [N] — [check]: [reason]`.

## Step 3: Handle Result

**On PASS:** Report the green result. Done.

**On FAIL:** Report what failed with the full error output, then suggest:

> "Verification failed at [check]. Run `/buildanything:build` with a fix prompt, or I can attempt a targeted fix now."

Do not auto-fix unless the user asks. This command is for reporting, not repairing.

---

## iOS Verify (project_type=ios)

iOS functional-correctness twin. Runs a sequential skill bundle (not parallel — each pass feeds the next) over the Xcode project. No 0-100 scoring — pass/fail gates only.

### Preflight

**Run iOS preflight:** see `protocols/ios-preflight.md`. If any preflight check fails, emit `VERIFY: FAIL at preflight — [reason]` and stop.

### Load context

Every dispatched agent below inherits `protocols/ios-context.md` (Senior iOS Engineer sidecar). Inject it as the first block of each agent prompt.

### Dispatch sequence (sequential)

Run in order. Stop on first hard blocker; soft findings accumulate into the report.

**a. Test triage + snapshot/doubles review — `skills/ios/swift-testing-expert`**
> Load `protocols/ios-context.md`. Triage existing `@Test` / XCTest suites: parallel-safety, isolation correctness, missing coverage on critical paths, test-plan wiring. Also review snapshot tests and Fowler-style test doubles for correctness, isolation, and coverage gaps. Output: list of test + snapshot/doubles issues with severity.

**b. Security audit — `skills/ios/swift-security-expert` (audit mode)**
> Load `protocols/ios-context.md`. Audit Keychain usage, CryptoKit calls, ATS exceptions in Info.plist, biometric gating. Report any hardcoded secrets or weak primitives. Severity: P0 / P1 / P2.

**c. App Review compliance — `agents/ios-app-review-guardian`**
> Load `protocols/ios-context.md`. Check App Review guidelines, privacy manifest (`PrivacyInfo.xcprivacy`), IAP/StoreKit rules, required usage-description strings, tracking/ATT compliance. Report blockers vs. warnings.

**d. Maestro flow authoring — `skills/ios/ios-maestro-flow-author`** _(conditional)_
> If a critical user journey lacks E2E coverage, author a `.yaml` Maestro flow for it. Skip if coverage is adequate.

**e. Build + test run — XcodeBuildMCP**
> `BuildProject` all targets → run the active test plan via XcodeBuildMCP → capture failures, warnings, and test output. This is the hard gate.

### Pass/fail gates

All must pass for `VERIFY: PASS`:

| Gate | Pass condition |
|------|----------------|
| Build | XcodeBuildMCP `BuildProject` succeeds, zero errors |
| Tests | All tests in active test plan pass |
| Security audit | No P0 findings from `swift-security-expert` |
| App Review | No blockers from `ios-app-review-guardian` (warnings OK) |
| A11y warnings | No new a11y warnings introduced since last verify |

Any gate failing → `VERIFY: FAIL at [gate] — [reason]`.

### Output

Write `docs/plans/ios-verify-report.md` with:

- One-line pass/fail summary
- Per-agent section (testing, security, app-review, maestro, build)
- Findings list grouped by severity (P0/P1/P2)
- Diff vs. previous report if one exists

Log the final line to `docs/plans/.build-state.md` the same way web mode does.

### Note on Step 6.0 (Pre-Hardening Verification)

Step 6.0 references `protocols/verify.md` which auto-branches on `project_type`. iOS builds flow through the iOS twin section of this file. No separate Step 6.0 action needed for iOS.
