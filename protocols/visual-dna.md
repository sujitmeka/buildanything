# Visual DNA Protocol

Phase 3.0 Brand Guardian locks a 7-axis Visual DNA card that becomes the single source of truth for every downstream Phase 3 design step and every Phase 4 implementer that touches visual output. Visual Research (3.1), Visual Designer (3.2, 3.4), UX Architect (3.3), Inclusive Visuals Specialist (3.5), Frontend Developer generator (3.6), Design Critic (3.6), Accessibility Auditor (3.7), and every Phase 4 implementer via `refs.json` read this card before producing any visual artifact. It is the most load-bearing artifact in the visual pipeline — if the DNA drifts, every downstream surface drifts with it. This protocol exists to make the schema, ownership, and legal-combination rules explicit.

## 1. The 7 axes

Each axis has a closed value set. Brand Guardian picks one value per axis at Phase 3.0 and never revises it mid-build (a DNA revision is a new build session).

### Scope

**Values:** Marketing / Product / Dashboard / Internal Tool

Scope is the **gating axis**. It decides which libraries get vendored into the Phase 4 scaffold and sets the per-page bundle budget enforced by the Phase 6 SRE chapter. Three.js/WebGL libraries install only for Marketing or Product-with-Expressive-motion; dashboards and internal tools never ship them. Perf budgets: Marketing 500KB, Product 300KB, Dashboard 400KB, Internal Tool 200KB (gzipped, excluding images). Exceeding budget by >25% auto-blocks the LRR SRE chapter.

### Density

**Values:** Airy / Balanced / Dense

Density controls the spacing scale, type size ramp, whitespace rhythm, and information-per-viewport target. Airy is marketing-friendly breathing room; Dense is power-user tool territory (Linear, Superhuman, Datadog consoles). The Visual Designer at 3.4 maps this to concrete Tailwind spacing tokens and line-height ramps.

### Character

**Values:** Minimal / Editorial / Maximalist / Brutalist / Playful

Character is the overall visual personality. It drives typographic choice, color saturation, decoration rules, and the general "what kind of product is this" read within 200ms of page load. Minimal is Stripe-adjacent. Editorial is magazine-like with strong type hierarchy. Maximalist is decoration-heavy (aceternity/ui territory). Brutalist is raw and aggressive. Playful is rounded, animated, approachable.

### Material

**Values:** Flat / Glassy / Physical / Neumorphic

Material is the surface treatment across every card, modal, button, and panel. It determines blur radii, border styles, elevation system, and shadow character. Flat is modern shadcn default. Glassy is backdrop-filter blur + subtle borders (Apple / Vercel aesthetic). Physical is realistic drop shadows and depth. Neumorphic is soft inset/outset shadows (fragile — breaks contrast easily).

### Motion

**Values:** Still / Subtle / Expressive / Cinematic

Motion drives easing curves, animation durations, scroll choreography, hover feedback, and page transitions. Still is no motion. Subtle is shadcn-default hover transitions (150-200ms ease-out). Expressive is framer-motion choreography with spring physics. Cinematic is GSAP + ScrollTrigger with 500-800ms eases — the Neuform / aura.build kind of motion that requires heavy libraries and is bundle-expensive.

### Type

**Values:** Neutral Sans / Humanist Sans / Serif-forward / Display-forward / Mono-accented

Type is the font-pairing strategy. It controls primary/secondary font choice, tracking rules, and optical sizing decisions. Neutral Sans is Inter / Geist (safe default). Humanist Sans is Söhne / Söhne Breit (warmer). Serif-forward is Tiempos / GT Super (editorial feel). Display-forward is a bold display face paired with a neutral body. Mono-accented uses JetBrains Mono / IBM Plex Mono for labels and callouts inside an otherwise-sans design. Specific font pairings live in `docs/library-refs/component-library-catalog.md`, not here.

### Copy

**Values:** Functional / Narrative / Punchy / Technical

Copy is the language register across headlines, CTAs, labels, and microcopy. It controls vocabulary density, sentence rhythm, and the emotional distance between product and user. Functional is labels-only, no sales language — content-first (Notion, Linear dashboard). Narrative uses scene-setting and emotional pull — headlines paint a moment (Stripe, Loom). Punchy enforces 3-5 word headlines, one idea per sentence, newspaper economy — cut half, then cut again (Arc, Raycast). Technical uses precise terminology, spec-like voice, avoids marketing softeners — values exactness over warmth (Vercel, Railway).

## 2. Incompatibility matrix

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

Anything not on this list is legal. When two legal combinations both fit the user's references, Brand Guardian reads `quality-targets.json` and the architecture stack to resolve ties (e.g., if the stack is Next.js + shadcn default and quality-targets say "fast MVP," prefer Flat over Glassy).

## 3. Schema

The DNA card lives at `docs/plans/visual-dna.md` — one file per build, locked at Phase 3.0. Shape:

```markdown
---
locked_at: 2026-04-14T01:23:45Z
locked_by: Brand Guardian
build_session: <session_id>
---

# Visual DNA

## Axes

- Scope: Marketing
- Density: Airy
- Character: Editorial
- Material: Glassy
- Motion: Expressive
- Type: Display-forward
- Copy: Punchy

## Rationale

<why these axes, with explicit references to design-doc.md sections and findings-digest signals
that pushed each axis to the chosen value; 4-8 sentences total, no padding>

## References that exemplify this DNA

- <url or path> — exemplifies Character + Motion
- <url or path> — exemplifies Material + Type
- <url or path> — exemplifies Scope + Density
```

<HARD-GATE>
SCHEMA CONTRACT:

- All seven axis fields MUST be present and MUST be one of the allowed values from Section 1.
- The combination across all six axes MUST NOT appear in the Section 2 incompatibility matrix.
- `locked_at` is set exactly once, at Phase 3.0 Brand Guardian completion, and is never rewritten.
- `References that exemplify this DNA` MUST contain at least two entries, each tied to specific axis pairs. "Looks good" without axis attribution is not permitted.
- Only `docs/plans/visual-dna.md` is the canonical location. No other path is read.
</HARD-GATE>

## 4. Ownership

**Writer:** Brand Guardian at Phase 3.0, exactly once per build. No other agent writes `visual-dna.md`. If the user requests a DNA revision mid-build, that is a new Phase 3.0 invocation, not an edit.

**Readers:**

| Phase / Step | Agent | Why it reads DNA |
|---|---|---|
| 3.1 | Visual Research | Frames reference-site lookup queries around the locked axes instead of casting wide. |
| 3.2 | Visual Designer (Component Library Mapping) | Picks component variants from `component-library-catalog.md` matching the DNA axis combination. |
| 3.3 | UX Architect | Information architecture and flow choices respect Density and Character. |
| 3.4 | Visual Designer (Visual Design Spec) | Material system, motion system, and typographic tuning all derive from Material/Motion/Type axes. |
| 3.5 | Inclusive Visuals Specialist | Checks DNA for a11y risks (Neumorphic contrast, Dense density tap targets, Cinematic motion reduced-motion fallback). |
| 3.6 | Frontend Developer generator | Every generated surface honors DNA; deviations flagged by Design Critic. |
| 3.6 | Design Critic | Scores rendered output against DNA on all seven axes + craft dimensions in the metric loop. |
| 3.7 | Accessibility Auditor | Re-verifies DNA-level a11y claims from 3.5 against real rendered output. |
| 4 | Phase 4 implementers | Read via `refs.json` primary anchor; every component they write must match DNA or compose from the DNA-matching library variants. |
| 5 | Drift check | Verifies visual output still reads as the locked DNA. |
| 6 | Brand Guardian chapter | Final verdict pass against DNA as ground truth. |

## 5. Legal-combo examples

**Premium marketing landing page — Stripe / Linear / Neuform aesthetic:**

- Scope: Marketing
- Density: Airy
- Character: Editorial
- Material: Glassy
- Motion: Expressive
- Type: Display-forward
- Copy: Punchy

Airy density + Editorial character gives the breathing room and strong type hierarchy. Glassy material + Display-forward type hits the premium feel. Expressive motion is the bundle budget ceiling Marketing scope can afford without tipping into Cinematic territory. Punchy copy matches the premium marketing register — short, declarative headlines that let the type and motion carry the emotional weight. All seven axes reinforce the same read.

**Internal analytics dashboard — Datadog / Grafana aesthetic:**

- Scope: Dashboard
- Density: Balanced
- Character: Minimal
- Material: Flat
- Motion: Subtle
- Type: Humanist Sans
- Copy: Functional

Minimal character + Flat material + Humanist Sans is the "tool chrome that disappears" combination. Subtle motion keeps interactions snappy without distracting from the data. Balanced density fits dashboard chart density without triggering the Glassy + Dense incompatibility. Functional copy keeps labels terse and data-first — no marketing softeners competing with the charts for attention. Ships well under the 400KB Dashboard budget.

**Consumer productivity app — Notion / Superhuman aesthetic:**

- Scope: Product
- Density: Balanced
- Character: Minimal
- Material: Physical
- Motion: Expressive
- Type: Neutral Sans
- Copy: Functional

Minimal + Neutral Sans is the "content is the hero" base. Physical material adds just enough depth to make interactive surfaces feel tactile. Expressive motion is where Superhuman-style transitions live. Functional copy keeps the interface out of the way of the user's content — the app labels actions, it doesn't narrate them. Product scope allows the motion library cost, since it's inside the 300KB budget when managed carefully.

## 6. Illegal-combo example

**Dashboard + Maximalist + Cinematic — rejected.**

Three conflicts at once. Dashboards need parse-speed, which Maximalist actively fights by burying data under decoration. Cinematic motion (650ms+ eases) is too slow for the interaction rhythm dashboards require — a user filtering a table cannot wait 800ms for every state change. And the combined library cost of aceternity-heavy maximalist surfaces + GSAP cinematic motion blows the 400KB Dashboard budget on its own before any app code is added.

When the user's references push toward this combination (e.g., "I want it to feel like [Neuform marketing page] but it's actually a dashboard"), Brand Guardian rejects the combination, writes a decision-log row naming the incompatibility, and asks the user to pick a direction: keep the scope and drop the Maximalist/Cinematic, or change the product scope to Marketing (which will change the whole app's shape, not just its look). There is no middle ground — the axes are load-bearing, not decorative.
