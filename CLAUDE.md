# BuildAnything — Core Problem Statement

The pipeline's output quality is not measurably better than one-shotting with Claude. The root cause is that product context generated in early phases does not meaningfully reach the agents that write code. Every chat must understand this.

## What Each Phase Must Achieve

- **Phase 0:** Figure out what we're working with (new project? existing code? iOS or web?)
- **Phase 1:** Understand the idea, research the market, make product decisions with the user, write the PRD
- **Phase 2:** Design the technical architecture and break it into tasks
- **Phase 3:** Design the visual system (colors, components, motion, typography) and build a living style guide
- **Phase 4:** Write the code
- **Phase 5:** Test and audit the built product
- **Phase 6:** Final review — ship or fix
- **Phase 7:** Write docs and deploy

## Active Redesign Work

See `docs/plans/2026-04-20-*` and `docs/plans/2026-04-21-*` for the full audit and redesign decisions:
- `2026-04-20-known-issues-quality-audit.md` — 6 diagnosed issues, 5 CRITICAL
- `2026-04-20-phase4-redesign-decisions.md` — three-tier hierarchy (Product Owner → Briefing Officers → Execution Agents)
- `2026-04-20-phase0-3-question-map.md` — 56 questions the pipeline must answer before code, 18 currently unanswered
- `2026-04-20-q9-product-spec-implementation.md` — plan for the root missing artifact (feature behavioral specs)
- `2026-04-21-phases0-3-implementation-plan.md` — full implementation plan for Phases 0-3 changes (product spec, page specs, prompt updates)
