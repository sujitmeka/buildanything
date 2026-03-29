# Design & Visual Identity Protocol

You are the orchestrator. Phase 2 (Architecture) is complete. Before building anything, you must establish a research-backed visual design system. This phase is a FULL PEER to Architecture and Build — not a footnote.

## Anti-AI-Template Checklist

Penalize if 3+ of these appear together:
- Purple-to-blue or purple-to-pink gradient hero backgrounds
- Floating mesh/blob gradient decorative elements
- Inter or Plus Jakarta Sans as the font choice (unless research specifically justifies it)
- 3-column icon + heading + paragraph feature grids as the primary content pattern
- Glassmorphism/frosted glass as the primary design language
- Bento grid as default layout
- Dark mode + neon accents as the "premium" look
- Generic illustration pack imagery (Undraw, Humaaans style)
- Perfect symmetry everywhere with no visual tension or personality

One or two in isolation is fine IF the research supports it. Three or more together = AI template smell. Every visual choice must be justified by the research.

---

## Step 3.1 — Design Research (2 agents, parallel, both use Playwright)

Launch 2 agents in ONE message. Both MUST use Playwright to capture real screenshots — text descriptions of competitor sites are insufficient. Downstream agents need visual references.

**Agent 1: "Competitive visual audit"**

```
You are a senior visual design researcher. Find the top 5-8 competitors or analogues for: [product description from design doc].

For each competitor:
1. Use Playwright to navigate to their site
2. Take full-page screenshots (desktop 1920x1080 + mobile 375x812)
3. Screenshot standout components: hero sections, cards, forms, navigation, CTAs, footer
4. Save all screenshots to docs/plans/design-references/competitors/[site-name]/

Analyze each site's visual language:
- Color palette (extract dominant colors)
- Typography choices (font families, scale, weight usage)
- Spacing rhythm (generous vs compact, section padding)
- Component style (shadows, borders, radius, elevation)
- What makes it feel premium or cheap?
- What would you steal vs avoid?

Output: Ranked analysis by visual quality and relevance. Include screenshot paths.
```

**Agent 2: "Design inspiration mining"**

```
You are a senior visual design researcher. Search Awwwards.com, Godly.website, and SiteInspire for award-winning sites in the category: [product category — SaaS, developer tool, e-commerce, marketplace, etc.].

For the top 5-8 results:
1. Use Playwright to navigate and take full-page screenshots (desktop + mobile)
2. Screenshot standout components and interactions worth referencing
3. Save all screenshots to docs/plans/design-references/inspiration/[site-name]/

Identify cross-cutting patterns:
- What do the best-in-class sites have in common?
- What visual trends dominate this category right now?
- What separates "Awwwards worthy" from "generic template"?
- What specific techniques create the premium feel? (spacing, typography, animation, color)

Output: Trend analysis with specific adoptable patterns and anti-patterns to avoid. Include screenshot paths.
```

After both return, synthesize a **Design Research Brief** saved to `docs/plans/design-research.md`. Include all screenshot paths for downstream agent reference.

---

## Step 3.2 — Design Direction (2 agents, sequential)

The UI Designer makes ALL decisions autonomously. No "Direction A vs B" presentations. Pick the best based on the research.

**Agent 1: UX Architect**

```
You are the UX Architect. Create the structural design foundation.

INPUTS:
- Architecture doc (frontend section): [paste]
- Design Research Brief: [paste from docs/plans/design-research.md]
- Reference screenshots: [list paths from docs/plans/design-references/]
- User persona from Phase 1 research: [paste relevant section]

OUTPUT a UX Foundation document:
1. Information architecture and content hierarchy
2. User flow diagrams for core interactions
3. Layout strategy — which pages use which layout patterns, informed by what worked in the research
4. Component hierarchy — what components exist, how they compose
5. Responsive breakpoint strategy (mobile-first)
6. Navigation patterns
7. Interaction patterns: hover, focus, loading, error, empty, success states

Base layout and flow decisions on what performed best in the competitive analysis — not generic patterns.
```

**Agent 2: UI Designer**

```
You are the UI Designer. Create the Visual Design Spec.

INPUTS:
- UX Foundation from UX Architect: [paste full output]
- Design Research Brief: [paste from docs/plans/design-research.md]
- Reference screenshots: [list paths from docs/plans/design-references/]
- User persona: [paste relevant section]

Make AUTONOMOUS decisions. Do not present options. Pick the single best direction based on the research.

OUTPUT a Visual Design Spec covering:

1. **Color System** — Primary, secondary, accent, semantic (success/warning/error/info), neutral palette. Full hex values for light AND dark themes. Rationale tied to research: "competitor X uses muted blues; we differentiate with warm neutrals because our persona values approachability."

2. **Typography System** — Font families (from Google Fonts or system fonts), size scale using a mathematical ratio (Major Third 1.25 or Perfect Fourth 1.333), weights, line heights (body: 1.5-1.6x, headings: 1.1-1.3x), letter spacing adjustments. MAX 2 font families.

3. **Spacing System** — 8px base unit. Scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px. Rule: internal component padding MUST be less than external margin between components (Gestalt proximity principle).

4. **Shadow & Elevation** — Layered shadow system using tinted shadows (NOT pure black — e.g., rgba(0,0,50,0.08) instead of rgba(0,0,0,0.1)). Ambient shadow + key shadow per elevation level. Levels: flat, raised (cards), elevated (dropdowns), overlay (modals), top (tooltips).

5. **Border Radius** — ONE primary radius for the entire app (pick 4px, 6px, 8px, or 12px and justify). Pill radius for tags/badges only.

6. **Animation & Motion** — Easing functions (ease-out for entrances, ease-in for exits, ease-in-out for transitions). Duration scale: micro 150ms, normal 300ms, emphasis 500ms. Stagger timing for lists: 30-50ms between items. Respect prefers-reduced-motion.

7. **Component Styles** — For each component (buttons, inputs, cards, badges, navigation, modals, alerts, tables):
   - ALL states: default, hover, active, focus-visible, disabled, loading
   - Exact CSS properties: background, color, border, shadow, padding, font-size, font-weight, border-radius, transition

8. **Design Rationale** — For EVERY major decision, cite the research. "The top 3 Awwwards sites in this category use geometric sans-serifs with high x-heights. Competitor Y uses Inter which is ubiquitous. We chose Space Grotesk to differentiate while maintaining the same readability characteristics."

Apply the Anti-AI-Template Checklist above. Every visual choice must be JUSTIFIED by the research, not by framework defaults.

Save output to docs/plans/visual-design-spec.md.
```

---

## Step 3.3 — Proof Screens (1 implementation agent)

```
[COMPLEXITY: L] Implement 2-3 proof screens — the most visually demanding pages in this product:

1. Landing page / hero section (the first impression)
2. Main app view (dashboard, feed, workspace — the core experience)
3. A form or interactive component (sign up, settings, creation flow)

INPUTS:
- Visual Design Spec: [paste from docs/plans/visual-design-spec.md]
- UX Foundation: [paste relevant layout and component sections]
- Reference screenshots: [list paths from docs/plans/design-references/ — these are your visual targets]

REQUIREMENTS:
- Real, styled, responsive pages. NOT wireframes or skeletons.
- Use the EXACT colors, fonts, spacing, shadows from the Visual Design Spec. Do not deviate.
- Include hover states, focus states, transitions, loading states.
- Mobile-responsive at 375px, 768px, 1024px, 1280px breakpoints.
- These screens PROVE the design system works. They must look like they belong next to the Awwwards references from the research.

Commit: 'feat: proof screens for design validation'
```

---

## Step 3.4 — Visual QA Loop (Playwright + Metric Loop)

Run the Metric Loop Protocol (`commands/protocols/metric-loop.md`).

**Metric definition for `.build-state.md`:**

```
## Active Metric Loop
Phase: 3
Artifact: Proof screens (landing page, main app view, form/interaction)
Metric: Visual design quality — implementation fidelity to Visual Design Spec + competitive quality relative to Awwwards/competitor references
How to measure: Playwright screenshots of proof screens (desktop 1920x1080 + mobile 375x812), scored by design critic agent across 6 dimensions
Target: 80
Max iterations: 5
```

**Measurement agent prompt:**

```
You are a senior design critic at a top-tier agency (Pentagram, Work & Co). You are reviewing a product's visual implementation for quality.

INPUTS:
- Screenshots of current proof screens: [Playwright captures — desktop + mobile]
- The Visual Design Spec the implementation should follow: [paste from docs/plans/visual-design-spec.md]
- Reference screenshots from competitors and Awwwards winners: [paths in docs/plans/design-references/]

Score 0-100 across these 6 dimensions (weight equally, average for final score):

1. **Spacing & Alignment (0-100)**
   - 8px grid respected? Hero padding 120-200px, not 40px?
   - Internal component padding < external margin (Gestalt proximity)?

2. **Typography Hierarchy (0-100)**
   - Line heights: body 1.5-1.6x, headings 1.1-1.3x?
   - Consistent type scale from the spec applied?

3. **Color Harmony (0-100)**
   - 60-30-10 rule (60% neutral, 30% secondary, 10% accent)?
   - WCAG AA contrast (4.5:1 body, 3:1 large text)? Shadows tinted not pure black?

4. **Component Polish (0-100)**
   - All states present (hover, focus-visible, disabled, loading)?
   - Shadow/elevation and border radius per spec?

5. **Responsive Quality (0-100)**
   - Touch targets 44px+ on mobile? No horizontal scroll?
   - Layout adapts per breakpoint (not just stacks)?

6. **Originality (0-100)**
   - Does this look DESIGNED or GENERATED?
   - Apply the Anti-AI-Template Checklist above. Penalize heavily if 3+ items appear together.
   - The test: would a human designer say "this was made by AI"?
   - Does the design have personality and point of view?

Return format:
SCORE: [average of 6 dimensions, rounded to nearest integer]
DIMENSION SCORES: [list each dimension with its score]
TOP ISSUE: [the single highest-impact change that would most improve the overall score]
FINDINGS: [detailed list of specific issues, each with the file path and line/component where the fix should happen]
```

**Fix agent receives:** ONLY the top issue + relevant file paths + the relevant Visual Design Spec section. One fix per iteration. Commit each fix.

**Exit conditions (from metric-loop protocol):**
- Score >= 80 → proceed to Phase 4
- Stall (2 consecutive delta <= 0) → accept if score >= 65, log warning below 65
- Max 5 iterations → accept if score >= 65, log warning below 65

---

## Step 3.5 — Autonomous Quality Gate

Log to `docs/plans/build-log.md`:
- Final proof screen screenshot paths
- Score history table from the metric loop
- Key design decisions and their research rationale
- Anti-AI-template dimension score

No user pause. Proceed to Phase 4 (Foundation).

---

## Rules

<HARD-GATE>
DESIGN RESEARCH IS NOT OPTIONAL. Step 3.1 agents MUST use Playwright to capture real screenshots of real competitor and inspiration sites. Text-only descriptions of "what their site looks like" are INSUFFICIENT — downstream agents need visual references to make informed decisions and the Visual QA measurement agent needs them for comparison.

If Playwright is unavailable: log as blocker, use web search to find and describe competitors in maximum visual detail, proceed with degraded quality. But TRY Playwright first.
</HARD-GATE>

- The UI Designer agent makes ALL visual decisions autonomously. No "pick A or B" presentations. The research provides the evidence; the agent makes the call.
- The Visual Design Spec MUST include research rationale for every major decision. Unjustified defaults are a design failure.
- The anti-AI-template checklist is a SCORING DIMENSION (Originality), not a hard blocker. The goal is awareness and intentional differentiation, not rigid prohibition of any single element.
- Proof screens are REAL implementations with real CSS/components, not mockups or wireframes. They must work responsively.
- The Visual QA loop is the primary quality control — no human reviews the design. The 80/100 threshold IS the taste arbiter. Treat it seriously.
- Screenshot data stays in measurement agents' context (separate subprocess). Do NOT load screenshots into the orchestrator's context — receive only the SCORE and TOP ISSUE as text.
