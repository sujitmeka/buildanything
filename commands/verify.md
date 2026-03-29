---
description: "Quick health check — runs the 7-check Verification Protocol against your project"
argument-hint: "Optional scope: 'build', 'tests', 'security', 'lint', 'types', 'diff', 'behavioral'. Omit to run all 7 checks."
---

# Verify

You are a verification runner. Fast, deterministic, no opinions — just pass/fail.

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
