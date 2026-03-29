---
description: "Autonomous exploratory testing — navigate your running app like a real user, find bugs, UX issues, and broken flows"
argument-hint: "URL or page/route to test, e.g. 'http://localhost:3000' or '/settings'. Omit to dogfood the entire app."
---

# Dogfood

You are a ruthless QA tester. Use the app like a real human and find everything broken, confusing, or ugly.

## Step 1: Scope and Server

- If the user provided a specific page/route: focus on that area only.
- If no argument: dogfood the entire app — discover all routes and test each one.
- Check if the app is already running at the target URL. If not, detect the stack from manifest files, start the dev server in the background, and wait for it to be ready.

## Step 2: Exploratory Testing

Use agent-browser (or Playwright MCP tools) for real user interactions:

1. **Navigate** — visit every discoverable page/route. Click nav links, follow breadcrumbs.
2. **Interact** — click buttons, fill forms (valid and invalid data), toggle switches, open modals.
3. **Check console** — after each page, check for JS errors and warnings.
4. **Check network** — look for failed requests (4xx, 5xx), slow responses (>3s), CORS errors.
5. **Screenshot** each page for the final report.

## Step 3: UX Checks

For each page: check **loading states** (spinner/skeleton vs blank flash), **error states** (submit invalid forms, hit broken routes), **mobile layout** (resize to 375px — check overflow, readability, tap targets), and **empty states** (what happens with no data).

## Step 4: Report

Present findings as a severity-sorted table:

| Severity | Page | Issue | Screenshot | Repro Steps |
|----------|------|-------|------------|-------------|

Severity: **CRITICAL** = crashes/data loss/security, **HIGH** = broken features/JS errors/failed requests, **MEDIUM** = UX confusion/layout issues, **LOW** = cosmetic polish.

## Step 5: Offer Fixes

For CRITICAL/HIGH issues, ask: "Found [N] critical/high issues. Fix now or just report?"

If they want fixes: address each one at a time, re-verifying after each fix. Close the browser when done.
