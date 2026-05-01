# Web Phase Branches

_Loaded into orchestrator session context when `project_type=web` (the default). Contains per-phase web-specific instructions. Mode-agnostic phase scaffolding lives in `commands/build.md`._

## CONTEXT header injection (web branch — project_type hardcoded)

Every `subagent_type:` dispatch in this file prepends a CONTEXT header to its prompt. Per `commands/build.md` CONTEXT HEADER HARD-GATE: the orchestrator MUST render this header ONCE at the start of each phase by resolving all values into concrete strings, then reuse the rendered header verbatim for every dispatch in that phase. DO NOT leave `{read from ...}` placeholders — resolve them before the first dispatch.

```
CONTEXT:
  project_type: web
  phase: <resolved: current phase number>
  dna: <resolved: 7-axis Brand DNA values extracted from `DESIGN.md` `## Overview > ### Brand DNA` block — NOT the full file content, just the axis values. Include only if phase >= 3 AND DESIGN.md exists>

TASK:
```

**Resolution rules:**
- `dna` = the 7 axis values only (Scope, Density, Character, Material, Motion, Type, Copy) extracted from `DESIGN.md` `## Overview > ### Brand DNA` — NOT the full `DESIGN.md` content. ~100 tokens, not ~5K.
- Phase 3 Step 3.0 (Visual DNA Selection) is the ONE exception — it runs BEFORE `DESIGN.md` exists, so its CONTEXT omits `dna`.
- The rendered header is a stable prefix — it does not change between dispatches within a phase.

Individual dispatches below reference `[CONTEXT header above]` and rely on this rendered template.

## Phase 2 — Architecture (web branch additions)

### Step 2.9 — Visual DNA Directional Preview (pre-Gate-2)

Before the Quality Gate 2 approval prompt in `commands/build.md` is rendered, dispatch a lightweight directional DNA preview. This is NOT the full 6-axis lock (that remains Phase 3.0's job) — it is a 3-5 bullet sanity-check surfaced at Gate 2 so the user catches wrong visual direction before Phase 3+ burns tokens against it.

Call the Agent tool once:

1. Description: "Visual DNA directional preview" — subagent_type: `design-brand-guardian` — prompt: "[CONTEXT header above — phase: 2. NOTE: `dna` is omitted — this step produces the preview, not the lock.] Read `docs/plans/design-doc.md` (#persona, #scope, #voice), `docs/plans/phase1-scratch/findings-digest.md` (reference signals), and `docs/plans/architecture.md` (stack constraints). Emit a 3-5 bullet DIRECTIONAL preview of the intended Visual DNA — brand read in one line, then proposed leanings on Scope, Character, Material/Motion, and Type. NO rationale paragraphs, NO reference citations, NO incompatibility-matrix work. This is a sanity-check for the user at Gate 2, not the locked card. Save to `docs/plans/visual-dna-preview.md` as a flat bullet list. Target 150 tokens of output, max 250."

Output: `docs/plans/visual-dna-preview.md` — surfaced by the orchestrator in the Gate 2 prompt alongside Architecture + Sprint Task List. Phase 3.0 Brand Guardian re-invokes to produce the full locked 6-axis card; the preview is discarded after Gate 2 approval.

## Phase 3 — Design (web branch)

**Goal:** Lock the 7-axis Brand DNA inside `DESIGN.md` Pass 1, then compose — not reconstruct — the product's visual system from a vendored component library, then complete `DESIGN.md` Pass 2 with full tokens + prose. Every downstream step reads `DESIGN.md`. Compositional beats reconstructive for visual quality. Fully autonomous.

**Skip if** the project has no user-facing frontend (CLI tools, pure APIs, backend services).

HARD-GATE: UI/UX IS THE PRODUCT. This phase is a full peer to Architecture and Build — not a footnote, not an afterthought, not a "nice to have." Do NOT skip, compress, or rush this phase for any reason. Brand Guardian MUST author Pass 1 of `DESIGN.md` (Overview + Brand DNA + Do's and Don'ts) at Step 3.0 before any other agent runs. Every downstream step reads `DESIGN.md`. The `/design-system` route must be rendered and iterated with Playwright-verified feedback from the Design Critic before a single line of product code is written. Phase 4 (Build) Step 4.0 Scaffold WILL NOT START without `DESIGN.md` complete (Pass 2 finished). If missing or incomplete, return here.

HARD-GATE: **Compositional not reconstructive.** From Step 3.2 onward, every visual element that has a library variant MUST be mapped to that variant in `docs/plans/component-manifest.md`. Writing components from scratch when the library covers the case is a HARD-GATE violation that the cleanup agent will revert.

### Step 3.0 — DESIGN.md Pass 1 — Brand DNA + Overview + Do's and Don'ts (single agent)

Dispatch a single agent to author Pass 1 of `DESIGN.md` (repo root). Pass 1 locks the 7-axis Brand DNA, writes the Overview prose, and seeds the Do's and Don'ts. Pass 2 (token + remaining prose) lands at Step 3.4.

Call the Agent tool once:

1. Description: "DESIGN.md Pass 1 — Brand DNA + Overview" — subagent_type: `design-brand-guardian` — prompt: "[CONTEXT header above — phase: 3. NOTE: Step 3.0 omits `dna` because this step PRODUCES it.] You are the Brand Guardian authoring Pass 1 of `DESIGN.md`. The format is specified by `protocols/design-md-spec.md` (vendored). The pipeline contract is in `protocols/design-md-authoring.md`. Read both before writing.

Inputs (Read tool): `docs/plans/product-spec.md` (## App Overview for product identity, ## Screen Inventory for what screens exist, ## Permissions & Roles for complexity level — a dense admin panel needs different DNA than a simple consumer app), `docs/plans/design-doc.md` (product concept, user, voice), `docs/plans/phase1-scratch/findings-digest.md` (reference sites the user mentioned, competitor aesthetic landscape), `docs/plans/architecture.md` (stack constraints — e.g. server-rendered Rails can't ship Three.js), `docs/plans/quality-targets.json` (perf budget constrains motion and material choices), `docs/plans/phase1-scratch/user-decisions.md`.

Lock the 7-axis Brand DNA per `protocols/design-md-authoring.md` §3 (incompatibility matrix). The 7 axes: **Scope** (Marketing / Product / Dashboard / Internal Tool), **Density** (Airy / Balanced / Dense), **Character** (Minimal / Editorial / Maximalist / Brutalist / Playful), **Material** (Flat / Glassy / Physical / Neumorphic), **Motion** (Still / Subtle / Expressive / Cinematic), **Type** (Neutral Sans / Humanist Sans / Serif-forward / Display-forward / Mono-accented), **Copy** (Functional / Narrative / Punchy / Technical). You are FORBIDDEN from picking illegal combinations from the §3 matrix.

Write `DESIGN.md` at the **repository root** (NOT under `docs/plans/`) using the Pass 1 skeleton in `protocols/design-md-authoring.md` §5:
- YAML front matter: `version: alpha`, `name: <Brand Name>`. Leave colors/typography/rounded/spacing/components empty for Pass 2.
- `## Overview` with 2-4 paragraph brand description.
- `### Brand DNA` h3 subsection listing all 7 axis values.
- `### Rationale` h3 with 4-8 sentences citing design-doc.md sections + findings-digest signals.
- `### Locked At` h3 with `locked_at` (ISO-8601, single-write), `locked_by: design-brand-guardian`, `build_session`.
- `### References` h3 with at least 2 entries, each tied to specific axis pairs.
- `## Colors`, `## Typography`, `## Layout`, `## Elevation & Depth`, `## Shapes`, `## Components` — present as headings with `<!-- Pass 2 — UI Designer at Step 3.4 -->` placeholder body. Section ORDER matters; the linter enforces it.
- `## Do's and Don'ts` with at least 4 bullets (≥2 Do, ≥2 Don't), enforcing the anti-slop gates in §4 of the authoring protocol against the user's references.

Apply the anti-slop gates from `protocols/design-md-authoring.md` §4 (font hard-ban, font overuse-ban, AI-slop pattern ban, Copy axis validation). When the user's references push toward a forbidden choice, reject it, pick the closest legal alternative, and emit a decision-log row naming the rejection.

Output: `DESIGN.md` at repo root. Every downstream Phase 3 step reads this file."

Output: `DESIGN.md` (repo root) — Pass 1. Step 3.4 completes Pass 2.

#### Step 3.0.idx — DESIGN.md Pass 1 graph index

After `design-brand-guardian` returns and `DESIGN.md` is on disk, index it into the build graph. Slice 2 graph index — required for downstream agents.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js DESIGN.md`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

### Step 3.1 — Visual Research (2 agents, parallel, both Playwright-driven)

Research is now goal-directed — validate and enrich the locked DNA, not catalogue the landscape. Only surface references that exemplify one or more of the chosen DNA axes.

Call the Agent tool 2 times in one message:

1. Description: "Competitive visual audit" — subagent_type: `visual-research` — prompt: "[CONTEXT header above — phase: 3] Mode: `competitive-audit`. Read `DESIGN.md` (`## Overview > ### Brand DNA`) to understand the locked DNA. Find 5-8 rival UIs that exemplify the chosen DNA axes (NOT all competitors — only ones that nail the axes we chose). Use Playwright to screenshot each at desktop 1920x1080 and mobile 375x812. For each site, analyze which DNA axes it nails and which it doesn't. Save screenshots to `docs/plans/design-references/competitors/`. Append findings to `docs/plans/design-references.md` grouped by DNA axis (motion refs, material refs, typography refs, character refs, density refs). Optional caller-supplied competitor URLs: [list or 'none']."

2. Description: "Design inspiration mining" — subagent_type: `visual-research` — prompt: "[CONTEXT header above — phase: 3] Mode: `inspiration-mining`. Read `DESIGN.md` (`## Overview > ### Brand DNA`). Search Awwwards.com, Godly.website, and SiteInspire for award-winning sites that match the DNA axes. Use Playwright to screenshot the top 5-8 results at desktop 1920x1080 and mobile 375x812. Save to `docs/plans/design-references/inspiration/`. Append findings to `docs/plans/design-references.md` grouped by DNA axis. Tag every reference with the specific axis (or axes) it validates."

Output: `docs/plans/design-references.md` — reference paths grouped by DNA axis, ready to feed Step 3.2 component mapping and Step 3.6 critic scoring.

#### Step 3.1.idx — Design references graph index

After both `visual-research` agents return and `docs/plans/design-references/` is populated with screenshots, index the directory into the build graph as Slice 5 reference fragments. Required for downstream agents.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/design-references/`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

### Step 3.2 — Component Library Mapping (single agent, HARD-GATE source)

This is the compositional step. The Visual Designer picks specific library component variants for every slot the product needs, using the static DNA→variant catalog as its source of truth. The output is a locked manifest that Phase 4 implementers MUST import from.

Call the Agent tool once:

1. Description: "Component library mapping" — subagent_type: `design-ui-designer` — prompt: "[CONTEXT header above — phase: 3] Read `DESIGN.md` (`## Overview > ### Brand DNA` for axis values; `### References` for reference paths), `docs/plans/design-references.md`, `docs/plans/product-spec.md` (## Screen Inventory for what screens exist, per-feature States and Empty/Loading/Error States sections for what component states are needed — e.g. a feature with 7 states needs more component variants than one with 3), and `docs/library-refs/component-library-catalog.md` (the static reference mapping DNA-axis combinations to library component variants). Pick specific component variants for each slot the product needs: hero, cards, cta, nav, marquee, chart, 3D, form elements, modals. The catalog is authoritative — when the DNA matches a row, use the variants that row specifies; do not reinvent. Write `docs/plans/component-manifest.md` with the locked component picks, one row per slot, naming the library and the variant. For any slot the catalog doesn't cover, emit a row tagged 'manifest gap' with a short fallback plan (stock shadcn primitive plus notes)."

Output: `docs/plans/component-manifest.md` — locked component manifest.

**HARD-GATE:** Phase 4 implementers MUST import from this manifest. Writing components from scratch when the manifest names one is a HARD-GATE violation. The cleanup agent will flag and revert custom-written components that have a manifest entry. See the Phase 4 HARD-GATE block below.

#### Step 3.2.idx — Component manifest graph index

After `design-ui-designer` returns and `docs/plans/component-manifest.md` is on disk, index it into the build graph. Slice 2 graph index — required for downstream agents.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/component-manifest.md`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

### Step 3.2b — DNA Persona Check

Call the Agent tool — description: "DNA persona check" — subagent_type: design-ux-researcher — prompt: "[CONTEXT header above — phase: 3] Read `DESIGN.md` (the full Pass 1 — `## Overview` including `### Brand DNA` is the locked 7-axis card and `### Rationale` explains why those axes were chosen) + docs/plans/design-doc.md (#persona and #jobs-to-be-done sections) + docs/plans/product-spec.md (## App Overview and per-feature Persona Constraints sections — these carry the specific behavioral patterns from research, e.g. 'user scans, doesn't read') + docs/plans/phase1-scratch/findings-digest.md. Validate: do the locked DNA axes actually serve this persona and these jobs-to-be-done? Cross-check each DNA axis against the persona's context (e.g., if persona is 'senior enterprise buyer on a tight schedule' but DNA chose Maximalist + Cinematic, that's wrong — Enterprise/Minimal/Subtle fits better). Report any DNA-persona mismatches. If mismatches found, the Brand Guardian may need to re-author DESIGN.md Pass 1 (backward edge to Step 3.0). Save findings to docs/plans/dna-persona-check.md."

### Step 3.3 — UX Architecture + Page Layouts (single agent)

Structural design must align to the locked DNA — a Dense layout behaves differently from an Airy layout even for the same user flow. This step produces BOTH the UX architecture (flows, navigation, IA) AND per-screen page specs with ASCII wireframes. Flows and layouts inform each other — a checkout flow might be 2 steps or 3 depending on what fits spatially, and a sidebar nav only makes sense if the screen count warrants it.

Call the Agent tool once:

1. Description: "UX architecture + page layouts" — subagent_type: `design-ux-architect` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 3] Read the page spec schema at `protocols/page-spec-schema.md` before writing. Then read these inputs via your Read tool:
  - Product spec: `docs/plans/product-spec.md` (FULL document — this is your source of truth. Screen Inventory is your screen list. Per-feature sections define what each screen does, what data it shows, what states exist, what errors look like, persona constraints, business rules)
  - Visual DNA: `DESIGN.md` `## Overview > ### Brand DNA` (Density axis drives layout — Airy = generous whitespace, Dense = compact data. Character and Motion axes shape navigation transitions and interaction patterns)
  - Components: `docs/plans/component-manifest.md` (which library components for which slots — use these in your wireframes)
  - Frontend architecture: `docs/plans/architecture.md#frontend` (component hierarchy, routing, state management)
  - API contracts: `docs/plans/architecture.md#backend/api` (what data is available from each endpoint)
  - Design references: `docs/plans/design-references/` (competitor/inspiration screenshots for layout reference)
  - PRD: `docs/plans/design-doc.md` (#persona, #jobs-to-be-done, #scope)

Produce TWO outputs:

**Output 1: `docs/plans/ux-architecture.md`** — information architecture, user flows (derived from product spec feature flows, not invented), navigation model, interaction patterns, responsive strategy. Map each user flow to the component-manifest slots it needs. The product spec's feature flows are your behavioral source of truth — refine and structure them into screen-to-screen journeys, don't reinvent them.

**Output 2: `docs/plans/page-specs/*.md`** — one file per screen from the Screen Inventory, following `protocols/page-spec-schema.md`. Each file includes: ASCII wireframe (desktop + mobile for web), content hierarchy with component refs from the manifest and data sources from the API contracts, key copy, responsive behavior, platform conventions, data loading strategy, and screen-specific states from the product spec.

The Density axis from DESIGN.md is your primary layout driver. Airy = generous spacing, fewer items visible per viewport. Dense = compact rows, data tables, more items per viewport. Match the density to the persona constraints from the product spec.

NOTE: The visual design spec (exact spacing values, typography ramp) does not exist yet at this step. Use the DNA Density axis for spatial decisions (airy vs dense) and the component manifest for component choices. Phase 4 implementers have specialized build skills and will apply the final token values from the visual design spec when they build — your layouts define the spatial arrangement and content hierarchy, not pixel-precise measurements."

Output: `docs/plans/ux-architecture.md` + `docs/plans/page-specs/*.md`.

#### Step 3.3.idx — Page-specs graph index

After `design-ux-architect` returns and `docs/plans/page-specs/` is populated with one .md file per screen, index the directory into the build graph. Slice 3 graph index — best-effort, BO falls back to file reads on failure.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/page-specs/`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

### Step 3.3b — UX Flow Validation

Validate the UX architecture against the target persona's actual goals and jobs-to-be-done before the Visual Design Spec is built on top of it.

Call the Agent tool once:

1. Description: "UX flow validation" — subagent_type: `design-ux-researcher` — prompt: "[CONTEXT header above — phase: 3] Read `docs/plans/ux-architecture.md`, `docs/plans/page-specs/` (the ASCII wireframes — validate that layouts serve the persona), `docs/plans/product-spec.md` (per-feature Happy Path and Persona Constraints — these are the behavioral source of truth the flows must implement), `docs/plans/design-doc.md` (#persona, #jobs-to-be-done, #scope sections), and `DESIGN.md`. For each user flow in the UX architecture, walk through it as the target persona: narrate the steps, flag friction points, check if the flow serves the persona's jobs-to-be-done efficiently. Specifically check: (1) Are there screens or sections the persona doesn't need? (2) Are critical tasks reachable in the minimum number of steps? (3) Does the information hierarchy match what the persona cares about most? (4) Does the navigation pattern fit the persona's context (mobile-first for on-the-go users, sidebar for desktop power users, etc.)? (5) Does the responsive strategy degrade gracefully for the persona's primary device? Report findings to `docs/plans/ux-flow-validation.md` with pass/flag per flow. If critical flow issues are found, the UX Architect should revise `ux-architecture.md` before proceeding (backward edge to Step 3.3)."

Output: `docs/plans/ux-flow-validation.md`.

### Step 3.4 — Visual Design Spec (single agent, second Visual Designer invocation)

The Visual Designer re-invokes as writer this time, producing the much richer Visual Design Spec with four new layers on top of the existing tokens.

Call the Agent tool once:

1. Description: "Visual design spec" — subagent_type: `design-ui-designer` — prompt: "[CONTEXT header above — phase: 3] Second invocation as writer. Read `DESIGN.md`, `docs/plans/component-manifest.md`, `docs/plans/ux-architecture.md`, `docs/plans/design-references.md`, `docs/plans/product-spec.md` (per-feature States and Empty/Loading/Error States — the state matrix must cover every state the product spec defines, not just generic defaults), and `docs/plans/page-specs/` (the ASCII wireframes — the typography ramp and spacing scale must work for the actual page layouts, not just in isolation). Write `DESIGN.md` with ALL the following layers:

**TOKENS** (existing): color system (hex, light + dark), typography scale, spacing (8px base), shadows, radius.

**MATERIAL SYSTEM** (NEW): glass parameters — surface opacity, border rgba, radius, blur radius — for each material variant referenced by the DNA Material axis. Include concrete examples for Flat / Glassy / Physical / Neumorphic variants even if the project only ships one.

**MOTION SYSTEM** (NEW): easings (cubic-bezier curves), duration clusters (fast / base / slow), scroll patterns (fade-up on intersection, parallax offsets), hover patterns (lift, scale, color shift), choreography notes (sequential reveals, staggered delays). Tune to the DNA Motion axis — Still has no animation, Subtle uses 200-300ms base, Expressive uses 400-600ms with curves, Cinematic uses 650-1100ms with GSAP.

**TYPOGRAPHY TUNING** (NEW): tracking rules at each size (e.g. 'eyebrow 11px uppercase +0.15em for Editorial'), optical sizing directives (opsz axis on variable fonts), variable font axes tuned per use case (wght for body, wght+opsz for display).

**COMPONENT STATE MATRIX** (existing): every component × every state (default / hover / focus / active / disabled / loading / error).

Every token, parameter, and rule must be derivable from the DNA card plus the design references. Cite the reference path for every non-obvious choice."

Output: `DESIGN.md` — substantially richer than the prior one-layer spec.

#### Step 3.4.idx — DESIGN.md Pass 2 token re-index

After `design-ui-designer` completes Pass 2 of `DESIGN.md` (YAML front matter + Pass 2 prose sections populated), re-run the indexer on DESIGN.md. The CLI dispatch detects Pass 2 content and writes `slice-3-tokens.json` alongside the existing `slice-2-dna.json` (which is also overwritten with the latest Pass 1 state for consistency).

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js DESIGN.md`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

### Step 3.5 — Inclusive Visuals Check (single agent)

Call the Agent tool once:

1. Description: "Inclusive visuals check" — subagent_type: `design-inclusive-visuals-specialist` — prompt: "[CONTEXT header above — phase: 3] Read `DESIGN.md`, `docs/plans/component-manifest.md`, and `DESIGN.md`. Audit for representation gaps, imagery bias, color choices that exclude colorblind users, contrast failures, and culturally-specific iconography that doesn't translate. Write findings to `docs/plans/inclusive-visuals-audit.md`."

Output: `docs/plans/inclusive-visuals-audit.md`.

### Step 3.6 — Style Guide Implementation [METRIC LOOP]

This is the only Phase 3 step that writes code. Wrapped in a generator/critic metric loop per `protocols/metric-loop.md`. The generator builds the `/design-system` route by composing from the manifest; the Design Critic scores the rendered result against the DNA and references; the generator applies only the top issue each iteration.

**Generator (initial build):**

Call the Agent tool once:

1. Description: "Build living style guide" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 3] [COMPLEXITY: L] Read `docs/plans/component-manifest.md` and `DESIGN.md`. Build a `/design-system` route with rendered, interactive examples of every chosen variant from the manifest. **HARD-GATE: Import from the installed libraries. Do NOT write components from scratch when the manifest names one.** Every component must be interactive (hover, focus, transitions all work). Mobile-responsive. This ships with the product. Commit: 'feat: living style guide'."

**Metric loop wrapper** (per `protocols/metric-loop.md`):

- **Critic** — Call the Agent tool — description: "Design critic scoring pass" — subagent_type: `design-critic` — prompt: "[CONTEXT header above — phase: 3] SCORING CRITERIA CHECKLIST: [paste the checklist from `active_metric_loop.scoring_criteria_checklist` in `.build-state.json` — NOT the raw reference docs]. Capture the rendered `/design-system` route via Playwright screenshot (desktop 1920x1080 + mobile 375x812). Also read `docs/plans/page-specs/` to understand what page compositions these components will be used in — score components in the context of their actual usage, not just in isolation. Score the gap on **7 DNA axes** (Scope fit, Density, Character, Material, Motion, Type, Copy — 20 points each) plus **5 craft dimensions** (whitespace rhythm, visual hierarchy, motion coherence, color harmony, typographic refinement — 20 points each). Total 240. Target 195. <!-- Scoring scale: see agents/design-critic.md for authoritative thresholds --> Every finding must cite a specific element with file:line reference AND reference the checklist criteria — score a gap, not an opinion. Suggest concrete improvements ('the card padding is 16px but the checklist says Density: Airy — 32px — bump to 32px'). Iteration 1 MAY Read `docs/plans/design-references.md` for visual comparison; iteration 2+ MUST NOT unless diagnosis explicitly flags a visual-reference gap. Default verdict: NEEDS WORK. Never edit code. Max 5 iterations before exit."

- **Generator (re-invocation, iteration 2+)** — Call the Agent tool — description: "Apply critic's top issue" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "TARGETED FIX from metric loop diagnosis: [paste top issue from Step 3 diagnosis]. Files: [paste file paths]. Relevant criteria from checklist: [paste the specific checklist values that relate to the top issue — e.g., 'Density: Airy — 32px card padding']. Apply ONLY the top issue. Do not re-critique. Do not refactor other parts. Re-render the `/design-system` route. Return the commit SHA." NOTE: Do NOT include `[CONTEXT header above]` on iteration 2+ — the generator already has the codebase context from iteration 1. Per `protocols/metric-loop.md` Step 4 iteration-aware context rule.

- **Exit conditions:** quality target hit (score ≥ 195), stall (no score improvement for 2 consecutive rounds), or max iterations (5 total).

Record the score history to `docs/plans/build-log.md` under `## Design Critic Loop`.

### Step 3.7 — A11y Design Review (single agent)

WCAG 2.2 AA runtime check on the rendered style guide plus any key product pages that exist at this point.

Call the Agent tool once:

1. Description: "A11y design review" — subagent_type: `a11y-architect` — prompt: "[CONTEXT header above — phase: 3] WCAG 2.2 AA runtime check on the rendered `/design-system` route and any key product pages. Check contrast, focus order, keyboard navigation, screen reader labels, reduced-motion variants, and touch targets (>= 44px). Use Playwright and axe-core. Save findings to `docs/plans/a11y-design-review.md` with severity tags (Critical / Serious / Moderate / Minor)."

Output: `docs/plans/a11y-design-review.md`.

### Step 3.8 — Autonomous Quality Gate

Log to `docs/plans/build-log.md`: final screenshot paths, Design Critic score history (per-round totals plus per-axis subscores), a11y findings count by severity, a DNA compliance score derived from the critic's 7 DNA-axis subscores, and the DESIGN.md lint result (broken-refs count, warning count, hash). No user pause.

DESIGN.md lint runs at this step via `hooks/design-md-lint`. Broken-refs is a hard fail and routes back to Step 3.4 with the broken ref as the focused finding. Warnings (missing-primary, contrast-ratio WCAG AA, orphaned-tokens, missing-typography, section-order) are logged to `build-log.md` and feed the Phase 3.7 a11y review's contrast escalation rules but do NOT block Phase 4.

Phase 4 HARD-GATE: web mode requires `DESIGN.md` (Pass 1 + Pass 2 complete, lint broken-refs == 0) AND `docs/plans/component-manifest.md` AND `docs/plans/page-specs/` (at least one file) to exist before Phase 4 starts. If any is missing or DESIGN.md fails the broken-refs lint, return to Phase 3.

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

Call the Agent tool — description: "Project scaffolding" — subagent_type: `engineering-rapid-prototyper` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] [COMPLEXITY: M] Set up the project from the architecture. Read `docs/plans/architecture.md` via your Read tool before starting. Create directory structure, dependencies, build tooling, linting config, test framework with one passing test, .gitignore, .env.example. Read `DESIGN.md` Scope axis and only install the component libraries the DNA needs — never ship Three.js for an internal admin panel. Commit: 'feat: initial scaffolding'."

#### 4.0.b — Design system setup

Call the Agent tool — description: "Design system setup" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] Implement the design system from the Visual Design Spec. Read `DESIGN.md` via your Read tool before starting. Create CSS tokens matching the spec's color system, typography scale, spacing system, shadow/elevation tokens, and base layout components. The living style guide from Phase 3 is the reference implementation — components must match. Commit: 'feat: design system'."

#### 4.0.c — Acceptance test scaffolding

Call the Agent tool — description: "Scaffold acceptance tests" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] Read docs/plans/sprint-tasks.md. For every task with a Behavioral Test field, create a Playwright test stub in tests/e2e/acceptance/. Use Page Object Model. Each test should: navigate to the page, perform the interaction, assert the expected outcome. Tests should FAIL right now (features aren't built yet) — that's correct. Also ensure agent-browser is available (run `which agent-browser`). Commit: 'test: scaffold acceptance tests from sprint tasks'."

## Phase 4 — Build per-task flow (web branch)

These are the web-specific prompt templates for the per-task flow inside Phase 4 Step 4.1+. The orchestrator-side machinery (**three-tier: Product Owner → Briefing Officer → Execution Agents**, Senior Dev cleanup, code review pair, Metric Loop, Verify Service) lives in `commands/build.md` Phase 4. This section only overrides the implementer dispatch and UI-specific verification prompts.

### Wave dispatch (feature-grained, from feature-delegation-plan.json)

The Product Owner (Step 4.1) groups features into waves and writes `docs/plans/feature-delegation-plan.json`. The orchestrator reads that plan — not sprint-tasks.md Dependencies — to determine wave membership. Each wave dispatches one Briefing Officer per feature in parallel. Within a feature, tasks run in DAG-parallel batches (topological order from the `Dependencies:` field in sprint-tasks.md — independent sibling tasks run in parallel, yielding ~30-50% wall-clock saving).

No magic parallelism cap — the dependency graph is the limit within a feature. A task that declares no dependencies runs in the first intra-feature batch alongside every other root. A task that declares `Dependencies: T1, T2` runs in whichever batch first satisfies both.

### Step 4.1+ — Task execution overrides (web)

#### Implementer dispatch (web)

The Briefing Officer's feature brief specifies the agent type (`subagent_type`) for each task — the orchestrator reads it from the brief rather than deciding itself.

Call the Agent tool — description: "[task name]" — subagent_type: `[from BO brief]` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 4] [COMPLEXITY: S/M/L from sprint-tasks.md].

TASK: [task description from BO brief]

FEATURE CONTEXT:
[product_context from BO brief — persona constraints, business rules, key error scenarios]

PAGE LAYOUT:
[relevant wireframe section from page-spec, pasted from BO brief. Omit for backend-only tasks.]

COMPONENTS:
[component picks from BO brief — name, variant, which slot. HARD-GATE: import from manifest, do NOT write from scratch.]

API CONTRACT:
[endpoint shape from BO brief — route, method, request/response]

ERROR STATES:
[specific failure modes from BO brief — trigger, user message, recovery]

BUSINESS RULES:
[concrete rules from BO brief — values, not 'configurable']

SKILLS ASSIGNED: [skill list from BO brief]

ACCEPTANCE: [criteria from BO brief]

## Prior Learnings
[paste contents of docs/plans/.active-learnings.md if it exists]

## Deviation Reporting
If your implementation deviates from the planned architecture, return a deviation_row object per protocols/decision-log.md. If no deviation, return deviation_row: null. Do NOT write decisions.jsonl directly.

For UI tasks: the living style guide at /design-system shows every component's exact styling and states — match it. Import from the manifest-named library variants (Phase 4 HARD-GATE).

Implement fully with real code and tests. Commit: 'feat: [task]'. Report what you built, files changed, and test results."

#### Metric Loop (web behavioral verification)

Per `protocols/metric-loop.md` Step 0.5, extract acceptance criteria from `sprint-tasks.md` Behavioral Test field into the Scoring Criteria Checklist before the loop starts. **Phase 4 per-task extraction is mechanical — no dispatch.** The Behavioral Test field is a single structured value per task; the orchestrator copies it directly into `active_metric_loop.scoring_criteria_checklist` in `.build-state.json`.

For UI-facing tasks, include behavioral verification: the measurement agent receives the checklist + uses agent-browser to verify the feature renders and responds to interaction, not just read the code. Max 5 iterations. Generator re-invocation on iteration 2+ follows the lean context rule (top issue + file paths + relevant checklist values only — no full `[CONTEXT header above]`). Other Metric Loop mechanics (critic dispatch, exit conditions) follow `protocols/metric-loop.md`.

#### Behavioral Smoke Test (web)

Uses agent-browser against localhost to open the app, execute the task's behavioral acceptance criteria, and verify the feature actually works. Evidence saved to `docs/plans/evidence/[task-name]/`: annotated screenshot, snapshot diff, error log, network log, HAR file.

## Phase 5 — Audit (web branch)

Phase 5 in the web branch is split into three layers — Track A (engineering envelope: 5 parallel auditors), Track B (product reality: parallel per-feature audit driven by graph queries), and Cross-cutting (3-iteration Playwright E2E, autonomous agent-browser dogfood, fake-data detector). All findings route through the Feedback Synthesizer (Step 5.4) and Fix loop (Step 5.5). The orchestrator-side machinery (Track-A team dispatch, Track-B fan-out, synthesizer, evidence writes, fix loop) follows `commands/build.md` Phase 5 — this file carries web-branch-specific elaboration only. Reality Check and LRR Aggregation are Phase 6, not here.

### Step 5.1 — Track A: Engineering Reality (5 agents in parallel, ONE message)

Read the NFRs from `docs/plans/quality-targets.json` (and `docs/plans/sprint-tasks.md` NFR section if present). Pass the relevant NFR thresholds to each audit agent so they have concrete targets, not generic checks. The fifth auditor is the Brand Guardian drift check — it runs alongside the technical auditors to catch DNA drift before the Phase 6 LRR Brand Guardian chapter renders its verdict. Per-feature UX quality (loading states, empty states, error states, mobile responsiveness, visual consistency) is now covered feature-by-feature in Step 5.2 Track B — DO NOT add a generic UX-quality dispatch back here.

Call the Agent tool 5 times in one message:

1. Description: "API testing" — subagent_type: `testing-api-tester` — Prompt: "[CONTEXT header above — phase: 5] Comprehensive API validation: all endpoints, edge cases, error responses, auth flows. NFR targets: Read `docs/plans/quality-targets.json` via your Read tool for performance and reliability thresholds. Report findings with counts."

2. Description: "Performance audit" — subagent_type: `testing-performance-benchmarker` — Prompt: "[CONTEXT header above — phase: 5] Measure response times, identify bottlenecks, flag performance issues. NFR targets: Read `docs/plans/quality-targets.json` via your Read tool for performance thresholds. Report benchmarks AGAINST these targets.

**Bundle budget per Scope axis** (read `DESIGN.md` Scope field):
- Marketing:     500KB gzipped (excluding images), LCP <= 2.5s
- Product:       300KB gzipped, LCP <= 1.8s
- Dashboard:     400KB gzipped, LCP <= 2.0s
- Internal Tool: 200KB gzipped, LCP <= 1.5s

Exceeding the budget by >25% auto-blocks the Phase 6 LRR SRE chapter. Budget violations route back to Phase 3.2 (component mapping — swap a heavy variant for a lighter one) OR Phase 4 (code-splitting, lazy-loading, dynamic imports). Report budget-compliance per Scope axis, with the exact gzipped bundle size and LCP measurement."

3. Description: "Accessibility audit" — subagent_type: `a11y-architect` — Prompt: "[CONTEXT header above — phase: 5] WCAG 2.2 AA runtime compliance audit on all interfaces. NFR target: Read `docs/plans/quality-targets.json` via your Read tool for accessibility thresholds. Check screen reader, keyboard nav, contrast, focus order, reduced-motion variants, touch targets >= 44px. Report issues with severity tags (Critical/Serious/Moderate/Minor). This is the same agent that sets constraints at Phase 2 and judges at Phase 6 LRR — keep the standards consistent across all three invocations."

4. Description: "Security audit" — subagent_type: `engineering-security-engineer` — Prompt: "[CONTEXT header above — phase: 5] Security review: auth, input validation, data exposure, dependency vulnerabilities. NFR targets: Read `docs/plans/quality-targets.json` via your Read tool for security thresholds. Report findings with severity."

5. Description: "Brand Guardian drift check" — subagent_type: `design-brand-guardian` — Prompt: "[CONTEXT header above — phase: 5] You are the Phase 5 drift check (proposed state §5 re-invite). Read `DESIGN.md` (the DNA card locked at Phase 3.0) + the actually-built pages via Playwright screenshots under `docs/plans/evidence/brand-drift/` (write production screenshots there as PNG/JPG files, one per page audited, named `<screen-id>.png`). Score whether Phase 4 implementers stayed true to the DNA or drifted away from it. Specifically check each of the 6 DNA axes (Scope / Density / Character / Material / Motion / Type) against what the built product actually renders. Report drift count and specific elements (file:line references). Save findings to `docs/plans/evidence/brand-drift.md`. This is a drift check only — the Phase 6 LRR Brand Guardian chapter does the verdict. You do NOT issue a pass/fail here, only surface findings for the LRR chapter to read."

#### Step 5.1.idx — Brand drift screenshots graph index

After `design-brand-guardian` returns and `docs/plans/evidence/brand-drift/` is populated with production screenshots, index the directory into the build graph as Slice 5 brand-drift fragments. Best-effort, the LRR Brand chapter falls back to direct file reads on failure.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/evidence/brand-drift/`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

### Step 5.2 — Track B: Product Reality (parallel per-feature, ONE message)

Track B audits the built app against `product-spec.md` on a per-feature basis. The orchestrator-side dispatch shape (feature enumeration via the graph, zero-feature gate, parallel `product-reality-auditor` fan-out, post-dispatch evidence verification) is canonically described in `commands/build.md` Step 5.2 — follow that for orchestration. This section adds web-branch-specific elaboration.

**What the auditor does** (per-feature, in parallel): synthesizes agent-browser scripts from the graph slice (states, transitions, business rules, happy path, persona constraints, page-spec wiring, manifest coverage), executes them against the running web app, captures screenshots, and writes structured evidence. The auditor's contract is in `agents/product-reality-auditor.md`. The seven check classes (a–g) and the routing table live there — do not paraphrase them here.

**Web-branch specifics:**
- The running app is at `http://localhost:[port]` (orchestrator must have the dev server running before Step 5.2 — same as for E2E/dogfood at Step 5.3).
- agent-browser is the primary execution surface; Playwright loaded via the Skill tool is the fallback (one retry total).
- Screenshots and per-case evidence land under `docs/plans/evidence/product-reality/{feature_id}/screenshots/`. Each case_id maps 1:1 to a PNG file (or `screenshot: null` for non-visual checks like manifest-slot-empty).
- The four evidence files per feature (`tests-generated.md`, `results.json`, `findings.json`, `coverage.json`) are written by the auditor; the orchestrator verifies their presence + JSON parseability per `commands/build.md` Step 5.2 post-dispatch verification.

**Failure routing:** Track B auditor failures route through the existing fix-loop spec-gap path (`target_phase: 1, target_step: 1.6` to `product-spec-writer`) — see `commands/build.md` Step 5.2 post-dispatch verification for the escalation flow.

#### Step 5.2.idx — Track B evidence graph index

After all per-feature `product-reality-auditor` dispatches return and `docs/plans/evidence/product-reality/*/` is populated, index the directory into the build graph. Best-effort — downstream consumers (Phase 5.4 synthesizer, Phase 6.1 Eng-Quality chapter) fall back to file reads on indexer failure.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/evidence/product-reality/`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: log the error to `docs/plans/build-log.md` and continue (best-effort — Track B evidence is hard-gated at Phase 6.0 by file presence + parseability, not by graph index status).

### Step 5.3 — Cross-cutting (3 parallel, ONE message)

Three checks run in parallel as a cross-cutting layer: 3-iteration Playwright E2E for multi-feature User Journeys, autonomous agent-browser dogfood for emergent issues, and the fake-data detector. The orchestrator dispatch shape (3 parallel agents in one message) is in `commands/build.md` Step 5.3.

#### Step 5.3a — E2E Testing (3 mandatory iterations)

HARD-GATE: ALL 3 ITERATIONS ARE MANDATORY. Do NOT stop after iteration 1 even if all tests pass. The purpose of 3 runs is to catch flaky tests, timing-dependent failures, and race conditions that only surface on repeated execution. Skip this step ONLY if the project has no user-facing frontend.

**Scope (POST Track B):** E2E covers **multi-feature User Journeys ONLY** — login → browse → buy, signup → onboarding → first-action, etc. Single-feature happy paths are covered by Track B per-feature auditors at Step 5.2 — DO NOT duplicate. The User Journey list lives in `docs/plans/sprint-tasks.md` (Step 0 of the Planning Protocol). Each cross-feature journey = one E2E test file.

**Iteration 1 — Generate & Run:**

Call the Agent tool — description: "E2E test generation" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt:

"[CONTEXT header above — phase: 5] [COMPLEXITY: L] Generate and run end-to-end Playwright tests for cross-feature User Journeys ONLY (single-feature happy paths are covered by Track B at Step 5.2 — do NOT duplicate them here).

INPUTS:
Read these files via your Read tool before starting — do NOT expect pasted content:
- User Journeys: `docs/plans/sprint-tasks.md` (User Journeys section — each cross-feature journey becomes one E2E test)
- Architecture (API contracts): `docs/plans/architecture.md`
- NFRs: `docs/plans/sprint-tasks.md` (NFR section — use performance thresholds as test assertions)
- Visual Design Spec (component selectors): `DESIGN.md`

REQUIREMENTS:
1. One E2E test per cross-feature User Journey from sprint-tasks.md (each journey = one test file covering the full flow)
2. Use Page Object Model pattern — one page object per major view
3. Use data-testid selectors (add them to components if missing)
4. Wait for API responses, NEVER use arbitrary timeouts (no waitForTimeout)
5. Capture screenshots at critical verification points
6. Configure multi-browser: Chromium + Firefox + WebKit
7. Set up playwright.config.ts with: fullyParallel, retries: 0 (we handle retries ourselves), screenshot: 'only-on-failure', video: 'retain-on-failure', trace: 'on-first-retry'
8. Run all tests. Report: total, passed, failed, with failure details and screenshot paths.
9. Commit: 'test: e2e test suite for cross-feature user journeys'

Test priority:
- CRITICAL: Auth, core cross-feature happy path, data submission across features, payment/transaction flows
- HIGH: Search across features, filtering, navigation, error states that span features
- MEDIUM: Responsive layout for multi-feature flows, animations, edge cases"

Record results: total tests, pass count, fail count, failure details. Log to `docs/plans/.build-state.md` under `## E2E Testing`:

```
| Iter | Total | Passed | Failed | Flaky | Top Failure |
|------|-------|--------|--------|-------|-------------|
| 1    | ...   | ...    | ...    | ...   | ...         |
```

**Iteration 2 — Fix & Re-run:**

Call the Agent tool — description: "E2E fix iteration 2" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 5] [COMPLEXITY: M] Fix E2E test failures from iteration 1: [paste failure details — test names, error messages, screenshot paths]. Diagnose each as real bug, flaky test, or missing selector. Fix accordingly — do NOT delete or skip tests. Re-run ALL tests. Commit: 'fix: e2e test failures iteration 2'."

Record results in the E2E table. Identify flaky candidates (passed iter 1, failed iter 2 or vice versa).

**Iteration 3 — Final Stability Run:**

Call the Agent tool — description: "E2E stability run" — subagent_type: `engineering-frontend-developer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 5] [COMPLEXITY: M] Final E2E stability run (3 of 3). Previous results — Iter 1: [pass/fail counts], Iter 2: [pass/fail counts], Flaky candidates: [list]. Run ALL tests with --repeat-each=3. Quarantine inconsistent tests with test.fixme(). Fix remaining consistent failures. PASS CRITERIA: 95%+ pass rate (quarantined flaky tests excluded but logged). Commit: 'test: e2e stability fixes iteration 3'."

Record final results. Include in the Phase 6.0 Reality Check evidence sweep (see `commands/build.md` Phase 6 Step 6.0).

#### Step 5.3b — Autonomous Dogfooding

Run the agent-browser dogfood skill against the running app. Unlike Track B (which checks built features against the spec) and unlike per-task smoke tests (which verify specific acceptance criteria), dogfooding is **exploratory** — it autonomously navigates every reachable page, clicks buttons, fills forms, checks console errors, and finds issues we didn't think to test. Spec-blind by design — that's the point.

Start the dev server if not running. Then invoke the dogfood skill:

Call the Agent tool — description: "Dogfood the app" — subagent_type: `testing-evidence-collector` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 5] Run the agent-browser dogfood skill against the running app at http://localhost:[port]. Explore every reachable page. Click every button. Fill every form. Check console for errors. Report a structured list of issues with severity ratings (critical/high/medium/low), screenshots, and repro steps. Save screenshots under `docs/plans/evidence/dogfood/` (one PNG/JPG per finding, named after the finding_id), and emit `docs/plans/evidence/dogfood/findings.json` (machine-readable mirror of findings.md — schema: `[{finding_id, severity, description, screenshot_path, affected_screen_id}, ...]` per agents/testing-evidence-collector.md \"Dogfood Evidence Outputs\") so the Slice 5 indexer can wire `screenshot_evidences_finding` edges. If dogfood skill is not available, use agent-browser manually: snapshot each page, click all interactive elements, check errors and network requests. Focus on emergent issues (console errors, broken layouts at 320/375/768px, failed network requests, broken navigation links) — do NOT re-audit per-feature spec coverage; that's Track B's job at Step 5.2."

Classification and fix-routing of Dogfood findings is handled by the Feedback Synthesizer at `commands/build.md` Phase 5 Step 5.4 — do NOT self-classify or spawn fix agents from this step.

##### Step 5.3b.idx — Dogfood evidence graph index

After `testing-evidence-collector` returns and `docs/plans/evidence/dogfood/` is populated with finding screenshots, index the directory into the build graph as Slice 5 dogfood fragments. Best-effort, the feedback synthesizer falls back to file reads on failure. The indexer reads BOTH the screenshots in `evidence/dogfood/` AND the `findings.json` side-channel to wire `screenshot_evidences_finding` edges.

Run via the Bash tool:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/evidence/dogfood/`
- On exit 0: log success to `docs/plans/build-log.md` and continue.
- On non-zero exit: STOP. Log the error to `docs/plans/build-log.md` and report the failure. Downstream agents require the graph — do not proceed without a successful index.

#### Step 5.3c — Fake Data Detector

Call the Agent tool — description: "Fake data audit" — subagent_type: `silent-failure-hunter` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 5] Run the Fake Data Detector Protocol (protocols/fake-data-detector.md). Check for mock/hardcoded data in production paths. Static analysis: grep for Math.random() business data, hardcoded API responses, setTimeout faking async, placeholder text. Dynamic analysis: inspect HAR files from docs/plans/evidence/ for missing real API calls, static responses, absent WebSocket traffic. Report findings with file:line references and severity."

**Fix loop:** For each CRITICAL finding:
1. Spawn a fix agent with: the finding (file:line, what's fake, what it should be), and the relevant source files.
2. The fix agent replaces fake data with real API calls, real WebSocket connections, real data sources. If real data sources aren't available (missing API keys, no backend), the fix agent must flag this as a blocker — not paper over it with better-looking fake data.
3. After fixes, re-run the fake data detector (static checks only — fast). Max 2 fix cycles.

Remaining findings feed into the Phase 6.0 Reality Check evidence sweep (see `commands/build.md` Phase 6 Step 6.0).

### Step 5.4 — Feedback Synthesizer

The orchestrator-side dispatch and prompt body live in `commands/build.md` Step 5.4. The synthesizer ingests both Track B `findings.json` (one per feature) and Dogfood `findings.md`/`findings.json`, validates target_phase routing against the graph, and emits `docs/plans/evidence/dogfood/classified-findings.json` with a `source: "dogfood" | "product-reality"` discriminator. Web-branch note: for `project_type=web` this is always the path; for iOS see `protocols/ios-phase-branches.md`.

### Step 5.5 — Fix loop

The orchestrator-side fix-loop dispatch lives in `commands/build.md` Step 5.5. Max 2 fix cycles. Routing template at the bottom of `commands/build.md` ("Re-entry dispatch template"). Findings with `target_phase: 1, target_step: 1.6` route back to `product-spec-writer`, which re-triggers Track B for the affected feature on the next loop.

## Phase 7 — Ship (web branch)

### Step 7.1 — Documentation (web)

Call the Agent tool — description: "Documentation" — subagent_type: `engineering-technical-writer` — mode: "bypassPermissions" — prompt: "[CONTEXT header above — phase: 7] Write project docs: README with setup/architecture/usage, API docs if applicable, deployment notes. Commit: 'docs: project documentation'."

Deployment target per the design doc (Vercel/Netlify/Railway/Fly.io/etc.) — include the deploy flow specific to that target in the README.
