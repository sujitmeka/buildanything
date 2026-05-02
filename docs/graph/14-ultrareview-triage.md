# UltraReview PR #2 — Triage of 12 Confirmed Issues

**Source:** /ultrareview run on 2026-04-30 (12 confirmed, 7 refuted, 36 candidates evaluated)
**Status:** triage complete; fixes pending
**Scope:** Slice 1-5 graph-layer code only.

## Severity legend

- **S1** — silent correctness bug or contract violation; blocks GREEN ship.
- **S2** — heuristic precision issue or spec/impl drift; bounded wrong output.
- **S3** — cosmetic / doc drift.

## Issue table

| # | Sev | File | Lines | Title | Group |
|---|---|---|---|---|---|
| 1 | S1 | src/graph/storage/index.ts | 56-84 | `loadGraph` rejects all slice-2/3/4/5 fragments | A |
| 2 | S1 | bin/graph-index.ts | 99-110 | `graph-index` hard-exits on screenshot extract failure | B |
| 3 | S1 | src/graph/parser/screenshot.ts | 101-226 | `brand_drift_observation` + `dogfood_finding` never emitted | D |
| 4 | S1 | src/graph/parser/page-spec.ts | 318 | `ScreenStateSlot.state_id` is hardcoded placeholder | C |
| 5 | S1 | bin/graph-index.ts | 289-302 | Stale `slice-3-tokens.json` after Pass 2 empties | B |
| 6 | S1 | src/graph/storage/index.ts | 453-461 | `loadAllGraphs` duplicate-id silent overwrite | A |
| 7 | S2 | src/graph/parser/architecture.ts | 234-279, 423-428 | Phantom `feature_provides_endpoint` from heuristic | E |
| 8 | S2 | src/graph/parser/design-md.ts | 250, 311 | `brand_reference` axis substring match → false positives | F |
| 9 | S2 | src/graph/parser/screenshot.ts | 162-183 | Stub data emitted with `EXTRACTED` confidence | D |
| 10 | S2 | src/graph/parser/page-spec.ts | 397 | `prop_overrides` always `""` | C |
| 11 | S2 | src/graph/parser/page-spec.ts | 290-298 | `parseStates` regex captures spurious leading `: ` | C |
| 12 | S3 | src/graph/storage/index.ts | 1057-1080 | `graph_query_brand_drift` description ↔ impl drift | A |

## Fix groupings (one parallel agent per group)

- **Group A — Storage layer:** issues #1, #6, #12 (one file: `storage/index.ts`)
- **Group B — graph-index CLI:** issues #2, #5 (one file: `bin/graph-index.ts`)
- **Group C — page-spec parser:** issues #4, #10, #11 (one file: `parser/page-spec.ts`)
- **Group D — Screenshot extractor:** issues #3, #9 (one file: `parser/screenshot.ts` + indexer hook)
- **Group E — Architecture parser:** issue #7 (one file: `parser/architecture.ts`)
- **Group F — design-md parser:** issue #8 (one file: `parser/design-md.ts`)

All six groups are parallelizable — no shared file ownership.

---

## Per-issue cards

### Issue #1 — `loadGraph` rejects slice-2+ fragments (S1)

- **Cause** — `storage/index.ts:78` hardcodes `schema !== "buildanything-slice-1"`. `loadAllGraphs:440` has the multi-schema check; tests pass only because every test uses `loadAllGraphs`.
- **Fix** — accept all five slice schema strings (mirror line 440); factor `isSupportedSchema`.
- **Test** — hand `loadGraph` a temp project with each slice file in turn; assert non-null.
- **Risk** — verify no consumer filters output by `schema === "buildanything-slice-1"` post-call.

### Issue #2 — graph-index hard-exits on screenshot extract failure (S1)

- **Cause** — `bin/graph-index.ts:109-110` calls `process.exit(1)` per-image. Slice 5 contract is best-effort (schema §11); empty dirs already follow that pattern at `:80-83`.
- **Fix** — replace `process.exit(1)` with stderr warn + `continue`; keep per-image error lines.
- **Test** — directory with one valid image + one zero-byte file; assert `ok` exit, fragment with one node, stderr names the bad file.
- **Risk** — must not silently mask real bugs; always emit error message + path.

### Issue #3 — `brand_drift_observation` + `dogfood_finding` never emitted (S1)

- **Cause** — `parser/screenshot.ts:101-226` only emits `ScreenshotNode` + (reference class) `ImageComponentDetectionNode`. Schema declares both other node types and `screenshot_evidences_finding` / `prod_drifts_from_reference` edges; no parser produces them. `queryBrandDrift` always returns `{observations: []}` (per `13-final-status.md` §3).
- **Fix** — wire side-channel JSON consumption: dogfood writes `findings.json`, brand-guardian writes `drift.json`; CLI reads them after the per-image extract loop and emits matching nodes + edges. ~20 LOC.
- **Test** — fixture `evidence/dogfood/findings.json` with one row; run indexer; assert fragment has `dogfood_finding` node + `screenshot_evidences_finding` edge.
- **Risk** — must validate target IDs (dangling-edge concern is open as `13-final-status.md` Bug #6); coordinate with #9.

### Issue #4 — `ScreenStateSlot.state_id` is a placeholder (S1)

- **Cause** — `parser/page-spec.ts:318` writes `unresolved__state__<screen>__<state>`. Slice 1 state nodes use `ids.state(featureLabel, screenName, stateName)` (different format including feature). FK resolution in `queryScreen({full:true})` never matches; slot is orphaned.
- **Fix** — resolve at load time in `loadAllGraphs` by scanning Slice 1 state nodes for `(screen_id, state_name)` matches.
- **Test** — load slice-1 + slice-3 fragments where slice-1 has matching state; assert resolved `state_id` matches, not placeholder.
- **Risk** — collision when one screen has multiple parent features; schema assumes 1:1, verify before relying.

### Issue #5 — Stale `slice-3-tokens.json` after Pass 2 empties (S1)

- **Cause** — `bin/graph-index.ts:289-302` only writes Pass 2 output when `nodes.length > 0`. Removing Tokens from DESIGN.md leaves the previous fragment; `loadAllGraphs` merges stale tokens with current DNA.
- **Fix** — when Pass 2 returns ok with 0 nodes, `unlinkSync` any existing `slice-3-tokens.json` (best-effort). Same on Pass 2 failure.
- **Test** — index DESIGN.md with tokens; remove Tokens section; re-index; assert `slice-3-tokens.json` is absent.
- **Risk** — concurrent runs; existing atomic write covers it.

### Issue #6 — `loadAllGraphs` duplicate-id silent overwrite (S1)

- **Cause** — `storage/index.ts:456-460` logs duplicate-id, then `nodeMap.set` overwrites. Last-loaded fragment wins; only stderr surfaces it.
- **Fix** — promote duplicate-id from warn to fatal: throw, or return `null`. Recommend throw.
- **Test** — write two fragments with overlapping ids; assert `loadAllGraphs` throws (or returns `null` per chosen contract).
- **Risk** — audit existing fixtures for benign duplicates first; if any, dedupe at parser-emit time before flipping.

### Issue #7 — Phantom `feature_provides_endpoint` from heuristic (S2)

- **Cause** — `parser/architecture.ts:234-245` (path inference) and `:266-279` (module-name match) feed `:423-428`, merging heuristics into `provides`. Generic terms (`discovery`, `users`, `search`) emit dangling `feature__<x> -[provides]-> contract` edges with `EXTRACTED` confidence.
- **Fix** — downgrade heuristic-derived edges to `confidence: INFERRED`; reserve `EXTRACTED` for explicit annotation matches at `:217-232`.
- **Test** — architecture.md with module `Discovery` + contract `GET /search` and no annotation; assert no `feature_provides_endpoint` edge with `EXTRACTED`.
- **Risk** — fixtures may rely on heuristic resolution; audit `tests/graph/architecture-parser.test.ts` first.

### Issue #8 — `brand_reference` axis substring match (S2)

- **Cause** — `parser/design-md.ts:250` and `:311` both use `lower.includes(a)`. "Designscope" matches `scope`; "type-driven" matches `type` even when neither is intended.
- **Fix** — replace with word-boundary regex `new RegExp(\`\\\\b${a}\\\\b\`, "i")` per axis; cache compiled regexes at module top.
- **Test** — fixture brand reference "Designscope" without axis intent; assert `exemplifies_axes` is empty.
- **Risk** — likely none; substring match is too loose to be intentional.

### Issue #9 — Stub data emitted with `EXTRACTED` confidence (S2)

- **Cause** — `parser/screenshot.ts:172, 199` set `confidence: "EXTRACTED"` despite caption + `dna_axis_tags` + `bounding_box` + `detection_confidence` being canned stubs. Comment at `:162-165` acknowledges and defers.
- **Fix** — set `confidence: "INFERRED"` on both nodes while in stub mode; per-field confidence split deferred to Slice 5 production.
- **Test** — extract any image; assert `result.nodes[0].confidence === "INFERRED"`. Update existing screenshot tests.
- **Risk** — verify no consumer filters `screenshot.confidence === "EXTRACTED"` before flipping.

### Issue #10 — `prop_overrides` always `""` (S2)

- **Cause** — `parser/page-spec.ts:397` hardcodes `prop_overrides: ""`. Schema declares it as token-name → value bindings used by `queryScreen({full:true}).tokens_used`; resolution can never fire.
- **Fix** — parse from Component Picks table: dedicated "Prop Overrides" column, OR scan slot cell for `key=value` pairs after stripping slot name.
- **Test** — fixture row `| primary-button | Hero | label="Sign up", variant=cta |`; assert `prop_overrides` parses those bindings.
- **Risk** — schema underspecifies the format; coordinate with `07-slice3-schema.md` before locking syntax.

### Issue #11 — `parseStates` regex captures spurious leading `: ` (S2)

- **Cause** — `parser/page-spec.ts:290`: optional separator group `(?:—|--|-)?` does not include `:`. For `- **idle**: empty form`, alternative 1 matches `**idle**`, separator skips `:`, then `(.*)$` captures `: empty form`. Surfaces only when bold + colon co-occur.
- **Fix** — extend separator to `(?:—|--|-|:)?`.
- **Test** — fixture States bullet `- **idle**: empty form`; assert `appearance_text === "empty form"`.
- **Risk** — minimal; table-form path doesn't use this regex.

### Issue #12 — `graph_query_brand_drift` description ↔ impl drift (S3)

- **Cause** — `storage/index.ts:1070-1080` returns raw `prod_screenshot_id` / `reference_screenshot_id`. MCP tool description at `bin/mcp-servers/graph-mcp.ts:425` claims "resolved inline."
- **Fix** — pick one. Cheap: amend description. Better: inline-resolve by joining `ScreenshotNode` and embedding `image_path` + `caption`. Recommend the latter — LRR Brand chapter wants one round-trip.
- **Test** — call `queryBrandDrift` on a fragment with one observation; assert returned object includes resolved screenshot fields and MCP description matches.
- **Risk** — resolving changes the public response shape; coordinate with any LRR consumer destructuring the current return.

---

## Confirmation status

All 12 root causes confirmed against the cited code. No issues required fix-agent triage extension.

**Severity distribution:** 6 × S1, 5 × S2, 1 × S3. Groups A and C each touch one file with three independent issues — one PR per group.

**Test impact:** all 188 tests pass. Fix work for #6, #7, #9 may require fixture updates; #1 needs new `loadGraph` coverage. Full suite stays green at end of every group's PR.
