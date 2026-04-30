# Slice 3 — Logical Evaluation (Hypothetical Build Walkthrough)

**Date:** 2026-04-26
**Status:** Pre-implementation thought experiment. No code run.
**Scope:** Trace what would happen during a real `/build` now that Slice 3 parsers (`page-spec.ts`, `design-md-pass2.ts`), `queryScreenFull`, and `queryToken` exist — and surface wiring gaps the schema doc papers over.

**Update 2026-04-26 (post-verification).** Bugs #1 and #2 in the appendix below were drafted while the MCP+CLI wiring subagent was still in flight. End-to-end smoke run after that subagent shipped confirms BOTH are fixed in current code: `bin/graph-index.ts` handles directory paths (lines 24-76) and dispatches `extractDesignMdTokens` on `DESIGN.md` (lines 122-135); `web-phase-branches.md` has Step 3.4.idx at line 192. The walkthroughs in §1 and §3 reflect the stale pre-fix state and are kept as historical record of the failure mode that motivated the fix; treat the §1 T+12 / T+18 / §3 Step 3.4 claims as superseded. Bugs #3, #4, #5, #6 remain real.

Paired with `docs/graph/07-slice3-schema.md` §11. §11 enumerates parser-level failure modes; this file traces a pipeline run and identifies windows where downstream consumers query data that hasn't been indexed, plus issues found by reading the actual code.

---

## 1. Walkthrough — happy path through Phase 3 + into Phase 4

A web fintech build, marketplace flavour. Slice 1 + 2 indexers assumed wired (per Slice 2 eval bugs #2). Timeline:

- **T+0 (Step 1.6.idx).** `product-spec-writer` returns; orchestrator runs `bin/graph-index.js docs/plans/product-spec.md`; `bin/graph-index.ts:21-23` dispatches to `extractProductSpec` and writes `slice-1.json`. **Queryable:** `graph_query_feature/screen/acceptance`. `graph_query_dna` and `graph_query_manifest` still null.
- **T+5 (Step 3.0.idx).** `design-brand-guardian` writes `DESIGN.md` Pass 1 placeholders. Orchestrator runs `graph-index.js DESIGN.md`; `bin/graph-index.ts:24-26` dispatches to `extractDesignMd` (Pass 1) → `slice-2-dna.json`. **Queryable:** `graph_query_dna()` returns `pass_complete: { pass1: true, pass2: false }`.
- **T+10 (Step 3.2.idx).** `design-ui-designer` writes manifest. `slice-2-manifest.json` written. `graph_query_manifest` works.
- **T+12 (Step 3.3.idx — `web-phase-branches.md:156`).** `design-ux-architect` returns. Orchestrator runs `graph-index.js docs/plans/page-specs/`. **GAP:** `bin/graph-index.ts:9-12` reads `process.argv[2]` and calls `readFileSync(mdPath)` to verify existence. Passing a directory makes `readFileSync` throw `EISDIR` and the CLI exits 64. **`slice-3-pages.json` is never produced.** Bug #1 below.
- **T+18 (Step 3.4 ends).** `design-ui-designer` writes Pass 2 (YAML tokens + prose). Web-phase-branches.md has NO Step 3.4.idx block — cf. lines 173-190. **`slice-3-tokens.json` is never produced.** Bug #2 below.
- **T+25 (Step 4.2.a — BO assembly).** BO calls `graph_query_screen(screen_id, full: true)` per `briefing-officer.md:32` and `:74`. In `storage/index.ts:545-665`, `queryScreenFull` runs against the merged graph. Because Step 3.3.idx and Step 3.4.idx didn't fire, no `page_spec` node exists in the merged graph: `storage/index.ts:568-584` returns the screen with `page_spec: null`, empty arrays for sections / state slots / component_uses / key_copy / tokens_used. BO's fallback at `briefing-officer.md:74` triggers: file-read of `docs/plans/page-specs/<screen>.md` plus manual manifest join. Brief still assembles, but every Slice 3 token-saving path collapses.
- **T+30 (Step 4.2.b.1 — implementer).** Implementer queries `graph_query_token("colors.primary")` per `briefing-officer.md:36`. `queryToken` (`storage/index.ts:492-517`) walks the merged graph. No token nodes → returns `null`. Implementer falls back to file-read of DESIGN.md or — per `agents/engineering-frontend-developer.md` — has no instruction to call this tool at all (see §10).

**Consumer-window verdict.** Even if the CLI bugs were fixed, the BO brief would arrive at T+25 carrying full structured wireframe data and the implementer would resolve tokens at T+30. Neither needs data from a step that hasn't run yet. The ordering is correct; the wiring is broken.

---

## 2. Walkthrough — token resolution at implementer time

Bugs #1+#2 patched: `slice-3-tokens.json` carries `colors.primary`, `spacing.lg`, etc. Implementer receives a brief listing `Tokens: colors.primary, spacing.lg` per `briefing-officer.md:130`. Calls `graph_query_token("colors.primary")` and resolves to `#0F172A`.

- **Token name doesn't exist.** `storage/index.ts:492-496` does `graph.nodes.find(n => n.entity_type === "token" && n.name === name)`; on miss returns `null`. The implementer prompt SHOULD instruct: on null, fall back to file-read of `DESIGN.md`. No implementer prompt mentions this — Bug #4.
- **Pass 2 not yet indexed.** Same null result, same fallback. Schema §11.3.
- **`axis_provenance` is null.** `queryToken` returns the field as-is (`storage/index.ts:506-516`). Implementers don't care about provenance unless validating DNA conformance — Slice 4 cleanup territory. `null` for `component`-layer tokens (`design-md-pass2.ts:84-86`) is correct and lossless.
- **Dot-form vs flat name.** `colors.primary` is the literal `TokenNode.name` (`design-md-pass2.ts:151`); `queryToken` matches by string. `queryToken("primary")` returns `null`. The BO brief MUST list the full dot-form name verbatim — `briefing-officer.md:148`'s verbatim rule covers this.

---

## 3. Walkthrough — re-entry from Phase 6 BLOCK

Phase 6 LRR routes a BLOCK back to Phase 3 (re-lock DNA — Density was wrong for the persona). Re-entry at Step 3.0 per `web-phase-branches.md:43-44`. The rerun cascade:

- **Step 3.0 → 3.0.idx.** `DESIGN.md` Pass 1 rewritten. `graph-index.js DESIGN.md` re-runs `extractDesignMd` (Pass 1 only — `bin/graph-index.ts:24-26` does not call `extractDesignMdTokens`). `slice-2-dna.json` overwritten via `saveGraph`'s atomic tmp+rename (`storage/index.ts:84-107`). `slice-3-tokens.json` is NOT re-derived at this point — the CLI never invoked the Pass 2 extractor.
- **Step 3.2 → 3.2.idx (manifest).** Manifest may be re-written; Slice 2 fragment overwritten.
- **Step 3.3 → 3.3.idx (page-specs).** Re-rewrites page-specs; with bug #1 fixed, `slice-3-pages.json` overwritten wholesale.
- **Step 3.4.** Pass 2 rewritten. Without Step 3.4.idx block (`web-phase-branches.md:173-190`), Pass 2 never re-indexes. **Stale token data risk:** if the prior build had Pass 2 indexed (somehow — manual invocation), the new Pass 1 may rename axis values but Pass 2 token nodes remain from prior pass. `loadAllGraphs` (`storage/index.ts:438-453`) does NOT detect this drift; it just unions nodes by ID with a duplicate-warning. The orchestrator overwrites only what `bin/graph-index.ts` is told to overwrite.

**Cross-fragment edge silent breakage.** `screen_uses_token` is documented in schema §2 but the page-spec parser DOES NOT emit it — `parser/page-spec.ts:364-402` only emits `slot_used_on_screen`, no token-use edges. Token resolution happens at query time inside `queryScreenFull` (`storage/index.ts:627-648`) by regex-matching `prop_overrides` strings. So if Step 3.4 re-runs and renames `colors.primary` → `colors.primary-default`, page-specs that say `colors.primary` in `prop_overrides` keep working only if the new token also uses that name. If the rename is breaking, `tokens_used` silently shrinks; nothing flags the drift. Document this for Slice 4: a startup-time validator that joins page-spec `prop_overrides` token references against `slice-3-tokens.json` names, warns on misses.

---

## 4. Multi-screen flows + slice consistency

Slice 1's "Checkout (3 screens)" splits into three `screen__*` nodes (cart-review, checkout-payment, checkout-confirmation). Slice 3 expects three page-spec files; each emits one `page_spec` node via `parser/page-spec.ts:466-477`.

The naming chain depends on `kebab(screenName)` agreement across sources:

- Slice 1's screen ID: `ids.screen(name)` (`ids.ts:36`) — name from product-spec Screen Inventory.
- Slice 3's page_spec_id: `ids.pageSpec(screenName)` (`ids.ts:63-64`) — name from page-spec h1 `# Page: <Screen Name>` (`parser/page-spec.ts:414-420`).
- Back-pointer `screen_id`: `ids.screen(screenName)` from the SAME h1 (`parser/page-spec.ts:421`).

If h1 says `Cart Review` and Slice 1 says `Cart Review`, both kebab to `cart-review`. Chain works.

**Divergence risks.** Page-spec h1 `Cart Review Page` kebabs to `cart-review-page`; Slice 1's `Cart Review` is `cart-review`. **Mismatch.** `queryScreenFull` (`storage/index.ts:568-584`) finds no `page_spec` for `screen__cart-review`; returns `page_spec: null`; BO falls back. Schema §11.2 promised "warn at index time" but `parser/page-spec.ts` does NOT cross-reference Slice 1 — Bug #3.

**Recommendation:** post-process validator in `bin/graph-index.ts` that loads `slice-1.json` after writing `slice-3-pages.json` and warns per orphan. Out of pure-parser scope; orchestrator concern.

---

## 5. iOS asymmetry (correction to original prompt)

The prompt assumed iOS lacks page-specs. Wrong. Reading `ios-phase-branches.md`:

- **iOS HAS page-specs.** Step 3.3-ios at line 186 dispatches `design-ux-architect` to write `docs/plans/page-specs/*.md` per `protocols/page-spec-schema.md` §9.5 (iOS conventions). `extractPageSpec` is platform-agnostic — runs the same on iOS — IF the indexer fires.
- **iOS Step 3.3.idx missing.** `ios-phase-branches.md` defines Step 3.0.idx only (line 183). Combined with bug #1, iOS page-specs never index. Bug #5.
- **iOS has tokens.** Step 3.2-ios at line 185 writes Pass 2 with iOS-flavoured YAML. `extractDesignMdTokens` is platform-agnostic. Step 3.4.idx-ios absent. Bug #5.
- **iOS has NO component-manifest.md.** Per Slice 2 eval §5. `queryScreenFull` (`storage/index.ts:596-620`) returns `component_use` rows without `manifest_entry` field on iOS. Schema §11.5 anticipates this; the omission (rather than null) is correct.

**For BO on iOS:** `graph_query_screen(full: true)` returns sections + state slots + component_uses (no manifest entries) + key copy + tokens used. Absent `manifest_entry` is expected, not a fallback trigger. Implementer uses SwiftUI standard library + DESIGN.md `## Components` token names directly. The Slice 2 eval already called for documenting this in `briefing-officer.md` — still pending.

---

## 6. Token name conflicts and the alias problem

YAML key conflicts handled deterministically by `design-md-pass2.ts:119-178`:

- `colors: { primary: "#000" }` flattens to name `colors.primary` (`design-md-pass2.ts:149-153`). A top-level `primary: "#FFF"` flattens to `primary` only (`:170-174`). Different `name` strings → different IDs via `ids.token(layer, name)` (`ids.ts:61-62`). No graph collision.
- `queryToken("primary")` returns the top-level one; `queryToken("colors.primary")` returns the nested. Implementer uses the exact name BO listed. Verbatim discipline handles drift.
- Alias semantics (`{colors.primary-hover}` → `{colors.primary}.darken(10)`) NOT supported in Slice 3. Parser stores raw values; aliases just produce additional token nodes. No data loss.

**Hash-collision risk.** Two names that kebab to the same string (e.g. `colors.primary-hover` and `colors-primary-hover`) collide on `id` because `ids.token` uses `kebab(name)`. `loadAllGraphs` (`storage/index.ts:447-450`) logs cross-fragment duplicates to stderr; intra-fragment duplicates produce two array entries with the same ID, and `queryToken` returns the first `.find()` hit — non-deterministic across rebuilds if YAML key ordering changed. Slice 4 extraction-time validator territory. Document.

---

## 7. Page-spec wireframe ASCII drift

Schema §11.5 anticipates "page-spec wireframe ASCII uses a slot name not in the manifest." Parser behavior is partial:

- `parseComponentPicks` (`parser/page-spec.ts:364-402`) emits `screen_component_use` nodes ONLY for entries in `## Component Picks` or `## Content Hierarchy` tables (checks `slot`/`manifest slot` columns, line 373). ASCII wireframe labels become `wireframe_section` nodes via `parseWireframe` (`:185-247`), NOT component_use nodes.
- A wireframe labeled `[Submit Button]` with no Component Picks row produces a section node but no component_use. `queryScreenFull` returns the section in `sections[]` with empty `component_uses`. Implementer sees the label, has no manifest entry, falls back to "sensible default" — Slice 0 from-scratch drift.
- **Step 3.3b (UX Flow Validation, `web-phase-branches.md:160-168`) does NOT cover this.** It validates flows against persona, not slot coverage against manifest.

**Mitigation:** strengthen Step 3.3 prompt to require every `[<slot>]` wireframe label to have a Component Picks row, OR a Slice 3.5 hook that diffs wireframe labels against manifest slots. Slice 4 cleanup agent catches it at code-review time — acceptable to defer.

---

## 8. Token usage resolution accuracy

`queryScreenFull`'s `tokens_used` extraction (`storage/index.ts:627-648`) uses two regex passes against `prop_overrides` strings:

- `bracedRe = /\{([a-z][a-zA-Z0-9._-]*)\}/g` — captures `{colors.primary}`, `{spacing.lg}`.
- `prefixRe = /\btokens\.([a-z][a-zA-Z0-9._-]*)/g` — captures `tokens.colors.primary` style.

**Limitations:**

- Tokens referenced in plain prose (e.g. `prop_overrides: "primary brand color, large gap"`) are NOT detected. The regex requires explicit `{...}` or `tokens.<name>` syntax.
- Tokens used implicitly (component variant defaults) are NOT in the list. The page-spec parser stores `prop_overrides: ""` for entries that don't include explicit overrides (`parser/page-spec.ts:397`); the regex finds nothing.
- Tokens referenced via the `Visual Weight` or other Content Hierarchy columns (e.g. `primary` weight) are NOT detected — the regex doesn't run against those columns. By design.
- Case sensitivity: regex is `[a-z][a-zA-Z0-9._-]*`, so `{Colors.Primary}` is NOT matched. YAML keys are lowercase by convention, so this is OK in practice.

**Why this is intentional:** over-extraction (false positives in tokens_used) is worse than under-extraction. False positives cause BO briefs to list tokens the screen doesn't actually use, which the implementer then resolves to wrong values. False negatives just mean the implementer reads DESIGN.md for any token not in the brief — graceful degradation.

**Slice 4 candidate:** a richer resolver that joins page-spec `screen_component_use` → manifest entry → component variant token references. That requires Slice 4's component-variant-to-token edges, which don't exist yet.

---

## 9. Token budget impact analysis

Per-task brief size estimates (single UI task touching one screen):

- Slice 1 brief: ~600 tokens (feature context + rules + acceptance)
- Slice 2 brief: ~700 tokens (+ DNA card + manifest entries)
- Slice 3 brief: ~1200 tokens (+ wireframe ASCII + states + key copy + tokens listed)

Pre-graph baseline (Slice 0): BO pasted summary of product-spec + page-spec + component-manifest + visual-design-spec sections. ~3500 tokens, often paraphrased and lossy.

**Slice 3 net.** 1200-token brief is ~65% smaller than Slice 0 AND carries verbatim wireframe ASCII (no paraphrase loss). Vs Slice 2, Slice 3 grows the brief, but alternatives — brief-without-wireframe (implementer reads ~3KB page-spec file) or brief-with-paraphrased-wireframe (drift) — are worse.

Real Slice 3 wins:

- Implementer no longer reads `page-specs/*.md` (saved ~1.5-3KB per task; ~30-40KB per 12-task feature).
- `queryToken(name)` is a per-name lookup vs. parsing full DESIGN.md Pass 2 (~5KB raw).
- BO replaces page-specs file-read + manifest-join with one `queryScreenFull` call.

**Cumulative Phase 4 token-cost vs Slice 0:** ~70-75% reduction once Slice 3 wires. Slice 3 buys another -10% on top of Slice 2.

---

## 10. Open follow-ups for Slice 4+

- **`ScreenStateSlot.state_id` placeholder.** `parser/page-spec.ts:318` emits `unresolved__state__<screen>__<state>`. Slice 4 should join screen → owning_features → states to produce a real `state__<feature>__<state>` ID. Harmless if unread; pollutes `queryScreenFull.screen_state_slots[].state_id`.
- **Token aliases.** `{colors.primary-hover}` → `{colors.primary}.darken(10)` not modeled.
- **Naming convention audit.** Slice 1 Screen Inventory IDs must match page-spec h1 kebabs. No enforcement; silent orphans (§4).
- **Step 3.3b wireframe-vs-manifest drift detection.** Orchestrator concern. §7.
- **iOS Step 3.3.idx + Step 3.4.idx-ios.** Bug #5.
- **Implementer narrow-tool affordance.** Schema §6.2 + `briefing-officer.md:36` describe `graph_query_token` as implementer-call. `agents/engineering-frontend-developer.md` and `web-phase-branches.md:282-316` make NO mention. Bug #4.
- ~~**`bin/graph-index.ts` directory + Pass 2 dispatch.** Bugs #1, #2.~~ RESOLVED 2026-04-26 — see appendix.
- **`loadAllGraphs` schema check.** `storage/index.ts:432` accepts `slice-1/2/3`. Page-spec parser writes `slice-3` (`parser/page-spec.ts:486`); Pass 2 parser writes `slice-3` (`design-md-pass2.ts:18`). Both correct.

---

## Bugs surfaced (real, found by reading code, need fixing now)

1. **~~`bin/graph-index.ts` does not handle directory paths or Pass 2 token extraction.~~** RESOLVED.
   - Verified in code 2026-04-26: `bin/graph-index.ts:24-76` implements directory mode (detects `page-specs/` basename, iterates `*.md`, accumulates fragments, writes `slice-3-pages.json`). `bin/graph-index.ts:122-135` runs `extractDesignMdTokens` after Pass 1 on basename `DESIGN.md` and writes `slice-3-tokens.json` when Pass 2 nodes are present. Smoke run produces all 5 fragments (`slice-1.json`, `slice-2-dna.json`, `slice-2-manifest.json`, `slice-3-pages.json`, `slice-3-tokens.json`).

2. **~~Step 3.4.idx block missing from `web-phase-branches.md`.~~** RESOLVED.
   - Verified 2026-04-26: `web-phase-branches.md:192-200` defines `Step 3.4.idx — DESIGN.md Pass 2 token re-index` running `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js DESIGN.md`. Best-effort, file-read fallback on non-zero exit. Mirrors Step 3.0.idx shape as planned.

3. **Page-spec parser does not detect orphan screen IDs.**
   - Schema §11.2 says "filename → kebab match against existing `screen__*` nodes. Mismatch = warn at index time, emit the `page_spec` node anyway with `screen_id: null`." Implementation at `parser/page-spec.ts:421` emits `screen_id: ids.screen(screenName)` from the page-spec h1 verbatim — no cross-check against `slice-1.json`.
   - Fix: cannot live inside the pure parser (no I/O contract). Must move to `bin/graph-index.ts` post-processing, or to a Slice 3.5 validator hook. Schema §11.2's "warn at index time" was over-promised; document the gap.

4. **Implementer agents have no instruction to call Slice 3 graph tools.**
   - `agents/engineering-frontend-developer.md` (and the implementer dispatch prompt template at `web-phase-branches.md:282-316`) mention no graph tools. The Slice 3 schema §6.2 and `briefing-officer.md:36` both assume the implementer calls `graph_query_token` at code time.
   - Fix: add a Tool Affordances section to the implementer dispatch template after `web-phase-branches.md:316`, listing `mcp__plugin_buildanything_graph__graph_query_token` and `mcp__plugin_buildanything_graph__graph_query_screen` with `full: true`. ~8 lines. Same shape applies to the iOS implementer agents.

5. **iOS branch missing Step 3.3.idx and Step 3.4.idx.**
   - `ios-phase-branches.md` defines Step 3.0.idx (line 183) only. Steps 3.3-ios (page-specs writer at line 186) and 3.2-ios (DESIGN.md Pass 2 writer at line 185) have no follow-up indexer dispatches.
   - Combined with bug #1, every iOS Slice 3 query (`queryScreenFull` token data, `queryToken`) returns null. iOS implementers always file-fall-back.
   - Fix: insert the same indexer blocks after lines 185 and 186, with the directory-dispatch (`docs/plans/page-specs/`) and DESIGN.md (Pass 2 re-index) commands.

6. **`queryScreenFull` does not warn on missing manifest joins.**
   - `storage/index.ts:604-620` silently drops `manifest_entry` when no manifest node matches the slot. The schema §11.5 anticipated a soft-fail with a logged warning. The query layer logs nothing.
   - Fix: out of scope for Slice 3 (queries are pure read). Slice 4 cleanup agent territory or a one-shot validator. Document.

Of the six, #1 and #2 were resolved 2026-04-26 (CLI directory + Pass 2 dispatch + Step 3.4.idx block all in tree, end-to-end smoke run produces 5/5 fragments). Remaining: #5 is a blocker for iOS-flavored builds (Slice 3 queries return null, implementers always file-fall-back); #3, #4, #6 are quality-of-life gaps. The schema and parsers are correct on web; iOS still needs Step 3.2.idx-ios + 3.3.idx-ios + 3.4.idx-ios.
