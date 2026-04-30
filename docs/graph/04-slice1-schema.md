# Slice 1 — Schema + Tool Spec

**Date:** 2026-04-26
**Status:** Draft for redline. No code yet.
**Scope:** Product-spec → graph → Briefing Officer. Nothing else.

Ground truth: `protocols/product-spec-schema.md`. Every node and edge below maps to a defined section in that schema.

---

## 1. Node types (extends Graphify's `file_type` enum)

Graphify ships with `file_type ∈ {code, document, paper, image, rationale}`. We extend `validate.py` to add a parallel `entity_type` field for our typed nodes. Existing Graphify-extracted file/code nodes are untouched.

| `entity_type` | Source section in product-spec.md | One per | Key fields |
|---|---|---|---|
| `persona` | `## App Overview` (persona name + 1-line desc) | persona enumerated in App Overview table (typically 2-4) | `id`, `label`, `description`, `role` (e.g. "buyer", "seller", "admin"), `is_primary: bool`, `primary_jtbd: str` |
| `feature` | `## Feature: {Name}` heading | feature | `id`, `label`, `name`, `kebab_anchor` |
| `screen` | `## Screen Inventory` table row | screen | `id`, `label`, `description`, `feature_ids[]` (from "Features" column) |
| `state` | `### States` per feature | feature × state name | `id`, `label`, `feature_id`, `is_initial: bool`, `meta_state: bool` |
| `transition` | `### Transitions` table row | row | `id`, `from_state_id`, `to_state_id`, `trigger`, `preconditions`, `side_effects` |
| `business_rule` | `### Business Rules` bullet | bullet | `id`, `feature_id`, `text`, `value`, `decision_needed: bool` |
| `failure_mode` | `### Failure Modes` bullet | bullet | `id`, `feature_id`, `trigger`, `user_sees`, `user_can`, `system_does` |
| `acceptance_criterion` | `### Acceptance Criteria` checkbox | line | `id`, `feature_id`, `text`, `verified: bool` (defaults false) |
| `persona_constraint` | `### Persona Constraints` bullet | bullet | `id`, `feature_id`, `persona_id`, `constraint_text`, `cited_source` (e.g. `ux-research.md`) |

All nodes inherit Graphify's required base fields:
- `id` — stable, `_make_id(stem, name)` rules. Format: `{entity_type}__{feature_kebab}__{slug}` (e.g. `state__checkout__loading`)
- `label` — human-readable
- `source_file` — always `docs/plans/product-spec.md` for Slice 1
- `source_location` — line number in product-spec.md (`L{n}`)
- `confidence` — always `EXTRACTED` (deterministic parser, never LLM)

---

## 2. Edge types

Extend Graphify's `relation` enum with the following. All Slice 1 edges are `EXTRACTED` confidence.

| Relation | From → To | Cardinality | Source |
|---|---|---|---|
| `has_screen` | feature → screen | 1:N | Screen Inventory "Features" column |
| `has_state` | feature → state | 1:N | per-feature `### States` |
| `has_initial_state` | feature → state | 1:1 | first entry in `### States` (marked `(initial)`) |
| `transitions_to` | state → state | N:N | per-feature `### Transitions` table |
| `triggered_by_transition` | state → transition | 1:N | reverse of above (audit convenience) |
| `has_rule` | feature → business_rule | 1:N | per-feature `### Business Rules` |
| `has_failure_mode` | feature → failure_mode | 1:N | per-feature `### Failure Modes` |
| `has_acceptance` | feature → acceptance_criterion | 1:N | per-feature `### Acceptance Criteria` |
| `constrains` | persona_constraint → feature | N:1 | per-feature `### Persona Constraints` |
| `applies_to_persona` | persona_constraint → persona | N:1 | per-feature `### Persona Constraints` (a single feature typically has multiple `persona_constraint` nodes, each pointing to a different persona — fan-out is the norm, not the exception) |
| `depends_on` | feature → feature | N:N | `## Cross-Feature Interactions` (e.g. `Auth → Checkout`) |

**Edge schema additions (forward-compat for later slices):**

| Field | Required | Notes |
|---|---|---|
| `produced_by_agent` | optional | Defaults `"product-spec-writer"` for Slice 1. Used by Slice 4 for decisions. |
| `produced_at_step` | optional | `"1.6"` for everything in Slice 1. |

---

## 3. ID generation rules

Stable across re-runs. Determinism matters: same product-spec.md → identical IDs → SHA256 cache hits.

- **feature**: `feature__{kebab(feature_name)}` → `feature__checkout`
- **screen**: `screen__{kebab(screen_name)}` → `screen__login`, `screen__checkout-cart-review` (multi-screen flows split: "Checkout (3 screens)" → 3 nodes if names provided, else 1 node with `count: 3`)
- **state**: `state__{feature}__{kebab(state_name)}` → `state__checkout__loading`
- **transition**: `transition__{feature}__{from}__{to}` → `transition__checkout__loading__loaded`
- **business_rule**: `rule__{feature}__{sha256_8(text)}` → `rule__checkout__a3f1b2c8` (content-hashed because rules are free-form)
- **failure_mode**: `failure__{feature}__{sha256_8(trigger)}` → `failure__checkout__9e2a55b1`
- **acceptance_criterion**: `accept__{feature}__{sha256_8(text)}` → `accept__checkout__7c9d11f4`
- **persona**: `persona__{kebab(persona_label)}` → `persona__time-poor-ops-manager`. Multiple persona nodes coexist with no collision (e.g. `persona__time-poor-buyer` and `persona__seller-fulfillment` in the same build).
- **persona_constraint**: `pconstraint__{feature}__{sha256_8(text)}` → `pconstraint__checkout__b4a82e91`

Content-hashing the free-form fields keeps IDs stable across rewrites that change wording trivially (whitespace, punctuation) — we strip-and-normalize before hashing.

---

## 4. Extractor mapping

One Python module: `extractors/product_spec.py`. Pure function, dict in (parsed markdown) / dicts out (nodes + edges). No I/O.

```python
def extract_product_spec(md_path: str) -> tuple[list[NodeDict], list[EdgeDict]]:
    """Parse product-spec.md per protocols/product-spec-schema.md.
    Returns (nodes, edges) ready for validate.py + graph build."""
```

Parsing strategy: section-aware markdown walker (no regex spaghetti). For each `## Feature:` block:
1. Split into subsections by `###` heading
2. Dispatch to per-subsection parser (one per node type above)
3. Each parser returns `(nodes, edges)` for its slice
4. Merge

Failure mode: malformed product-spec → fail loud, do NOT emit partial graph. Indexer logs error and orchestrator falls back to file-read path. The graph is never *partially* trusted.

---

## 5. MCP tool specs

Three tools for Slice 1. JSON in/out (replacing Graphify's plain-text BFS output for these tools — Graphify's existing tools stay available for code/doc traversal).

### `graph_query_feature`

```json
{
  "name": "graph_query_feature",
  "input": { "feature_id": "feature__checkout" },
  "output": {
    "feature": { "id": "...", "label": "Checkout", "kebab_anchor": "checkout" },
    "screens": [{ "id": "screen__cart-review", "label": "Cart Review", "description": "..." }],
    "states": [{ "id": "state__checkout__loading", "label": "loading", "is_initial": false }],
    "transitions": [{ "from": "state__checkout__loading", "to": "state__checkout__loaded", "trigger": "API 200", "preconditions": "Response has ≥1 item", "side_effects": "Render list" }],
    "business_rules": [{ "id": "rule__checkout__...", "text": "Cart timeout = 30 minutes", "decision_needed": false }],
    "failure_modes": [{ "trigger": "Network failure during submit", "user_sees": "...", "user_can": "Retry", "system_does": "Log error, no partial order" }],
    "persona_constraints": [
      { "constraint_text": "keep checkout to 3 steps max", "applies_to_persona": "persona__time-poor-buyer", "cited_source": "ux-research.md" },
      { "constraint_text": "show fulfillment SLA + payout timing on order confirmation", "applies_to_persona": "persona__seller-fulfillment", "cited_source": "ux-research.md" }
    ],
    "acceptance_criteria": [{ "text": "Verify that checkout completes in 3 steps or fewer" }],
    "depends_on": ["feature__auth", "feature__inventory"]
  }
}
```

Single call returns everything BO needs to brief one feature. Replaces ~15 lines of paste-summary in current BO output.

### `graph_query_screen`

```json
{
  "name": "graph_query_screen",
  "input": { "screen_id": "screen__cart-review" },
  "output": {
    "screen": { "id": "...", "label": "...", "description": "..." },
    "owning_features": ["feature__checkout"],
    "states_visible_here": [/* states from owning features that surface on this screen */]
  }
}
```

Slim — most screen detail (wireframe, hierarchy) comes from page-specs in Slice 3. Slice 1 returns just the inventory row + feature back-pointer.

### `graph_query_acceptance`

```json
{
  "name": "graph_query_acceptance",
  "input": { "feature_id": "feature__checkout" },
  "output": {
    "acceptance_criteria": [{ "id": "...", "text": "Verify that checkout completes in 3 steps or fewer", "verified": false }],
    "business_rules_in_scope": [/* same shape as feature query */],
    "persona_constraints": [/* same */]
  }
}
```

Used by Briefing Officer to populate the "Acceptance" section of per-task briefs without re-reading the feature block.

---

## 6. Briefing Officer integration

Patch `agents/briefing-officer.md`:

**Add to "What You Read" section:**
> Primary: graph queries via MCP tools `graph_query_feature(feature_id)`, `graph_query_screen(screen_id)`, `graph_query_acceptance(feature_id)`. Fall back to direct read of `docs/plans/product-spec.md` only if the graph MCP server is unavailable (logged warning).

**Replace the per-task brief assembly logic** (currently: paste summary of product-spec.md sections) with: call `graph_query_feature(feature_id)` once per feature, slot the structured fields into the brief template by name. No paraphrase.

**Output to implementer is unchanged in shape** — the brief still contains the same sections — but the content is now graph-pulled, structurally complete, and traceable back to product-spec.md line numbers via `source_location`.

---

## 7. Indexer trigger

End of Step 1.6, after `product-spec-writer` finishes. Wired in `commands/build.md`:

```
Step 1.6 (existing) → emit product-spec.md
Step 1.6.idx (new)  → run extractor; write graph.json fragment; SHA256 cache; log to build-log.md
```

If extractor fails: log error, set `.build-state.json.graph_status = "failed"`, continue pipeline (BO falls back). Graph never blocks the build.

Re-runs (resume mid-build) hit Graphify's existing SHA256 cache — no re-extraction unless product-spec.md changed.

---

## 8. Validation checklist (before merging to main)

- [ ] Schema-validation tests for each node type (valid + invalid fixtures)
- [ ] Round-trip test: extractor on a fabricated product-spec.md → assert expected node + edge counts
- [ ] BO consumer test: feed graph output through current brief template, diff against legacy paste-summary output for one real product-spec.md
- [ ] Fallback path test: kill MCP server, BO completes successfully via file read
- [ ] Token measurement: BO context size pre/post for the same feature, on a fixture build
- [ ] Determinism test: re-run extractor on same input → byte-identical graph fragment

---

## 9. Out of scope for Slice 1 (called out so we don't drift)

- Visual DNA, manifest, page-specs, tokens → Slice 2-3
- Cross-feature contracts, decisions, findings → Slice 4
- Screenshots → Slice 5
- Phase 2 architecture nodes → Slice 4
- iOS-specific extractor variations → defer to Slice 1.5 (after web is proven)

---

## 10. Open redlines for the user

1. **`screen` granularity for multi-screen flows.** "Checkout (3 screens)" in Screen Inventory — split into 3 nodes when names are given, single node with `count: 3` when not? Slice 3 will need them split for page-specs anyway. Vote: split now.

> **LOCKED: Multi-persona is the default.**
> Every build has ≥1 persona node, with one flagged `is_primary: true`. Single-persona builds are allowed but must be justified upstream (in `ux-research.md`). The graph never assumes singularity. Per-feature `persona_constraint` edges typically fan out to multiple persona nodes.
> Pipeline fixes (parallel work, 2026-04-26): `agents/design-ux-researcher.md` requires persona enumeration, `protocols/product-spec-schema.md` App Overview takes a persona table, `agents/product-spec-writer.md` enforces per-feature persona attribution.

2. **`acceptance_criterion.verified` field.** Slice 1 always emits `false`. Should Slice 5 (or a parallel system) flip these to `true` based on Phase 5 test results, creating a coverage view? Easy to leave the field, hard to add it later.
3. **Hash collisions.** SHA256 truncated to 8 chars (~4B keyspace). Per-feature scoping makes collision probability ~zero in practice but not theoretical. Vote: keep 8 chars; expand to 12 if a real collision ever shows up.
4. **MCP tool naming.** Should we keep our `graph_query_*` prefix to distinguish from Graphify's built-in tools (`query_graph`, `get_node`, etc.)? Or namespace differently (`buildanything.feature`, etc.)? Vote: keep `graph_query_*` — agent prompts already code against this namespace.
