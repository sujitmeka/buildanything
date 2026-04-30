# Slice 5 — Schema + Tool Spec

**Date:** 2026-04-26
**Status:** Draft for redline. No code yet.
**Scope:** 3 image classes (design references + brand drift + dogfood) → graph → Brand Guardian + Phase 5.4 routing + Phase 6 LRR Brand chapter.

Slice 5 is **deferred and scoped**. The spec defines the contract — node shapes, edge types, extractor signatures, MCP tool I/O — but actual multimodal subagent dispatches are NOT validatable in a hypothetical environment. Verification of vision-extraction output (captions, DNA-axis tags, component detections) happens only when run against real images via multimodal subagent dispatch. Until then, this document is the contract; implementation can be sketched and unit-tested against fixtures, but integration tests require real images and real subagent responses.

Ground truth: §11 of `docs/graph/03-integration-plan.md` (three image classes, extraction levels, cost model, cache strategy); agents `visual-research` (Step 3.1, design references), `design-brand-guardian` (Phase 5.1, brand-drift screenshots), `testing-evidence-collector` (Phase 5.3, dogfood evidence).

Slice 1-4 nodes are untouched. Slice 5 extends `entity_type` and `relation` enums, adds one class-aware extractor, and ships three new MCP tools.

---

## 1. Node types (extends Slice 4's `entity_type` enum)

Slice 5 adds four entity types. Existing Slice 1/2/3/4 nodes are untouched.

| `entity_type` | Source | One per | Key fields |
|---|---|---|---|
| `screenshot` | Any of the three image directories (`docs/plans/design-references/`, `evidence/brand-drift/`, `evidence/dogfood/screenshots/`) | image file | `id`, `label`, `image_path` (relative to repo root), `image_class: "reference" \| "brand_drift" \| "dogfood"`, `caption` (one-line description from Claude's native multimodal capabilities), `perceptual_hash` (string, 64-bit dHash hex), `dominant_palette` (string[] — up to 5 hex colors), `image_dimensions` (string, e.g. `"1280x720"`), `dna_axis_tags` (string[] — DNA axes this image exemplifies), `linked_screen_id` (string \| null — FK to Slice 1 `screen` for brand_drift + dogfood), `linked_finding_id` (string \| null — FK to `dogfood_finding` for evidence) |
| `image_component_detection` | Multimodal subagent extraction on design-reference images only (brand_drift + dogfood skip this) | detected component within a reference image | `id`, `label`, `screenshot_id`, `component_label` (e.g. `"hero"`, `"card"`, `"modal"`), `bounding_box` (string, optional — e.g. `"x:120,y:80,w:400,h:200"`), `confidence` (float, optional, 0-1) |
| `dogfood_finding` | Dogfood evidence collector output at Phase 5.3 | finding | `id`, `label`, `finding_id`, `severity: "critical" \| "major" \| "minor"`, `description`, `screenshot_id` (FK), `affected_screen_id` (string \| null) |
| `brand_drift_observation` | Brand Guardian comparison output at Phase 5.1 | (prod_screenshot, reference_screenshot, axis) tuple | `id`, `label`, `observation_id`, `prod_screenshot_id`, `reference_screenshot_id`, `axis` (one of the 7 DNA axes), `score` (number, 0-1), `verdict: "drift" \| "ok" \| "needs-review"`, `notes` (string, optional) |

All nodes inherit Slice 1's required base fields: `id`, `label`, `source_file`, `source_location`, `confidence`.

For `screenshot` nodes: `source_file` is the image path itself; `source_location` is `"L0"` (binary file — no line number). Confidence: `EXTRACTED` for hash + dimensions + palette (deterministic byte-level computation); `INFERRED` for caption + dna_axis_tags + component detections (vision is non-deterministic).

---

## 2. Edge types

Extend Slice 4's `relation` enum.

| Relation | From → To | Cardinality | Source |
|---|---|---|---|
| `references_axis_image` | screenshot (image_class=reference) → dna_axis | N:N | Vision-extraction `dna_axis_tags`. NOTE: intentionally distinct from `references_axis` (Slice 2) which fires on textual `brand_reference` nodes. |
| `screenshot_depicts_screen` | screenshot → screen | N:1 | Filename or evidence directory naming convention (kebab match). |
| `screenshot_evidences_finding` | screenshot → dogfood_finding | 1:1 | Dogfood agent output linking screenshot path to finding. |
| `image_has_component_detection` | screenshot → image_component_detection | 1:N | Vision extraction for design references only. |
| `prod_drifts_from_reference` | brand_drift_observation → screenshot (×2: emits two edges, one to `prod_screenshot_id` and one to `reference_screenshot_id`) | 1:1 each | Brand Guardian comparison output. |
| `similar_to_image` | screenshot → screenshot | N:N | Perceptual-hash distance under threshold (default Hamming distance ≤ 10 of 64). Confidence: `INFERRED` — the only Slice 5 edge marked INFERRED. |

All other Slice 5 edges are `EXTRACTED` confidence.

**Edge schema additions (forward-compat, same pattern as Slice 1-4):**

| Field | Required | Notes |
|---|---|---|
| `produced_by_agent` | optional | `"visual-research"` for design refs, `"design-brand-guardian"` for brand drift, `"testing-evidence-collector"` for dogfood. |
| `produced_at_step` | optional | `"3.1"`, `"5.1"`, `"5.3"`. |

---

## 3. ID generation rules

Stable across re-runs. Content-hashed for image stability across rename.

- **screenshot**: `screenshot__{kebab(basename(path))}__{sha256_8(file_content)}` → `screenshot__pricing-hero__a3f1b2c8`. SHA256 is over the image bytes (not the path) so that a renamed image keeps the same ID; a re-cropped image gets a new ID.
- **image_component_detection**: `image_component_detection__{screenshot_id}__{kebab(component_label)}__{order}` → `image_component_detection__screenshot__pricing-hero__a3f1b2c8__hero__1`
- **dogfood_finding**: `dogfood_finding__{kebab(finding_id)}` → `dogfood_finding__f-001`
- **brand_drift_observation**: `brand_drift_observation__{kebab(observation_id)}` → `brand_drift_observation__bdo-001`

No perceptual-hash-based IDs. Perceptual hash is a queryable field, not an identifier — same image can produce different hashes after re-encoding (lossy format round-trips shift bits). SHA256 of raw bytes is the identity anchor.

---

## 4. Extractor mapping

Single extractor file with class-aware dispatch: `src/graph/parser/screenshot.ts`. Rationale: the parsing surface differs by class but the node shape is shared — one file keeps the class-dispatch logic co-located instead of scattered across three parsers.

```ts
export function extractScreenshot(
  imagePath: string,
  imageClass: "reference" | "brand_drift" | "dogfood",
  sideChannel?: { caption?: string; dna_axis_tags?: string[]; dominant_palette?: string[]; component_detections?: ComponentDetection[] }
): ExtractResult {
  // The CLI is deterministic. Two inputs:
  //   (a) image bytes — for SHA256 (ID + cache key), dHash perceptual hash, and image dimensions
  //   (b) side-channel JSON (optional) — pre-extracted vision metadata produced by the
  //       `screenshot-extractor` subagent dispatched at the orchestrator layer BEFORE the CLI runs
  //
  // 1. Compute SHA256 of image bytes — used as cache key + ID suffix
  // 2. Compute dHash perceptual hash (64-bit, hand-rolled per §10 redline 2)
  // 3. Compute image dimensions from header bytes (no external deps; PNG/JPEG/WebP minimal parsers)
  // 4. If sideChannel is present, populate caption / dna_axis_tags / dominant_palette /
  //    component detections from it (class-shaped — reference: full, brand_drift: lite, dogfood: caption only).
  //    If absent (Slice 5 stub mode, or vision extraction has not run yet), use stub/null values per the existing stub.
  // 5. Emit screenshot node + edges per class
  // Returns ExtractResult — synchronous; no Claude calls from this process.
}
```

**dHash algorithm:** convert to grayscale → resize to 9×8 → for each row, compare adjacent pixels → output 64 bits → hex-encode. Hand-rolled in pure TypeScript (~50 LOC, no new dependency) per §10 redline 2 vote.

**Failure modes** (each a hard-fail unless noted):
- File not found → fail loud
- Unsupported image format → fail loud, list supported formats (PNG, JPEG, WebP)
- Subagent timeout / model overload / context-window exhaustion → retry with exponential backoff (max 3); on final failure, the side-channel JSON omits that image and the indexer emits a screenshot node WITHOUT extraction-derived fields, warning (per §11 scenario 2). **Not a hard-fail** — degrade per-image. The orchestrator's existing subagent retry logic covers the dispatch-level retries; the indexer's job is to handle a partial side-channel cleanly. Note: subagent dispatches bill the user's Claude credits — the cost-budget concern in §10 redline 3 is about token usage.
- Subagent content-policy refusal → emit node without caption + dna_axis_tags, warn — do NOT fail loud (blocking the build over a single image is wrong)

**Warnings** (non-fatal):
- File extension doesn't match content (e.g. `.jpg` extension on a PNG) → warn, dispatch by content-sniff result
- Image dimensions wildly out of range (>10000px or <50px any axis) → warn, still extract

**THE BIG IDEA:** This slice REQUIRES a multimodal model call (Claude's native multimodal capabilities, dispatched via a subagent). Slice 5 indexer is therefore NOT pure deterministic. The extraction path can produce slightly different captions / tags across runs (tested with temperature=0 the variance is small but nonzero). Cache (SHA256-keyed) is the determinism backstop — once cached, subsequent runs return the same fragment. First-extraction non-determinism is accepted as a Slice 5 trade. Every prior slice was deterministic; Slice 5 breaks that invariant by design.

**Production-mode architecture.** The CLI stays fully deterministic (raw byte parsing, dHash on file bytes, no Claude calls). The vision-driven extraction (caption, dna_axis_tags, dominant_palette, component detection) happens at the **orchestrator layer**, where a `screenshot-extractor` subagent is dispatched with the image path attached as multimodal input, and writes a side-channel JSON file (e.g. `evidence/dogfood/extractions.json`). The indexer then reads that JSON alongside the raw image bytes when emitting screenshot graph nodes. Same architecture as `hooks/design-md-lint.ts` writing `lint-status.json` for `graph_query_dna` to consume — no Claude calls from the Node process, no API key, no auth question.

**CLI dispatch:** `bin/graph-index.ts <directory> [--image-class=<class>]`. When `--image-class` is omitted, the CLI infers from path conventions: `design-references/` → reference, `evidence/brand-drift/` → brand_drift, `evidence/dogfood/` → dogfood. Unknown directory → fail loud.

---

## 5. MCP tool specs

Three new tools. JSON in/out, same convention as Slice 1-4's `graph_query_*` family.

### `graph_query_screenshot`

Input: `{ "id": "screenshot__..." }`. Output: full screenshot node fields + linked screen + linked finding + linked brand_drift_observations.

```json
{
  "name": "graph_query_screenshot",
  "input": { "id": "screenshot__pricing-hero__a3f1b2c8" },
  "output": {
    "screenshot": {
      "id": "screenshot__pricing-hero__a3f1b2c8",
      "image_path": "evidence/brand-drift/pricing.png",
      "image_class": "brand_drift",
      "caption": "Pricing page hero with three-tier card layout",
      "perceptual_hash": "ff00ee11aa22bb33",
      "dominant_palette": ["#FFFFFF", "#0F172A", "#3B82F6"],
      "image_dimensions": "1440x900",
      "dna_axis_tags": ["material", "density"],
      "linked_screen_id": "screen__pricing",
      "linked_finding_id": null
    },
    "linked_screen": { "id": "screen__pricing", "label": "Pricing" },
    "linked_finding": null,
    "brand_drift_observations": [
      {
        "id": "brand_drift_observation__bdo-001",
        "axis": "material",
        "score": 0.62,
        "verdict": "drift",
        "reference_screenshot_id": "screenshot__stripe-pricing__9e2a55b1"
      }
    ]
  }
}
```

### `graph_query_similar`

Input: `{ "image_path_or_id": "...", "threshold": 10 }` (Hamming distance threshold, default 10). Output: screenshots whose perceptual_hash falls within threshold.

```json
{
  "name": "graph_query_similar",
  "input": { "image_path_or_id": "evidence/brand-drift/pricing.png", "threshold": 10 },
  "output": {
    "input_hash": "ff00ee11aa22bb33",
    "matches": [
      { "screenshot_id": "screenshot__stripe-pricing__9e2a55b1", "image_path": "docs/plans/design-references/competitors/stripe-pricing.png", "image_class": "reference", "hamming_distance": 4, "dna_axis_tags": ["material", "density"] },
      { "screenshot_id": "screenshot__linear-pricing__7c9d11f4", "image_path": "docs/plans/design-references/competitors/linear-pricing.png", "image_class": "reference", "hamming_distance": 8, "dna_axis_tags": ["character", "type"] }
    ]
  }
}
```

When input is an image_path that is NOT yet indexed, the tool computes its hash on the fly (no node emitted) and runs the comparison — useful for ad-hoc Brand Guardian queries on new captures.

### `graph_query_brand_drift`

Input: `{}` (no params). Output: all brand_drift_observation nodes with verdicts, sorted by descending score.

```json
{
  "name": "graph_query_brand_drift",
  "input": {},
  "output": {
    "observations": [
      {
        "id": "brand_drift_observation__bdo-001",
        "prod_screenshot": { "id": "screenshot__pricing__a1b2c3d4", "image_path": "evidence/brand-drift/pricing.png" },
        "reference_screenshot": { "id": "screenshot__stripe-pricing__9e2a55b1", "image_path": "docs/plans/design-references/competitors/stripe-pricing.png" },
        "axis": "material",
        "score": 0.62,
        "verdict": "drift",
        "notes": "Prod uses gradient surfaces; reference is flat"
      }
    ]
  }
}
```

---

## 6. Consumer integration

### 6.1 Brand Guardian (Phase 5.1, brand-drift mode)

At Phase 5.1, the Brand Guardian captures prod screenshots for top N screens (N=10 by default), then for each:

1. Calls `graph_query_similar(prod_image_path)` with class filter `image_class=reference` to find matching design references
2. For each (prod, reference) pair within threshold, scores drift on each DNA axis the reference exemplifies
3. Emits one `brand_drift_observation` per (prod_screenshot, reference_screenshot, axis) tuple via the indexer
4. Slice 5 stores the observations; the verdict feeds Phase 6 LRR Brand chapter

### 6.2 Phase 6 LRR Brand chapter

The LRR Brand chapter aggregator queries `graph_query_brand_drift()` once at compile time. Drift observations with `verdict: "drift"` become Brand chapter findings — same finding shape as the existing prose-grep flow but now backed by a graph walk. No paraphrase: reference screenshot path + axis name + score appear verbatim in the chapter.

### 6.3 Feedback synthesizer (Phase 5.4)

For dogfood findings emitted by `testing-evidence-collector`, the synthesizer calls `graph_query_screenshot(screenshot_id)` to resolve the linked screen → owning feature → owning task. Replaces the current grep-based screen-id heuristic with a deterministic graph walk. Same fallback pattern as Slice 4 — graph unavailable → file-read of evidence index.

---

## 7. Indexer triggers

Three triggers — same best-effort pattern as Slice 1-4 (log on failure, do NOT block).

### Step 3.1.idx — Design references

After `visual-research` returns and `docs/plans/design-references/` has images:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/design-references/ --image-class=reference`
- On exit 0: log success, write `slice-5-references.json`. On non-zero: warn and continue.
- Token budget per build (≤200K tokens, per §10 redline 3): the indexer aborts and warns if it would exceed the cap; partial fragment is written for the images extracted before the cap hit.

### Step 5.1.idx — Brand drift

After `design-brand-guardian` (drift-check mode) writes brand-drift screenshots to `evidence/brand-drift/`:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js evidence/brand-drift/ --image-class=brand_drift`
- Vision-extraction lite (caption + DNA tags only, skip palette + components for cost).
- Brand Guardian's observation emission happens AFTER indexing, since it needs `graph_query_similar` to find matching references. Order: index → query similar → emit observations → re-index (incremental).

### Step 5.3.idx — Dogfood evidence

After `testing-evidence-collector` writes findings + screenshots:

- Command: `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js evidence/dogfood/screenshots/ --image-class=dogfood`
- Cheapest path — caption only, no DNA tagging.
- Findings are linked to screenshots via the agent's output index file (`evidence/dogfood/findings.json` mapping finding_id → screenshot_path). The indexer reads this side-channel to emit `screenshot_evidences_finding` edges.

CLI dispatch: extend `bin/graph-index.ts` to accept image directories and an optional `--image-class` flag. SHA256 cache (image-byte-keyed) prevents re-extraction across runs.

---

## 8. Validation checklist (before merging to main)

- [ ] Schema-validation tests for each new node type (`screenshot`, `image_component_detection`, `dogfood_finding`, `brand_drift_observation`) — valid + invalid fixtures
- [ ] Idempotent indexing: running the same image directory twice produces an identical fragment file (vision-cache hit on second run)
- [ ] Perceptual hash determinism: same bytes → same dHash hex, byte-identical
- [ ] Cache portability: SHA256 cache keyed on image bytes works across machines (no path leakage in the key)
- [ ] Subagent failure handling: simulate timeout / model-overload / context-window-exhaustion → indexer emits screenshot nodes without extraction-derived fields, warns to build-log, does NOT fail the whole batch
- [ ] Subagent content-policy refusal handling: same partial-emit path, warned distinctly
- [ ] Token-budget cap test: synthesize a 200-image fixture → indexer aborts at the cap, partial fragment intact
- [ ] Slice 1-4 nodes untouched after Slice 5 indexes (no clobbering, no edge contamination)
- [ ] `graph_query_similar` with a non-indexed image path → on-the-fly hash compare succeeds, no node emitted
- [ ] Brand drift observation linking: emit a synthetic prod + reference pair with known DNA axis → `prod_drifts_from_reference` resolves both endpoints

---

## 9. Out of scope for Slice 5 (called out so we don't drift)

- Per-task verify screenshots (`evidence/[task-name]/*`) — path-only, no extraction
- Critic-loop interim renders — perceptual hash cache catches dups for free, no node emission
- LLM-extracted UX patterns from screenshots (e.g. "this layout uses a sidebar nav") → defer to Slice 6 if needed
- Video frame extraction → out of scope; only static images
- iOS-specific simulator screenshots → defer to Phase B; same parser will handle them once iOS shipping path is unblocked
- Real-time drift monitoring (re-screenshot prod on a schedule) → orchestrator concern, not a graph schema concern

---

## 10. Open redlines for the user

1. **Vision extraction ordering at the orchestrator.** The `screenshot-extractor` subagent runs in its own context and produces the side-channel JSON before the CLI runs. Should the orchestrator dispatch the subagent concurrently with image-class indexing, or sequentially? Vote: **sequential for simplicity** — orchestrator dispatches the subagent first, waits for the side-channel JSON, then runs the indexer. The best-effort indexer pattern means a missing or partial side-channel does not block the build; the indexer falls back to stub/null values per §4. This is not a "vision API integration" question — it is an orchestration-ordering question.

2. **Perceptual hash library vs hand-rolled.** Add a dep (e.g. `image-hash` npm package) or hand-roll dHash in pure TS? Vote: **hand-rolled.** dHash is ~50 LOC; a new dependency for 50 LOC of well-known math is the wrong trade. The ~50 LOC also removes a supply-chain attack surface.

3. **Extraction cost budget.** Cap per build at 200K tokens (~5% of post-graph total per `03-integration-plan.md`). What happens when a build's image set would exceed? Vote: **abort + partial fragment + warn.** Continuing to extract past the cap silently is worse than skipping the tail; the partial fragment lets `graph_query_*` succeed on the extracted subset.

4. **iOS support.** Defer to Phase B per CLAUDE.md, same as Slices 2-4. Vote: **defer.** Same parser will handle iOS simulator captures once the iOS pipeline is unblocked.

5. **Image storage.** Store image bytes inside the graph fragment, or keep paths-only and leave bytes on disk? Vote: **paths-only.** Graph stores metadata (hash, dimensions, palette, caption, tags); actual image bytes stay in the source directories. Loading bytes into the graph would 100×-1000× the fragment file size with zero query benefit.

6. **PII redaction in captions.** Captions are LLM-generated and could surface email addresses, names, or other PII visible in screenshots. Should we run captions through a redaction filter before persisting? Vote: **yes — pass captions through a regex-based redaction pass** (emails, phone numbers, common ID patterns). Cheap; the alternative is shipping a graph fragment with leaked PII into a committed repo. The redaction is conservative (over-redacts rather than under-redacts) and logged so a human can review.

---

## 11. Logical scenarios — what could go wrong

1. **Design references directory empty.** `docs/plans/design-references/` has no images (e.g., `visual-research` skipped). Indexer emits `slice-5-references.json` with `nodes: []`, `edges: []`. `graph_query_similar` returns `{ matches: [] }` for any query against this class. Build does NOT fail.
   *Note:* Same empty-directory-vs-missing-directory distinction as Slice 3 page-specs.

2. **Subagent fails for one image (timeout, model overload, or context-window exhaustion) mid-batch.** The orchestrator-side subagent retries 3× with exponential backoff. On final failure, the side-channel JSON omits that image. The indexer reads the partial side-channel and emits the screenshot node WITHOUT extraction-derived fields (no caption, no DNA tags, no palette, no component detections) — only structural fields (id, path, dimensions, perceptual_hash). Logs warning to build-log. Other images in the batch proceed normally.
   *Note:* Don't fail the entire batch over one image; degrade per-image. Re-running the indexer hits the cache for successful images and retries the failed ones.

3. **Two design references have identical content (duplicate file).** SHA256 of bytes matches → cache returns same extraction. Indexer detects duplicate before vision call, emits two `screenshot` nodes (different paths, identical perceptual_hash) AND a `similar_to_image` edge between them with `hamming_distance: 0`.
   *Note:* Don't dedupe to a single node — paths differ; downstream consumers may want to know both exist.

4. **Brand-drift screenshot for `/pricing` taken at runtime; references include a Stripe pricing capture tagged Material=Flat.** `graph_query_similar(/pricing prod path, threshold=10)` returns the Stripe ref with hamming_distance=4. Brand Guardian compares them on the Material axis, scores 0.62 (below the 0.75 fidelity threshold), emits `brand_drift_observation` with `verdict: "drift"`. LRR Brand chapter at Phase 6 picks this up via `graph_query_brand_drift()`.
   *Note:* The 0.75 fidelity threshold is configurable in Brand Guardian's prompt — Slice 5 just stores the score and verdict.

5. **Dogfood finding linked to a screenshot, finding later resolved in a Phase 5.4 fix wave.** The screenshot stays in the graph forever (append-only, same as decisions). The orchestrator marks the finding as resolved separately (status field on `dogfood_finding`); the screenshot's `linked_finding_id` doesn't change. Audit trail intact.
   *Note:* No cascade-delete. Resolved findings + their evidence remain queryable for retrospectives.

6. **User hand-edits an image file mid-build (e.g., re-crops a competitor screenshot).** SHA256 of bytes changes → cache miss → re-vision-extract on next index run. Old screenshot node's ID changes (because ID embeds SHA256_8). Old node is orphaned in the fragment until next full re-index drops it. Edges referencing the old ID dangle in the interim.
   *Note:* Same SHA256-cache freshness contract as Slices 1-4. Hand-editing source files mid-build is a user pattern the graph cannot fully track without a file watcher; full re-index on resume backfills.
