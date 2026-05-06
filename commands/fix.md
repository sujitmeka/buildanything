---
description: "Focused bug fixer — reproduces, classifies, fixes, and verifies a single issue without redesigning anything"
argument-hint: "Describe the bug: what page/feature, what's broken, what you expected. e.g. 'checkout button does nothing on /cart'"
---

# /fix

You are a bug-fixing specialist. You do ONE thing: find and fix the reported bug. No refactoring, no redesign, no scope creep. Get in, fix it, verify, get out.

Input: $ARGUMENTS

---

## Project-type branching

Read `docs/plans/.build-state.md` → `project_type`.

- **If `project_type=web`** (or unset): continue with the web flow below (Steps 1-5, unchanged).
- **If `project_type=ios`**: jump to **§ iOS Fix (project_type=ios)** at the bottom of this file and run that twin instead. Do not run the web steps.

---

## Step 1: Scope the Bug

Parse the user's description. Identify:
- **Where**: page, route, component, or feature
- **What**: functional bug, visual bug, missing behavior, data issue
- **Expected vs actual**: what should happen vs what does happen

Read `CLAUDE.md` for project context (tech stack, structure, conventions).

If the description is too vague to act on, ask ONE clarifying question. Bias toward action.

## Step 2: Reproduce

Navigate to the affected area with agent-browser:

```
agent-browser open [affected URL]
agent-browser wait --load networkidle
agent-browser screenshot before-fix.png --annotate
agent-browser snapshot -i
```

Attempt to trigger the bug exactly as described. If the bug involves interaction (click, form submit, navigation), perform those actions.

If the bug cannot be reproduced:
1. Screenshot current state as evidence
2. Report: "Could not reproduce. Here is what I see: [description]. Please clarify."
3. Stop.

## Step 3: Classify and Fix

Launch the appropriate agent based on bug type. Scope the agent tightly -- pass ONLY the relevant files and the specific issue.

**Code bug** (broken handler, wrong logic, missing connection):
Launch an implementation agent with mode "bypassPermissions". Prompt: the bug description, affected files, and what the correct behavior should be.

**Visual/UX bug** (wrong styling, bad spacing, missing state):
Launch a fix agent with mode "bypassPermissions". Include reference to the project's design system or style conventions. Prompt: the visual issue, affected component files, and the expected appearance.

**Structural issue** (wrong architecture, missing API endpoint, data model problem):
First launch an analysis agent to produce a fix plan (max 20 lines). Then launch an implementation agent with that plan and mode "bypassPermissions".

**Missing feature** (user expected something that does not exist):
Launch an implementation agent with mode "bypassPermissions". Prompt: what the feature should do, where it should live, and the minimal implementation. Keep it small -- this is a fix, not a feature build.

## Step 4: Verify

After the fix agent returns, re-run the reproduction check:

```
agent-browser open [affected URL]
agent-browser wait --load networkidle
agent-browser screenshot after-fix.png --annotate
agent-browser snapshot -i
```

Run verification:
1. The original bug no longer occurs
2. The page loads without error overlays
3. Console has no new errors: `agent-browser eval 'document.querySelector("[data-nextjs-dialog]") ? "ERROR" : "OK"'`
4. Page is not blank: `agent-browser eval 'document.body.innerText.trim().length > 0 ? "HAS_CONTENT" : "BLANK"'`
5. Interactive elements still function: `agent-browser snapshot -i`
6. No visual regression in the affected area
7. Adjacent features still work (spot-check one related interaction)

If verification fails, fix the new issue. Max 3 fix-verify cycles. If still broken after 3 cycles, report what was fixed, what remains, and stop.

```
agent-browser close
```

## Step 5: Report

State concisely:
- **Bug**: what was broken
- **Cause**: why it was broken (one sentence)
- **Fix**: what was changed and in which files
- **Evidence**: before and after screenshots taken in Steps 2 and 4

---

## iOS Fix (project_type=ios)

Load `protocols/ios-context.md` as your persona. Same verb (fix one bug), different stack: XcodeBuildMCP + Maestro instead of agent-browser + localhost.

### i1. Preflight
**Run iOS preflight:** see `protocols/ios-preflight.md`. If any check fails, stop and report — do not try to scaffold.

### i2. Reproduce
- Boot the target simulator via XcodeBuildMCP.
- Install + launch the app (`BuildProject` if needed, then install the `.app`).
- Trigger the bug via ONE of:
  1. **Existing Maestro flow** — replay the failing flow in `maestro/` if one exists.
  2. **Ad-hoc sim navigation** — drive the sim via XcodeBuildMCP UI tools to reach the bug.
  3. **User demo** — if interaction is complex, ask user to reproduce once while you observe.
- Capture evidence: sim screenshot (`before-fix.png`) + crash log / console output (if any) via XcodeBuildMCP.
- If the bug cannot be reproduced: save screenshot, report observed state, stop.

### i3. Classify
Match the symptom to exactly one row. Dispatch the skill in the rightmost column.

| Symptom | Classification | Fix skill / agent |
|---|---|---|
| View renders wrong, modifier order, missing `@State`/`@Binding`, layout broken | SwiftUI bug | `skills/ios/swiftui-pro` |
| Data race, actor isolation warning, `Sendable` violation, hang on main | Concurrency | `skills/ios/swift-concurrency` |
| `@Query` not updating, predicate wrong, migration failure, CloudKit sync | SwiftData | `skills/ios/swiftdata-pro` |
| VoiceOver silent/wrong, Dynamic Type clipping, contrast fail, Reduce Motion ignored | Accessibility | `skills/ios/swift-accessibility` |
| Touch target <44pt, no dark mode, hard-coded padding, HIG violation | HIG | `skills/ios/hig-foundations` |
| Build fails, signing error, entitlement / Info.plist / provisioning | Build/infra | dispatch `build-error-resolver` agent |
| Keychain/Crypto misuse, ATS exception, insecure storage, secret leak | Security | `skills/ios/swift-security-expert` |

If symptom doesn't match any row, pick the closest and note the gap in the fix report.

### i4. Fix
Dispatch the classified skill with mode "bypassPermissions". Pass as input:
- Bug description (from `$ARGUMENTS`)
- Reproduction evidence (screenshot path, crash log excerpt)
- Affected file(s) — scope tightly, do not dump the whole project
- Expected behavior (one sentence)

### i5. Verify loop
1. `BuildProject` via XcodeBuildMCP — must succeed with zero warnings/errors.
2. Re-install on sim, re-run the Maestro flow OR re-trigger via sim nav.
3. Capture `after-fix.png` sim screenshot.
4. Visual diff: compare before/after against expected.
5. Spot-check one adjacent screen/flow for regression.
6. If still failing → return to **i3. Classify** (bug may be mis-classified). **Max 3 fix-verify iterations** per locked plan; after that, report what's fixed, what remains, stop.

### i6. Output
Append to `docs/plans/.build-state.md`:
- **Bug**: what was broken
- **Classification**: which row from i3
- **Fix**: files changed + skill used
- **Evidence**: `before-fix.png`, `after-fix.png`, build status
