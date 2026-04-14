# Component Library Catalog

Static reference mapping 6-axis Visual DNA combinations to specific vendored library component variants. Phase 3.2 (Component Library Mapping) reads this to author `component-manifest.md`; Phase 4 implementers are forbidden from hand-writing any component the manifest names.

**Maintenance:** human-curated, not agent-generated. Grow over time based on build outcomes — add a row when a new library ships or a new DNA combination becomes common. Treat like a living spec.

---

## 1. Vendored library set

All MIT-licensed. Installed into the Phase 4 scaffold as actual dependencies, partitioned by Scope + Motion + product-type gates. The Phase 4 scaffolder reads `visual-dna.md` and only installs what the DNA needs — never ship Three.js for an internal admin panel.

### Always install (all scopes)

| Library | Role | Why we vendor it |
|---|---|---|
| `tailwindcss` | Styling primitive | Every downstream library assumes Tailwind classes |
| `shadcn/ui` | Baseline component set | Industry-standard accessible primitives; copy-in model gives us full code control |
| `lucide-react` | Icon set | Huge, consistent, tree-shakeable; works for every character/material choice |
| `framer-motion` | Motion primitives | Needed even for Subtle motion; choreography engine for Phase 3.6 |

### Install if Scope ≠ Internal Tool

| Library | Role | Why we vendor it |
|---|---|---|
| `magicui` | Decorative components | Marquees, tickers, number counters, iphone mockups, animated beams |
| `aceternity/ui` | Premium layouts | Bento grids, animated cards, gradient borders, glass variants, hero compositions |
| `@tabler/icons-react` | Extended icon set | Supplements lucide for more decorative options when Character = Editorial/Maximalist |

### Install if Scope = Marketing OR (Product AND Motion ≥ Expressive)

| Library | Role | Why we vendor it |
|---|---|---|
| `@react-three/fiber` + `@react-three/drei` | Declarative Three.js | 3D scenes without writing WebGL |
| `cobe` | Animated globe | Single-component hero element, used in hundreds of marketing sites |
| `GSAP` + `GSAP ScrollTrigger` | Scroll choreography | Used by Neuform and most premium marketing sites; heavier than framer-motion but necessary for Cinematic motion |

### Install if product has data surfaces

| Library | Role | Why we vendor it |
|---|---|---|
| `tremor` | Dashboard components | Best-in-class for Product/Dashboard scope with charts |
| `recharts` | Chart primitives | Simpler than tremor when the need is smaller |
| `@tanstack/react-table` | Data tables | Sortable/filterable tables without reinventing them |

### Install if product involves text/form-heavy interfaces

| Library | Role | Why we vendor it |
|---|---|---|
| `@tiptap/react` | Rich text editor | Wildly better than rolling a contenteditable div |
| `react-hook-form` + `zod` | Form machinery | Validation + typing; assumed by shadcn form components |

### Stock asset libraries (always available, never auto-installed — agents reference URLs)

| Resource | Role | Note |
|---|---|---|
| Heroicons, Phosphor, Tabler | Icon supplements | CDN-loaded when needed |
| Unsplash, Pexels | Stock imagery | Used sparingly — DNA check first for fit |
| Google Fonts | Typography | Every Type axis maps to specific Google Fonts pairings |

---

## 2. 6-axis Visual DNA reference

Brand Guardian at Step 3.0 locks these six axes. Every downstream Phase 3 step reads `visual-dna.md`. Phase 4 implementers read it via `refs.json`. Not every combination is legal — Dashboard + Cinematic motion is contradictory. The Brand Guardian system prompt contains the full incompatibility matrix.

| Axis | Values | What it controls |
|---|---|---|
| **Scope** | Marketing / Product / Dashboard / Internal Tool | Gates library installation (Three.js/WebGL only for Marketing or Expressive Product) |
| **Density** | Airy / Balanced / Dense | Spacing scale, type size, whitespace rhythm, information density per viewport |
| **Character** | Minimal / Editorial / Maximalist / Brutalist / Playful | Overall visual personality — drives typographic choice, color saturation, decoration rules |
| **Material** | Flat / Glassy / Physical / Neumorphic | Surface treatment — blur radii, border styles, elevation system, shadow character |
| **Motion** | Still / Subtle / Expressive / Cinematic | Easings, durations, scroll choreography, hover feedback, page transitions |
| **Type** | Neutral Sans / Humanist Sans / Serif-forward / Display-forward / Mono-accented | Font pairing strategy, tracking rules, optical sizing decisions |

---

## 3. DNA → component variant catalog

Each entry lists slot-to-component mappings for a DNA combination. Slot vocabulary: `hero`, `cards`, `cta`, `nav`, `marquee`, `chart`, `3D`, `typography`, `motion prefs`. `(none)` means the slot is not applicable for that DNA.

### 3.1 Marketing

#### Scope=Marketing + Character=Editorial + Material=Glassy + Motion=Expressive

- hero: aceternity/ui hero-parallax
- cards: aceternity/ui card-hover-effect
- cta: aceternity/ui moving-border
- nav: shadcn navbar + framer-motion scroll reveal
- marquee: magicui marquee
- chart: (none — marketing)
- 3D: @react-three/drei Sphere
- typography: serif-forward (Tiempos Headline + Inter)
- motion prefs: ease-out-cubic, 450ms-650ms, scroll-triggered reveals

#### Scope=Marketing + Character=Maximalist + Material=Physical + Motion=Cinematic

- hero: aceternity/ui background-beams + GSAP pinned intro
- cards: aceternity/ui bento-grid
- cta: aceternity/ui shimmer-button
- nav: shadcn navbar + GSAP ScrollTrigger sticky transform
- marquee: magicui animated-beam
- chart: (none — marketing)
- 3D: @react-three/drei shader material + cobe globe
- typography: display-forward (Fraunces + Inter)
- motion prefs: power3.inOut, 700ms-1100ms, pinned sections, orchestrated sequences

#### Scope=Marketing + Character=Minimal + Material=Flat + Motion=Subtle

- hero: shadcn hero section + framer-motion fade-in
- cards: shadcn card
- cta: shadcn button (primary large)
- nav: shadcn navbar
- marquee: (none)
- chart: (none — marketing)
- 3D: (none)
- typography: neutral sans (Inter + Inter)
- motion prefs: ease-out, 200ms-350ms, opacity-only fade-in on mount

#### Scope=Marketing + Character=Playful + Material=Neumorphic + Motion=Expressive

- hero: aceternity/ui wavy-background
- cards: aceternity/ui 3d-card
- cta: aceternity/ui shimmer-button
- nav: shadcn navbar + framer-motion bounce
- marquee: magicui marquee (looping logos)
- chart: (none — marketing)
- 3D: @react-three/drei Torus + MeshWobbleMaterial
- typography: humanist sans (DM Sans + DM Sans)
- motion prefs: back-out, 400ms-600ms, spring(stiffness=300, damping=20)

#### Scope=Marketing + Character=Brutalist + Material=Flat + Motion=Subtle

- hero: custom (manifest gap — log decision row; use Tailwind grid + magicui animated-grid-pattern as fallback)
- cards: shadcn card with hard borders (border-4 border-black, no rounding)
- cta: shadcn button with offset shadow variant
- nav: shadcn navbar with mono tracking
- marquee: magicui marquee (text-only, no images)
- chart: (none — marketing)
- 3D: (none)
- typography: mono-accented (Space Grotesk + JetBrains Mono)
- motion prefs: linear, 150ms-250ms, instant snap transitions

#### Scope=Marketing + Character=Editorial + Material=Physical + Motion=Subtle

- hero: aceternity/ui spotlight
- cards: aceternity/ui card-hover-effect
- cta: shadcn button (large, serif label)
- nav: shadcn navbar with serif logotype
- marquee: (none — editorial restraint)
- chart: (none — marketing)
- 3D: (none)
- typography: serif-forward (Newsreader + Inter)
- motion prefs: ease-in-out, 300ms-500ms, reveal-on-scroll

#### Scope=Marketing + Character=Minimal + Material=Glassy + Motion=Expressive

- hero: aceternity/ui background-gradient-animation
- cards: aceternity/ui evervault-card
- cta: aceternity/ui moving-border
- nav: shadcn navbar + framer-motion blur-on-scroll
- marquee: magicui orbiting-circles
- chart: (none — marketing)
- 3D: @react-three/drei Icosahedron + MeshDistortMaterial
- typography: neutral sans (Geist + Geist Mono)
- motion prefs: ease-out-expo, 500ms-750ms, scroll-linked blur

### 3.2 Product

#### Scope=Product + Character=Minimal + Material=Flat + Motion=Subtle

- hero: shadcn app shell header
- cards: shadcn card
- cta: shadcn button
- nav: shadcn sidebar + breadcrumb
- marquee: (none)
- chart: recharts LineChart (simple)
- 3D: (none)
- typography: neutral sans (Inter + Inter)
- motion prefs: ease-out, 150ms-250ms, hover-only feedback

#### Scope=Product + Character=Humanist + Material=Glassy + Motion=Expressive

- hero: aceternity/ui background-gradient + shadcn header overlay
- cards: aceternity/ui glare-card
- cta: aceternity/ui moving-border
- nav: shadcn sidebar + framer-motion slide-in
- marquee: (none)
- chart: tremor AreaChart
- 3D: @react-three/drei Sphere (subtle hero accent)
- typography: humanist sans (DM Sans + Inter)
- motion prefs: ease-out-cubic, 300ms-500ms, layout-transition enabled

#### Scope=Product + Character=Editorial + Material=Physical + Motion=Subtle

- hero: shadcn header with editorial headline
- cards: shadcn card with elevated shadow (shadow-xl, rounded-lg)
- cta: shadcn button
- nav: shadcn sidebar with serif section labels
- marquee: (none)
- chart: tremor BarChart
- 3D: (none)
- typography: serif-forward (Source Serif 4 + Inter)
- motion prefs: ease-in-out, 250ms-400ms, entrance fades only

#### Scope=Product + Character=Minimal + Material=Glassy + Motion=Subtle

- hero: shadcn header with backdrop-blur
- cards: shadcn card + backdrop-blur-md
- cta: shadcn button
- nav: shadcn sidebar with glass panel background
- marquee: (none)
- chart: recharts AreaChart
- 3D: (none)
- typography: neutral sans (Geist + Geist Mono)
- motion prefs: ease-out, 200ms-350ms, opacity fades

#### Scope=Product + Character=Playful + Material=Flat + Motion=Expressive

- hero: aceternity/ui wavy-background
- cards: shadcn card with rounded-2xl and pastel tints
- cta: aceternity/ui shimmer-button
- nav: shadcn sidebar with icon-forward labels
- marquee: (none)
- chart: recharts LineChart with high-saturation strokes
- 3D: (none)
- typography: humanist sans (DM Sans + DM Sans)
- motion prefs: back-out, 350ms-500ms, spring hover lifts

#### Scope=Product + Character=Maximalist + Material=Glassy + Motion=Expressive

- hero: aceternity/ui background-beams + shadcn header
- cards: aceternity/ui bento-grid
- cta: aceternity/ui moving-border
- nav: shadcn sidebar + framer-motion staggered reveal
- marquee: magicui animated-beam (feature connections)
- chart: tremor DonutChart
- 3D: (none)
- typography: display-forward (Fraunces + Inter)
- motion prefs: ease-out-expo, 400ms-600ms, layered reveals

### 3.3 Dashboard

#### Scope=Dashboard + Character=Minimal + Material=Flat + Motion=Still

- hero: (none — dashboard)
- cards: shadcn card
- cta: shadcn button
- nav: shadcn sidebar + shadcn breadcrumb
- marquee: (none)
- chart: tremor AreaChart + tremor BarChart
- 3D: (none)
- typography: neutral sans (Inter + JetBrains Mono for numerics)
- motion prefs: linear, 0ms-150ms, no entrance animation, hover-only

#### Scope=Dashboard + Character=Humanist + Material=Flat + Motion=Subtle

- hero: (none — dashboard)
- cards: shadcn card with rounded-xl
- cta: shadcn button
- nav: shadcn sidebar with sectioned labels
- marquee: (none)
- chart: tremor LineChart + tremor Legend
- 3D: (none)
- typography: humanist sans (DM Sans + JetBrains Mono)
- motion prefs: ease-out, 150ms-250ms, number count-up on load

#### Scope=Dashboard + Character=Minimal + Material=Glassy + Motion=Subtle

- hero: (none — dashboard)
- cards: shadcn card + backdrop-blur-sm
- cta: shadcn button
- nav: shadcn sidebar with glass overlay
- marquee: (none)
- chart: tremor AreaChart with gradient fills
- 3D: (none)
- typography: neutral sans (Geist + Geist Mono)
- motion prefs: ease-out, 200ms-300ms, subtle blur on hover

#### Scope=Dashboard + Character=Editorial + Material=Flat + Motion=Still

- hero: (none — dashboard)
- cards: shadcn card with serif headings
- cta: shadcn button
- nav: shadcn sidebar with serif section labels
- marquee: (none)
- chart: recharts ComposedChart
- 3D: (none)
- typography: serif-forward (Source Serif 4 + Inter + JetBrains Mono)
- motion prefs: linear, 0ms, no animation (reporting context)

#### Scope=Dashboard + Character=Maximalist + Material=Physical + Motion=Subtle

- hero: (none — dashboard)
- cards: shadcn card with elevated shadow and gradient borders
- cta: aceternity/ui moving-border
- nav: shadcn sidebar + framer-motion slide
- marquee: (none)
- chart: tremor DonutChart + tremor BarChart + tremor Legend
- 3D: (none)
- typography: display-forward (Fraunces + Inter + JetBrains Mono)
- motion prefs: ease-out-cubic, 250ms-400ms, card hover lift

### 3.4 Internal Tool

#### Scope=Internal Tool + Character=Minimal + Material=Flat + Motion=Still

- hero: (none — internal tool)
- cards: shadcn card
- cta: shadcn button
- nav: shadcn sidebar + shadcn breadcrumb
- marquee: (none)
- chart: recharts LineChart (minimal, optional)
- 3D: (none)
- typography: neutral sans (Inter + JetBrains Mono)
- motion prefs: linear, 0ms-100ms, no entrance animation, focus rings only

#### Scope=Internal Tool + Character=Minimal + Material=Flat + Motion=Subtle

- hero: (none — internal tool)
- cards: shadcn card
- cta: shadcn button
- nav: shadcn sidebar
- marquee: (none)
- chart: recharts BarChart (on demand)
- 3D: (none)
- typography: neutral sans (Inter + Inter)
- motion prefs: ease-out, 150ms-200ms, hover color changes only

#### Scope=Internal Tool + Character=Humanist + Material=Flat + Motion=Still

- hero: (none — internal tool)
- cards: shadcn card with rounded-lg
- cta: shadcn button
- nav: shadcn sidebar with icon-forward labels
- marquee: (none)
- chart: recharts LineChart
- 3D: (none)
- typography: humanist sans (DM Sans + JetBrains Mono)
- motion prefs: linear, 0ms, no animation

#### Scope=Internal Tool + Character=Brutalist + Material=Flat + Motion=Still

- hero: (none — internal tool)
- cards: shadcn card with hard borders (border-2, no rounding)
- cta: shadcn button with monospace label
- nav: shadcn sidebar with mono tracking
- marquee: (none)
- chart: recharts BarChart (mono stroke)
- 3D: (none)
- typography: mono-accented (JetBrains Mono + JetBrains Mono)
- motion prefs: linear, 0ms, no animation (form-over-feel)

---

## 4. Phase 4 HARD-GATE

Once the component library is vendored and `component-manifest.md` is written, Phase 4 implementers are forbidden from writing a component that the manifest names. Concrete rule in the dispatch prompt:

> If your task requires a button, card, hero, chart, modal, form field, marquee, bento grid, or 3D element, you MUST import the variant specified in `component-manifest.md`. Writing a custom component when the manifest names one is a HARD-GATE violation. The Senior Dev cleanup agent will flag and revert custom-written components that have a manifest entry.

**Escape hatch:** if the manifest doesn't cover a component a task genuinely needs (e.g. a domain-specific widget), the implementer writes it AND emits a `decisions.jsonl` row flagging "manifest gap." Post-build, the catalog is updated to cover that component for future builds. Missing coverage becomes a learning, not silent drift back to from-scratch.

---

## 5. Scope bundle budgets

Libraries like `@react-three/drei`, `GSAP`, and `aceternity/ui` are heavy. A Cinematic+Glassy+Marketing page can easily ship at 2-4MB of JavaScript — a perf disaster for anything that isn't a dedicated landing page. Phase 6 (Audit) Performance Benchmarker enforces per-Scope budgets:

| Scope | Bundle budget (gzipped, excluding images) | Largest Contentful Paint |
|---|---|---|
| Marketing | 500KB | ≤ 2.5s |
| Product | 300KB | ≤ 1.8s |
| Dashboard | 400KB | ≤ 2.0s |
| Internal Tool | 200KB | ≤ 1.5s |

Exceeding the budget by >25% auto-blocks the Phase 6 LRR SRE chapter. Budget violations route back to Phase 3.2 (component mapping — swap a heavy variant for a lighter one) or Phase 4 (code-splitting, lazy-loading, dynamic imports).

---

## 6. Maintenance notes

- **When to add a row:** a new library ships and belongs in the vendored set, OR a new DNA combination becomes common across builds, OR a build surfaces a manifest gap that the catalog should cover going forward.
- **When to revise a row:** a library deprecates a component, a variant gets replaced by a better one, or build outcomes show the current mapping underperforms.
- **Who edits:** humans only. The catalog is not agent-generated. Agents read it; they don't write it.
- **Versioning:** treat like a living spec. No formal version numbers — the commit history is the changelog. When a row is replaced, note the reason in the commit message.
- **Growing the catalog:** start with the ~20-25 combinations above and grow based on build outcomes. Prefer expanding coverage of common scopes (Marketing, Product) over exhaustively enumerating edge cases.
- **Manifest gap logging:** every `decisions.jsonl` row flagged "manifest gap" is a candidate catalog addition. Review gap logs periodically and upstream the recurring ones into new rows here.
