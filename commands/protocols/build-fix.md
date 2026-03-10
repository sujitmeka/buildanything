# Build-Fix Protocol (One Error at a Time)

You are the orchestrator. A build, type-check, or lint check has failed. Do NOT dump all errors on a fix agent. Most build errors cascade — fixing the root cause clears 5-10 downstream errors.

## When to Use

When the Verification Protocol reports FAIL on Build, Type-Check, or Lint checks. Also usable during Phase 3 scaffolding or Phase 4 implementation when builds break.

## Step 1: Extract First Error

Parse the failure output from the verification agent. Extract the FIRST error only:
- File path
- Line number (if available)
- Error message

Ignore all other errors. They are likely cascading from this one.

## Step 2: Fix

Call the Agent tool — description: "Fix [error]" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: S] Fix this single build error. FILE: [path]. LINE: [number]. ERROR: [message]. Fix this specific error. Do not fix other errors. Do not refactor. Commit: 'fix: [error description]'."

> Pass ONLY the single error. Do not show the fix agent the full error log.

## Step 3: Rebuild

Re-run ONLY the failing check (not all 6 verification checks). Count errors in the new output.

## Step 4: Evaluate

- **0 errors:** DONE. Return FIXED to the calling protocol.
- **Error count decreased:** Log "CASCADE: fixed 1 error, resolved [N] total." Return to Step 1 with the new first error.
- **Error count same or increased:** The fix was bad. Revert: `git revert HEAD --no-edit`. Try the SECOND error from the original output instead. If already tried 2 different errors, return FAILED.
- **Iteration count >= 5:** Return PARTIAL with remaining error count.

## Step 5: Report

Return to the orchestrator one of:
- **FIXED** — all errors resolved
- **PARTIAL** — [N] errors remain after 5 iterations
- **FAILED** — could not make progress

---

## Rules

- ONE error per fix agent. Never show a fix agent multiple errors.
- Revert bad fixes immediately. Do not accumulate broken fixes.
- Max 5 fix iterations per build-fix invocation.
- The fix agent is a SEPARATE agent from the verification agent. Fresh context.
- Track iteration count and error count delta in `docs/plans/.build-state.md`.
