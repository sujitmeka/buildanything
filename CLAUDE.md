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
- `visual-design-spec.md` — tokens, material, motion, typography. Produced at Step 3.4 after layouts exist.

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

## Still TODO
- Wire product-spec.md into Phase 2 architect + planner prompts
- iOS equivalent: wire page specs into `protocols/ios-phase-branches.md`
- Phase 4 three-tier wiring complete (commands/build.md + docs/migration/phase-graph.{md,yaml} + state-schema v5); agents/product-owner.md and agents/briefing-officer.md shipped
- Graph layer — deferred, product-spec + refs.json may suffice
- Measurement infrastructure — count backward routing events before/after
