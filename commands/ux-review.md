---
description: "Focused UX/UI review — scoped to a specific page, component, or issue. Compares the live app against the design system, fixes what's wrong, and shows before/after proof."
argument-hint: "A page, component, or issue: 'the dashboard', 'signup form on mobile', 'button color is wrong on settings'. Leave blank for a full audit."
---

# UX Review

You are a UX engineer. Your job: find visual and interaction problems in the live app, compare against the design system, fix them, and prove the fix with screenshots.

**Scope rule**: Do the MINIMUM work the user's argument requires. A specific issue means one page, one fix. No argument means full audit.

---

## Step 1: Determine Scope

Parse `$ARGUMENTS`:

| Argument | Scope |
|----------|-------|
| Specific issue ("button too small on settings") | Navigate to that page, investigate that issue only |
| Page or component ("the dashboard", "signup form") | Review only that page/component |
| Empty or "everything" | Full audit of all routes |

Identify the target URL(s) from the argument. If ambiguous, check the router/pages directory to find the right route.

---

## Step 2: Capture Reference and Current State

1. Start the dev server if not already running.
2. Screenshot `/design-system` (or `/storybook`, or whatever style guide route exists) at 1440px wide. This is your reference. If no style guide route exists, skip this step and use the project's design tokens/theme files as reference instead.
3. For each target page, capture two screenshots:
   - **Desktop**: 1920x1080
   - **Mobile**: 375x812
4. Take an accessibility snapshot of interactive elements on each page.

---

## Step 3: Review

For each page in scope, check these categories. Skip categories that don't apply to the scoped issue.

- **Visual consistency**: Do colors, typography, spacing, and border radii match the design system?
- **Responsive behavior**: Does layout break or overflow on mobile? Are touch targets at least 44x44px?
- **States**: Are loading, error, and empty states implemented? Do they look intentional?
- **Form UX**: Validation feedback visible? Error messages near the field? Disabled states clear?
- **Motion**: Are transitions smooth and consistent? Any layout shift on load?
- **Contrast and readability**: Text contrast ratio adequate? Font sizes readable on mobile?

Produce a ranked issue list: CRITICAL > HIGH > MEDIUM > LOW. Include the screenshot and a one-line description for each issue.

---

## Step 4: Fix

For each issue, starting with CRITICAL:

1. Launch a fix agent with:
   - The screenshot showing the problem
   - What is wrong (one sentence)
   - The design system reference (token values, style guide screenshot, or theme file path)
   - The file(s) to change
2. After the agent returns, re-screenshot the same page at the same viewport size.
3. Compare before and after. If the fix introduced a new issue or didn't resolve the original, revert and retry once.
4. Move to the next issue.

Fix visual issues one at a time. Do not batch — each fix needs its own before/after verification.

---

## Step 5: Report

Present a summary:

| Issue | Severity | Page | Before | After | Status |
|-------|----------|------|--------|-------|--------|
| ... | CRITICAL/HIGH/MED/LOW | /path | screenshot | screenshot | FIXED/DEFERRED |

For deferred issues, explain why (e.g., requires design decision, backend change needed).

Close the browser. Done.
