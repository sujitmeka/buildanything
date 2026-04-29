# Slice 2 — Schema + Tool Spec

**Date:** 2026-04-26
**Status:** Draft for redline. No code yet.
**Scope:** DESIGN.md Pass 1 (Brand DNA + Overview + Do's/Don'ts) + component-manifest.md → graph → BO + cleanup-agent + implementer.

Ground truth: `protocols/design-md-spec.md` (vendored, Apache 2.0) for the DESIGN.md format, `protocols/design-md-authoring.md` for pipeline-internal additions (the `### Brand DNA` h3, 7 axes, two-pass authoring, Do's and Don'ts contract), and `protocols/web-phase-branches.md` Step 3.2 for the component-manifest table shape (one row per slot, naming library + variant). Slice 2 indexes only Pass 1 of DESIGN.md — Pass 2 tokens are Slice 3.

Slice 1 is untouched; Slice 2 extends `entity_type` and `relation` enums and adds two new extractors + two new MCP tools.

---

## 1. Node types (extends Slice 1's `entity_type` enum)

Slice 2 adds six entity types. Existing Slice 1 nodes are untouched.

| `entity_type` | Source section in source artifact | One per | Key fields |
|---|---|---|---|
| `dna_axis` | `DESIGN.md` `## Overview > ### Brand DNA` (7 bullets, fixed names) | axis name (×7: `scope`, `density`, `character`, `material`, `motion`, `type`, `copy`) | `id`, `label`, `axis_name`, `value` (e.g. `"Brutalist"`, `"Dense"`), `locked_at` (ISO-8601 from `### Locked At`), `rationale` (paragraph from `### Rationale`, optional) |
| `brand_dna_guideline` | `DESIGN.md` `## Do's and Don'ts` bullet | bullet | `id`, `label`, `polarity` (`"do"` \| `"dont"`), `text`, `axis_scope` (axis name when guideline is axis-attributed, else `null`) |
| `brand_reference` | `DESIGN.md` `## Overview > ### References` bullet | bullet | `id`, `label`, `url_or_path` (string), `exemplifies_axes` (string[] — axis names cited in the bullet, e.g. `["material", "character"]`) |
| `component_manifest_entry` | `component-manifest.md` table row | row | `id`, `label`, `slot`, `library`, `variant`, `source_ref` (line ref or anchor in `design-references.md`), `hard_gate: bool` (true when row is a HARD-GATE entry, false for `manifest gap` rows), `fallback_plan` (string, present only on `manifest gap` rows) |
| `component_slot` | `component-manifest.md` table column "Slot" (deduped) | distinct slot value | `id`, `label`, `slot_name` (kebab-cased, e.g. `"hero"`, `"card"`, `"modal"`) |

All nodes inherit Slice 1's required base fields:
- `id` — stable, deterministic. Format documented in §4.
- `label` — human-readable
- `source_file` — `DESIGN.md` (repo root) for DNA nodes, `docs/plans/component-manifest.md` for manifest nodes
- `source_location` — line number (`L{n}`) in source file
- `confidence` — `EXTRACTED` (deterministic parsers, no LLM)

---

## 2. Edge types

Extend Slice 1's `relation` enum. All Slice 2 edges are `EXTRACTED` confidence.

| Relation | From → To | Cardinality | Source |
|---|---|---|---|
| `has_axis` | DESIGN.md (synthetic root node — see §4) → dna_axis | 1:7 | per `### Brand DNA` bullet |
| `dna_governs` | dna_axis → component_manifest_entry | N:N | when `material` axis dictates variant naming per `protocols/design-md-authoring.md` §2.3 (Flat → bare names, Glassy → `-glass` suffix, Physical → `-elev-N` suffix); also when `character` axis surfaces in slot picks. Inferred by parser via simple suffix/name match against the locked Material value — fail-loud if no axis is locked. |
| `forbids` | brand_dna_guideline (polarity = `dont`) → string text (stored as edge attribute `forbidden_text`) | 1:1 per guideline | each `Don't` bullet — preserved as text on the edge for query convenience (`graph_query_dna()` returns the list directly without a string-node walk) |
| `applies_to` | brand_dna_guideline → dna_axis | N:1 | when guideline cites an axis (e.g. "Don't use more than two font weights" → `type` axis). Best-effort keyword match; absent edge means guideline is global. |
| `slot_filled_by` | component_slot → component_manifest_entry | 1:1 (one entry per slot; collisions handled per §11 scenario 4) | one row per slot in manifest |
| `manifest_uses_library` | component_manifest_entry → string library name (stored as edge attribute `library_name`) | 1:1 | per row "Library" column |
| `references_axis` | brand_reference → dna_axis | N:N | per `### References` bullet's "exemplifies <axes>" tail |

**Edge schema additions (forward-compat for Slice 4):**

| Field | Required | Notes |
|---|---|---|
| `produced_by_agent` | optional | `"design-brand-guardian"` for DNA nodes, `"design-ui-designer"` for manifest nodes. |
| `produced_at_step` | optional | `"3.0"` for DNA, `"3.2"` for manifest. |

---

## 3. ID generation rules

Stable across re-runs. Same DESIGN.md + same component-manifest.md → identical IDs → SHA256 cache hits. Same `kebab` and `sha256_8` helpers as Slice 1 (`src/graph/ids.ts`).

- **dna_axis**: `dna_axis__{axis_name}` → `dna_axis__scope`, `dna_axis__density`, `dna_axis__character`, `dna_axis__material`, `dna_axis__motion`, `dna_axis__type`, `dna_axis__copy`. Seven IDs only — fixed enumeration, no hashing.
- **brand_dna_guideline**: `dna_guideline__{polarity}__{sha256_8(text)}` → `dna_guideline__do__a3f1b2c8`, `dna_guideline__dont__9e2a55b1`. Content-hashed because guideline text is free-form.
- **brand_reference**: `brand_reference__{sha256_8(url_or_label)}` → `brand_reference__7c9d11f4`. Hashed on URL when present, else on the label text.
- **component_manifest_entry**: `manifest_entry__{kebab(slot)}` → `manifest_entry__hero`, `manifest_entry__cart-cta`. One entry per slot; collisions resolved per §11 scenario 4.
- **component_slot**: `slot__{kebab(slot)}` → `slot__hero`, `slot__modal`.
- **DESIGN.md root node** (synthetic — needed because DESIGN.md has no Slice 1 anchor to hang `has_axis` off): `design_md__root`. Its own `entity_type: "design_doc_root"` with fields `name`, `description`, `locked_at`, `lint_status`, `pass_complete`. ID is always `design_md__root` (singleton per build). Per §10.5 redline vote.

Free-form text is normalized via `normalizeForHash` (whitespace collapse, trim) before hashing — same rule as Slice 1 §3 — so trivial wording changes don't churn IDs.

---

## 4. Extractor mapping

Two new extractors added under `src/graph/parser/`. Pure functions, dict in / dicts out, no I/O. Same fail-loud contract as Slice 1: malformed source → no partial graph fragment.

### 4.1 `src/graph/parser/design-md.ts`

Parses `DESIGN.md` Pass 1 portion only. Pass 2 sections are tolerated as placeholders (see §11 scenario 1).

```ts
export function extractDesignMdPass1(mdPath: string): ExtractResult {
  // Reads YAML frontmatter (`name`, `description`)
  // Reads `## Overview` paragraph (description fallback)
  // Reads `### Brand DNA` h3 — 7 lines, one per axis (`**Scope:** Product`, etc.)
  // Reads `### Locked At` (ISO timestamp + locked_by + build_session)
  // Reads `### References` bullet list (URL/path + axes)
  // Reads `## Do's and Don'ts` (labeled bullets — `Do` / `Don't` prefix per spec example)
  // Returns { ok, fragment: { nodes, edges } } or { ok: false, errors }
}
```

Failure modes (each a hard-fail, fragment NOT written):
- File not found at repo root → `ExtractError { line: 0, message: "DESIGN.md missing at repo root" }`
- `### Brand DNA` h3 missing → fail loud (per `protocols/design-md-authoring.md` §11 schema-contract enforcement)
- Fewer than 7 axis bullets → fail loud, list missing axis names in error
- Axis value not in the allowed enumeration (per `design-md-authoring.md` §2.1) → fail loud
- `### Locked At > locked_at` missing or unparseable → fail loud (DNA must be locked once)
- `## Do's and Don'ts` has fewer than 4 bullets total or fails the "≥2 Do, ≥2 Don't" rule → fail loud (Pass 1 schema contract per `design-md-authoring.md` §5)

Warnings (non-fatal, logged to `build-log.md`):
- `### References` has fewer than 2 entries — Pass 1 contract requires ≥2; treat as warn at index time and let the lint gate (Step 3.8) decide.
- `### Rationale` block absent — rationale is informative, not blocking for extraction.

### 4.2 `src/graph/parser/component-manifest.ts`

Parses `docs/plans/component-manifest.md`. Each table row is one slot-to-variant binding.

```ts
export function extractComponentManifest(mdPath: string): ExtractResult {
  // Walks the markdown table(s). Header row determines column mapping.
  // Required columns: Slot, Library, Variant. Optional: Source, Notes.
  // For each row, emits a component_manifest_entry node + a component_slot node
  // (deduped) + slot_filled_by + manifest_uses_library edges.
  // Detects `manifest gap` rows (per protocols/web-phase-branches.md Step 3.2)
  // and emits with hard_gate: false + fallback_plan field populated from Notes.
  // Detects HARD-GATE annotations in row text (case-insensitive) and sets hard_gate: true.
  // Returns { ok, fragment } or { ok: false, errors }.
}
```

Failure modes:
- File not found → fail loud
- No table found → fail loud (manifest must be tabular per `web-phase-branches.md` Step 3.2)
- Required column missing (Slot / Library / Variant) → fail loud, name missing column
- Duplicate slot name in same manifest → fail loud per §11 scenario 4 (open redline §10.4)

---

## 5. MCP tool specs

Two new tools for Slice 2. JSON in/out, same convention as Slice 1's `graph_query_*` family.

### `graph_query_dna`

```json
{
  "name": "graph_query_dna",
  "input": {},
  "output": {
    "name": "Daylight Prestige",
    "description": "A high-contrast neutral system with one evocative accent for editorial fintech.",
    "axes": [
      { "name": "scope",     "value": "Product",          "locked_at": "2026-04-26T18:14:22Z", "rationale": "..." },
      { "name": "density",   "value": "Balanced",         "locked_at": "2026-04-26T18:14:22Z", "rationale": "..." },
      { "name": "character", "value": "Editorial",        "locked_at": "2026-04-26T18:14:22Z", "rationale": "..." },
      { "name": "material",  "value": "Flat",             "locked_at": "2026-04-26T18:14:22Z", "rationale": "..." },
      { "name": "motion",    "value": "Subtle",           "locked_at": "2026-04-26T18:14:22Z", "rationale": "..." },
      { "name": "type",      "value": "Serif-forward",    "locked_at": "2026-04-26T18:14:22Z", "rationale": "..." },
      { "name": "copy",      "value": "Narrative",        "locked_at": "2026-04-26T18:14:22Z", "rationale": "..." }
    ],
    "guidelines": {
      "dos":   [{ "id": "dna_guideline__do__a3f1b2c8",   "text": "Use the primary color only for the single most important action per screen", "axis_scope": "character" }],
      "donts": [{ "id": "dna_guideline__dont__9e2a55b1", "text": "Don't use more than two font weights on a single screen",                    "axis_scope": "type" }]
    },
    "references": [
      { "id": "brand_reference__7c9d11f4", "url_or_path": "https://stripe.com/atlas", "exemplifies_axes": ["material", "character"] }
    ],
    "lint_status": "pass"
  }
}
```

`lint_status` is read from `.buildanything/graph/lint-status.json` (open redline §10.1) produced by `hooks/design-md-lint.ts`. Values: `"pass" | "warn" | "fail" | null` (null when lint hasn't run yet; tool returns null rather than erroring so consumers can render gracefully).

### `graph_query_manifest`

```json
{
  "name": "graph_query_manifest",
  "input": { "slot": "hero" },
  "output": {
    "slot": "hero",
    "library": "shadcn",
    "variant": "Hero01",
    "source_ref": "design-references.md#L42",
    "hard_gate": true
  }
}
```

When `slot` is omitted, returns the full list:

```json
{
  "name": "graph_query_manifest",
  "input": {},
  "output": {
    "entries": [
      { "slot": "hero", "library": "shadcn",       "variant": "Hero01",  "source_ref": "design-references.md#L42", "hard_gate": true },
      { "slot": "card", "library": "tailwindui",   "variant": "Card-Compact-2", "source_ref": "design-references.md#L88", "hard_gate": true },
      { "slot": "chart","library": "recharts",     "variant": "AreaChart", "source_ref": null, "hard_gate": false, "fallback_plan": "wrap recharts AreaChart in a Card; see manifest gap notes" }
    ]
  }
}
```

Slice 2 ships both tools. Implementer prompts get read-only access to `graph_query_manifest` for HARD-GATE compliance checks; cleanup agent gets it for revert decisions.

---

## 6. Consumer integration

### 6.1 Briefing Officer patch refinement

Slice 1 added graph_query_feature/screen/acceptance to BO. The `agents/briefing-officer.md` cognitive protocol (Step 2) still names `component-manifest.md` and `visual-design-spec.md` as file-based reads — the latter is now stale per the 2026-04-21 DESIGN.md consolidation. Slice 2 closes this:

- Replace the file-read of `component-manifest.md` with one `graph_query_manifest()` call per brief assembly (returns the full list; BO filters to slots its tasks touch).
- Per task that touches a UI slot, call `graph_query_manifest(slot)` and slot the structured fields into the per-task `Components` block verbatim — same no-paraphrase rule as Slice 1.
- Add `graph_query_dna()` once per brief assembly to populate the brief's `Design DNA` block. The 7-axis card is what the implementer is held to.
- The stale `visual-design-spec.md` reference at line ~67 of `agents/briefing-officer.md` is replaced with `DESIGN.md` (file-based until Slice 3 enriches the graph with tokens).

### 6.2 Cleanup agent (code-simplifier / refactor-cleaner)

Slice 2 ships the tool surface; the agent prompt update can be deferred. Once wired, the cleanup agent gains the ability to enforce HARD-GATE programmatically:

- For any custom UI code touched, parse the slot it covers (heuristic: directory name, exported component name, JSX root element).
- Call `graph_query_manifest(slot)`. If a manifest entry exists with `hard_gate: true`, revert the custom variant and emit a finding.
- If `hard_gate: false` (manifest gap row), pass through with a note in the cleanup log.

This replaces the prose-grep enforcement noted in `docs/graph/03-integration-plan.md` §3 fact 4.

### 6.3 Implementer narrow tool affordance

Implementer prompts (Phase 4 dispatch) gain read-only access to:

- `graph_query_dna()` — token-name-to-axis lookup. Slice 2 returns axis values; Slice 3 will extend `graph_query_token()` so the implementer can resolve `colors.primary` → its DNA-axis provenance.
- `graph_query_manifest(slot)` — pre-write HARD-GATE compliance check. Before authoring a custom component, the implementer queries the slot; if `hard_gate: true`, it imports the named variant.

Cost: ~30 lines of MCP tool affordance per dispatch. Same prompt-bloat tolerance question logged in `docs/graph/03-integration-plan.md` §10.4.

---

## 7. Indexer triggers

Two new triggers in `commands/build.md`. Both follow the Slice 1 best-effort pattern: log to `docs/plans/build-log.md` on failure, do NOT block.

### Step 3.0.idx — Brand DNA index

After `design-brand-guardian` returns and `DESIGN.md` (Pass 1) is on disk, index it.

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js DESIGN.md --pass 1`
- On exit 0: log success to `build-log.md` and continue.
- On non-zero exit: log warning (`graph-index DESIGN.md pass 1 failed — continuing with file-read fallback`) and continue.

The `--pass 1` flag tells the extractor to tolerate Pass 2 placeholder sections (`<!-- Pass 2 — UI Designer at Step 3.4 -->`) without erroring. Re-runs after Pass 2 should be re-indexed via Slice 3's trigger; Slice 2 only owns the Pass 1 fragment.

### Step 3.2.idx — Component manifest index

After `design-ui-designer` writes `docs/plans/component-manifest.md`, index it.

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/component-manifest.md`
- On exit 0: log success.
- On non-zero exit: log warning (`graph-index component-manifest failed — continuing with file-read fallback`) and continue.

The graph-index binary dispatches by filename: `DESIGN.md` → `parser/design-md.ts`, `component-manifest.md` → `parser/component-manifest.ts`, `product-spec.md` → `parser/product-spec.ts` (Slice 1).

Re-runs hit the same SHA256 cache discipline as Slice 1 — no re-extraction unless source changed.

---

## 8. Validation checklist (before merging to main)

- [ ] Schema-validation tests for each new node type (`dna_axis`, `brand_dna_guideline`, `brand_reference`, `component_manifest_entry`, `component_slot`) — valid + invalid fixtures
- [ ] Round-trip determinism test: extractor on a fabricated `DESIGN.md` Pass 1 → byte-identical graph fragment on second run
- [ ] Fail-loud test: `DESIGN.md` missing the `### Brand DNA` h3 → no fragment emitted, error reported
- [ ] Multi-axis fan-out test: a guideline citing two axes (e.g. "Don't mix rounded and sharp corners" → `shapes` is not in our 7 axes; verify keyword matcher punts to global instead of misattributing)
- [ ] Manifest HARD-GATE preservation: fixture with mixed HARD-GATE + manifest-gap rows → `hard_gate` boolean correctly set on each
- [ ] `lint_status` surfacing test: tool returns `null` when no side-channel file exists; returns the file's status when present
- [ ] Idempotent indexing: running `graph-index.js DESIGN.md --pass 1` twice produces an identical fragment file
- [ ] Slice 1 isolation: after Slice 2 indexes, query a Slice 1 node by ID and confirm it is unchanged (no node clobbering, no edge contamination)
- [ ] Pass 1 tolerance: `DESIGN.md` with Pass 2 placeholder comments (`<!-- Pass 2 — ... -->`) extracts cleanly under `--pass 1` flag
- [ ] Manifest gap row preserves `fallback_plan` text from Notes column

---

## 9. Out of scope for Slice 2 (called out so we don't drift)

- Pass 2 token extraction (YAML colors/typography/rounded/spacing/components, Layout/Elevation/Shapes/Components prose) → Slice 3
- Page-spec ingestion → Slice 3
- Decision nodes / contracts / tasks → Slice 4
- Screenshots → Slice 5
- iOS-specific manifest variants (ios-design-board.md is already deprecated; iOS DESIGN.md indexing reuses the same parser) → handled in Slice 1.5

---

## 10. Open redlines for the user

1. **`lint_status` side-channel file path.** `hooks/design-md-lint.ts` currently writes to `docs/plans/build-log.md` as prose. Slice 2 needs a structured side-channel for `graph_query_dna()` to read. Vote: **`.buildanything/graph/lint-status.json`** with `{ status, ran_at, broken_refs, warnings[] }`. Hooks update needed.
2. **Partial DESIGN.md tolerance.** Pass 1 done, Pass 2 not yet — does the indexer succeed on Pass 1 alone? Vote: **yes, tolerant of Pass 2 placeholder comments under `--pass 1` flag**. Re-index without the flag at Step 3.4.idx (Slice 3) for the full token surface.
3. **Fragment file layout.** Should manifest fragments and DESIGN.md fragments be separate JSON files (`.buildanything/graph/slice-2-dna.json` + `.buildanything/graph/slice-2-manifest.json`) or merged into the existing `slice-1.json`? Vote: **separate files per source artifact**, then a merged `graph.json` view assembled at query time. Easier to invalidate one source without nuking the other; matches the indexer's per-file dispatch.
4. **Unnamed slots / duplicate slots.** When the manifest table has anonymous rows (no Slot value) or two rows with the same slot, what wins? Vote: **fail loud on both**. Anonymous rows are author error; duplicate slots violate the "one row per slot" contract in `web-phase-branches.md` Step 3.2.
5. **Synthetic DESIGN.md root node ID.** The `has_axis` edges need a source. Vote: **`design_md__root`** as a typed `entity_type: "design_doc_root"` (new). Lighter than reusing `feature` shape; leaves the door open for Slice 3 to attach token nodes to the same root.
6. **Guideline-to-axis matching strategy.** Right now I propose keyword matching ("font" → `type` axis, "rounded" → no axis match, etc.). This is fragile. Vote: **start with keyword matching, log unmatched guidelines as warnings**, revisit in Slice 4 if the cleanup agent's enforcement misses real cases. Better to ship matched-where-confident than block on perfect coverage.

---

## 11. Logical scenarios — what could go wrong

Pre-implementation thought experiment. Each scenario states the desired behavior and a one-line implementation note.

1. **DESIGN.md Pass 1 written, Pass 2 not yet (the normal mid-build state between Step 3.0 and Step 3.4).** Indexer must succeed on Pass 1 portion alone — emit `dna_axis ×7`, `brand_dna_guideline*`, `brand_reference*` nodes; skip Pass 2 sections that contain only `<!-- Pass 2 — UI Designer ... -->` placeholders.
   *Note:* `--pass 1` flag in the CLI; parser detects placeholder comments by exact-match string and short-circuits per-section.

2. **component-manifest.md written before DESIGN.md (edge case if 3.2 dispatches before 3.0 returns under a future parallelization).** The manifest indexes successfully, emitting `component_manifest_entry*` and `component_slot*` nodes. `dna_governs` edges are deferred — they require the `material` axis, which doesn't exist yet. The DNA index at Step 3.0.idx runs second and back-fills `dna_governs` edges by re-walking existing manifest entries.
   *Note:* Indexer is order-independent; `dna_governs` is a follow-up pass keyed off "is the dna_axis node present? and is at least one component_manifest_entry present?"

3. **Brand Guardian writes 6 axes instead of 7 (Copy axis omitted — the most likely omission since it was added late per `design-md-authoring.md`).** Fail loud. `extractDesignMdPass1` returns `{ ok: false, errors: [{ line: <L>, message: "missing axis: copy" }] }`. Build orchestrator logs warning and BO falls back to file read of DESIGN.md.
   *Note:* Parser checks the 7 axis names against the fixed enumeration; missing axes are listed by name in the error so the dispatch re-prompt to Brand Guardian is precise.

4. **Manifest has duplicate slot names (two "card" rows).** Fail loud per open redline §10.4 vote. Manifest is invalid; orchestrator logs warning and BO falls back to file read.
   *Note:* Detected in `extractComponentManifest` after collecting all rows — last-pass duplicate check on `slot_name` set; cheaper than per-row.

5. **DESIGN.md Pass 1 lint fails (broken-refs).** Per `design-md-authoring.md` §8, broken-refs is a hard fail at the lint gate but the gate runs at Step 3.8 (after Pass 2). At Step 3.0.idx, lint hasn't run yet — the graph fragment is still saved. `graph_query_dna().lint_status` returns `null` until Step 3.8 writes the side-channel.
   *Note:* Indexer does not call the linter; lint_status is purely a side-channel read at query time. Decoupling means lint failures don't block graph writes.

6. **User edits DESIGN.md by hand outside Step 3.0/3.4.** The graph re-indexes on the next build because content SHA changes → cache miss. Mid-build hand edits are not auto-detected (no file watcher); user must re-run the build for the graph to catch up.
   *Note:* SHA256 cache is content-keyed (Slice 1 pattern); freshness is a build-time check, not a runtime invariant. Document this in the user-facing build log so surprise edits don't silently desync from the graph.
