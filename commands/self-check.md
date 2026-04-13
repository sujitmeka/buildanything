---
description: "Plugin maintainer self-check — runs schema sanity, manifest sync, V.H.P. regression proof, and silent-skip detection before publish"
---

# /buildanything:self-check

Run before `git push` / `npm publish` to catch plugin regressions locally. Takes ~10-30 seconds.

This is **plugin-maintainer tooling**, not a user-facing build command. It does not build any user project; it validates the plugin itself. Zero external dependencies — no git hosting, no CI, no nightly runs. Just one command, executed on the maintainer's laptop.

## What it checks

Four sequential checks, **stop on first FAIL** (except Check 3, which may SKIP without failing if its fixture is unavailable):

1. **Schema sanity** — every protocol and command file parses cleanly and all cross-references resolve.
2. **Manifest sync** — agent count on disk matches the claim in `.claude-plugin/plugin.json`.
3. **V.H.P. regression check** — the Layer C stub detector still flags a known-stub Swift test file from the capdotai project. This is the deterministic proof that the V.H.P. fix still works.
4. **Silent-skip detection** — no forbidden "skip silently" phrases have been reintroduced into the protocols.

You are the orchestrator. Run each check via the Bash tool, record the result, and proceed to the next unless a FAIL aborts the run.

---

## Check 1: Schema Sanity

**Goal:** every file in `protocols/` and `commands/` parses as valid markdown with valid cross-references.

For every file in `/Users/sujit/projects/oneshot-claude-plugin/protocols/*.md`:

1. First non-blank line must start with `# ` (top-level heading).
2. Count of ` ``` ` (triple-backtick) fences must be even — no unclosed code fences.

For every file in `/Users/sujit/projects/oneshot-claude-plugin/commands/*.md`:

1. Must begin with a `---` frontmatter block that contains a `description:` field. `argument-hint:` is optional.
2. Must have at least one `# ` heading after the frontmatter.
3. Same even-count rule for code fences.

For every protocol and command file, grep for references of the form `protocols/<name>.md` and `commands/<name>.md`. For each match, resolve the target relative to the plugin root and confirm the file exists on disk. A broken reference is a FAIL.

Use Bash + Grep for the walk. Report PASS with file counts (e.g., `PASS — 15 protocols, 10 commands, 47 cross-refs, all resolve`) or FAIL with the offending file and specific reason.

---

## Check 2: Manifest Sync

**Goal:** the on-disk agent roster matches the plugin's advertised count.

1. Run `ls /Users/sujit/projects/oneshot-claude-plugin/agents/ | wc -l` to get the actual count.
2. Read `/Users/sujit/projects/oneshot-claude-plugin/.claude-plugin/plugin.json` and extract any integer from the `description` field (e.g., "73 specialist agents"). If `plugin.json` has a dedicated `agent_count` field, prefer that.
3. If the two numbers disagree, FAIL with both values.
4. If no agent count is claimed anywhere in `plugin.json`, report PASS with a warning: `PASS — 61 agents on disk, no claim in manifest to check against`.

Report format: `PASS — 61 agents on disk, manifest claims 61` or `FAIL — 61 agents on disk, manifest claims 73`.

---

## Check 3: V.H.P. Regression Check

**Goal:** prove that the V.H.P. Layer C stub detector still correctly flags Apple-template Swift test files as STUB. This is the deterministic regression proof that the verification fix is intact.

**Fixture dependency:** this check requires `/Users/sujit/projects/capdotai/cap/capTests/capTests.swift` to exist on disk. If the fixture path is missing (the maintainer doesn't have capdotai checked out), **SKIP this check** with the explanatory note `SKIPPED — capdotai fixture not present at /Users/sujit/projects/capdotai/; clone capdotai locally to enable V.H.P. regression proof`. A SKIP here does NOT cause the overall self-check to fail — it's a legitimate absence, not a regression.

**If the fixture exists**, run the Layer C stub detector heuristic against it:

1. **File size:** `wc -c < /Users/sujit/projects/capdotai/cap/capTests/capTests.swift`. A real test file is ≥ 500 bytes. Smaller → stub signal.
2. **Apple template markers:** grep (case-sensitive) for any of: `Write your test here`, `Swift Testing Documentation`, `developer.apple.com/documentation/testing`. Any match → stub signal.
3. **Assertion count:** count occurrences of `#expect(` and `#require(` (Swift Testing) plus `XCTAssert` (XCTest). Zero → stub signal.

A file is a STUB if it trips **all three** signals simultaneously (size < 500 AND template markers present AND zero assertions).

Known fixture state: `capTests.swift` is 358 bytes, contains `Write your test here` and `Swift Testing Documentation`, and has zero `#expect` / `#require` / `XCTAssert` calls. The detector MUST classify it as STUB.

- If the detector correctly classifies it as STUB → PASS. Report: `PASS — detector correctly flagged capdotai/capTests.swift as STUB (358 bytes, 2 template markers, 0 assertions)`.
- If the detector classifies it as NOT-STUB → **FAIL**. Report: `FAIL — V.H.P. regression: detector did NOT flag capdotai/capTests.swift as STUB. The verification fix is broken.` This is the loudest failure in the entire self-check because a silent regression here means user builds will ship untested code.

---

## Check 4: Silent-Skip Detection

**Goal:** no forbidden "skip silently" phrases have been reintroduced into the protocol prose.

Grep every file in `/Users/sujit/projects/oneshot-claude-plugin/protocols/*.md` (case-insensitive) for each of the following forbidden phrases:

- `do not block the build`
- `skipped check counts as pass`
- `otherwise skip`

Use Grep with `-i` (case-insensitive) and output-mode content to capture file + line number for any match.

- If zero matches → PASS. Report: `PASS — no silent-skip phrases found in protocols/`.
- If any match → FAIL. Report: `FAIL — silent-skip phrase "<phrase>" found in protocols/<file>.md:<line>`. Include the full offending line so the maintainer can locate and fix it.

The `otherwise skip` check is specifically for autonomous-mode contexts (i.e., the surrounding prose should be about autonomous / unattended behavior). If a match appears in a non-autonomous context (e.g., user-instruction flow where "otherwise skip" means "if the user declines, skip"), note it in the report but still FAIL — any reintroduction deserves human review.

---

## Output format

For each check, emit one line with the check name, verdict, and one-sentence reason:

```
Check 1 — Schema Sanity:        PASS — 15 protocols, 10 commands, 47 cross-refs, all resolve
Check 2 — Manifest Sync:        PASS — 61 agents on disk, no claim in manifest to check against
Check 3 — V.H.P. Regression:    PASS — detector correctly flagged capdotai/capTests.swift as STUB (358 bytes, 2 markers, 0 assertions)
Check 4 — Silent-Skip:          PASS — no silent-skip phrases found in protocols/
```

At the end, emit one of:

- `SELF-CHECK PASS (4/4)` — all four checks passed (or Check 3 SKIPPED, others passed → `SELF-CHECK PASS (3/4, Check 3 SKIPPED)`).
- `SELF-CHECK FAIL: Check <N> — <one-line reason>` — the first check that failed.

---

## Exit conditions

- **Stop on first FAIL.** The moment any check returns FAIL, emit the per-check results gathered so far, emit the overall `SELF-CHECK FAIL` verdict, and stop. Do not continue to later checks — a failing plugin should not ship, and running the rest wastes time when the maintainer needs to fix the first failure.
- **Report all results up to and including the failure.** If Check 3 fails, still print Check 1 and Check 2 results.
- **Check 3 SKIPPED is not a failure.** If the capdotai fixture is missing, Check 3 reports SKIPPED, and the run proceeds to Check 4. The overall verdict is `SELF-CHECK PASS (3/4, Check 3 SKIPPED)` iff Checks 1, 2, and 4 all pass.
- **Final verdict goes last.** Always end the output with the single `SELF-CHECK PASS` or `SELF-CHECK FAIL` line so the maintainer's eye lands on it immediately.
