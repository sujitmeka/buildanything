---
name: writing-for-interfaces
description: Microcopy and tone review for iOS interfaces. Use when reviewing button labels, error messages, onboarding copy, empty states, alerts, permission prompts, and in-app text for clarity, brevity, and consistency with Apple's voice guidelines.
version: 0.1.0
status: ready
---

# Writing for Interfaces

## Purpose
Reviews and improves microcopy across iOS app screens — button labels, error messages, onboarding text, empty states, alerts, permission dialogs, and navigation titles. Ensures text is clear, concise, actionable, and consistent with Apple's tone guidelines.

## When this fires
- `/ux-review` iOS branch (Step 4e)
- Any screen-level copy audit
- Permission prompt or alert wording review

## Inputs
- Screen screenshots or SwiftUI view code containing user-facing strings
- App category and tone keywords from `.build-state.md` (if available)

## Outputs
- Per-screen findings: issue, severity (P0/P1/P2), current copy, suggested rewrite
- Tone consistency assessment across reviewed screens

## Principles

### Clarity over cleverness
- Every label should be instantly understood on first read
- Avoid jargon, abbreviations, and internal terminology
- Use familiar words: "Delete" not "Remove from collection"

### Brevity without ambiguity
- Button labels: 1–3 words (verb or verb + noun)
- Error messages: one sentence, state what happened and what to do
- Empty states: one sentence of encouragement + one CTA

### Actionable language
- Buttons describe what happens: "Save Photo", "Send Message", "Try Again"
- Avoid vague labels: "OK", "Submit", "Continue" (unless context is unambiguous)
- Destructive actions name the consequence: "Delete Account", not "Confirm"

### Consistent voice
- Match the app's established tone (playful, professional, minimal, warm)
- Keep capitalization consistent (Title Case for buttons, Sentence case for descriptions)
- Use the same term for the same concept everywhere (don't alternate "photo" and "image")

### Apple conventions
- Permission prompts: explain the benefit, not the mechanism ("To send you reminders" not "This app needs notification access")
- Alerts: title states the situation, message gives context, buttons name the actions
- Navigation titles: short, noun-based ("Settings", "Profile", not "Your Settings Page")

## Review checklist

1. **Buttons** — Are labels verb-first and specific? Are destructive actions clearly named?
2. **Error messages** — Do they say what went wrong AND what to do next?
3. **Empty states** — Is there a friendly message + clear CTA to populate the screen?
4. **Permission prompts** — Do usage descriptions explain the user benefit?
5. **Alerts** — Does the title summarize the situation? Do button labels name the actions (not "OK"/"Cancel")?
6. **Navigation titles** — Short, noun-based, consistent across the tab/flow?
7. **Onboarding** — Is each screen one idea, scannable in 3 seconds?
8. **Placeholders** — Do text field placeholders show format or example, not just the field name?
9. **Tone consistency** — Does copy across screens feel like it was written by the same person?
10. **Localization readiness** — Are strings free of concatenation, hardcoded plurals, and layout-breaking length assumptions?

## Severity guide

| Severity | Criteria | Example |
|----------|----------|---------|
| **P0** | Copy is misleading, causes data loss, or blocks the user | Destructive button labeled "OK" with no explanation |
| **P1** | Copy is confusing, vague, or inconsistent — fix before ship | Error message says "Something went wrong" with no guidance |
| **P2** | Copy works but could be tighter, friendlier, or more on-brand | Empty state says "No items" instead of something encouraging |

---
_In-house skill for buildanything iOS mode. See `protocols/ios-context.md` for Senior iOS Engineer persona._
