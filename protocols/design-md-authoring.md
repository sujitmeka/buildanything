# DESIGN.md Authoring Protocol

`DESIGN.md` is the single design-system artifact for every web build. It replaces the prior `visual-dna.md` + `visual-design-spec.md` pair. The format is specified by `protocols/design-md-spec.md` (vendored from `google-labs-code/design.md` at a pinned commit). This protocol layers our pipeline contract on top of the spec — the two-pass authoring model, the DNA preservation rule, the lint gate, and the iOS component vocabulary.

Every Phase 3 design step and every Phase 4+ implementer reads `DESIGN.md`. If the file drifts, every downstream surface drifts with it. This protocol exists to make ownership, schema additions, and the gate behavior explicit.

## 1. File location and ownership

**Canonical path:** `DESIGN.md` at the **repository root** (NOT under `docs/plans/`). Repo-root placement is required so external tools (Cursor, Claude Code, Antigravity, Gemini CLI) auto-load it as design context. Only this path is read.

**Two-pass authoring** — the file is built by two agents in two phases:

| Pass | Step | Agent | Writes |
|---|---|---|---|
| 1 | 3.0 | `design-brand-guardian` | Markdown body: `## Overview` (including `### Brand DNA` subsection) + `## Do's and Don'ts`. YAML front matter contains only `version: alpha` and `name`. All other sections present as headings with `<!-- Pass 2 — UI Designer -->` placeholders so the file lints (missing-sections is a warning, not an error). |
| 2 | 3.4 | `design-ui-designer` | Fills YAML front matter (`colors`, `typography`, `rounded`, `spacing`, `components`) AND writes the remaining prose sections: `## Colors`, `## Typography`, `## Layout`, `## Elevation & Depth`, `## Shapes`, `## Components`. |

Both agents Edit the same file; ordering is enforced by the phase graph (3.0 must complete before 3.4 dispatches). The writer-owner table in `docs/migration/phase-graph.yaml` registers `DESIGN.md` with both agents as legitimate writers.

**No other agent writes `DESIGN.md`.** Brand Guardian's Phase 5 drift check and Phase 6 LRR Brand Guardian chapter are READ-ONLY against this file.

## 2. Schema additions (on top of the vendored spec)

The vendored spec (`protocols/design-md-spec.md`) defines the canonical sections, YAML schema, and linter rules. Our pipeline adds three structured constraints inside DESIGN.md that the spec leaves implicit:

### 2.1 Required `### Brand DNA` subsection inside `## Overview`

`## Overview` MUST contain a `### Brand DNA` h3 subsection that lists the 7 locked DNA axes as a bullet list. The DESIGN.md linter treats unknown h3 subsections as preserve-not-error (per spec's "Consumer Behavior for Unknown Content" table), so this is schema-safe. Our pipeline depends on these values for: CONTEXT header injection (Phase 3+), Design Critic scoring (Step 3.6), Phase 5 brand drift check, Phase 6 LRR Brand Guardian chapter, and Phase 4 implementer dispatches.

```markdown
## Overview

<2-4 paragraph holistic brand description — personality, target audience, emotional response>

### Brand DNA

- Scope: <Marketing | Product | Dashboard | Internal Tool>
- Density: <Airy | Balanced | Dense>
- Character: <Minimal | Editorial | Maximalist | Brutalist | Playful>
- Material: <Flat | Glassy | Physical | Neumorphic>
- Motion: <Still | Subtle | Expressive | Cinematic>
- Type: <Neutral Sans | Humanist Sans | Serif-forward | Display-forward | Mono-accented>
- Copy: <Functional | Narrative | Punchy | Technical>

### Locked At

- locked_at: <ISO-8601 timestamp set exactly once at Step 3.0>
- locked_by: design-brand-guardian
- build_session: <session_id>

### References

- <url or path> — exemplifies <axes>
- <url or path> — exemplifies <axes>
```

The 7 axis values, the incompatibility matrix in §3, the anti-slop gates in §4, and the rationale rules below ALL preserve from the prior `visual-dna.md` protocol — the visual mechanics did not change, only the file format.

### 2.2 YAML `name` and `description` derive from Overview

`name:` MUST match the brand identity declared in Overview (e.g. "Daylight Prestige"). `description:` MUST be a single sentence drawn from the Overview's first paragraph. This keeps tools that read the YAML standalone (export, diff, third-party tooling) consistent with the prose.

### 2.3 Component naming follows DNA Material

When DNA Material = `Flat`, the `components:` block uses shadcn-aligned variant names (`button-primary`, `card`, `input`). When DNA Material = `Glassy`, names append the material register (`button-primary-glass`, `card-glass`). When DNA Material = `Physical`, names append elevation steps (`button-primary-elev-1`, `card-elev-2`). This is convention only — the linter does not enforce naming, but the Style Guide critic and Phase 4 implementers expect it.

## 3. Incompatibility matrix

<HARD-GATE>
Brand Guardian is forbidden from locking any of the combinations below. If the user's references or design doc push toward an illegal combo, Brand Guardian picks the closest legal alternative and emits a decision-log row explaining the rejection.
</HARD-GATE>

| # | Illegal combination | Why |
|---|---|---|
| 1 | Dashboard + Cinematic motion | Dashboards need snappy feedback (100-200ms), not 650ms cinematic eases. Users lose their place. |
| 2 | Internal Tool + Maximalist character | Internal tools exist for fast parse; decoration-heavy styling buries the data users came for. |
| 3 | Internal Tool + Expressive or Cinematic motion | Internal tools ship at <200KB budget; framer-motion choreography + GSAP break that budget. |
| 4 | Marketing + Dense density | Marketing pages need breathing room to sell; dense kills scroll rhythm and conversion. |
| 5 | Dashboard + Glassy material + Dense density | Glass blur on dense data surfaces renders unreadable — the backdrop-filter eats legibility. |
| 6 | Dashboard + Serif-forward type | Dashboards need high-readability UI faces at small sizes; serifs lose clarity at 12-14px. |
| 7 | Product + Neumorphic material (with WCAG AA target) | Neumorphic shadows depend on low-contrast surfaces; AA contrast math fails by construction. |
| 8 | Brutalist character + Glassy material | Brutalism is raw, unapologetic, unadorned; glass is the opposite ethos. Visual contradiction. |
| 9 | Playful character + Still motion | Playful without motion reads as stiff and off-brand. Playful implies at least Subtle motion. |
| 10 | Marketing + Still motion | Marketing pages rely on scroll reveal and choreography to guide attention; Still kills that. |
| 11 | Internal Tool + Display-forward type | Display faces are for hero moments, not tool chrome. Clashes with fast-parse requirement. |
| 12 | Dashboard + Physical material | Heavy drop shadows on data grids add visual noise that competes with the chart ink. |
| 13 | Playful character + Technical copy | Playful implies approachable warmth; technical copy creates cognitive dissonance — the visual feel promises friendliness, the words deliver distance. |
| 14 | Brutalist character + Narrative copy | Brutalism is raw, direct, unapologetic; narrative copy is storytelling and emotional pull — the aesthetic actively rejects the storytelling register. |

Anything not on this list is legal. When two legal combinations both fit the user's references, Brand Guardian reads `quality-targets.json` and the architecture stack to resolve ties (e.g., if the stack is Next.js + shadcn default and quality-targets say "fast build," prefer Flat over Glassy).

## 4. Anti-slop gates (Step 3.0 — Brand Guardian)

These gates fire at DNA lock time, before any design decisions are made. If the user's references or design doc push toward any item on these lists, Brand Guardian rejects it, picks the closest acceptable alternative, and emits a decision-log row naming the rejection.

### 4.1 Font hard-ban

Never recommend in any role: Papyrus, Comic Sans, Lobster, Impact, Jokerman, Bleeding Cowboys, Permanent Marker, Bradley Hand, Brush Script, Hobo, Trajan, Raleway, Clash Display, Courier New (as body text).

### 4.2 Font overuse-ban (never as primary)

Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, Poppins. Acceptable as secondary/utility faces when the primary is more distinctive. Not acceptable as the sole or headline typeface if non-generic output is the goal.

### 4.3 AI-slop pattern ban

1. Purple/violet/indigo gradients as default accent.
2. 3-column feature grid with icons in colored circles.
3. Centered everything with uniform spacing.
4. Uniform bubbly border-radius on all elements.
5. Gradient buttons as primary CTA.
6. Decorative blobs, floating circles, wavy SVG dividers.
7. Emoji as design elements.
8. Colored left-border cards.
9. Generic hero copy ("Welcome to [X]", "Unlock the power of...", "Your all-in-one solution for...").
10. Cookie-cutter section rhythm (Hero → Features 3-col → Testimonials → Pricing → CTA).

### 4.4 Copy axis validation

After locking the Copy axis value, validate any example headlines or microcopy in the design doc against the locked register. Functional → labels, no marketing language. Narrative → headlines read as story openings. Punchy → ≤5 word headlines, ≤3 word CTAs. Technical → exact vocabulary, no softeners.

## 5. Pass 1 — Step 3.0 Brand Guardian

**Reads:** `docs/plans/product-spec.md` (App Overview, Screen Inventory, Permissions & Roles), `docs/plans/design-doc.md` (#persona, #scope, #voice), `docs/plans/phase1-scratch/findings-digest.md`, `docs/plans/architecture.md` (stack constraints), `docs/plans/quality-targets.json` (perf budget gates Motion/Material), `docs/plans/phase1-scratch/user-decisions.md`.

**Writes:** `DESIGN.md` (repo root) with this skeleton:

```markdown
---
version: alpha
name: <Brand Name>
---

# <Brand Name>

## Overview

<2-4 paragraph holistic brand description — personality, target audience, emotional response>

### Brand DNA

- Scope: <value>
- Density: <value>
- Character: <value>
- Material: <value>
- Motion: <value>
- Type: <value>
- Copy: <value>

### Rationale

<4-8 sentences citing design-doc.md sections + findings-digest signals that pushed each axis to its chosen value. No padding>

### Locked At

- locked_at: <ISO-8601>
- locked_by: design-brand-guardian
- build_session: <session_id>

### References

- <url or path> — exemplifies <axes>
- <url or path> — exemplifies <axes>

## Colors

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Typography

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Layout

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Elevation & Depth

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Shapes

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Components

<!-- Pass 2 — UI Designer at Step 3.4 -->

## Do's and Don'ts

- Do <rule from references + DNA>
- Don't <rule against AI-slop patterns or DNA contradictions>
- (4-10 bullets total)
```

<HARD-GATE>
PASS 1 SCHEMA CONTRACT:

- All seven axis fields MUST be present and MUST be one of the allowed values from §3 enumeration.
- The combination across all seven axes MUST NOT appear in the §3 incompatibility matrix.
- `locked_at` is set exactly once and is never rewritten.
- `### References` MUST contain at least two entries, each tied to specific axis pairs. "Looks good" without axis attribution is not permitted.
- `## Do's and Don'ts` MUST contain at least 4 bullets — at least 2 Do, at least 2 Don't.
- All eight required `<h2>` sections MUST appear in the canonical order from the spec, even if Pass 2 sections are placeholders.
- The file MUST be at repo root. No other path is read.
</HARD-GATE>

## 6. Pass 2 — Step 3.4 UI Designer

**Reads:** `DESIGN.md` (Pass 1 output), `docs/plans/component-manifest.md` (locked component picks), `docs/plans/ux-architecture.md`, `docs/plans/page-specs/*.md` (the wireframes the typography/spacing scale must work for), `docs/plans/design-references.md`, `docs/plans/product-spec.md` (per-feature States and Empty/Loading/Error States — the state matrix must cover every state the product spec defines).

**Writes:** Edits `DESIGN.md` to (a) fill YAML front matter and (b) replace Pass 2 placeholder sections with prose.

### 6.1 YAML front matter — token shape

```yaml
---
version: alpha
name: <Brand Name>
description: <single sentence from Overview>
colors:
  primary: "#..."     # hex SRGB only
  secondary: "#..."
  tertiary: "#..."    # optional
  neutral: "#..."     # optional
  surface: "#..."     # optional
  on-surface: "#..."  # optional
  error: "#..."       # optional
typography:
  headline-display:   # 9-15 levels typical; names follow spec's recommended set
    fontFamily: <face>
    fontSize: 48px    # px / em / rem only
    fontWeight: 700
    lineHeight: 1.1   # unitless multiplier preferred
    letterSpacing: -0.02em
  body-md:
    fontFamily: <face>
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  # ... additional levels
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
  gutter: 24px
  margin: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    # variants follow <base>-<state> naming per spec §Components > Variants
  # ... at minimum: button-primary, input, card, nav for every project
---
```

Token references (`{colors.primary}`) MUST resolve. The linter's broken-ref rule is a hard-fail (see §8).

### 6.2 Prose sections — required

Each Pass 2 section follows the vendored spec's example shape:

- `## Colors` — palette description tied to DNA Character axis. Cite contrast ratios where they motivate choices. Pass 2 fills semantic role for each token.
- `## Typography` — pairing rationale, role per level (headlines / body / labels / caption). Tracking tuning per size if DNA Type axis demands it (e.g. Editorial → eyebrow 11px uppercase +0.15em).
- `## Layout` — grid model + spacing scale. Tied to DNA Density axis (Airy = 32px gutters; Dense = 12-16px gutters; Balanced = 24px).
- `## Elevation & Depth` — material treatment per DNA Material axis. Flat = describe how hierarchy is conveyed without shadows. Glassy = blur radii, border rgba, surface opacity per variant. Physical = drop shadow specs (offset, blur, color). Neumorphic = inset/outset shadow pairs.
- `## Shapes` — radius scale + decorative shape rules. Cite DNA Character axis (Brutalist = 0px radius across the board; Playful = liberal use of `rounded.lg`+).
- `## Components` — narrative for the most important component types (buttons, inputs, cards, modals, lists, tooltips). YAML token block in §6.1 carries the machine-readable values.

### 6.3 Motion and state matrix

The vendored spec has no `motion:` or component-state-matrix block. Our pipeline preserves both inside the prose and uses convention names in the `components:` YAML:

- **Motion** — write inside `## Components` or as an h3 inside `## Elevation & Depth`. Specify easings (cubic-bezier curves), duration clusters (fast / base / slow), scroll patterns, hover patterns, choreography notes — tuned to DNA Motion axis (Still=none, Subtle=200-300ms, Expressive=400-600ms, Cinematic=650-1100ms).
- **Component state matrix** — every interactive component needs `<base>`, `<base>-hover`, `<base>-focus`, `<base>-active`, `<base>-disabled`, `<base>-loading`, `<base>-error` in the YAML where relevant. Spec convention: `button-primary-hover: { backgroundColor: ... }` overrides only the changed properties from `button-primary`.

## 7. Iteration discipline

**No revision after Pass 2 except via metric loop.** Step 3.6 (Style Guide Implementation) runs the design-critic loop and may surface findings that require re-tuning DESIGN.md. Re-tuning is allowed during the metric loop only and re-invokes `design-ui-designer` with a tight, finding-scoped prompt — NOT a full Pass 2 rewrite. The DNA axes (§2.1) are LOCKED by Pass 1 and never edited mid-build; a DNA revision is a new build session.

LRR backward routing per `docs/migration/phase-graph.yaml` re-entry rules: if the LRR Brand Guardian chapter routes a BLOCK back to Phase 3, the orchestrator re-opens the specific step named by `decision_row.author` (3.0 for DNA-level findings, 3.4 for token-level findings). Unaffected sections of DESIGN.md are not re-edited.

## 8. Lint gate

After Pass 2 completes, the orchestrator runs:

```bash
npx @google/design.md lint DESIGN.md
```

Linter rules (per vendored spec):

| Rule | Severity | Pipeline behavior |
|---|---|---|
| broken-ref | error | HARD FAIL — Step 3.4 must re-dispatch with the broken ref as the focused finding |
| missing-primary | warn | Logged to `docs/plans/build-log.md` Phase 3 Step 3.4 entry; allowed to pass |
| contrast-ratio (WCAG AA) | warn | Logged; Phase 3.7 a11y review may escalate to BLOCK |
| orphaned-tokens | warn | Logged; pruning is a Phase 5 hardening-loop concern |
| missing-typography | warn | Logged |
| section-order | warn | Logged; Pass 2 must produce sections in canonical order from the spec |
| token-summary | info | Logged |
| missing-sections | info | Logged; Pass 1 placeholders satisfy this rule once Pass 2 fills them |

Broken-refs is the only hard-fail. Warnings accumulate in the build log and feed the Phase 3.8 gate summary, but do not block Phase 4. The lint hook is invoked at Phase 3 Step 3.8 (Autonomous Quality Gate) — see `hooks/design-md-lint.ts`.

## 9. iOS DESIGN.md (Phase B)

The same DESIGN.md format applies to iOS builds. The 7-axis Brand DNA, two-pass authoring, and lint gate are unchanged. iOS specifics live in this section.

### 9.1 Authoring agents

iOS uses a single Pass 2 author rather than the web's `design-ui-designer`. The dispatch table:

| Pass | Step | Agent | Writes |
|---|---|---|---|
| 1 | 3.0 | `design-brand-guardian` | Markdown body (Overview + Brand DNA + Do's and Don'ts), shared with web. iOS-specific anti-slop guidance inline in §4. |
| 2 | 3.2-ios | `ios-swift-ui-design` | YAML front matter + Pass 2 prose. Replaces the prior `ios-design-board.md` artifact entirely. |

`ios-swift-ui-design` is the only iOS Pass 2 writer. The visual QA loop at Step 3.4-ios uses it as the generator (Preview tweaks) paired with `design-critic` as the critic — same pattern as web Step 3.6, just measuring against SwiftUI Preview captures instead of Playwright screenshots.

### 9.2 iOS-specific YAML conventions

The vendored spec is platform-agnostic. iOS authoring layers these conventions on top — they are NOT linter-enforced (the linter doesn't know about iOS), but downstream agents and the SwiftUI translator depend on them.

**Colors** — every color token has a paired `-dark` token for dark-mode UITraitCollection. Authoring example:
```yaml
colors:
  primary: "#1A1C1E"
  primary-dark: "#F2F4F6"
  surface: "#FFFFFF"
  surface-dark: "#0B0B0C"
  on-surface: "#1A1C1E"
  on-surface-dark: "#F2F4F6"
```
The translator emits a single `Color("primary")` that resolves through Asset Catalog with both appearances. Authors who skip the `-dark` pair get a contrast warning at Step 3.7.

**Typography** — name tokens after iOS Dynamic Type roles, not display sizes. The roles map directly to `Font.TextStyle`:
```yaml
typography:
  largeTitle:    { fontFamily: SF Pro Display, fontSize: 34px, fontWeight: 700, lineHeight: 1.2 }
  title:         { fontFamily: SF Pro Display, fontSize: 28px, fontWeight: 700, lineHeight: 1.2 }
  title2:        { fontFamily: SF Pro Display, fontSize: 22px, fontWeight: 600, lineHeight: 1.2 }
  title3:        { fontFamily: SF Pro Text,    fontSize: 20px, fontWeight: 600, lineHeight: 1.2 }
  headline:      { fontFamily: SF Pro Text,    fontSize: 17px, fontWeight: 600, lineHeight: 1.3 }
  body:          { fontFamily: SF Pro Text,    fontSize: 17px, fontWeight: 400, lineHeight: 1.4 }
  callout:       { fontFamily: SF Pro Text,    fontSize: 16px, fontWeight: 400, lineHeight: 1.4 }
  subheadline:   { fontFamily: SF Pro Text,    fontSize: 15px, fontWeight: 400, lineHeight: 1.4 }
  footnote:      { fontFamily: SF Pro Text,    fontSize: 13px, fontWeight: 400, lineHeight: 1.3 }
  caption:       { fontFamily: SF Pro Text,    fontSize: 12px, fontWeight: 400, lineHeight: 1.3 }
  caption2:      { fontFamily: SF Pro Text,    fontSize: 11px, fontWeight: 400, lineHeight: 1.3 }
```
Token names that match a Dynamic Type role get a `Font.TextStyle` (which scales with the user's accessibility setting). Custom names that don't match emit a fixed-size Font, breaking accessibility — Step 3.7 will flag those.

**Spacing** — iOS uses HIG's 4 / 8 / 16 / 20 / 24 progression (`xs: 4 / sm: 8 / md: 16 / lg: 20 / xl: 24 / xxl: 32`). The translator emits these as `CGFloat` constants. Use `safeArea`, `gutter`, and `margin` named tokens for layout anchors.

**Rounded** — iOS prefers `continuous` corner curves on iOS 13+. The translator emits `RoundedRectangle(cornerRadius: X, style: .continuous)`. Token names follow the web convention (`sm / md / lg / xl / full`).

### 9.3 Required iOS components vocabulary

The `components:` block MUST cover at minimum these slots (additional components are encouraged):

```yaml
components:
  # Navigation
  nav-tab-bar:             { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}" }
  nav-stack-bar:           { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}" }
  nav-large-title:         { textColor: "{colors.on-surface}", typography: "{typography.largeTitle}" }

  # Lists / cards
  list-row:                { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", padding: "{spacing.md}" }
  list-row-grouped:        { backgroundColor: "{colors.surface}", rounded: "{rounded.md}" }
  list-row-inset:          { backgroundColor: "{colors.surface}", padding: "{spacing.lg}" }
  card-elevated:           { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}", padding: "{spacing.md}" }
  card-bordered:           { backgroundColor: "{colors.surface}", rounded: "{rounded.md}", padding: "{spacing.md}" }
  # iOS 26+ Liquid Glass — use only when DNA Material = Glassy AND build targets iOS 26+
  card-glass:              { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}" }

  # Buttons (HIG primary / secondary / tertiary; iOS 26+ tinted)
  button-primary:          { backgroundColor: "{colors.primary}", textColor: "{colors.surface}", typography: "{typography.headline}", padding: "{spacing.md}", rounded: "{rounded.md}" }
  button-primary-pressed:  { backgroundColor: "{colors.primary}" }   # 90% opacity applied by translator
  button-primary-disabled: { backgroundColor: "{colors.primary}" }   # 40% opacity applied by translator
  button-secondary:        { backgroundColor: "{colors.surface}", textColor: "{colors.primary}", typography: "{typography.headline}", padding: "{spacing.md}", rounded: "{rounded.md}" }
  button-tertiary:         { backgroundColor: "{colors.surface}", textColor: "{colors.primary}", typography: "{typography.headline}", padding: "{spacing.sm}" }
  # iOS 26+ only
  button-tinted:           { backgroundColor: "{colors.primary}", textColor: "{colors.primary}" }

  # Inputs
  input-text:              { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", typography: "{typography.body}", padding: "{spacing.md}", rounded: "{rounded.md}" }
  input-search:            { backgroundColor: "{colors.surface}", typography: "{typography.body}", padding: "{spacing.sm}" }
  input-stepper:           { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", typography: "{typography.body}" }
  input-toggle:            { backgroundColor: "{colors.primary}" }   # tint color when on

  # Containers
  sheet-modal:             { backgroundColor: "{colors.surface}", rounded: "{rounded.lg}" }
  sheet-presented:         { backgroundColor: "{colors.surface}" }
  popover:                 { backgroundColor: "{colors.surface}", rounded: "{rounded.md}", padding: "{spacing.md}" }
```

The same `<base>-<state>` variant convention applies. State suffixes for iOS: `-pressed` (corresponds to SwiftUI `pressed` state via `.buttonStyle`), `-disabled`, `-selected`, `-focused`. Hover does NOT exist on touch — do not author `-hover` variants for iOS.

### 9.4 SwiftUI translator (Phase 4 reference)

Phase 4's iOS scaffold step (`Step 4.0.b`) reads `DESIGN.md` and emits a Swift file that exposes the tokens as Swift extensions. The translator is part of the implementer's prompt — it is NOT a separate generated artifact, and it is NOT vendored. Implementers reference this template:

```swift
// DesignTokens.swift — generated from DESIGN.md at <commit-sha>. Do not edit by hand.
// Re-run the iOS design tokens setup task to regenerate after DESIGN.md changes.

import SwiftUI

extension Color {
    // Asset Catalog colors with light + dark appearances per DESIGN.md `colors:` block.
    // Each token requires a paired `-dark` entry in DESIGN.md to populate the dark appearance.
    static let primary       = Color("primary")
    static let surface       = Color("surface")
    static let onSurface     = Color("on-surface")
    static let neutral       = Color("neutral")
    static let error         = Color("error")
    // ... one per `colors:` token
}

extension Font {
    // Dynamic Type roles map to SwiftUI Font.TextStyle.
    // Tokens whose name matches a TextStyle scale with the user's text-size setting.
    static let largeTitle  = Font.system(.largeTitle,  design: .default).weight(.bold)
    static let title       = Font.system(.title,       design: .default).weight(.bold)
    static let title2      = Font.system(.title2,      design: .default).weight(.semibold)
    static let title3      = Font.system(.title3,      design: .default).weight(.semibold)
    static let headline    = Font.system(.headline,    design: .default).weight(.semibold)
    static let body        = Font.system(.body,        design: .default)
    static let callout     = Font.system(.callout,     design: .default)
    static let subheadline = Font.system(.subheadline, design: .default)
    static let footnote    = Font.system(.footnote,    design: .default)
    static let caption     = Font.system(.caption,     design: .default)
    static let caption2    = Font.system(.caption2,    design: .default)
    // Custom font tokens (those not matching a TextStyle role) emit fixed-size Fonts.
    // These do NOT scale with Dynamic Type — Step 3.7 will flag accessibility risk.
}

enum Spacing {
    // Spacing scale per DESIGN.md `spacing:` block. CGFloat constants.
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 16
    static let lg: CGFloat = 20
    static let xl: CGFloat = 24
    static let xxl: CGFloat = 32
    static let gutter: CGFloat = 16
    static let margin: CGFloat = 20
}

enum Radius {
    // Use with RoundedRectangle(cornerRadius: Radius.md, style: .continuous).
    static let sm: CGFloat = 4
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let full: CGFloat = 9999
}
```

The implementer also creates `Resources/Assets.xcassets` color set entries — one per `colors:` token, with the `-dark` variant populating the Dark appearance slot. Component tokens (`button-primary`, `card-elevated`, etc.) are NOT translated to Swift directly; they are applied via SwiftUI view modifiers (`.background(Color.primary)`, `.font(.headline)`, `.cornerRadius(Radius.md)`) inside per-screen views. The token YAML is the contract; the translator output is the toolkit; the views compose them.

### 9.5 iOS lint behavior

The vendored linter runs unchanged on iOS DESIGN.md. Three iOS-specific behaviors layer on top:

1. **Dark-pair rule** (warn, advisory) — the orchestrator post-processes lint results and warns when a `colors:` token lacks a `-dark` pair. Not in the vendored linter; logged to `build-log.md` Step 3.8 alongside the lint output.
2. **Dynamic Type role check** (warn, advisory) — same post-process step warns when a `typography:` token name does not match a known `Font.TextStyle` role. Custom names are allowed but accessibility-flagged.
3. **iOS 26 gating** (info) — when the DNA Material axis is `Glassy` AND the build's `ios_features` include iOS 26 targets, the orchestrator confirms `card-glass` and `button-tinted` variants exist. When DNA Material is anything else, those variants must be absent.

These post-process checks live in `hooks/design-md-lint.ts` (web codepath unaffected; iOS codepath gated on `project_type=ios` in `.build-state.json`).

## 10. Readers (downstream pipeline)

Every Phase 3+ agent that needs visual context reads `DESIGN.md` (the relevant subset, not the whole file):

| Phase / Step | Agent | Reads |
|---|---|---|
| 3.1 | visual-research | `## Overview` (incl. `### Brand DNA`) — to frame reference queries around the chosen axes |
| 3.2 | design-ui-designer (Component Manifest) | `## Overview` + reference paths from `### References` — picks library variants matching DNA |
| 3.2b | design-ux-researcher (DNA Persona Check) | `## Overview` (full) — validates DNA against persona/JTBD |
| 3.3 | design-ux-architect | `## Overview` (Density axis drives spatial decisions; Character/Motion shape interaction patterns) |
| 3.3b | design-ux-researcher (UX Flow Validation) | `## Overview` (full) |
| 3.4 | design-ui-designer | Reads its own Pass 1 output; writes Pass 2 |
| 3.5 | design-inclusive-visuals-specialist | `## Overview` + `## Colors` + `## Typography` (a11y risk surfaces) |
| 3.6 | engineering-frontend-developer (generator) | YAML front matter + every section (compositional source) |
| 3.6 | design-critic | `## Overview` (DNA scoring) + YAML tokens + `## Components` (compositional check) + `## Do's and Don'ts` (anti-slop scoring) |
| 3.7 | a11y-architect | `## Colors` + `## Typography` + YAML `components:` (focus state, contrast) |
| 4 | every implementer | YAML front matter via `refs.json` primary anchor — NOT the full file. Implementers Read individual sections on demand |
| 5 | testing-performance-benchmarker | `## Overview` (Scope axis → bundle budget) |
| 5 | design-brand-guardian (drift check) | `## Overview` (DNA values) + Playwright screenshots — scores drift against locked DNA |
| 5 | design-ux-researcher (audit) | `## Overview` + YAML `components:` — visual consistency check |
| 6 | LRR Brand Guardian chapter | `## Overview` + YAML tokens + Playwright evidence — final verdict pass |

**CONTEXT header injection (Phase 3+):** the orchestrator extracts the 7 axis values from `### Brand DNA` (NOT the full file) and inlines them into the dispatch CONTEXT header. ~100 tokens, not ~5K. See `protocols/web-phase-branches.md` CONTEXT header section.

## 11. Schema-contract enforcement order

When `DESIGN.md` is read by any agent and any of these is true, the agent halts and emits a finding instead of producing output:

1. The file does not exist at repo root.
2. `## Overview > ### Brand DNA` block is missing or has fewer than 7 axis bullets.
3. The 7-axis combination matches a row in §3 incompatibility matrix.
4. The file fails the broken-ref linter rule.

Findings 2-4 route back to Step 3.0 (axis-related) or Step 3.4 (token-related) per the decision_row.author convention.
