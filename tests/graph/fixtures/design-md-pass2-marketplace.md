---
version: alpha
name: Stockyard
description: A no-frills industrial parts marketplace for buyers who know what they need and sellers who ship from spec sheets.
colors:
  primary: "#0F172A"
  accent: "#FB923C"
  surface: "#FAFAF9"
  surface-alt: "#F5F2EC"
  text: "#1F2937"
  muted: "#94A3B8"
  error: "#DC2626"
  border-hairline: "#1A1A1A"
typography:
  headline-display:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
  headline-md:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.3
  body-md:
    fontFamily: Inter Tight
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: Inter Tight
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Inter Tight
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1
    letterSpacing: 0.08em
  caption:
    fontFamily: Inter Tight
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.3
rounded:
  none: 0px
  sm: 0px
  md: 0px
  lg: 0px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  gutter: 8px
  margin: 16px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.text}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-mono}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.surface-alt}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  card-outline:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "{spacing.md}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.none}"
    padding: "{spacing.sm} {spacing.md}"
  data-table-row:
    variant: "tanstack-table.DataTable.compact"
    height: "32px"
    border: "1px solid {colors.border-hairline}"
---

# Stockyard

## Overview

Stockyard is a peer-to-peer marketplace for industrial parts — bearings, fasteners, hydraulic fittings, raw stock. The target user is a procurement manager at a 50-person foundry or a sole-proprietor machine shop owner who already knows the McMaster part number and wants to find it cheaper, faster, or in surplus. Every pixel exists to surface part data and move a transaction forward. There is no lifestyle photography, no testimonial carousel, no "Why Stockyard?" section.

The visual language borrows from 1970s industrial parts catalogs: dense tables, hairline rules on cream stock, monospaced part numbers. The brand signal is the mono typeface — when a user sees JetBrains Mono on a price or SKU, they know they're in Stockyard. Color is almost absent: black ink on warm cream, a single saturated vermilion for destructive actions and low-stock warnings, and nothing else.

Density is non-negotiable. Procurement users compare 40+ SKUs per page. A catalog card taller than 32px or a gutter wider than 8px is a bug. The interface should feel like a spreadsheet that learned just enough manners to onboard a new hire — but not one pixel more.

### Brand DNA

- **Scope:** Product
  Stockyard is a transactional marketplace, not a marketing site — every screen exists to move a part from listing to escrow to ship.
- **Density:** Dense
  Procurement users compare 40+ SKUs at a glance; whitespace beyond 8px gutters wastes their scroll budget.
- **Character:** Brutalist
  Raw black-on-cream, hairline rules, no decoration. Reference: industrial parts catalogs from the 1970s — McMaster-Carr lineage.
- **Material:** Flat
  Zero shadows, zero gradients. Hierarchy via weight contrast and 1px borders only.
- **Motion:** Subtle
  150–220ms ease-out for state changes; no scroll choreography. Buyers don't have time for animation.
- **Type:** Mono-accented
  Body in a workhorse humanist sans (e.g. Söhne or Inter Tight as utility — NOT primary headline). Headlines and all SKU/quantity/price data in JetBrains Mono. The mono is the brand voice.
- **Copy:** Punchy
  ≤5 word headlines, ≤3 word CTAs, no marketing softeners. "Buy now" not "Reserve your spot today."

### Locked At

- locked_at: 2026-04-26T14:22:08Z
- locked_by: design-brand-guardian
- build_session: build-session-stockyard-2026-04-26

### References

- McMaster-Carr (https://www.mcmaster.com) — exemplifies Density and Character (industrial-catalog density, zero ornament Brutalism)
- Linear (https://linear.app) — exemplifies Motion and Material (Flat surfaces, ~200ms feedback timing — pacing reference for Density and Motion)
- Are.na (https://www.are.na) — exemplifies Character (raw brutalist composition, hairline rules)

## Colors

The Stockyard palette is rooted in raw industrial neutrals — the Character=Brutalist axis demands black ink on warm cream, with no decorative gradient or hue variation. Every color decision traces back to the parts-catalog ancestry: ink, paper, and one warning color.

Primary `#0F172A` is near-black, functioning as the dominant ink for headlines, SKU labels, and all JetBrains Mono text. The Brutalist character axis dictates that Type=Mono-accented headlines render at full ink density against the cream surface. The primary token is set near-black at #000 in spirit, though we settle on #0F172A for proper warm-cream contrast — the slight blue undertone prevents the harshness of pure black on warm stock while maintaining a 15.2:1 contrast ratio against `surface`.

Accent `#FB923C` is the sole chromatic signal in the system. It echoes warehouse signage — high-visibility orange used exclusively for low-stock warnings (`badge-stock` in "Backorder" state), destructive CTAs (cancel order, remove listing), and the active price-alert indicator. Accent never appears on primary navigation, headings, or body text. If a surface is orange, something requires immediate attention. This constraint is non-negotiable per the Brutalist register — decoration-free means color carries semantic weight only.

Surface `#FAFAF9` is the page background — warm white with a barely-perceptible yellow undertone that softens the reading experience across long catalog sessions. Surface-alt `#F5F2EC` is the card fill, providing 1.02:1 tonal separation from the page background. This near-invisible lift is the only "elevation" in the system — Material=Flat forbids shadows, so tonal shift does the work that `box-shadow` would do in a non-Flat system.

Text `#1F2937` is the secondary ink — used for body copy in Inter Tight where full-black primary would over-assert. The 0.5-step reduction from primary keeps body paragraphs subordinate to JetBrains Mono headlines without sacrificing WCAG AA compliance (11.8:1 on surface, 10.4:1 on surface-alt).

Muted `#94A3B8` handles metadata, timestamps, and tertiary labels. At 4.6:1 on surface it passes AA for large text and label-caps (11px uppercase) but intentionally fails for body-md — muted is never used at body size. This is a deliberate constraint: if text is important enough to read at 14px, it gets `text` color, not `muted`.

Error `#DC2626` is reserved for form validation failures and system errors. It is NOT the same as accent — accent is operational urgency (low stock), error is user-input failure (invalid email). The two reds are visually distinct: accent is warm orange, error is cool true-red. They never appear on the same screen region.

Border-hairline `#1A1A1A` is the workhorse of the entire hierarchy system. Material=Flat means no shadow, ever — so the 1px rule at `border-hairline` color does ALL structural separation. Table column dividers, card outlines, section separators, input field borders — every boundary in Stockyard is a 1px solid `#1A1A1A` line. The near-black tone ensures the rule is visible on both `surface` and `surface-alt` backgrounds without competing with primary text.

## Typography

Type=Mono-accented makes JetBrains Mono the brand voice. Every SKU, lot number, quantity, and price renders in JetBrains Mono — the monospace face is not decorative, it is functional. Procurement users scan columns of part numbers; fixed-width characters align vertically without tabular formatting hacks. Body copy in Inter Tight serves a utility role only — it is the humanist sans that carries product descriptions, seller bios, and help text without drawing attention to itself.

The headline ramp uses JetBrains Mono at three sizes: `headline-display` at 32px/600 for page titles (Catalog, Checkout, Payout Dashboard), `headline-lg` at 24px/600 for section headers within a page, and `headline-md` at 18px/500 for card titles and inline section labels. The tight letter-spacing on display (−0.01em) prevents the mono from feeling too wide at large sizes — a common failure mode when monospace faces scale up. Line-height is compressed across the ramp (1.1 → 1.2 → 1.3) because Density=Dense demands compact vertical rhythm; a 1.5 line-height on a 32px headline wastes 16px of vertical space per line.

Body text lives in Inter Tight at two sizes: `body-md` at 14px/400 for product descriptions and form help text, and `body-sm` at 13px/400 for metadata and secondary information. The 1px size difference is subtle but intentional — it creates a reading hierarchy without introducing a third weight. Both use 400 weight; bold body text does not exist in this system. If emphasis is needed, switch to JetBrains Mono `label-mono` — the face change carries more signal than a weight change within the same face.

`label-mono` at 12px/500 is the micro-label for prices, quantities, stock counts, and table cell data. The 0.02em letter-spacing opens the characters just enough for legibility at small sizes without breaking the monospace grid. This is the most-used token in the system — it appears in every catalog-card, every data-table row, every order summary line.

`label-caps` at 11px/600 with 0.08em tracking is the section eyebrow — "FILTERS", "ORDER SUMMARY", "SHIPPING". Inter Tight uppercase at this size reads as structural chrome, not content. The generous tracking (0.08em) prevents the uppercase from feeling cramped, which is critical at 11px where individual letter shapes start to blur.

`caption` at 11px/400 handles timestamps, attribution lines, and legal footnotes. It is the quietest token in the system — Inter Tight at minimum readable size, regular weight, no tracking adjustment. Caption text should be ignorable until the user specifically looks for it.

Font loading strategy: JetBrains Mono is self-hosted (no Google Fonts CDN dependency) with `font-display: swap` and a system monospace fallback (`ui-monospace, SFMono-Regular, Menlo`). Inter Tight loads from the same origin with `font-display: optional` — if it doesn't load in time, the system sans stack (`system-ui, -apple-system, sans-serif`) is visually close enough that the swap is invisible.

## Layout

Density=Dense drives the entire spacing scale. The base grid is 8px — every spacing value is a multiple of 4px (the half-step) or 8px (the full step). Gutter is 8px, NOT 24px — Density=Dense forbids the generous gutters that SaaS dashboards default to. The 8px gutter means catalog cards sit close together, reinforcing the spreadsheet-density that procurement users expect.

Margin is 16px on container edges — the only breathing room in the system. This 16px margin prevents content from touching the browser chrome on mobile and provides a minimal frame on desktop. Section spacing of 24px (`xl`) is the maximum vertical air permitted between major page regions (e.g., between the catalog grid and the filter bar). Anything wider than 24px violates Density=Dense and breaks the catalog scan rhythm that the entire layout is optimized for.

The content grid is a 12-column fluid grid with 8px gutters. On desktop (1024px+), the catalog uses all 12 columns for a 4-across product card grid. On tablet (768px), the grid drops to 2-across. On mobile (375px), cards go full-width single-column. The grid does not use a max-width container — Stockyard fills the viewport edge to edge because Density=Dense means more horizontal space = more columns = more SKUs visible.

Vertical rhythm follows the 4px half-step for micro-spacing (between a label and its value, between table rows) and the 8px full step for component-internal padding. Card padding is 12px (`md`) — tight enough to keep the card compact, loose enough to prevent text from touching the hairline border. Input padding follows the same 8px/12px pattern: vertical 8px, horizontal 12px.

The data-table layout is the most critical surface in the system. Table rows are 32px tall — this is a hard constraint from the component manifest (`data-table` slot specifies `DataTable.compact` at 32px). Column widths are content-driven with minimum widths: SKU column at 120px (accommodates 12-character part numbers in JetBrains Mono), price column at 80px, quantity at 60px. The table scrolls horizontally on narrow viewports rather than wrapping — procurement users expect tabular data to stay tabular.

## Elevation & Depth

Material=Flat is non-negotiable. There is no `box-shadow` token in this system. There is no `drop-shadow` utility. There is no elevation scale. Hierarchy is conveyed entirely through two mechanisms: 1px hairline borders (`border-hairline` at `#1A1A1A`) and tonal contrast between `surface` and `surface-alt`.

Cards use `surface-alt` (`#F5F2EC`) against the `surface` (`#FAFAF9`) page background, giving a 1.02:1 tonal separation. This is barely perceptible — and that is the point. Material=Flat means surfaces do not "float" above each other. They sit on the same plane, differentiated only by a whisper of warmth in the card fill. The card's 1px `border-hairline` outline does the real boundary work.

Modals and drawers use the same flat treatment. A modal is a `surface` rectangle with a `border-hairline` outline, centered on a semi-transparent scrim (`rgba(15, 23, 42, 0.4)` — primary at 40% opacity). The scrim provides the only depth cue: content behind the modal dims, but the modal itself does not cast a shadow. Drawer panels slide in from the edge with a 1px border on the leading edge — no shadow trail.

Focus states use a 2px `border-hairline` ring (doubling the standard 1px) rather than a glow or outline-offset. This keeps focus indication within the Material=Flat vocabulary — thicker border, not a new visual layer. The 2px ring is visible on both `surface` and `surface-alt` backgrounds.

Hover states on interactive elements use a background-color shift: `surface` → `surface-alt` on cards, `primary` → `text` on buttons (per the `button-primary-hover` component token). No transform, no scale, no shadow-on-hover. Material=Flat means the element stays exactly where it is — only its fill changes.

## Shapes

Character=Brutalist mandates flat corners across every component. Every value in the `rounded:` scale is `0px` — `none`, `sm`, `md`, `lg` are all zero. The only exception is `full: 9999px` for circular avatars, which is a functional requirement (user avatars are conventionally circular) rather than a decorative choice.

Sharp corners reinforce the industrial parts-catalog ancestry of the brand. A rounded button reads as friendly, approachable, consumer-facing — none of which describe Stockyard. A square button reads as utilitarian, no-nonsense, tool-like. The Brutalist register demands that every interactive surface looks like it was stamped from sheet metal, not molded from plastic.

This zero-radius rule applies uniformly: buttons, cards, inputs, modals, dropdowns, tooltips, badges, toasts. There are no exceptions for "softer" contexts (e.g., onboarding modals or empty states). If a designer proposes rounded corners on any element, the proposal violates Character=Brutalist and is rejected.

The `form-checkbox` component uses a square checkbox (not rounded) per the manifest specification. Toggle switches are not used in Stockyard — the square checkbox is the only boolean input. This is a deliberate constraint: toggle switches imply a playful, mobile-first interaction model that contradicts the Brutalist desktop-first register.

Input fields have sharp corners with a 1px `border-hairline` border. On focus, the border thickens to 2px (no radius change, no glow, no ring — Material=Flat). The sharp-cornered input with a hairline border is the most recognizable form element in the system.

## Components

**button-primary** is the workhorse CTA. Background `{colors.primary}` (near-black `#0F172A`), text in `{colors.surface}` (warm white), typography `{typography.label-mono}` (JetBrains Mono 12px/500 — the mono label is the brand signal per Type=Mono-accented). Padding is 12px vertical, 16px horizontal — tight per Density=Dense. No shadow (Material=Flat). No border-radius (Character=Brutalist). Hover shifts background to `{colors.text}` (`#1F2937`) — a subtle darkening that stays within the Flat vocabulary. Copy=Punchy dictates that button labels are 1–3 word verbs: "Buy now", "Bid", "Ship", "Pay out". No "Get started", no "Learn more", no "Reserve your spot today."

**button-secondary** inverts the primary: `{colors.surface}` background, `{colors.primary}` text, same `{typography.label-mono}`. The 1px `border-hairline` outline distinguishes it from the page background. Used for cancel actions, secondary navigation, and filter toggles. Same zero-radius, same flat hover (background shifts to `surface-alt`).

**card** uses `{colors.surface-alt}` fill with zero radius and `{spacing.md}` (12px) padding. No border by default — the tonal shift from `surface` to `surface-alt` provides separation. `card-outline` variant adds a 1px `border-hairline` border on `{colors.surface}` background for contexts where tonal separation is insufficient (e.g., card on card, or card in a sidebar that already uses `surface-alt`).

**input** has `{colors.surface}` background, `{colors.text}` text color, `{typography.body-md}` (Inter Tight 14px). The 1px `border-hairline` border thickens to 2px on focus — no glow, no ring, no shadow (Material=Flat). For SKU and quantity inputs, implementers override typography to `{typography.label-mono}` so part numbers render in JetBrains Mono. Error state adds a 2px `{colors.error}` border replacing the hairline.

**data-table-row** is the most performance-critical component. The `variant` field references `tanstack-table.DataTable.compact` directly — this is a complex object value, not a simple token reference. Row height is locked at 32px per the manifest hard-gate. The 1px `{colors.border-hairline}` bottom border separates rows. Cell padding is `{spacing.xs}` (4px) vertical, `{spacing.sm}` (8px) horizontal — the tightest spacing in the system, driven by Density=Dense. SKU and price cells use `{typography.label-mono}`; description cells use `{typography.body-sm}`. Alternating row backgrounds (`surface` / `surface-alt`) provide scan lines without zebra-stripe color — the tonal shift is so subtle it registers subconsciously.

**toast** uses sonner with a 4s auto-dismiss duration. Background `{colors.primary}`, text `{colors.surface}`, positioned bottom-right. Entry animation is a 180ms ease-out slide-up (Motion=Subtle — no bounce, no spring). Exit is a 150ms ease-in fade. The toast has zero radius (Character=Brutalist) and no shadow (Material=Flat).

**modal** uses a `{colors.surface}` background with 1px `border-hairline` outline, centered on a scrim. No shadow, no rounded corners. The modal header uses `{typography.headline-md}` (JetBrains Mono 18px). Close button is a `button-tertiary` ghost with an × glyph — no icon library, just the Unicode character.

## Do's and Don'ts

- Do keep table row height at 32px or below — violating Density=Dense kills the catalog scan rhythm.
- Do use JetBrains Mono for every SKU, lot number, quantity, and price — Type=Mono-accented is the brand signal.
- Do use 1px hairlines (#1A1A1A on #F5F2EC) for all dividers — Material=Flat means no shadows ever.
- Do keep CTA copy at 1–3 words ("Buy now", "Bid", "Watch") — Copy=Punchy bans marketing softeners.
- Don't combine Brutalist with Glassy materials — Character vs Material conflict, the aesthetics actively reject each other.
- Don't increase line-height beyond 1.5 — violates Density=Dense and breaks the catalog scan rhythm.
- Don't name buttons `button-glass` or `button-elev-1` — Material=Flat requires bare shadcn names per protocol §2.3.
- Don't use 4+ font weights — overuse-ban per §4.2; stick to 400 and 600 in the humanist sans, plus 500 in the mono.
- Don't reach for purple-to-blue gradients as accents — AI-slop pattern §4.3.1; use a single saturated brand vermilion on cream.
- Don't write "Welcome to Stockyard" or "Unlock the power of procurement" anywhere — generic hero copy is banned per §4.3.9.
