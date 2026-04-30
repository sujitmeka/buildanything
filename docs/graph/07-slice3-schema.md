# Slice 3 — Schema + Tool Spec

**Date:** 2026-04-26
**Status:** Draft for redline. No code yet.
**Scope:** Page-specs + DESIGN.md Pass 2 tokens → graph → BO + Implementer. Slice 3 enriches Slice 2's `design_doc_root` with token nodes + adds page-spec entities.

Ground truth: `protocols/page-spec-schema.md` for the page-spec file format and required sections, `protocols/design-md-spec.md` (vendored, Apache 2.0) for the DESIGN.md format, and `protocols/design-md-authoring.md` for the two-pass authoring model and Pass 2 YAML front matter keys. Page-specs are authored by `design-ux-architect` at Step 3.3; DESIGN.md Pass 2 is authored by `design-ui-designer` at Step 3.4.

Slice 1 + Slice 2 are untouched; Slice 3 extends `entity_type` and `relation` enums and adds two new extractors + three MCP tools (two new, one enrichment of an existing Slice 1 tool).

---

## 1. Node types (extends Slice 2's `entity_type` enum)

Slice 3 adds six entity types. Existing Slice 1 and Slice 2 nodes are untouched.

| `entity_type` | Source section in source artifact | One per | Key fields |
|---|---|---|---|
| `token` | `DESIGN.md` Pass 2 YAML front matter keys (`colors`, `typography`, `rounded`, `spacing`, `components`) + prose sections (`## Colors`, `## Typography`, `## Layout`, `## Elevation & Depth`, `## Shapes`, `## Components`) | YAML leaf key or prose-extracted token | `id`, `label`, `name` (dot-path key, e.g. `colors.primary`), `value` (concrete value, e.g. `#0F172A`), `layer` (`color` \| `typography` \| `spacing` \| `shape` \| `elevation` \| `motion` \| `type` \| `component`), `axis_provenance` (the DNA axis that justifies this token, e.g. `material` for an elevation/glass token; `null` when not axis-driven), `category` (sub-grouping, e.g. `brand-neutral`, `heading`, `body`) |
| `page_spec` | `docs/plans/page-specs/<screen>.md` (one file per screen) | screen file | `id`, `label`, `screen_id` (back-pointer to Slice 1 `screen` node), `wireframe_text` (the ASCII wireframe block as a single string, preserved verbatim for implementer use), `content_hierarchy` (ordered list of section names), `route` (URL path) |
| `wireframe_section` | Major section labels inside the ASCII wireframe block (e.g. `[Header]`, `[Sidebar]`, `[Main]`, `[Footer]`) | section label per wireframe | `id`, `label`, `section_name`, `parent_page_spec_id`, `order` (integer, top-to-bottom), `prose` (any descriptive text accompanying the section) |
| `screen_state_slot` | `## States` section in page-spec file. Distinct from Slice 1's `state` node (which is per-feature, not per-screen). | screen × state name | `id`, `label`, `screen_id`, `state_id` (back-pointer to Slice 1 `state` node when matched), `appearance_text` (how this state manifests on this screen) |
| `screen_component_use` | `## Content Hierarchy` table in page-spec file | screen × slot × position | `id`, `label`, `screen_id`, `slot` (matches manifest entry's slot name), `position_in_wireframe` (e.g. `"header center"`, `"main top-left"`), `prop_overrides` (string, free-form notes on per-screen customization) |
| `key_copy` | `## Key Copy` bullet list in page-spec file | explicit user-facing copy string | `id`, `label`, `screen_id`, `text` (the copy string), `placement` (e.g. `"primary button"`, `"empty-state heading"`) |

All nodes inherit Slice 1's required base fields: `id`, `label`, `source_file`, `source_location`, `confidence`.

---

## 2. Edge types

Extend Slice 2's `relation` enum. All Slice 3 edges are `EXTRACTED` confidence.

| Relation | From → To | Cardinality | Source |
|---|---|---|---|
| `has_page_spec` | screen → page_spec | 1:1 | page-spec filename kebab-matched to `screen__*` node |
| `has_section` | page_spec → wireframe_section | 1:N | section labels extracted from ASCII wireframe block |
| `has_screen_state` | page_spec → screen_state_slot | 1:N | `## States` section in page-spec |
| `slot_used_on_screen` | page_spec → screen_component_use | 1:N | `## Content Hierarchy` table rows |
| `screen_uses_token` | screen_component_use → token | N:N | emitted when `prop_overrides` references a known token name (dot-path match against token nodes) |
| `token_derived_from` | token → dna_axis | N:1 | emitted when `axis_provenance` is non-null; links token to its governing DNA axis |
| `key_copy_on_screen` | page_spec → key_copy | 1:N | `## Key Copy` bullet list |

**Edge schema additions (forward-compat for Slice 4):**

| Field | Required | Notes |
|---|---|---|
| `produced_by_agent` | optional | `"design-ux-architect"` for page-spec-derived edges (Step 3.3), `"design-ui-designer"` for token edges (Step 3.4). |
| `produced_at_step` | optional | `"3.3"` for page-spec edges, `"3.4"` for token edges. |

---

## 3. ID generation rules

Stable across re-runs. Same page-specs + same DESIGN.md Pass 2 → identical IDs → SHA256 cache hits. Same `kebab` and `sha256_8` helpers as Slice 1/2 in `src/graph/ids.ts`. Same `normalizeForHash` rule (whitespace collapse, trim) before hashing.

- **token**: `token__{layer}__{kebab(name)}` → `token__color__primary`, `token__typography__heading-1`, `token__spacing__lg`
- **page_spec**: `page_spec__{kebab(screen_name)}` → `page_spec__login`, `page_spec__cart-review`
- **wireframe_section**: `wireframe_section__{kebab(screen)}__{kebab(section)}__{order}` → `wireframe_section__dashboard__header__1`
- **screen_state_slot**: `screen_state_slot__{kebab(screen)}__{kebab(state_name)}` → `screen_state_slot__login__error`
- **screen_component_use**: `screen_component_use__{kebab(screen)}__{kebab(slot)}__{kebab(position)}` → `screen_component_use__dashboard__card__main-top-left`
- **key_copy**: `key_copy__{kebab(screen)}__{sha256_8(text)}` → `key_copy__login__a3f1b2c8` (content-hashed because copy is free-form)

---

## 4. Extractor mapping

Two new extractors. Recommend a NEW file `design-md-pass2.ts` to keep Pass 1 / Pass 2 separation clean — do not extend the existing `design-md.ts`.

### 4.1 `src/graph/parser/page-spec.ts`

Parses one page-spec markdown file. Pure function, no I/O beyond the file read. Same fail-loud contract as Slice 1/2.

```ts
export function extractPageSpec(mdPath: string): ExtractResult {
  // Reads `## Screen Overview` (1-line description, feature back-pointer)
  // Locates the `## ASCII Wireframe` fenced code block — preserve full text as wireframe_text
  // Extracts section labels from the ASCII (regex /\[([A-Z][A-Za-z0-9 :-]+)\]/) for wireframe_section nodes
  // Reads `## Content Hierarchy` table → screen_component_use rows
  // Reads `## Key Copy` bullet list → key_copy nodes
  // Reads `## States` → screen_state_slot per state mentioned
  // Returns { ok, fragment } or { ok: false, errors }
}
```

**Failure modes** (each a hard-fail, fragment NOT written):
- File not found → `ExtractError { line: 0, message: "page-spec missing: <path>" }`
- No `## ASCII Wireframe` section → fail loud
- ASCII wireframe code block empty or missing brackets entirely → warn but emit `page_spec` node without `wireframe_section` nodes
- `## Content Hierarchy` missing → fail loud (per `protocols/page-spec-schema.md` required sections)
- `## Key Copy` missing → fail loud
- Screen name in filename doesn't kebab-match a known screen ID from Slice 1 → warn (orphaned `page_spec`) per §11 scenario 2

**Warnings** (non-fatal, logged to `build-log.md`):
- Missing `## Responsive Behavior` (web-only optional section)
- Missing `## Data Loading`
- Slot in Content Hierarchy doesn't match any manifest entry → warn per §11 scenario 5

### 4.2 `src/graph/parser/design-md-pass2.ts`

Reads YAML front matter Pass 2 keys (`colors:`, `typography:`, `rounded:`, `spacing:`, `components:`) — flattens nested keys to dot-paths (`colors.primary` → token name `primary`, layer `color`). Also parses prose Pass 2 sections for additional tokens not present in YAML.

```ts
export function extractDesignMdTokens(mdPath: string): ExtractResult {
  // Reads YAML frontmatter Pass 2 keys: colors, typography, rounded, spacing, components
  // Flattens nested keys to dot-paths; emits one token node per leaf
  // Walks ## Colors, ## Typography, ## Layout, ## Elevation & Depth, ## Shapes, ## Components prose
  //   for tokens not present in YAML (e.g. token aliases, per-state component definitions)
  // For each token: derive layer from key path; derive axis_provenance via keyword heuristic
  //   - keys matching glass/blur → material axis
  //   - keys matching motion-* / duration-* → motion axis
  //   - keys matching space-* / spacing-* / density-* → density axis
  //   - keys matching font-* / type-* → type axis
  //   - everything else → null (not axis-driven)
  // Emits token_derived_from edge to dna_axis when provenance is non-null
  // Returns { ok, fragment } or { ok: false, errors }
}
```

**Failure modes:**
- `DESIGN.md` not found → fail loud
- `pass_complete.pass2 === false` (Pass 2 not yet authored) → return `{ ok: true, fragment: empty }` — NOT fail loud, because indexer is invoked best-effort at Step 3.4 even if Pass 2 stub exists
- YAML frontmatter malformed (parse error) → fail loud
- Token value missing for a YAML leaf → fail loud, name the offending key in the error

**Note:** Existing `extractDesignMdPass1` from Slice 2 is untouched. CLI dispatch decision (per §10 redline 6): when DESIGN.md is detected and Pass 2 is now complete, the CLI runs BOTH `extractDesignMdPass1` AND `extractDesignMdTokens` in one invocation, writing `slice-2-dna.json` and `slice-3-tokens.json` respectively. Idempotent.

---

## 5. MCP tool specs

Two new tools + one enrichment of an existing Slice 1 tool. JSON in/out, same convention as Slice 1/2's `graph_query_*` family.

### `graph_query_token`

```json
{
  "name": "graph_query_token",
  "input": { "name": "colors.primary" },
  "output": {
    "token": {
      "id": "token__color__primary",
      "name": "colors.primary",
      "value": "#0F172A",
      "layer": "color",
      "axis_provenance": "character",
      "category": "brand-neutral"
    }
  }
}
```

Returns `null` when token not found. Used by implementers to resolve `colors.primary` → `#0F172A` without opening DESIGN.md.

### `graph_query_screen_full`

The implementer's one-call tool. Returns the full Slice 1 screen result enriched with all Slice 3 page-spec data.

```json
{
  "name": "graph_query_screen_full",
  "input": { "screen_id": "screen__cart-review" },
  "output": {
    "screen": { "id": "screen__cart-review", "label": "Cart Review", "description": "Review items before checkout" },
    "owning_features": ["feature__checkout"],
    "states_visible_here": [{ "id": "state__checkout__loading", "label": "loading", "is_initial": false }],
    "page_spec": {
      "id": "page_spec__cart-review",
      "wireframe_text": "┌─────────────────────────────┐\n│ [Header]                    │\n│ [Cart Items]                │\n│ [Order Summary]             │\n│ [CTA Bar]                   │\n└─────────────────────────────┘",
      "content_hierarchy": ["Header", "Cart Items", "Order Summary", "CTA Bar"],
      "route": "/cart/review"
    },
    "sections": [
      { "id": "wireframe_section__cart-review__header__1", "section_name": "Header", "order": 1, "prose": "Logo + back nav" },
      { "id": "wireframe_section__cart-review__cart-items__2", "section_name": "Cart Items", "order": 2, "prose": "Scrollable item list with quantity controls" },
      { "id": "wireframe_section__cart-review__order-summary__3", "section_name": "Order Summary", "order": 3, "prose": "Subtotal, tax, total" },
      { "id": "wireframe_section__cart-review__cta-bar__4", "section_name": "CTA Bar", "order": 4, "prose": "Proceed to Payment button" }
    ],
    "screen_state_slots": [
      { "id": "screen_state_slot__cart-review__empty", "state_id": "state__checkout__empty", "appearance_text": "Empty-state illustration + 'Your cart is empty' heading" },
      { "id": "screen_state_slot__cart-review__loading", "state_id": "state__checkout__loading", "appearance_text": "Skeleton loaders in Cart Items and Order Summary sections" }
    ],
    "screen_component_uses": [
      {
        "id": "screen_component_use__cart-review__card__main-top-left",
        "slot": "card",
        "position_in_wireframe": "Cart Items",
        "prop_overrides": "compact variant, colors.surface-alt background",
        "manifest_entry": { "slot": "card", "library": "tailwindui", "variant": "Card-Compact-2", "hard_gate": true }
      },
      {
        "id": "screen_component_use__cart-review__cta__cta-bar-center",
        "slot": "cta",
        "position_in_wireframe": "CTA Bar",
        "prop_overrides": "full-width, colors.primary background",
        "manifest_entry": { "slot": "cta", "library": "shadcn", "variant": "Button-Primary", "hard_gate": true }
      }
    ],
    "key_copy": [
      { "id": "key_copy__cart-review__a3f1b2c8", "text": "Your cart is empty", "placement": "empty-state heading" },
      { "id": "key_copy__cart-review__9e2a55b1", "text": "Proceed to Payment", "placement": "primary button" }
    ],
    "tokens_used": [
      { "id": "token__color__primary", "name": "colors.primary", "value": "#0F172A", "layer": "color" },
      { "id": "token__color__surface-alt", "name": "colors.surface-alt", "value": "#F8FAFC", "layer": "color" }
    ]
  }
}
```

`manifest_entry` inside each `screen_component_uses` item is resolved inline via `graph_query_manifest` join on `slot`. `tokens_used` is the union of all tokens referenced by any `screen_component_use.prop_overrides` on this screen.

### `graph_query_screen` (existing Slice 1 tool — gains a flag)

Add optional `full?: boolean` parameter. When `full: true`, behaves identically to `graph_query_screen_full`. Default is `false` (backward compatible — returns the slim Slice 1 shape).

```json
{
  "name": "graph_query_screen",
  "input": { "screen_id": "screen__cart-review", "full": true },
  "output": { "...same as graph_query_screen_full output above..." }
}
```

Existing callers that omit `full` are untouched.

---

## 6. Consumer integration

### 6.1 Briefing Officer

- When assembling per-task briefs that touch a screen, prefer `graph_query_screen_full(screen_id)` over Slice 1's `graph_query_screen`. Wireframe slices come straight from the graph; no more paste-summary of page-specs.
- Per task that touches a token (e.g. button color), call `graph_query_token(name)` to embed the concrete value verbatim in the brief. Same no-paraphrase rule as Slice 1/2.
- Fall back to direct file read of `docs/plans/page-specs/<screen>.md` and `DESIGN.md` only if the graph MCP server is unavailable (logged warning).

### 6.2 Implementer narrow-tool affordance

Implementers (Phase 4 execution agents) gain read-only access to:

- `graph_query_screen_full(screen_id)` — pulls the wireframe slice for the screen the task touches. The implementer reads the ASCII wireframe, section layout, component slots, and key copy from a single structured response instead of opening thousand-line page-spec files.
- `graph_query_token(name)` — when the BO brief lists a token name like `colors.primary`, the implementer queries to resolve the value (`#0F172A`) instead of opening DESIGN.md.

Cost: ~30 lines of MCP tool affordance per dispatch, same tolerance as Slice 2.

### 6.3 Cleanup agent

On UI code touched, call `graph_query_screen_full` to confirm the implementer used the right slot positions per wireframe. Cross-check `position_in_wireframe` against the actual component placement in the authored code. Mismatches are logged as findings.

---

## 7. Indexer triggers

Two new triggers in `commands/build.md`. Both follow the Slice 1/2 best-effort pattern: log to `docs/plans/build-log.md` on failure, do NOT block.

### Step 3.3.idx — Page-specs index

After `design-ux-architect` writes `docs/plans/page-specs/*.md`:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/page-specs/`
- The CLI accepts a directory argument and dispatches to the page-spec parser. Parses all `*.md` files in the directory, merges results into a single `slice-3-pages.json` fragment.
- On exit 0: log success to `build-log.md` and continue.
- On non-zero exit: log warning (`graph-index page-specs failed — continuing with file-read fallback`) and continue.

### Step 3.4.idx — DESIGN.md Pass 2 re-index

After `design-ui-designer` writes DESIGN.md Pass 2:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js DESIGN.md`
- The existing CLI dispatches to `extractDesignMdPass1` (Slice 2) AND `extractDesignMdTokens` (Slice 3) in one invocation. If `pass_complete.pass2 === true`, also writes `slice-3-tokens.json`. Idempotent — running on a Pass-1-only DESIGN.md leaves `slice-3-tokens.json` absent.
- On exit 0: log success.
- On non-zero exit: log warning and continue.

Re-runs hit the same SHA256 cache discipline as Slice 1/2 — no re-extraction unless source changed.

---

## 8. Validation checklist (before merging to main)

- [ ] Schema-validation tests for each new node type (`token`, `page_spec`, `wireframe_section`, `screen_state_slot`, `screen_component_use`, `key_copy`) — valid + invalid fixtures
- [ ] Round-trip determinism test: extractor on a fabricated page-spec → byte-identical fragment on second run
- [ ] Idempotent indexing: running `graph-index.js DESIGN.md` twice with Pass 2 complete produces identical `slice-3-tokens.json`
- [ ] Page-spec parser edge cases: missing wireframe block → fail loud; malformed States section → fail loud; empty Content Hierarchy → fail loud
- [ ] Token parser handles missing `axis_provenance` gracefully (defaults to `null`, not `undefined`, no error)
- [ ] Slice 1 + Slice 2 nodes untouched after Slice 3 indexes (no clobbering, no edge contamination)
- [ ] Multi-screen flow: 3 page-spec files for one feature → 3 separate `page_spec` nodes, all linked to same feature via screen back-pointer
- [ ] `graph_query_screen_full` joins manifest entries inline correctly for every `screen_component_use`
- [ ] Pass 2 placeholder tolerance: DESIGN.md with Pass 2 stub comments → empty token fragment, no error
- [ ] Token name conflict: YAML key `colors.primary` and prose mention of `colors.primary` with different value → YAML wins, warn (per §11 scenario 4)

---

## 9. Out of scope for Slice 3

- Decision nodes / contracts / tasks → Slice 4
- Screenshots → Slice 5
- iOS-specific page-specs — Phase B deferred per CLAUDE.md, same as Slice 2
- Page-spec lint gate (cross-check vs product-spec Screen Inventory) → could ship as a hook in Slice 3.5; not in graph schema
- Token DNA enforcement (does the token value actually match what the DNA axis claims?) → Slice 4 cleanup-agent territory

---

## 10. Open redlines for the user

1. **Wireframe ASCII parsing strictness.** How strict should section-label detection be? The regex `/\[([A-Z][A-Za-z0-9 :-]+)\]/` catches `[Header]` and `[KPI Cards]` but may miss lowercase or unconventional labels. Vote: lenient — extract section names by scanning for capitalized labels in brackets; tolerate variations and log unmatched lines as warnings rather than failing.

2. **Token `axis_provenance` heuristic.** Keyword-based matching (glass→material, motion-*→motion, space-*→density, font-*→type) is fragile and will miss edge cases. Vote: yes — start keyword-based, accept gaps, log unmatched tokens as warnings, revisit if cleanup-agent enforcement in Slice 4 misses real cases.

3. **`graph_query_screen_full` API surface.** Ship as a new standalone tool, or add a `full?: boolean` flag on the existing `graph_query_screen`? Vote: add the flag — cleaner API surface; existing callers untouched; `graph_query_screen_full` is an alias that sets `full: true` internally.

4. **iOS page-specs.** Do they exist in Slice 3? Vote: skip — Phase B deferred per CLAUDE.md, same logic as Slice 2.

5. **Multi-screen flows.** "Checkout (3 screens)" — one `page_spec` per screen file, or one per flow? Vote: one per screen file; the orchestrator already splits multi-screen flows into individual screen nodes in Slice 1 schema.

6. **DESIGN.md re-index atomicity.** Indexing `slice-2-dna.json` (Pass 1) and `slice-3-tokens.json` (Pass 2) atomically — what if Pass 2 indexing fails after Pass 1 succeeded? Vote: keep `slice-2-dna.json` from prior run; log warning; downstream consumers tolerate missing `slice-3-tokens.json` (`graph_query_token` returns `null`).

---

## 11. Logical scenarios — what could go wrong

Pre-implementation thought experiment. Each scenario states the desired behavior and an implementation note.

1. **Page-specs directory exists but is empty** (`docs/plans/page-specs/` has no `.md` files). Indexer behavior: emit empty `slice-3-pages.json` fragment, log warning ("page-specs directory empty — design-ux-architect did not write any files"), continue. Build does NOT fail; BO falls back to file read which also finds nothing and degrades gracefully.
   *Note:* Empty directory is distinct from missing directory; missing directory is a hard fail (Step 3.3 must have run).

2. **Orphaned page_spec — references a screen NOT in Slice 1's screen inventory.** Page-spec filename → kebab match against existing `screen__*` nodes. Mismatch = warn at index time, emit the `page_spec` node anyway with `screen_id: null`. BO logs the orphan when querying. Author error, not a build blocker.
   *Note:* Could happen when product-spec Screen Inventory was edited after page-specs were written.

3. **DESIGN.md Pass 1 indexed at Step 3.0; Pass 2 NOT yet completed at Step 3.4** (e.g., design-ui-designer agent fails or is interrupted). `slice-3-tokens.json` absent. Phase 4 implementer queries `graph_query_token("colors.primary")` → returns `null`. Implementer prompt instructs: on null, fall back to file read of DESIGN.md. Build continues; BO logs warning that token graph is incomplete.
   *Note:* This is the cache-miss path — exactly the file-read fallback shape Slice 1 established.

4. **Token name conflict between YAML and prose.** YAML has `colors.primary: "#000"` but prose says `colors.primary: "#0F172A"`. YAML wins (machine-readable is authoritative). Parser emits warning to build-log: "token colors.primary: YAML=#000 conflicts with prose=#0F172A; using YAML".
   *Note:* Document in `design-md-spec.md` that YAML is the source of truth when both are present.

5. **Page-spec wireframe ASCII uses a slot name that doesn't match any manifest entry.** `screen_uses_token` edge can't resolve → emit `screen_component_use` node with slot but skip the edge to `manifest_entry`; warn ("page-spec dashboard.md references slot 'graphic-hero' not in component-manifest.md"). Author error or stale manifest; BO surfaces the warning to PO at brief assembly.
   *Note:* Soft-fail because the page-spec author may legitimately introduce a slot the manifest doesn't have yet.

6. **Step 3.3 re-runs (page-specs regenerated).** `slice-3-pages.json` overwritten atomically. But `slice-1.json`'s `screen` nodes are stable across regenerations only if the screen names didn't change. If they did, `page_spec` → `screen` back-pointers go stale. Parser warns on every run when a kebab-matched screen ID is not present in the Slice 1 fragment; orchestrator re-indexes Slice 1 first, then Slice 3, on every build to keep them in sync.
   *Note:* Re-index ordering is enforced in `commands/build.md`: Slice 1 always before Slice 3.
