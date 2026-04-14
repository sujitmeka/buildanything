# Web Phase Branches

_Loaded into orchestrator session context when `project_type=web` (the default). Contains per-phase web-specific instructions. Mode-agnostic phase scaffolding lives in `commands/build.md`._

## Phase 3 — Design (web branch)

**Goal:** Lock a 6-axis Visual DNA card, then compose — not reconstruct — the product's visual system from a vendored component library. Every downstream step reads the DNA. Compositional beats reconstructive for visual quality. Fully autonomous.

**Skip if** the project has no user-facing frontend (CLI tools, pure APIs, backend services).

HARD-GATE: UI/UX IS THE PRODUCT. This phase is a full peer to Architecture and Build — not a footnote, not an afterthought, not a "nice to have." Do NOT skip, compress, or rush this phase for any reason. Brand Guardian MUST lock the Visual DNA at Step 3.0 before any other agent runs. Every downstream step reads `docs/plans/visual-dna.md`. The `/design-system` route must be rendered and iterated with Playwright-verified feedback from the Design Critic before a single line of product code is written. Phase 4 (Build) Step 4.0 Scaffold WILL NOT START without both `docs/plans/visual-dna.md` AND `docs/plans/visual-design-spec.md`. If either is missing, return here.

HARD-GATE: **Compositional not reconstructive.** From Step 3.2 onward, every visual element that has a library variant MUST be mapped to that variant in `docs/plans/component-manifest.md`. Writing components from scratch when the library covers the case is a HARD-GATE violation that the cleanup agent will revert.

### Step 3.0 — Visual DNA Selection (DNA owner, single agent)

Dispatch a single agent to lock the 6-axis Visual DNA card that governs every downstream step in this phase.

Call the Agent tool once:

1. Description: "Visual DNA selection" — subagent_type: `design-brand-guardian` — prompt: "You are the DNA Owner for this build. Read these inputs: `docs/plans/design-doc.md` (product concept, user, voice), `docs/plans/findings-digest.md` (reference sites the user mentioned, competitor aesthetic landscape), `docs/plans/architecture.md` (stack constraints — e.g. server-rendered Rails can't ship Three.js), `docs/plans/quality-targets.json` (perf budget constrains motion and material choices), `docs/plans/user-decisions.md` (if the user said 'like Linear' or 'make it playful' during brainstorm). Lock a 6-axis Visual DNA card per the schema in `protocols/visual-dna.md`. The 6 axes: **Scope** (Marketing / Product / Dashboard / Internal Tool — gates library install), **Density** (Airy / Balanced / Dense), **Character** (Minimal / Editorial / Maximalist / Brutalist / Playful), **Material** (Flat / Glassy / Physical / Neumorphic), **Motion** (Still / Subtle / Expressive / Cinematic), **Type** (Neutral Sans / Humanist Sans / Serif-forward / Display-forward / Mono-accented). Consult the incompatibility matrix in `protocols/visual-dna.md` — you are FORBIDDEN from picking illegal combinations (e.g. Dashboard + Cinematic is contradictory). Write the locked DNA card to `docs/plans/visual-dna.md`."

Output: `docs/plans/visual-dna.md` — the locked DNA card. Every downstream Phase 3 step reads this file, and Phase 4 implementers read it via `refs.json`.

### Step 3.1 — Visual Research (2 agents, parallel, both Playwright-driven)

Research is now goal-directed — validate and enrich the locked DNA, not catalogue the landscape. Only surface references that exemplify one or more of the chosen DNA axes.

Call the Agent tool 2 times in one message:

1. Description: "Competitive visual audit" — subagent_type: `visual-research` — prompt: "Mode: `competitive-audit`. Read `docs/plans/visual-dna.md` to understand the locked DNA. Find 5-8 rival UIs that exemplify the chosen DNA axes (NOT all competitors — only ones that nail the axes we chose). Use Playwright to screenshot each at desktop 1920x1080 and mobile 375x812. For each site, analyze which DNA axes it nails and which it doesn't. Save screenshots to `docs/plans/design-references/competitors/`. Append findings to `docs/plans/design-references.md` grouped by DNA axis (motion refs, material refs, typography refs, character refs, density refs). Optional caller-supplied competitor URLs: [list or 'none']."

2. Description: "Design inspiration mining" — subagent_type: `visual-research` — prompt: "Mode: `inspiration-mining`. Read `docs/plans/visual-dna.md`. Search Awwwards.com, Godly.website, and SiteInspire for award-winning sites that match the DNA axes. Use Playwright to screenshot the top 5-8 results at desktop 1920x1080 and mobile 375x812. Save to `docs/plans/design-references/inspiration/`. Append findings to `docs/plans/design-references.md` grouped by DNA axis. Tag every reference with the specific axis (or axes) it validates."

Output: `docs/plans/design-references.md` — reference paths grouped by DNA axis, ready to feed Step 3.2 component mapping and Step 3.6 critic scoring.

### Step 3.2 — Component Library Mapping (single agent, HARD-GATE source)

This is the compositional step. The Visual Designer picks specific library component variants for every slot the product needs, using the static DNA→variant catalog as its source of truth. The output is a locked manifest that Phase 4 implementers MUST import from.

Call the Agent tool once:

1. Description: "Component library mapping" — subagent_type: `design-ui-designer` — prompt: "Read `docs/plans/visual-dna.md`, `docs/plans/design-references.md`, and `docs/library-refs/component-library-catalog.md` (the static reference mapping DNA-axis combinations to library component variants). Pick specific component variants for each slot the product needs: hero, cards, cta, nav, marquee, chart, 3D, form elements, modals. The catalog is authoritative — when the DNA matches a row, use the variants that row specifies; do not reinvent. Write `docs/plans/component-manifest.md` with the locked component picks, one row per slot, naming the library and the variant. For any slot the catalog doesn't cover, emit a row tagged 'manifest gap' with a short fallback plan (stock shadcn primitive plus notes)."

Output: `docs/plans/component-manifest.md` — locked component manifest.

**HARD-GATE:** Phase 4 implementers MUST import from this manifest. Writing components from scratch when the manifest names one is a HARD-GATE violation. The cleanup agent will flag and revert custom-written components that have a manifest entry. See the Phase 4 HARD-GATE block below.

### Step 3.2b — DNA Persona Check

Call the Agent tool — description: "DNA persona check" — subagent_type: design-ux-researcher — prompt: "Read docs/plans/visual-dna.md (the locked 6-axis DNA card) + docs/plans/design-doc.md (#persona and #jobs-to-be-done sections) + docs/plans/findings-digest.md. Validate: does the chosen Visual DNA actually serve this persona and these jobs-to-be-done? Cross-check each DNA axis against the persona's context (e.g., if persona is 'senior enterprise buyer on a tight schedule' but DNA chose Maximalist + Cinematic, that's wrong — Enterprise/Minimal/Subtle fits better). Report any DNA-persona mismatches. If mismatches found, the Brand Guardian may need to re-lock the DNA (backward edge to Step 3.0). Save findings to docs/plans/dna-persona-check.md."

### Step 3.3 — UX Architecture (single agent)

Structural design must align to the locked DNA — a Dense layout behaves differently from an Airy layout even for the same user flow.

Call the Agent tool once:

1. Description: "UX architecture" — subagent_type: `design-ux-architect` — prompt: "Read `docs/plans/visual-dna.md`, `docs/plans/component-manifest.md`, and the #frontend anchor in `docs/plans/architecture.md`. Design information architecture, user flows, interaction patterns, and responsive strategy — all aligned to the locked DNA. Dense layout behaves differently than Airy layout even for the same flow; Cinematic motion reshapes page transitions versus Subtle motion. Map each user flow to the component-manifest slots it needs. Save to `docs/plans/ux-architecture.md`."

Output: `docs/plans/ux-architecture.md`.

### Step 3.4 — Visual Design Spec (single agent, second Visual Designer invocation)

The Visual Designer re-invokes as writer this time, producing the much richer Visual Design Spec with four new layers on top of the existing tokens.

Call the Agent tool once:

1. Description: "Visual design spec" — subagent_type: `design-ui-designer` — prompt: "Second invocation as writer. Read `docs/plans/visual-dna.md`, `docs/plans/component-manifest.md`, `docs/plans/ux-architecture.md`, and `docs/plans/design-references.md`. Write `docs/plans/visual-design-spec.md` with ALL the following layers:

**TOKENS** (existing): color system (hex, light + dark), typography scale, spacing (8px base), shadows, radius.

**MATERIAL SYSTEM** (NEW): glass parameters — surface opacity, border rgba, radius, blur radius — for each material variant referenced by the DNA Material axis. Include concrete examples for Flat / Glassy / Physical / Neumorphic variants even if the project only ships one.

**MOTION SYSTEM** (NEW): easings (cubic-bezier curves), duration clusters (fast / base / slow), scroll patterns (fade-up on intersection, parallax offsets), hover patterns (lift, scale, color shift), choreography notes (sequential reveals, staggered delays). Tune to the DNA Motion axis — Still has no animation, Subtle uses 200-300ms base, Expressive uses 400-600ms with curves, Cinematic uses 650-1100ms with GSAP.

**TYPOGRAPHY TUNING** (NEW): tracking rules at each size (e.g. 'eyebrow 11px uppercase +0.15em for Editorial'), optical sizing directives (opsz axis on variable fonts), variable font axes tuned per use case (wght for body, wght+opsz for display).

**COMPONENT STATE MATRIX** (existing): every component × every state (default / hover / focus / active / disabled / loading / error).

Every token, parameter, and rule must be derivable from the DNA card plus the design references. Cite the reference path for every non-obvious choice."

Output: `docs/plans/visual-design-spec.md` — substantially richer than the prior one-layer spec.

### Step 3.5 — Inclusive Visuals Check (single agent)

Call the Agent tool once:

1. Description: "Inclusive visuals check" — subagent_type: `design-inclusive-visuals-specialist` — prompt: "Read `docs/plans/visual-dna.md`, `docs/plans/component-manifest.md`, and `docs/plans/visual-design-spec.md`. Audit for representation gaps, imagery bias, color choices that exclude colorblind users, contrast failures, and culturally-specific iconography that doesn't translate. Write findings to `docs/plans/inclusive-visuals-audit.md`."

Output: `docs/plans/inclusive-visuals-audit.md`.

### Step 3.6 — Style Guide Implementation [METRIC LOOP]

This is the only Phase 3 step that writes code. Wrapped in a generator/critic metric loop per `protocols/metric-loop.md`. The generator builds the `/design-system` route by composing from the manifest; the Design Critic scores the rendered result against the DNA and references; the generator applies only the top issue each iteration.

**Generator (initial build):**

Call the Agent tool once:

1. Description: "Build living style guide" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[COMPLEXITY: L] Read `docs/plans/component-manifest.md` and `docs/plans/visual-design-spec.md`. Build a `/design-system` route with rendered, interactive examples of every chosen variant from the manifest. **HARD-GATE: Import from the installed libraries. Do NOT write components from scratch when the manifest names one.** Every component must be interactive (hover, focus, transitions all work). Mobile-responsive. This ships with the product. Commit: 'feat: living style guide'."

**Metric loop wrapper** (per `protocols/metric-loop.md`):

- **Critic** — Call the Agent tool — description: "Design critic scoring pass" — subagent_type: `design-critic` — prompt: "Read the rendered `/design-system` route via Playwright screenshot (desktop 1920x1080 + mobile 375x812), plus `docs/plans/visual-dna.md`, `docs/plans/design-references.md`, and `docs/plans/visual-design-spec.md`. Score the gap on **6 DNA axes** (Scope fit, Density, Character, Material, Motion, Type — 20 points each) plus **5 craft dimensions** (whitespace rhythm, visual hierarchy, motion coherence, color harmony, typographic refinement — 20 points each). Total 220. Target 180. Every finding must cite a specific element with file:line reference AND reference the DNA card or design-references path — score a gap, not an opinion. Suggest concrete improvements ('the card padding is 16px but the DNA calls for Airy density — bump to 32px'). Default verdict: NEEDS WORK. Never edit code. Max 5 iterations before exit."

- **Generator (re-invocation)** — Call the Agent tool — description: "Apply critic's top issue" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "Design Critic returned these top issues: [paste top issue]. Apply ONLY the top issue. Do not re-critique. Do not refactor other parts. Re-render the `/design-system` route. Return the commit SHA."

- **Exit conditions:** quality target hit (score ≥ 180), stall (no score improvement for 2 consecutive rounds), or max iterations (5 total).

Record the score history to `docs/plans/build-log.md` under `## Design Critic Loop`.

### Step 3.7 — A11y Design Review (single agent)

WCAG 2.2 AA runtime check on the rendered style guide plus any key product pages that exist at this point.

Call the Agent tool once:

1. Description: "A11y design review" — subagent_type: `a11y-architect` — prompt: "WCAG 2.2 AA runtime check on the rendered `/design-system` route and any key product pages. Check contrast, focus order, keyboard navigation, screen reader labels, reduced-motion variants, and touch targets (>= 44px). Use Playwright and axe-core. Save findings to `docs/plans/a11y-design-review.md` with severity tags (Critical / Serious / Moderate / Minor)."

Output: `docs/plans/a11y-design-review.md`.

### Step 3.8 — Autonomous Quality Gate

Log to `docs/plans/build-log.md`: final screenshot paths, Design Critic score history (per-round totals plus per-axis subscores), a11y findings count by severity, and a DNA compliance score derived from the critic's 6 DNA-axis subscores. No user pause.

Phase 4 HARD-GATE: web mode requires BOTH `docs/plans/visual-dna.md` AND `docs/plans/visual-design-spec.md` AND `docs/plans/component-manifest.md` to exist before Phase 4 starts. If any is missing, return to Phase 3.

## Phase 4 — Build (web branch)

Phase 4 in the web branch contains the Step 4.0 Scaffold work (project scaffolding, design system setup, acceptance test stubs) plus the Step 4.1+ per-task implementation flow. Per-task implementation runs in parallel batches per the pattern in `commands/build.md` Phase 4 (Briefing Officer → Implementer → Senior Dev cleanup → code review pair → Metric Loop → Verify Service). The web-specific prompt templates for the per-task flow live in the "Phase 4 — Build per-task flow (web branch)" section below.

<HARD-GATE>
PHASE 4 IMPLEMENTERS — compositional not reconstructive.

If a task requires a button, card, hero, chart, modal, form field, marquee, bento grid, or 3D element, the implementer MUST import the variant specified in `docs/plans/component-manifest.md`. Writing a custom component when the manifest names one is a HARD-GATE violation. The code-simplifier cleanup agent will flag and revert custom-written components that have a manifest entry.

Escape hatch: if the manifest doesn't cover the component a task needs (legitimate gap — domain-specific widget), the implementer writes it AND emits a decision-log row flagging 'manifest gap'. Post-build, the catalog is updated to cover that component for future builds. Missing coverage becomes a learning, not a silent drift back to from-scratch.
</HARD-GATE>

### Step 4.0 — Scaffold (web)

Step 4.0 is three sequential dispatches: project scaffolding, design system setup, and acceptance test scaffolding. Scaffold verification (the 7-check Verify Protocol) must PASS before Step 4.1+ begins.

#### 4.0.a — Project scaffolding

Call the Agent tool — description: "Project scaffolding" — subagent_type: `engineering-rapid-prototyper` — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Set up the project from this architecture: [paste]. Create directory structure, dependencies, build tooling, linting config, test framework with one passing test, .gitignore, .env.example. Read `docs/plans/visual-dna.md` Scope axis and only install the component libraries the DNA needs — never ship Three.js for an internal admin panel. Commit: 'feat: initial scaffolding'."

#### 4.0.b — Design system setup

Call the Agent tool — description: "Design system setup" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "Implement the design system from the Visual Design Spec: [paste from docs/plans/visual-design-spec.md]. Create CSS tokens matching the spec's color system, typography scale, spacing system, shadow/elevation tokens, and base layout components. The living style guide from Phase 3 is the reference implementation — components must match. Commit: 'feat: design system'."

#### 4.0.c — Acceptance test scaffolding

Call the Agent tool — description: "Scaffold acceptance tests" — INTERNAL inline role-string: "Scaffold acceptance tests from sprint-tasks.md. Use Playwright Page Object Model. Each test should FAIL right now (features aren't built yet) — that's correct." — mode: "bypassPermissions" — prompt: "Read docs/plans/sprint-tasks.md. For every task with a Behavioral Test field, create a Playwright test stub in tests/e2e/acceptance/. Use Page Object Model. Each test should: navigate to the page, perform the interaction, assert the expected outcome. Tests should FAIL right now (features aren't built yet) — that's correct. Also ensure agent-browser is available (run `which agent-browser`). Commit: 'test: scaffold acceptance tests from sprint tasks'."

## Phase 4 — Build per-task flow (web branch)

These are the web-specific prompt templates for the per-task flow inside Phase 4 Step 4.1+. The orchestrator-side machinery (parallel batching by DAG, Briefing Officer dispatch, Senior Dev cleanup, code review pair, Metric Loop, Verify Service) lives in `commands/build.md` Phase 4. This section only overrides the implementer dispatch and UI-specific verification prompts.

### Step 4.1+ — Task execution overrides (web)

#### Implementer dispatch (web)

Call the Agent tool — description: "[task name]" — subagent_type: `[pick per task type]` — mode: "bypassPermissions" — prompt: "TASK: [task description + acceptance criteria]. CONTEXT MAP from Briefing Officer: [paste Briefing Officer output]. Use the Read tool to pull refs on demand — design-doc.md, architecture.md, visual-design-spec.md, component-manifest.md — do NOT expect full pasted content. For UI tasks: the living style guide at /design-system shows every component's exact styling and states — match it, and import from the manifest-named library variants (Phase 4 HARD-GATE — do not write components from scratch when the manifest names one). Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

Pick the right developer framing AND the matching `subagent_type`:
- Frontend / UI tasks → `engineering-frontend-developer`
- Backend / API / data-layer tasks → `engineering-backend-architect`
- AI / ML / model-integration tasks → `engineering-ai-engineer`
- Generalist / refactor / cross-cutting tasks → `engineering-senior-developer`

Set `[COMPLEXITY: S/M/L]` based on the task's Size from sprint-tasks.md.

#### Metric Loop (web behavioral verification)

For UI-facing tasks, include behavioral verification: the measurement agent should use agent-browser to verify the feature renders and responds to interaction, not just read the code. Max 5 iterations. Other Metric Loop mechanics (generator re-invocation, critic dispatch, exit conditions) follow `commands/build.md` Phase 4.

#### Behavioral Smoke Test (web)

Uses agent-browser against localhost to open the app, execute the task's behavioral acceptance criteria, and verify the feature actually works. Evidence saved to `docs/plans/evidence/[task-name]/`: annotated screenshot, snapshot diff, error log, network log, HAR file.

## Phase 5 — Audit (web branch)

Phase 5 in the web branch contains the 5-agent audit team, eval harness, hardening metric loop, 3-iteration E2E testing, autonomous dogfooding, and fake-data detector. The orchestrator-side machinery (TEAM dispatch, Feedback Synthesizer, evidence writes) follows `commands/build.md` Phase 5. Reality Check and LRR Aggregation moved to Phase 6 — do NOT run them here.

### Step 5.1 — Initial Audit (6 agents in parallel, ONE message)

Read the NFRs from `docs/plans/quality-targets.json` (and `docs/plans/sprint-tasks.md` NFR section if present). Pass the relevant NFR thresholds to each audit agent so they have concrete targets, not generic checks. The sixth auditor is the Brand Guardian drift check — it runs alongside the technical auditors to catch DNA drift before the Phase 6 LRR Brand Guardian chapter renders its verdict.

Call the Agent tool 6 times in one message:

1. Description: "API testing" — subagent_type: `testing-api-tester` — Prompt: "Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. NFR targets: [paste performance and reliability NFRs]. Report findings with counts."

2. Description: "Performance audit" — subagent_type: `testing-performance-benchmarker` — Prompt: "Measure response times, identify bottlenecks, flag performance issues. NFR targets: [paste performance NFRs — e.g., API < 200ms, page load < 3s]. Report benchmarks AGAINST these targets.

**Bundle budget per Scope axis** (read `docs/plans/visual-dna.md` Scope field):
- Marketing:     500KB gzipped (excluding images), LCP <= 2.5s
- Product:       300KB gzipped, LCP <= 1.8s
- Dashboard:     400KB gzipped, LCP <= 2.0s
- Internal Tool: 200KB gzipped, LCP <= 1.5s

Exceeding the budget by >25% auto-blocks the Phase 6 LRR SRE chapter. Budget violations route back to Phase 3.2 (component mapping — swap a heavy variant for a lighter one) OR Phase 4 (code-splitting, lazy-loading, dynamic imports). Report budget-compliance per Scope axis, with the exact gzipped bundle size and LCP measurement."

3. Description: "Accessibility audit" — subagent_type: `a11y-architect` — Prompt: "WCAG 2.2 AA runtime compliance audit on all interfaces. NFR target: [paste accessibility NFR from quality-targets.json]. Check screen reader, keyboard nav, contrast, focus order, reduced-motion variants, touch targets >= 44px. Report issues with severity tags (Critical/Serious/Moderate/Minor). This is the same agent that sets constraints at Phase 2 and judges at Phase 6 LRR — keep the standards consistent across all three invocations."

4. Description: "Security audit" — subagent_type: `engineering-security-engineer` — Prompt: "Security review: auth, input validation, data exposure, dependency vulnerabilities. NFR targets: [paste security NFRs]. Report findings with severity."

5. Description: "UX quality audit" — subagent_type: `design-ux-researcher` — Prompt: "UX quality review of every user-facing page. NFR targets: [paste accessibility NFRs]. First, screenshot the living style guide at /design-system as your reference for how components should look. Then review every product page and check: loading states (every async action must show a loading indicator), error states (every form and API call must show user-friendly error feedback), empty states (every list/table must handle zero items gracefully), mobile responsiveness (test at 375px viewport — touch targets >= 44px, no horizontal scroll, readable text), form validation (inline feedback, not just alert()), transition smoothness (no layout shifts, no janky animations), visual consistency (compare each page's components against the style guide — buttons, inputs, cards, colors, spacing should match). Report issues with page, severity, and screenshot."

6. Description: "Brand Guardian drift check" — subagent_type: `design-brand-guardian` — Prompt: "You are the Phase 5 drift check (proposed state §5 re-invite). Read `docs/plans/visual-dna.md` (the DNA card locked at Phase 3.0) + the actually-built pages via Playwright screenshots under `docs/plans/evidence/`. Score whether Phase 4 implementers stayed true to the DNA or drifted away from it. Specifically check each of the 6 DNA axes (Scope / Density / Character / Material / Motion / Type) against what the built product actually renders. Report drift count and specific elements (file:line references). Save findings to `docs/plans/evidence/brand-drift.md`. This is a drift check only — the Phase 6 LRR Brand Guardian chapter does the verdict. You do NOT issue a pass/fail here, only surface findings for the LRR chapter to read."

### Step 5.2 — Eval Harness

Run the Eval Harness Protocol (`protocols/eval-harness.md`). Define 8-15 concrete, executable eval cases from the audit findings and architecture doc. For UI flows, eval cases should use agent-browser: "agent-browser open /dashboard -> agent-browser click @submit -> agent-browser wait --text Success -> expect text contains confirmation ID". Run the eval agent. Record baseline pass rate. CRITICAL and HIGH failures feed into the metric loop in Step 5.3 as specific issues to fix.

### Step 5.3 — Metric Loop: Hardening Quality

Run the Metric Loop Protocol on the full codebase using audit findings as initial input. Define a composite metric based on what this project needs. Max 4 iterations.

When fixing, dispatch to the RIGHT specialist. Security → security agent. Accessibility → frontend agent. Don't send everything to one agent.

### Step 5.3b — Eval Re-run

Re-run the Eval Harness after the metric loop exits. All CRITICAL eval cases must now pass. If any CRITICAL case still fails, include it as evidence for the Phase 6 Reality Check sweep.

### Step 5.4 — E2E Testing (3 mandatory iterations)

HARD-GATE: ALL 3 ITERATIONS ARE MANDATORY. Do NOT stop after iteration 1 even if all tests pass. The purpose of 3 runs is to catch flaky tests, timing-dependent failures, and race conditions that only surface on repeated execution. Skip this step ONLY if the project has no user-facing frontend.

Generate and execute end-to-end tests using Playwright against the running application. Tests cover the **User Journeys** defined in `docs/plans/sprint-tasks.md` (Step 0 of the Planning Protocol). Each journey = one E2E test file.

**Iteration 1 — Generate & Run:**

Call the Agent tool — description: "E2E test generation" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt:

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

Call the Agent tool — description: "E2E fix iteration 2" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Fix E2E test failures from iteration 1: [paste failure details — test names, error messages, screenshot paths]. Diagnose each as real bug, flaky test, or missing selector. Fix accordingly — do NOT delete or skip tests. Re-run ALL tests. Commit: 'fix: e2e test failures iteration 2'."

Record results in the E2E table. Identify flaky candidates (passed iter 1, failed iter 2 or vice versa).

**Iteration 3 — Final Stability Run:**

Call the Agent tool — description: "E2E stability run" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[COMPLEXITY: M] Final E2E stability run (3 of 3). Previous results — Iter 1: [pass/fail counts], Iter 2: [pass/fail counts], Flaky candidates: [list]. Run ALL tests with --repeat-each=3. Quarantine inconsistent tests with test.fixme(). Fix remaining consistent failures. PASS CRITERIA: 95%+ pass rate (quarantined flaky tests excluded but logged). Commit: 'test: e2e stability fixes iteration 3'."

Record final results. Include in the Phase 6.0 Reality Check evidence sweep (see `commands/build.md` Phase 6 Step 6.0).

### Step 5.5 — Autonomous Dogfooding

Run the agent-browser dogfood skill against the running app. Unlike the per-task smoke tests (which verify specific acceptance criteria), dogfooding is **exploratory** — it autonomously navigates every reachable page, clicks buttons, fills forms, checks console errors, and finds issues we didn't think to test.

Start the dev server if not running. Then invoke the dogfood skill:

Call the Agent tool — description: "Dogfood the app" — subagent_type: `testing-evidence-collector` — mode: "bypassPermissions" — prompt: "Run the agent-browser dogfood skill against the running app at http://localhost:[port]. Explore every reachable page. Click every button. Fill every form. Check console for errors. Report a structured list of issues with severity ratings (critical/high/medium/low), screenshots, and repro steps. If dogfood skill is not available, use agent-browser manually: snapshot each page, click all interactive elements, check errors and network requests. Also evaluate UX quality: missing loading states, poor error messages, broken mobile layouts (resize to 375px), visual inconsistencies, missing empty states, form validation gaps. Report UX issues separately from functional issues."

Classification and fix-routing of Dogfood findings is handled by the Feedback Synthesizer at `commands/build.md` Phase 5 Step 5.4 — do NOT self-classify or spawn fix agents from this step.

### Step 5.6 — Fake Data Detector

Call the Agent tool — description: "Fake data audit" — subagent_type: `silent-failure-hunter` — mode: "bypassPermissions" — prompt: "Run the Fake Data Detector Protocol (protocols/fake-data-detector.md). Check for mock/hardcoded data in production paths. Static analysis: grep for Math.random() business data, hardcoded API responses, setTimeout faking async, placeholder text. Dynamic analysis: inspect HAR files from docs/plans/evidence/ for missing real API calls, static responses, absent WebSocket traffic. Report findings with file:line references and severity."

**Fix loop:** For each CRITICAL finding:
1. Spawn a fix agent with: the finding (file:line, what's fake, what it should be), and the relevant source files.
2. The fix agent replaces fake data with real API calls, real WebSocket connections, real data sources. If real data sources aren't available (missing API keys, no backend), the fix agent must flag this as a blocker — not paper over it with better-looking fake data.
3. After fixes, re-run the fake data detector (static checks only — fast). Max 2 fix cycles.

Remaining findings feed into the Phase 6.0 Reality Check evidence sweep (see `commands/build.md` Phase 6 Step 6.0).

## Phase 7 — Ship (web branch)

### Step 7.1 — Documentation (web)

Call the Agent tool — description: "Documentation" — subagent_type: `engineering-technical-writer` — mode: "bypassPermissions" — prompt: "Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

Deployment target per the design doc (Vercel/Netlify/Railway/Fly.io/etc.) — include the deploy flow specific to that target in the README.
