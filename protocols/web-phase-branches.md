# Web Phase Branches

_Loaded into orchestrator session context when `project_type=web` (the default). Contains per-phase web-specific instructions. Mode-agnostic phase scaffolding lives in `commands/build.md`._

## Phase 3 — Design (web branch)

**Goal:** Transform architecture into a research-backed visual design system, proven with Playwright screenshots. Fully autonomous — agents research, decide, and iterate without user input.

**Skip if** the project has no user-facing frontend (CLI tools, pure APIs, backend services).

HARD-GATE: UI/UX IS THE PRODUCT. This phase is a full peer to Architecture and Build — not a footnote, not an afterthought, not a "nice to have." Do NOT skip, compress, or rush this phase for any reason. The agents must research real competitors and award-winning sites, make deliberate visual choices backed by that research, build a living style guide with every component rendered and interactive, and iterate with Playwright-verified visual QA before a single line of product code is written. Phase 4 (Foundation) WILL NOT START without `docs/plans/visual-design-spec.md`. If it does not exist, return here.

### Step 3.1 — Design Research (2 agents, parallel, both use Playwright)

Follow the Design Protocol (`protocols/design.md`), Step 3.1.

Call the Agent tool 2 times in one message:

1. Description: "Competitive visual audit" — Prompt: "Research the top 5-8 competitors/analogues for: [product description]. Use Playwright to screenshot each site (desktop 1920x1080 + mobile 375x812). Screenshot standout components (hero, cards, forms, nav, CTAs). Save to docs/plans/design-references/competitors/. Analyze visual language: colors, typography, spacing, what feels premium vs cheap. Rank by visual quality. DESIGN DOC: [paste]."

2. Description: "Design inspiration mining" — Prompt: "Search Awwwards.com, Godly.website, SiteInspire for award-winning sites in category: [product category]. Use Playwright to screenshot top 5-8 results + standout components. Save to docs/plans/design-references/inspiration/. Identify visual trends, what separates best-in-class from generic. DESIGN DOC: [paste]."

After both return, synthesize a **Design Research Brief** to `docs/plans/design-research.md`. Include all screenshot paths.

### Step 3.2 — Design Direction (2 agents, sequential)

Follow the Design Protocol (`protocols/design.md`), Step 3.2.

1. Call the Agent tool — description: "UX architecture" — Prompt: "Create structural design foundation. INPUTS: frontend architecture section from architecture.md [paste], Design Research Brief [paste], reference screenshot paths [list], user persona [paste]. OUTPUT: information architecture, layout strategy, component hierarchy, responsive approach, interaction patterns. Base decisions on competitive research, not generic patterns."

2. Call the Agent tool — description: "Visual design spec" — Prompt: "Create the Visual Design Spec with AUTONOMOUS decisions — pick the single best direction, do not present options. INPUTS: UX foundation [paste previous output], Design Research Brief [paste], reference screenshot paths [list], user persona [paste]. OUTPUT: color system (with hex, light+dark), typography (Google Fonts, mathematical scale), 8px spacing system, tinted shadow system, border radius, animation/motion, component styles with ALL states. Every choice must cite the research. Apply anti-AI-template rules from the Design Protocol. Save to docs/plans/visual-design-spec.md."

### Step 3.3 — Living Style Guide (1 implementation agent)

Follow the Design Protocol (`protocols/design.md`), Step 3.3.

Call the Agent tool — description: "Build living style guide" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: L] Build a living style guide page (/design-system route or standalone HTML). INPUTS: Visual Design Spec [paste], UX foundation [paste relevant sections], reference screenshots [list paths — these are your quality targets]. Must include rendered, interactive examples of: color swatches, typography scale, spacing scale, buttons (all states), form elements (all states), cards, navigation, feedback components (alerts, toasts, spinners, empty states), modals/overlays, and layout grid examples. Every component interactive (hover, focus, transitions work). Mobile-responsive. This ships with the product. Commit: 'feat: living style guide'."

### Step 3.4 — Visual QA Loop (Playwright + Metric Loop)

Run the Metric Loop Protocol (`protocols/metric-loop.md`) using the measurement criteria from the Design Protocol (`protocols/design.md`, Step 3.4).

Measurement: Playwright screenshots of the living style guide sections (desktop + mobile). Design critic agent scores 0-100 across 6 dimensions: spacing/alignment, typography hierarchy, color harmony, component polish, responsive quality, originality (anti-AI-template check). Receives screenshots + Visual Design Spec + reference screenshots.

**Target: 80. Max 5 iterations.** On stall: accept if >= 65, log warning below 65.

### Step 3.5 — Autonomous Quality Gate

Log to `docs/plans/build-log.md`: final screenshot paths, score history table, design decisions, originality score. No user pause. Proceed to Phase 4.

Phase 4 HARD-GATE: web mode requires `docs/plans/visual-design-spec.md` to exist before Phase 4 starts. If missing, return to Phase 3.

## Phase 4 — Foundation (web branch)

### Step 4.1 — Scaffolding (web)

Call the Agent tool — description: "Project scaffolding" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Set up the project from this architecture: [paste]. Create directory structure, dependencies, build tooling, linting config, test framework with one passing test, .gitignore, .env.example. Commit: 'feat: initial scaffolding'."

### Step 4.2 — Design System (web, frontend only)

Call the Agent tool — description: "Design system setup" — mode: "bypassPermissions" — prompt: "Implement the design system from the Visual Design Spec: [paste from docs/plans/visual-design-spec.md]. Create CSS tokens matching the spec's color system, typography scale, spacing system, shadow/elevation tokens, and base layout components. The living style guide from Phase 3 is the reference implementation — components must match. Commit: 'feat: design system'."

### Step 4.2b — Acceptance Test Scaffolding (web)

Call the Agent tool — description: "Scaffold acceptance tests" — mode: "bypassPermissions" — prompt: "Read docs/plans/sprint-tasks.md. For every task with a Behavioral Test field, create a Playwright test stub in tests/e2e/acceptance/. Use Page Object Model. Each test should: navigate to the page, perform the interaction, assert the expected outcome. Tests should FAIL right now (features aren't built yet) — that's correct. Also ensure agent-browser is available (run `which agent-browser`). Commit: 'test: scaffold acceptance tests from sprint tasks'."

## Phase 5 — Build (web branch)

### Step 5.1 — Implement (web)

Call the Agent tool — description: "[task name]" — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. HANDOFF — Architecture section: [paste ONLY the relevant section from architecture.md]. Design section: [paste ONLY the relevant section from the design doc]. Previous task output: [what the last completed task produced, if relevant]. For UI tasks: the living style guide at /design-system shows every component's exact styling and states — match it. Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

Pick the right developer framing: frontend, backend, AI, etc. Set `[COMPLEXITY: S/M/L]` based on the task's Size from sprint-tasks.md.

### Step 5.2 — Metric Loop (web)

For UI-facing tasks, include behavioral verification: the measurement agent should use agent-browser to verify the feature renders and responds to interaction, not just read the code. Max 5 iterations.

### Step 5.3b — Behavioral Smoke Test (web)

Uses agent-browser against localhost to open the app, execute the task's behavioral acceptance criteria, and verify the feature actually works. Evidence saved to `docs/plans/evidence/[task-name]/`: annotated screenshot, snapshot diff, error log, network log, HAR file.

## Phase 6 — Harden (web branch)

### Step 6.1 — Initial Audit (5 agents in parallel, ONE message)

Read the NFRs from `docs/plans/sprint-tasks.md`. Pass the relevant NFR thresholds to each audit agent so they have concrete targets, not generic checks.

Call the Agent tool 5 times in one message:

1. Description: "API testing" — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. NFR targets: [paste performance and reliability NFRs]. Report findings with counts."

2. Description: "Performance audit" — Prompt: "Measure response times, identify bottlenecks, flag performance issues. NFR targets: [paste performance NFRs — e.g., API < 200ms, page load < 3s]. Report benchmarks AGAINST these targets."

3. Description: "Accessibility audit" — Prompt: "WCAG compliance audit on all interfaces. NFR target: [paste accessibility NFR — e.g., WCAG AA]. Check screen reader, keyboard nav, contrast. Report issues with counts."

4. Description: "Security audit" — Prompt: "Security review: auth, input validation, data exposure, dependency vulnerabilities. NFR targets: [paste security NFRs]. Report findings with severity."

5. Description: "UX quality audit" — Prompt: "UX quality review of every user-facing page. NFR targets: [paste accessibility NFRs]. First, screenshot the living style guide at /design-system as your reference for how components should look. Then review every product page and check: loading states (every async action must show a loading indicator), error states (every form and API call must show user-friendly error feedback), empty states (every list/table must handle zero items gracefully), mobile responsiveness (test at 375px viewport — touch targets >= 44px, no horizontal scroll, readable text), form validation (inline feedback, not just alert()), transition smoothness (no layout shifts, no janky animations), visual consistency (compare each page's components against the style guide — buttons, inputs, cards, colors, spacing should match). Report issues with page, severity, and screenshot."

### Step 6.1b — Eval Harness

Run the Eval Harness Protocol (`protocols/eval-harness.md`). Define 8-15 concrete, executable eval cases from the audit findings and architecture doc. For UI flows, eval cases should use agent-browser: "agent-browser open /dashboard -> agent-browser click @submit -> agent-browser wait --text Success -> expect text contains confirmation ID". Run the eval agent. Record baseline pass rate. CRITICAL and HIGH failures feed into the metric loop in Step 6.2 as specific issues to fix.

### Step 6.2 — Metric Loop: Hardening Quality

Run the Metric Loop Protocol on the full codebase using audit findings as initial input. Define a composite metric based on what this project needs. Max 4 iterations.

When fixing, dispatch to the RIGHT specialist. Security → security agent. Accessibility → frontend agent. Don't send everything to one agent.

### Step 6.2b — Eval Re-run

Re-run the Eval Harness after the metric loop exits. All CRITICAL eval cases must now pass. If any CRITICAL case still fails, include it as evidence for the Reality Checker.

### Step 6.2c — E2E Testing (3 mandatory iterations)

HARD-GATE: ALL 3 ITERATIONS ARE MANDATORY. Do NOT stop after iteration 1 even if all tests pass. The purpose of 3 runs is to catch flaky tests, timing-dependent failures, and race conditions that only surface on repeated execution. Skip this step ONLY if the project has no user-facing frontend.

Generate and execute end-to-end tests using Playwright against the running application. Tests cover the **User Journeys** defined in `docs/plans/sprint-tasks.md` (Step 0 of the Planning Protocol). Each journey = one E2E test file.

**Iteration 1 — Generate & Run:**

Call the Agent tool — description: "E2E test generation" — mode: "bypassPermissions" — prompt:

"[COMPLEXITY: L] Generate and run end-to-end Playwright tests for this application.

INPUTS:
- User Journeys from docs/plans/sprint-tasks.md: [paste the User Journeys section — each journey becomes one E2E test]
- Architecture doc (API contracts): [paste relevant sections from docs/plans/architecture.md]
- NFRs from docs/plans/sprint-tasks.md: [paste — use performance thresholds as test assertions]
- Visual Design Spec (component selectors): [paste relevant sections from docs/plans/visual-design-spec.md]

REQUIREMENTS:
1. One E2E test per User Journey from sprint-tasks.md (each journey = one test file covering the full flow)
2. Use Page Object Model pattern — one page object per major view
3. Use data-testid selectors (add them to components if missing)
4. Wait for API responses, NEVER use arbitrary timeouts (no waitForTimeout)
5. Capture screenshots at critical verification points
6. Configure multi-browser: Chromium + Firefox + WebKit
7. Set up playwright.config.ts with: fullyParallel, retries: 0 (we handle retries ourselves), screenshot: 'only-on-failure', video: 'retain-on-failure', trace: 'on-first-retry'
8. Run all tests. Report: total, passed, failed, with failure details and screenshot paths.
9. Commit: 'test: e2e test suite for critical user journeys'

Test priority:
- CRITICAL: Auth, core feature happy path, data submission, payment/transaction flows
- HIGH: Search, filtering, navigation, error states
- MEDIUM: Responsive layout, animations, edge cases"

Record results: total tests, pass count, fail count, failure details. Log to `docs/plans/.build-state.md` under `## E2E Testing`:

```
| Iter | Total | Passed | Failed | Flaky | Top Failure |
|------|-------|--------|--------|-------|-------------|
| 1    | ...   | ...    | ...    | ...   | ...         |
```

**Iteration 2 — Fix & Re-run:**

Call the Agent tool — description: "E2E fix iteration 2" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Fix E2E test failures from iteration 1: [paste failure details — test names, error messages, screenshot paths]. Diagnose each as real bug, flaky test, or missing selector. Fix accordingly — do NOT delete or skip tests. Re-run ALL tests. Commit: 'fix: e2e test failures iteration 2'."

Record results in the E2E table. Identify flaky candidates (passed iter 1, failed iter 2 or vice versa).

**Iteration 3 — Final Stability Run:**

Call the Agent tool — description: "E2E stability run" — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Final E2E stability run (3 of 3). Previous results — Iter 1: [pass/fail counts], Iter 2: [pass/fail counts], Flaky candidates: [list]. Run ALL tests with --repeat-each=3. Quarantine inconsistent tests with test.fixme(). Fix remaining consistent failures. PASS CRITERIA: 95%+ pass rate (quarantined flaky tests excluded but logged). Commit: 'test: e2e stability fixes iteration 3'."

Record final results. Include in Reality Checker evidence (Step 6.4 in `commands/build.md`).

### Step 6.2d — Autonomous Dogfooding

Run the agent-browser dogfood skill against the running app. Unlike the per-task smoke tests (which verify specific acceptance criteria), dogfooding is **exploratory** — it autonomously navigates every reachable page, clicks buttons, fills forms, checks console errors, and finds issues we didn't think to test.

Start the dev server if not running. Then invoke the dogfood skill:

Call the Agent tool — description: "Dogfood the app" — mode: "bypassPermissions" — prompt: "Run the agent-browser dogfood skill against the running app at http://localhost:[port]. Explore every reachable page. Click every button. Fill every form. Check console for errors. Report a structured list of issues with severity ratings (critical/high/medium/low), screenshots, and repro steps. If dogfood skill is not available, use agent-browser manually: snapshot each page, click all interactive elements, check errors and network requests. Also evaluate UX quality: missing loading states, poor error messages, broken mobile layouts (resize to 375px), visual inconsistencies, missing empty states, form validation gaps. Report UX issues separately from functional issues."

**Fix loop:** For each CRITICAL or HIGH issue found:
1. Classify: is this a code bug (fix in Phase 5 style — spawn implementation fix agent) or a structural problem (needs architecture change — spawn architect agent to propose a fix plan, then implementation agent to execute)?
2. Spawn the appropriate fix agent with: the issue description, repro steps, screenshot, affected page/component.
3. After fixes, re-run dogfood on the affected pages only (not the full app). If new CRITICAL/HIGH issues appear, repeat. Max 3 fix cycles.

MEDIUM/LOW issues: log to `docs/plans/build-log.md` for the Reality Checker.

### Step 6.2e — Fake Data Detector

Call the Agent tool — description: "Fake data audit" — mode: "bypassPermissions" — prompt: "Run the Fake Data Detector Protocol (protocols/fake-data-detector.md). Check for mock/hardcoded data in production paths. Static analysis: grep for Math.random() business data, hardcoded API responses, setTimeout faking async, placeholder text. Dynamic analysis: inspect HAR files from docs/plans/evidence/ for missing real API calls, static responses, absent WebSocket traffic. Report findings with file:line references and severity."

**Fix loop:** For each CRITICAL finding:
1. Spawn a fix agent with: the finding (file:line, what's fake, what it should be), and the relevant source files.
2. The fix agent replaces fake data with real API calls, real WebSocket connections, real data sources. If real data sources aren't available (missing API keys, no backend), the fix agent must flag this as a blocker — not paper over it with better-looking fake data.
3. After fixes, re-run the fake data detector (static checks only — fast). Max 2 fix cycles.

Remaining findings feed into the Reality Checker in Step 6.4 (in `commands/build.md`).

## Phase 7 — Ship (web branch)

### Step 7.1 — Documentation (web)

Call the Agent tool — description: "Documentation" — mode: "bypassPermissions" — prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

Deployment target per the design doc (Vercel/Netlify/Railway/Fly.io/etc.) — include the deploy flow specific to that target in the README.
