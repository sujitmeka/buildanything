---
name: ios-maestro-flow-author
description: Generates Maestro .yaml E2E flow files from natural-language user journeys. Use during /verify iOS branch whenever a critical user journey needs automated coverage.
version: 0.2.0
status: ready
---

# iOS Maestro Flow Author (Phase 6, /verify twin)

## Purpose
Converts a plain-English user journey ("sign up, create first habit, mark complete") into a runnable Maestro flow YAML, ready to execute against a booted simulator via `maestro test`.

## When this fires
- `/verify` iOS branch
- A new critical user journey needs E2E coverage
- Regression: existing flow drifted from current UI

## Inputs
- `journey_nl` (string) — natural-language user journey
- `app_id` (string) — bundle identifier under test (e.g. `com.acme.HabitForge`)
- `test_name` (string, optional) — defaults to slugified journey

## Outputs
- `maestro/<test_name>.yaml`
- Dry-run summary (commands emitted, accessibility-id assumptions, skipped steps)

## Workflow
1. Parse `journey_nl` into ordered discrete user actions (one sentence = one action group).
2. Match each action to a Maestro command pattern from the cheat-sheet below; prefer accessibility IDs over visible text when the app exposes them.
3. Emit YAML with `appId: {app_id}` header and one command per step.
4. Write to `maestro/<test_name>.yaml`.
5. Validate via `maestro test maestro/<test_name>.yaml` on a booted simulator (Maestro has no true `--dry-run`; shortest validation is to run it once against the sim).

## Maestro cheat-sheet (10 core commands)

```yaml
- launchApp                                   # launches the appId declared in the header
- tapOn: "Sign Up"                            # tap element by visible text
- tapOn:
    id: "emailField"                          # tap by accessibility identifier (preferred)
- assertVisible: "Welcome back"               # assert text/element visible, fails flow if not
- inputText: "alice@example.com"              # types into currently focused field
- scroll                                      # scroll down on current screen
- swipe:
    direction: LEFT                           # swipe: LEFT | RIGHT | UP | DOWN
- hideKeyboard                                # dismiss soft keyboard
- back                                        # system back / pop navigation
- pressKey: Enter                             # hardware key: Enter, Backspace, Home, Lock
```

See `references/` for five copy-and-adapt templates covering the 90% cases.

## Authoring rules
- Always start with `- launchApp`.
- Prefer `id:` selectors (stable) over raw text (fragile to copy changes).
- After every `inputText`, insert `hideKeyboard` before the next `tapOn` to avoid the keyboard intercepting taps.
- End every flow with at least one `assertVisible` that confirms the user reached the destination screen.
- Keep flows single-purpose — one user journey per file. Compose with `runFlow:` in a parent flow if needed.

## Reference templates
- `references/onboarding-flow.yaml` — launch → splash → signup → main screen
- `references/tap-and-assert.yaml` — minimal tap + assertVisible pattern
- `references/input-and-scroll.yaml` — form input + scroll + tap
- `references/modal-and-dismiss.yaml` — open sheet, interact, dismiss
- `references/tab-navigation.yaml` — switch tabs, verify each screen

---
_Part of buildanything iOS mode. See `protocols/ios-context.md` for Senior iOS Engineer persona._
