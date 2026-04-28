# BuildAnything — Core Problem Statement

The pipeline's output quality is not measurably better than one-shotting with Claude. The root cause is that product context generated in early phases does not meaningfully reach the agents that write code. Every chat must understand this.

## What Each Phase Must Achieve

- **Phase 0:** Figure out what we're working with (new project? existing code? iOS or web?)
- **Phase 1:** Understand the idea, research the market, make product decisions with the user, write the PRD + product spec
- **Phase 2:** Design the technical architecture (informed by product spec) and break it into tasks
- **Phase 3:** Design the visual system AND per-screen layouts — product spec is the source of truth for every design agent
- **Phase 4:** Write the code — implementers receive product spec + page layouts + design tokens
- **Phase 5:** Test and audit the built product
- **Phase 6:** Final review — ship or fix
- **Phase 7:** Write docs and deploy

## Key Artifacts

- `product-spec.md` — source of truth for what each feature does, business rules, error scenarios, screen inventory. Every Phase 2+ agent reads this.
- `page-specs/*.md` — per-screen ASCII wireframes + content hierarchy. Produced at Step 3.3 alongside UX architecture.
- `DESIGN.md` (repo root, web only) — the consolidated design system. Two-pass authoring: Step 3.0 (design-brand-guardian) writes Pass 1 (Overview, Brand DNA, Do's and Don'ts); Step 3.4 (design-ui-designer) writes Pass 2 (YAML tokens, Colors/Typography/Layout/Elevation/Shapes/Components prose). Format spec vendored at `protocols/design-md-spec.md` (Apache 2.0). Authoring contract at `protocols/design-md-authoring.md`. Replaces former `docs/plans/visual-dna.md` + `docs/plans/visual-design-spec.md` pair.

## Active Redesign Work

See `docs/plans/2026-04-20-*` and `docs/plans/2026-04-21-*` for the full audit and redesign decisions:
- `2026-04-20-known-issues-quality-audit.md` — 6 diagnosed issues, 5 CRITICAL
- `2026-04-20-phase4-redesign-decisions.md` — three-tier hierarchy (Product Owner → Briefing Officers → Execution Agents)
- `2026-04-20-phase0-3-question-map.md` — 56 questions the pipeline must answer before code, 18 currently unanswered
- `2026-04-20-q9-product-spec-implementation.md` — plan for the root missing artifact (feature behavioral specs)
- `2026-04-21-phases0-3-implementation-plan.md` — full implementation plan for Phases 0-3 changes

## Implemented Changes (2026-04-21)

### product-spec.md wired into all Phase 3 steps
Previously only referenced at Step 3.9. Now every Phase 3 agent reads it:
- 3.0 (Brand Guardian): App Overview, Screen Inventory, Permissions
- 3.2 (Component Manifest): Screen Inventory, per-feature States
- 3.2b (DNA Persona Check): per-feature Persona Constraints
- 3.3 (UX Architecture + Layouts): FULL product spec as source of truth
- 3.3b (UX Flow Validation): Happy Path, Persona Constraints, page-specs
- 3.4 (Visual Design Spec): per-feature States, page-specs for token context
- 3.6 (Design Critic): page-specs for scoring in page context

### Layout merged into Step 3.3 (Option C — former Step 3.9 removed)
UX architecture and per-screen ASCII wireframes produced together before the visual design spec. Phase 4 implementers apply final token values.

### Files changed
- `protocols/web-phase-branches.md` — product-spec wiring + Option C merge
- `docs/migration/phase-graph.yaml` — Step 3.3 expanded, Step 3.9 removed
- `docs/migration/phase-graph.md` — table update, Phase 4 entry requires page-specs/
- `protocols/page-spec-schema.md` — updated for Step 3.3 placement

## Implemented Changes (2026-04-26)

### DESIGN.md adopted as consolidated design artifact

`docs/plans/visual-dna.md` and `docs/plans/visual-design-spec.md` are replaced by a single `DESIGN.md` at the repo root. Format vendored from `google-labs-code/design.md` at pinned commit `8ecd4645b957e6a683a05fb9c79cd6c9028873d0` (Apache 2.0). The format is just markdown + YAML — no service dependency, portable across Cursor / Claude Code / Antigravity / Gemini CLI.

Two-pass authoring model:
- **Step 3.0 (design-brand-guardian)** writes Pass 1: `## Overview` (with `### Brand DNA` h3 listing the 7 axes — Scope, Density, Character, Material, Motion, Type, Copy), `### Rationale`, `### Locked At`, `### References`, `## Do's and Don'ts`. YAML front matter: `version: alpha` + `name:` only. Pass 2 sections present as placeholder headings to satisfy section-order linter rule.
- **Step 3.4 (design-ui-designer)** writes Pass 2: fills YAML front matter (`colors`, `typography`, `rounded`, `spacing`, `components`) and replaces Pass 2 placeholders with prose for `## Colors`, `## Typography`, `## Layout`, `## Elevation & Depth`, `## Shapes`, `## Components`. Pass 1 is read-only at this step.

### Step 3.8 lint gate
`hooks/design-md-lint.ts` runs `npx @google/design.md lint DESIGN.md` at Phase 3 Step 3.8. Broken-refs is a hard fail and routes back to Step 3.4. Warnings (missing-primary, contrast-ratio WCAG AA, orphaned-tokens, missing-typography, section-order) are logged to `docs/plans/build-log.md` but do not block Phase 4.

### Pipeline-internal additions on top of the spec
- `### Brand DNA` h3 inside `## Overview` is required (the linter accepts unknown subsections per spec's "Consumer Behavior for Unknown Content" rule). Carries the 7-axis values that drive CONTEXT header injection, Design Critic scoring (240-point rubric), Phase 5 brand drift check, and Phase 6 LRR Brand Guardian chapter.
- 14-row incompatibility matrix and anti-slop gates (font hard-ban, font overuse-ban, AI-slop pattern ban, Copy axis validation) preserved from the prior `protocols/visual-dna.md` protocol — see `protocols/design-md-authoring.md` §3-4.
- Component naming follows DNA Material axis convention (`button-primary` for Flat, `button-primary-glass` for Glassy, `button-primary-elev-N` for Physical).

### Files changed
- `protocols/design-md-spec.md` — vendored DESIGN.md format spec (NEW).
- `NOTICE` — Apache 2.0 attribution for vendored spec (NEW).
- `protocols/design-md-authoring.md` — two-pass authoring contract + DNA preservation rules + iOS component vocabulary (NEW; replaces `protocols/visual-dna.md`).
- `protocols/visual-dna.md` — deleted.
- `protocols/web-phase-branches.md` — Step 3.0 / 3.4 prompt rewrites; Step 3.8 lint gate; all path swaps.
- `agents/design-brand-guardian.md`, `agents/design-ui-designer.md`, `agents/design-ux-architect.md`, `agents/design-critic.md`, `agents/design-ux-researcher.md` — input/output paths.
- `docs/migration/phase-graph.yaml` — DESIGN.md artifact replaces the two old artifacts; writer-owner table updated; Step 3.0 / 3.4 produces strings updated; Step 3.6 metric-loop scale updated to 240.
- `docs/migration/phase-graph.md` — table + prose updated.
- `commands/build.md` — Phase 3 entry/exit gates, CONTEXT header, refs paragraph.
- `hooks/design-md-lint.ts` + `hooks/design-md-lint` — lint runner (NEW).

### iOS branch
Phase A is web-only. Phase B (deferred) will adopt the same DESIGN.md format for iOS with SwiftUI-aligned component names — see `protocols/design-md-authoring.md` §9.

## Still TODO
- Wire product-spec.md into Phase 2 architect + planner prompts
- iOS equivalent: wire page specs into `protocols/ios-phase-branches.md`
- iOS equivalent: adopt `DESIGN.md` for iOS branch (Phase B of design.md adoption — see `docs/strategies/2026-04-26-design-md-adoption.md`)
- Phase 4 three-tier wiring complete (commands/build.md + docs/migration/phase-graph.{md,yaml} + state-schema v5); agents/product-owner.md and agents/briefing-officer.md shipped
- Graph layer — deferred, product-spec + refs.json may suffice
- Measurement infrastructure — count backward routing events before/after
