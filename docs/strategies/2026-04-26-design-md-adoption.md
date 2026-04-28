# Phase 3 Restructure: Adopt DESIGN.md as Consolidated Design Artifact

**Date:** 2026-04-26
**Status:** Proposal
**Decision needed:** approve before implementation.

## Why

Phase 3's current outputs (`visual-dna.md` + `visual-design-spec.md` + style-guide loop) are bespoke artifacts no agent outside this plugin understands. Google Labs' [`DESIGN.md`](https://github.com/google-labs-code/design.md) is the de-facto LLM-readable design-system format — Cursor, Claude Code, Antigravity, Gemini CLI all consume it natively as repo-root context, with **zero service dependency**. It's just markdown+YAML.

**Explicitly excluded:**
- **Stitch MCP** — Stitch is Google's hosted screen-generator product. Useful for some, but DESIGN.md does not depend on it. Adopting Stitch would be vendor lock-in for capability we don't need.
- **Rendered visual mockups (HTML/screenshots)** — generating front-end mockups in Phase 3 just to feed Phase 4 implementers who regenerate the same front-end is wasteful. Keep ASCII page-specs as the visual blueprint; they constrain layout intent without prescribing pixels Phase 4 will produce anyway.
- **Anthropic Claude Design** — no programmatic surface as of 2026-04-17 launch. Revisit when integrations ship.

## Scope decisions (locked)

- **Replace `visual-dna.md` + `visual-design-spec.md`** with one `DESIGN.md` at repo root. Brand prose (Overview / Do's-and-Don'ts) + tokens + components live together, lint-able, portable.
- **Keep `page-specs/*.md`** — DESIGN.md spec has no screen/layout concept (confirmed by reading full spec + all 3 example projects: atmospheric-glass, paws-and-paths, totality-festival contain only DESIGN.md + tokens.json + tailwind.config, zero screen artifacts).
- **Keep `product-spec.md`** — DESIGN.md has no concept of feature behavior, states, or business rules.
- **iOS branch adopts the same DESIGN.md schema** — write a small SwiftUI translator at Phase 4.
- **Single-vendor risk acknowledged** — Format is alpha and Google-governed. Mitigation: vendor the spec at a pinned commit; format is just markdown so worst case we own a fork.

## Comparison table

| Dimension | Current Phase 3 | Proposed Phase 3 |
|---|---|---|
| Brand artifact | `docs/plans/visual-dna.md` (custom 6-axis card) | `DESIGN.md` Overview + Do's-and-Don'ts (portable, LLM-standard) |
| Token artifact | `docs/plans/visual-design-spec.md` (prose + ad-hoc tables) | `DESIGN.md` YAML front-matter (typed, lint-able, exports to Tailwind/DTCG) |
| Screen layouts | `docs/plans/page-specs/*.md` ASCII wireframes | **Unchanged** — DESIGN.md doesn't cover this |
| Behavioral spec | `docs/plans/product-spec.md` | **Unchanged** — DESIGN.md doesn't cover this |
| Visual mockups | None | **None** — deliberately. Phase 4 produces these. |
| Quality gate at 3.4 | Manual review by writer | `npx @google/design.md lint` — broken-refs error, contrast warning, orphan-tokens warning |
| Style-guide loop (3.6) | Critic scores `/design-system` route | **Unchanged** — still scores rendered output; now reads DESIGN.md |
| Phase 4 input | 4+ separate plan files | 1 portable DESIGN.md + page-specs + product-spec |
| Cross-tool interop | None | Cursor / Claude Code / Antigravity / Gemini all read DESIGN.md natively |
| iOS branch | `docs/plans/ios-design-board.md` (custom) | Same DESIGN.md schema; SwiftUI translator at Phase 4 |
| Brand Guardian invocations | 3.0 + Gate 2 + Phase 5 drift (3×) | Same — but all read/write the same DESIGN.md, no artifact translation |
| Step 3.2b (DNA persona check) | Validates `visual-dna.md` against persona | Validates DESIGN.md prose sections — same purpose |
| External services required | None | None (CLI is local npm package; format is just markdown) |
| Lines of plugin code that change | — | Estimate: ~400 lines across 4 files |

## What DESIGN.md gives us (concretely)

The format is YAML front-matter + markdown body. Schema:

**Front-matter keys:** `version`, `name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components`. Token references use `"{path.to.token}"` syntax. Components map to atomic styling: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`. State variants use naming convention `<base>-<state>` (e.g., `button-primary-hover`).

**Required markdown sections (canonical order, linter enforced):** Overview · Colors · Typography · Layout · Elevation & Depth · Shapes · Components · Do's and Don'ts.

**Linter rules (8):** broken-ref (error), missing-primary (warn), contrast-ratio WCAG AA (warn), orphaned-tokens (warn), missing-typography (warn), section-order (warn), token-summary (info), missing-sections (info).

**CLI:** `npx @google/design.md lint|diff|export|spec`. No network, no account, no service. Apache 2.0.

## Step-by-step implementation

### Phase A — schema migration (~1 day)

1. **Vendor `docs/spec.md`** from `google-labs-code/design.md` into `protocols/design-md-spec.md`. Pin to commit. Apache 2.0 attribution → `NOTICE` file.
2. **Rewrite `protocols/visual-dna.md`** → `protocols/design-md-authoring.md`:
   - Step 3.0 (Brand Guardian) writes `DESIGN.md` Overview + Do's-and-Don'ts (markdown body sections, leaves YAML empty).
   - Step 3.4 (UI Designer) fills YAML front-matter (colors / typography / rounded / spacing / components) + prose for Colors / Typography / Layout / Elevation / Shapes / Components.
   - Both write to the same file at repo root using Edit; ordering enforced by phase graph.
3. **Update `protocols/web-phase-branches.md`** Phase 3:
   - 3.0 outputs: `DESIGN.md` (markdown body sections only) — replaces `docs/plans/visual-dna.md`.
   - 3.2b inputs: read DESIGN.md prose sections instead of visual-dna.md.
   - 3.3 inputs: read DESIGN.md (still produce page-specs unchanged).
   - 3.4 outputs: completed `DESIGN.md` with YAML — replaces `docs/plans/visual-design-spec.md`.
   - 3.4 verification: run `npx @google/design.md lint DESIGN.md`; broken-refs = hard fail, warnings logged.
   - 3.6 inputs: read DESIGN.md instead of visual-design-spec.md.
4. **Update agent frontmatter** in `agents/design-brand-guardian.md`, `agents/design-ui-designer.md`, `agents/design-ux-architect.md`, `agents/design-critic.md`, `agents/design-ux-researcher.md` — change input/output paths.
5. **Update `docs/migration/phase-graph.yaml`** Phase 3 nodes — change artifact identifiers (`visual_dna_md` and `visual_design_spec_md` both → single `design_md` artifact). Update writer-owner table to register `DESIGN.md` as writable by `design-brand-guardian` (3.0) and `design-ui-designer` (3.4).
6. **Update `docs/migration/phase-graph.md`** table.
7. **Update `commands/build.md`** Phase 3 hard-gate list (DESIGN.md replaces 2 prior artifacts).
8. **Add lint hook** in `hooks/` — runs `npx @google/design.md lint DESIGN.md` after Step 3.4 writes complete; surfaces findings to Phase 3 gate (3.8). Broken-refs blocks; warnings logged but pass.
9. **Update `CLAUDE.md`** — Key Artifacts section + implemented-changes log.

### Phase B — iOS branch alignment (~0.5 day)

1. **Rewrite `protocols/ios-phase-branches.md` Step 3.2-ios** — iOS Design Board → produce DESIGN.md (same schema; component naming reflects SwiftUI primitives, e.g., `nav-tab-bar`, `list-row`, `card-elevated`).
2. **Phase 4 iOS implementer** — write a small SwiftUI translator that reads DESIGN.md tokens and emits `Color`/`Font`/`CGFloat` extensions. ~80 lines, one-time. Lives in implementer's prompt as a reference, not generated per project.
3. iOS-specific component vocabulary documented in `protocols/design-md-authoring.md` as a sub-section.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| DESIGN.md is alpha — format may churn | Pin vendored spec to a commit; format is just markdown so worst case we own a fork |
| Atomic-component vocabulary is web-CSS-flavored (`backgroundColor`, `padding`, `rounded`) | iOS translator handles mapping; document iOS-specific naming conventions in authoring protocol |
| Lint warnings on contrast may false-positive for translucent components using raw `rgba(...)` | Warning-not-error; document acceptable cases in agent guidance |
| Brand Guardian + UI Designer both edit one file | Phase ordering is sequential (3.0 → 3.4); existing write-lease infrastructure (`acquire_write_lease`) covers concurrent edits |
| Writer-owner table must include `DESIGN.md` | Update `docs/migration/phase-graph.yaml` in step A.5; pre-tool-use hook will block writes otherwise |
| Vendor risk (Google governance, no W3C standardization) | Format is open + Apache 2.0; if Google abandons it, fork is trivial — it's just markdown |

## Out of scope

- Replacing `page-specs/*.md`.
- Replacing `product-spec.md`.
- Stitch MCP / Stitch product integration.
- Generating rendered HTML/screenshot mockups in Phase 3.
- Anthropic Claude Design integration.
- Replicating Claude Design's "auto-extract design system from existing codebase" — separate future plan, would slot at Phase 0.

## Decision points

1. **Approve as written?**
2. **iOS schema alignment now (Phase B) or after web ships?** Recommendation: now — cheaper than translating later.
3. **Run `npx @google/design.md lint` via npx (no install) or pin a version in package.json?** Recommendation: pin a version in plugin's setup skill so the lint behavior is reproducible.

## Appendix — current Phase 3 inventory (web)

| Step | Agent | Output | Change |
|---|---|---|---|
| 3.0 | design-brand-guardian | `docs/plans/visual-dna.md` | → writes `DESIGN.md` prose body |
| 3.1 | visual-research ×2 | `design-references.md` + screenshots | unchanged |
| 3.2 | design-ui-designer | `component-manifest.md` | unchanged |
| 3.2b | design-ux-researcher | `dna-persona-check.md` | unchanged (reads DESIGN.md prose) |
| 3.3 | design-ux-architect | `ux-architecture.md` + `page-specs/*.md` | unchanged |
| 3.3b | design-ux-researcher | `ux-flow-validation.md` | unchanged |
| 3.4 | design-ui-designer | `visual-design-spec.md` | → completes `DESIGN.md` (YAML + prose) + lint gate |
| 3.5 | design-inclusive-visuals-specialist | `inclusive-visuals-audit.md` | unchanged |
| 3.6 | engineering-frontend-developer + design-critic | `/design-system` route + score | unchanged (now reads DESIGN.md) |
| 3.7 | a11y-architect | `a11y-design-review.md` | unchanged |
| 3.8 | gate | log entry | adds DESIGN.md lint result |
