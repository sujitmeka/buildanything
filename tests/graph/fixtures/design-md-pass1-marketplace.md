---
version: alpha
name: Stockyard
description: A no-frills industrial parts marketplace for buyers who know what they need and sellers who ship from spec sheets.
colors:
typography:
rounded:
spacing:
components:
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
