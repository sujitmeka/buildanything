# Slice 5 — Logical Evaluation (Hypothetical Build Walkthrough)

**Date:** 2026-04-26
**Status:** Pre-implementation thought experiment. No code run, no multimodal subagent dispatches made. Slice 5 ships as a deliberate **stub** — see `src/graph/parser/screenshot.ts:1-16` and `src/graph/util/dhash.ts:1-18` for the boundary between what is in tree and what production must replace.
**Scope:** Trace what would happen during a real `/build` now that Slice 5 node types, edge types, IDs, and the stub extractor exist — and surface the exact production-mode work that the hypothetical environment cannot exercise.

Paired with `docs/graph/11-slice5-schema.md` §11. §11 enumerates parser-level failure modes against a notional production extractor; this file traces a Phase 3→5→6 pipeline run, marks where the stub produces "right shape, wrong content," and identifies wiring gaps the schema doc papers over (CLI dispatch, query layer, MCP tool registration). Slice 1-4 evals are not re-litigated.

---

## 1. Walkthrough — happy path with stub (hypothetical env)

A web marketplace build, fintech-adjacent, three features (Auth, Search, Checkout). Slice 1-4 indexers assumed wired and producing fragments per the prior eval banners. Timeline picks up at Phase 3.1:

- **T+30 (Step 3.1.idx — design references).** `visual-research` returns; competitor + inspiration screenshots land under `docs/plans/design-references/competitors/` and `.../inspiration/` (`web-phase-branches.md:91, 93`). Orchestrator should run `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/design-references/ --image-class=reference` (per Slice 5 schema §7). **GAP:** the CLI at `bin/graph-index.ts:80-116` only routes `product-spec.md`, `DESIGN.md`, `component-manifest.md`, `architecture.md`, `sprint-tasks.md`, `decisions.jsonl`, plus the `page-specs/` directory branch. Image directories are not in the dispatch table; passing `docs/plans/design-references/` makes `readFileSync(absPath, "utf-8")` (`bin/graph-index.ts:88`) throw `EISDIR`, the fatal catch at `:145-148` writes to stderr, exits 2. **`slice-5-references.json` is never produced.** Bug #1 below.
- **Hypothetical-mode counterfactual (CLI bug fixed).** With the dispatcher patched, `extractScreenshot` (`src/graph/parser/screenshot.ts:101-226`) runs once per image. Each invocation:
  - Computes `dhash(input.imageBytes)` — note the dhash is itself a stub (`src/graph/util/dhash.ts:25-53`). It samples 65 evenly-spaced bytes and compares adjacent samples. Deterministic on identical bytes; **NOT** perceptual on visual content. Two visually identical PNGs that differ only in metadata produce DIFFERENT stub hashes because the byte distribution differs.
  - Computes SHA256 truncated to 8 hex chars (`screenshot.ts:128-131`) — used as the ID suffix per Slice 5 schema §3.
  - Produces a canned caption: `"Stub caption — Slice 5 production mode dispatches a multimodal subagent"` for `reference` class (`screenshot.ts:147`); class-tagged variant for `brand_drift`/`dogfood` (`screenshot.ts:155`).
  - Tags DNA axes by basename keyword scan (`screenshot.ts:149-151`) — a file named `density-airy.png` gets `dna_axis_tags: ["density"]`. This is roughly the "right shape" but it conflates filename with visual content; a real reference may exemplify Density visually while the filename says nothing about it.
  - Emits a single stub `image_component_detection` node per reference (`screenshot.ts:187-209`) with `component_label: "stub-component"`. Production would emit zero-to-many real component detections.
- **T+220 (Step 5.1.idx — brand drift).** Phase 5.1 fires the `design-brand-guardian` drift-check at `web-phase-branches.md:366`. The agent screenshots prod pages to `docs/plans/evidence/` (today; per Slice 5 schema §7 these should write to `evidence/brand-drift/`). Indexer command: `bin/graph-index.js evidence/brand-drift/ --image-class=brand_drift`. Same CLI gap as Step 3.1.idx — never fires. With the gap patched, the stub emits screenshot nodes with empty `dna_axis_tags` and empty `dominant_palette` (`screenshot.ts:155-157`). Production needs a lite multimodal-subagent dispatch here (caption + DNA tags only).
- **T+240 (Step 5.3.idx — dogfood evidence).** `commands/build.md:962` dispatches the dogfood agent; findings land at `docs/plans/evidence/dogfood/findings.md` per `commands/build.md:1015`. Slice 5 schema §7.3 expects screenshots under `evidence/dogfood/screenshots/` and a side-channel `evidence/dogfood/findings.json` mapping `finding_id → screenshot_path`. The indexer reads the side-channel to emit `screenshot_evidences_finding` edges. **GAP:** dogfood agent today writes `findings.md`, not `findings.json`; no screenshot-id → finding-id mapping is produced. The indexer would have nothing to read for the linkage edge. The stub skips this entirely because `extractScreenshot` only links via the `linkedFindingId` parameter passed by the caller (`screenshot.ts:219-222`); the CLI has no mechanism to read the side-channel and pass that parameter. Bug #2.
- **T+250 (Step 5.1 Brand Guardian observation emission).** Per Slice 5 schema §6.1, the Brand Guardian calls `graph_query_similar(prod_image_path)` after the indexer runs, finds matching references, and emits `brand_drift_observation` nodes via a follow-up indexer pass. **GAP:** `graph_query_similar` does not exist in the storage layer (`grep "querySimilar\|queryScreenshot\|queryBrandDrift" src/graph/storage/index.ts` returns zero) and no MCP tool is registered (`grep "graph_query_similar" src/` returns zero). The query layer is the missing-most piece of Slice 5. Bug #3 — the most consequential gap, because without it the Brand Guardian cannot do the "find similar reference for this prod shot" walk that justifies the whole brand-drift_observation node.
- **T+400 (Step 6.0 LRR Brand chapter).** Per Slice 5 schema §6.2, the Brand chapter aggregator calls `graph_query_brand_drift()` once at compile time. Same gap — tool not registered, query function not implemented. The Brand chapter falls back to its existing prose-grep flow (`launch-readiness.md:82-90`). Slice 5's only Phase 6 user is unwired.

**Consumer-window verdict.** With the stub in place, even if all wiring landed, every screenshot node would carry placeholder caption text ("Stub caption ... multimodal subagent dispatches in production") and either heuristically-tagged or empty DNA axes. The structural lineage edges (`screenshot_depicts_screen`, `screenshot_evidences_finding`, `image_has_component_detection`) are real and queryable; the semantic content (caption, palette, axis tags) is decoration that prod consumers must not trust. Implication for the hypothetical pipeline run: lineage walks succeed; semantic comparisons (drift scoring, similarity ranking) would produce garbage if invoked. The stub is a **scaffold**, not a working slice.

---

## 2. Production-mode requirements (out of scope for hypothetical env)

What must ship for Slice 5 to deliver the schema's value at runtime, in order:

1. **Build the `screenshot-extractor` subagent.** New agent file at `agents/screenshot-extractor.md`. Takes image paths via the orchestrator dispatch, returns structured JSON (caption + dna_axis_tags + dominant_palette + component detections, class-shaped per §4). Multimodal input via image attachments on the Agent tool dispatch. Writes a side-channel JSON file (e.g. `evidence/dogfood/extractions.json`) keyed by image path.

2. **Wire orchestrator triggers to dispatch the subagent BEFORE the CLI.** Step 3.1.idx, Step 5.1.idx, and Step 5.5.idx each gain a "dispatch screenshot-extractor → wait for side-channel JSON → run `bin/graph-index.js`" sequence. Sequential per §10 redline 1 — best-effort indexer pattern means missing extraction does not block the build.

3. **Update `bin/graph-index.ts` to optionally consume the side-channel JSON.** If the side-channel exists, populate the screenshot node's caption / dna_axis_tags / dominant_palette / component fields from it. If absent (Slice 5 stub mode, or vision extraction has not run yet), keep the existing stub data. Replace the canned branches at `screenshot.ts:146-158` with the side-channel-or-stub merge logic.

4. **Real Sharp-based dHash for actual perceptual content.** Replace `src/graph/util/dhash.ts:25-53` byte-sampling stub with Sharp-based decode → grayscale → 9×8 → 64 horizontal-adjacent comparisons. Still needed for the byte-level part of the pipeline; runs inside the Node CLI on raw image bytes, no Claude calls. Note: Slice 5 schema §10 redline 2 voted "hand-rolled," but that vote elided the image-decode dependency — re-redline.

5. **SHA256-keyed extraction cache** at `.buildanything/graph/.extraction-cache/<sha256>.json` for the side-channel JSON. SHA256 is already computed at `screenshot.ts:128-131`; cache hit → orchestrator skips the subagent dispatch entirely. The §8 idempotency checkbox depends on this.

6. **Cost-budget concern.** The screenshot-extractor subagent uses the user's Claude credits. Per-build budget remains the same as before (~57-69K tokens for a moderate build per §6). Track via existing measurement infrastructure. Per Slice 5 schema §10 redline 3, abort + partial side-channel + warn at 200K tokens.

7. **Subagent failure handling at the orchestrator layer.** Timeout / model overload / context-window exhaustion → exponential backoff (1s, 2s, 4s, max 3) → on final failure the side-channel JSON omits that image. Content-policy refusal → same. The orchestrator's existing subagent retry logic covers this; the indexer just handles a partial side-channel cleanly per §11 scenario 2.

8. **PII redaction on captions** per §10 redline 6. Email + phone + ID-pattern regexes inside the `screenshot-extractor` subagent BEFORE writing the side-channel JSON. Post-hoc redaction is too late once fragments hit git.

9. **CLI dispatch for image directories** — already shipped per §10 Bug #1 RESOLVED.

10. **Indexer triggers in protocols** — already shipped per §10 Bug #4 RESOLVED.

**Estimated production effort:** ~1 day post-stub. The work is "subagent + Sharp + side-channel wiring" — not "API integration." Build the agent file, wire the orchestrator to dispatch it before each `*.idx` trigger, teach the CLI to read the side-channel, swap the dHash util to Sharp. The 3 storage queries, 3 MCP tools, CLI dispatch, and 3 trigger blocks are already shipped (per `13-final-status.md` Section 1). No new auth, no new SDK, no new rate-limit handling — just an Agent tool dispatch with the image attached.

---

## 3. Walkthrough — Brand Guardian drift detection

Phase 5.1 (`web-phase-branches.md:366`) today writes prose findings to `evidence/brand-drift.md`. Slice 5 promotes this to typed `brand_drift_observation` nodes:

1. Brand Guardian Playwright-captures prod pages to `evidence/brand-drift/` (Slice 5 schema §7.2 standardizes the path; `web-phase-branches.md:366` currently uses `docs/plans/evidence/` — alignment needed).
2. Step 5.1.idx runs the indexer with `--image-class=brand_drift`. Vision-lite tags each prod with `dna_axis_tags` + caption.
3. Brand Guardian calls `graph_query_similar(prod_id, threshold=10)` per prod page. Filter to references whose `dna_axis_tags` overlap the locked DNA card in DESIGN.md.
4. For each (prod, reference, axis) triple inside threshold, score drift. The scoring algorithm itself is prompted out to the agent — Slice 5 schema §11 scenario 4 names a "0.75 fidelity threshold" as configurable in the prompt. The score is the number stored on the observation; the verdict (`drift` / `ok` / `needs-review`) is the agent's call.
5. For each `drift` / `needs-review` tuple, emit a `brand_drift_observation` node via a follow-up indexer pass over a JSONL of observation deltas the agent wrote.

**Hypothetical env behavior.** Stub `dna_axis_tags` come from filename keyword scan (`screenshot.ts:149-151`). For prod screenshots named like `pricing-page-desktop.png` the scan finds zero DNA keywords → `dna_axis_tags: []`. Hamming distance against the byte-sample stub hash means two prod screenshots at the same resolution may collide low-distance for header-byte reasons; cross-class similarity (prod vs reference) likely produces high distance because references were captured at different resolutions/encoders. **Net: structurally testable that indexer-runs-and-produces-nodes works; cannot produce meaningful similarity rankings.** Step 3 above is fully gated on §2 production work.

**Schema gap to flag:** §6.1 step 3 says "scores drift on each DNA axis" but doesn't define how. Brand Guardian prompt concern, not graph-layer — but the score field's meaningfulness depends on a stable scoring prompt across runs. If the prompt is loose, Phase 6 LRR Brand aggregation reads incomparable numbers.

---

## 4. Walkthrough — Phase 5.4 finding routing with screenshots

`commands/build.md:962-975` has dogfood writing `findings.md` (prose); Slice 5 schema §6.3 + §7.3 expect `findings.json` + a screenshot folder.

**Intended flow:**

1. Dogfood captures screenshot to `evidence/dogfood/screenshots/issue-NNN.png`, appends row to `evidence/dogfood/findings.json` mapping `finding_id → screenshot_path → affected_screen_id` (kebab against Slice 1 `screen__*`).
2. Step 5.3.idx runs `--image-class=dogfood`. Caption-only extraction. Indexer reads the side-channel JSON to emit `screenshot_evidences_finding` edges.
3. Phase 5.4 synthesizer (graph-wired per Slice 4 eval Bug #3 RESOLVED) calls `graph_query_screenshot(finding.screenshot_id)` → response includes `linked_screen`. Walks `screen → owning_features → tasks` (Slice 4 lineage) → routes to `task.assigned_phase`.

**Why this works EVEN WITH the stub.** The lineage edges (`screenshot_depicts_screen` at `screenshot.ts:213-216`, `screenshot_evidences_finding` at `:219-222`) emit from caller-passed parameters, not vision. As long as the CLI dispatcher reads the side-channel and passes `linkedScreenId` + `linkedFindingId` correctly, the structural walk Phase 5.4 needs is intact. Stub captions are irrelevant — synthesizer routes by screen→feature→task, not by reading captions.

**The catch.** Both Bug #1 (no CLI dispatcher for image dirs) and Bug #2 (no `findings.json` side-channel) block this. Once both land, the stub is sufficient for Phase 5.4 routing.

**Net:** Phase 5.4 routing is the most stub-friendly Slice 5 consumer. Phase 5.1 Brand Guardian is the most stub-hostile.

---

## 5. Edge case — stub-vs-prod determinism

`src/graph/util/dhash.ts:25-53` is deterministic-by-bytes, NOT perceptually meaningful. Three concrete failure modes the hypothetical env cannot exercise honestly:

1. **Visually identical images, different metadata → DIFFERENT stub hashes.** Re-encoding a PNG strips chunks, byte distribution shifts, adjacent-sample comparisons flip. Real dHash would collapse them. Implication: §11.3 "duplicate file" scenario is falsely provable when both inputs are the same Uint8Array, but fails when the same image went through different compressors.
2. **Visually different images, similar byte distributions → CLOSE stub hashes.** Two PNGs of similar dimensions/color depth but unrelated content cluster low-distance. `graph_query_similar` returns spurious matches.
3. **Quality degrades with format.** PNG/JPEG headers occupy 50-200 bytes; the stub samples 65 evenly-spaced positions across the whole file. For files <5KB, most samples land in nearly format-invariant header bytes — Hamming distance clusters low for any pair.

**Implication for tests.** The pipeline (CLI → parser → fragment → query) is exercisable; drift-detection accuracy is not. Slice 5 schema §8 lists "Perceptual hash determinism: same bytes → same dHash hex" as a checkbox — the stub passes that but it overstates capability. Add to §8: "perceptual-accuracy validation deferred to production-extraction integration (Sharp-based real dHash + multimodal subagent dispatch)."

`src/graph/util/dhash.ts:13-15` already documents this honestly; the eval's job is keeping consumers from over-claiming.

---

## 6. Cost analysis

Moderate build (3 features, 8-12 screens, 5-8 references per DNA axis):

- **Step 3.1 references:** ~30 images × full extraction (caption ~150 + dna_axis_tags ~100 + palette ~50 + 3-5 component detections ~700) ≈ ~1500 tokens/image = **45K tokens**.
- **Step 5.1 brand-drift:** Top-N=10 prod × vision-lite ~250-500 tokens × 2-4 capture passes = **10-20K tokens**.
- **Step 5.3 dogfood:** ~10-20 screenshots × caption-only ~150 = **2-4K tokens**.

**Total Slice 5 per-build cost: ~57-69K tokens**, well under the 200K cap (Slice 5 schema §10 redline 3).

**Net pipeline impact.** Slices 1-4 cumulatively save ~70-75% of pre-graph Phase 4 cost (per prior evals §9). Slice 5 adds ~57-69K, offset by consumer-side savings: Brand Guardian no longer pastes design-references.md (~3-5K saved per drift-check), LRR Brand chapter same (~750-1250), synthesizer screen-id walks instead of grepping filenames (~5K across ~10 findings). Net Slice 5 ≈ token-neutral to mildly positive. **Slice 5's real value is quality of brand-drift detection** (typed observations, Hamming-bounded reference matching) — not raw token savings. Per `CLAUDE.md`'s stated quality thesis ("product context does not reach agents that write code"), Slice 5 extends that thesis to visual context.

---

## 7. iOS asymmetry

iOS pipeline (`protocols/ios-phase-branches.md`) has different visual-research shape:

- `design-references/` exists per `ios-phase-branches.md:192` but the visual-research path is shaped around HIG references, not competitor web apps. DNA axes (Density, Material, Motion) are web-flavored in current operationalization — open design question whether they apply to SwiftUI captures.
- `evidence/brand-drift/` from Brand Guardian: iOS writes prose only, no screenshot dump in Slice 5 shape. Per §10 redline 4 ("iOS deferred to Phase B") intentional.
- `evidence/dogfood/screenshots/`: Maestro produces simulator captures in a different directory layout.

**Behavior on iOS builds.** Step 3.1.idx fires if `design-references/` exists (stub keyword scan misses iOS-flavored references — production vision would tag them correctly). Step 5.1.idx fires on empty/absent `evidence/brand-drift/` → empty fragment per §11 scenario 1 → `graph_query_brand_drift()` returns `{ observations: [] }`. Correct fail-soft. Step 5.3.idx similarly best-effort.

**Document.** Mirrors Slice 2 eval's iOS manifest absence pattern. Amend §10 redline 4: "On iOS builds, all three Slice 5 indexers may fire on empty/absent directories. `graph_query_brand_drift` returning `{ observations: [] }` on iOS is expected, not a fallback trigger."

---

## 8. Privacy concerns (per schema redline #6)

Dogfood captions may contain user data — email field showing "user@example.com" as test data, profile page rendering a user's name. Slice 5 schema §10 redline 6 voted "yes" on redaction.

**Production must implement:**
- Email regex: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b` → `[REDACTED:email]`.
- Phone regex: US `(NNN) NNN-NNNN`, intl `+NN N NNN NNNN`, bare 10-digit → `[REDACTED:phone]`.
- ID patterns: SSN-style, Luhn-checkable 13-19 digit → `[REDACTED:id]`.
- Names: schema doesn't commit; conservative path is log-and-review on capitalized-two-word non-common-noun sequences.

**Stub doesn't need it** (`screenshot.ts:147, 155` produces canned captions, zero PII risk). But fragments at `.buildanything/graph/` may be checked into git — once vision goes live, leaked captions end up in repo history.

**Where to put it:** inside `extractScreenshot`, BETWEEN the vision call and the `screenshotNode.caption = ...` assignment at `screenshot.ts:175`. Post-hoc redaction requires history rewrite.

**Test gap.** §8 checklist has no PII redaction test. Add: "caption containing email/phone/SSN → fragment caption redacted; redaction event logged."

---

## 9. Token budget impact

Slice 5 adds three MCP query paths (Phase 5.1, 5.4, 6.0). Each is a graph traversal — only the agent's response interpretation costs tokens.

**Per-call response sizes:** `graph_query_screenshot` ~75-125 tokens; `graph_query_similar` ~190-750 (depends on match count); `graph_query_brand_drift` ~310-940 (scales with observation count).

**File-paste replacements:**
- Brand Guardian: paste `design-references.md` (~3-5KB) per prod page × ~10 pages × multiple drift rounds ≈ 30-60K tokens. Slice 5: `graph_query_similar` per prod page ≈ 2-7K tokens. **Saves 25-55K per Phase 5/6 cycle.**
- LRR Brand chapter: paste design-references.md + grep brand-drift.md. Slice 5: one `graph_query_brand_drift()`. **Saves 3-5K per Phase 6.0.**
- Phase 5.4 synthesizer: filename-grep ~500 tokens/finding → `graph_query_screenshot` ~125. ~10 findings → **3-4K saved.**

**Cumulative.** ~30-65K tokens saved per Phase 5/6 cycle, combined with ~57-69K extraction cost → mildly net-positive. **The real win is correctness, not tokens** — typed brand-drift observations replace prose grep; LRR cites verbatim instead of paraphrasing.

---

## 10. Open follow-ups

Things this walkthrough surfaced that Slice 5 does not resolve, ordered by severity (post 2026-04-29 stale-claim sweep — three CRITICAL bullets resolved by parallel-subagent work, evidence in §"Bugs surfaced" appendix below):

- **CRITICAL — production vision integration.** Steps in §2 above: build the `screenshot-extractor` subagent, wire orchestrator dispatch before each `*.idx` trigger, teach the CLI to read the side-channel JSON, swap dHash util to Sharp. Stub→prod is the gating dependency for any Slice 5 consumer to deliver value. ~1 day of work.
- ~~**CRITICAL — `graph_query_similar`, `graph_query_screenshot`, `graph_query_brand_drift` storage queries + MCP tools missing.**~~ **RESOLVED** — see Bug #3.
- ~~**CRITICAL — CLI dispatch for image directories absent.**~~ **RESOLVED** — see Bug #1.
- **MAJOR — dogfood side-channel `findings.json` absent.** Slice 5 schema §7.3 expects this; `commands/build.md:962-975` has dogfood writing `findings.md` only. Without the side-channel, `screenshot_evidences_finding` edges cannot be emitted. Bug #2 below — STILL OPEN.
- **Real perceptual hash dependency.** Sharp / @napi-rs/image / Jimp. Sharp is fastest but heavy native dep; Jimp is pure-JS. Pick at production time per the Slice 5 schema §10 redline 2 vote ("hand-rolled" — but the hand-rolled assumes an image decoder is present; the redline glossed over the dependency it implies). Re-redline this.
- **iOS Phase B brand drift design.** Slice 5 schema §10 redline 4 defers; the deferral needs an explicit design pass before Phase B starts. iOS DNA axes may differ from web (Material is HIG-flavored, Density is interpreted differently for tap targets).
- **Cross-fragment edge integrity for screenshots referencing screens.** Per Slice 1 IDs. `screenshot_depicts_screen` from `screenshot.ts:213-216` writes the edge target verbatim from the caller's `linkedScreenId`. If that ID doesn't match a Slice 1 `screen__*` node (typo, kebab mismatch), the edge dangles. Same shape as Slice 3 eval Bug #3 (page-spec orphan screen IDs). Either validate at index time (CLI dispatcher post-process check loading `slice-1.json`) or accept dangling edges and let consumers handle null joins. Document.
- **Implementer agent integration.** `agents/engineering-frontend-developer.md` and the implementer dispatch template currently receive wireframes (Slice 3) but no visual references. Slice 5 unlocks a future "implementer queries `graph_query_similar` to find component examples that nail the locked DNA axes" workflow — but this requires implementer prompt updates AND a way to filter `graph_query_similar` to the `image_class=reference` subset. Slice 5 schema §5 doesn't expose a class filter on `graph_query_similar`; add to the input shape: `{ image_path_or_id, threshold, image_class?: "reference"|"brand_drift"|"dogfood" }`. Bundle with §2 work.
- **`brand_drift_observation` deletion / supersession on Phase 5.1 re-run.** Each re-run of Step 5.1.idx writes `slice-5-brand-drift.json` wholesale. Old observations are dropped — same atomic-overwrite pattern as Slice 2 eval §3. Verify wholesale-overwrite is the desired behavior (probably yes; brand drift should re-evaluate from scratch each run). Document explicitly.

---

## Bugs surfaced (real, found by reading code, need fixing now)

> **Stale-claim sweep (2026-04-29):** Bugs #1, #3, #4 were resolved by parallel-subagent work that landed before this eval was written. Bug #2 is still real. Bugs #5 and #6 stand. Resolution evidence inline below.

1. **CLI dispatcher does not route image directories.** **RESOLVED.**
   - Was: `bin/graph-index.ts` had no image-directory branch; `EISDIR` on `readFileSync`.
   - Now: `bin/graph-index.ts:32-45` infers image class from path; `:55-74` collects images recursively; `:76-137` runs `extractScreenshot` per file and writes the right `slice-5-*.json`; `:165-224` dispatches directory mode. Verified end-to-end: smoke run on `design-references/`, `evidence/brand-drift/`, `evidence/dogfood/screenshots/` produced `slice-5-references.json` (4n/2e), `slice-5-brand-drift.json` (1n/0e), `slice-5-dogfood.json` (1n/0e).

2. **Dogfood agent does not emit a side-channel `findings.json` mapping screenshots to findings.** **STILL OPEN.**
   - Read: `commands/build.md:962-975`. Dogfood agent prompt still writes `findings.md` (prose) only. Synthesizer at `:970` writes `classified-findings.json` post-classification, but that is *after* the Slice 5 indexer would run and uses different keys (no `screenshot_path → finding_id` mapping shaped for the indexer).
   - Verified: `grep "findings.json" commands/build.md` returns the line at `:1015-1016` referencing `findings.md` and `classified-findings.json` only — no `evidence/dogfood/findings.json` side-channel is produced before Step 5.5.idx runs.
   - Result: Step 5.5.idx (`web-phase-branches.md:469-475`) writes screenshot nodes but cannot emit `screenshot_evidences_finding` edges. The Phase 5.4 routing walk that the eval §4 calls "the most stub-friendly Slice 5 consumer" works structurally, but `linked_finding_id` is always null.
   - Fix: amend the dogfood agent prompt at `commands/build.md:962` to also emit `docs/plans/evidence/dogfood/findings.json` with shape `[{finding_id, screenshot_path, affected_screen_id}, ...]`. Then teach the Slice 5 dogfood indexer to read the side-channel and pass `linkedFindingId` + `linkedScreenId` to `extractScreenshot`. ~5-10 LOC of prompt edit + ~15 LOC in `bin/graph-index.ts:88-113` to read the side-channel before the per-file loop.

3. **Slice 5 query layer + MCP tools entirely missing.** **RESOLVED.**
   - Was: zero implementation in storage or MCP server.
   - Now: `src/graph/storage/index.ts:928-941` implements `queryScreenshot`; `:1027-1064` implements `queryScreenshotSimilar`; `:1066-1091` implements `queryBrandDrift`. All three MCP tools registered: `bin/mcp-servers/graph-mcp.ts:375-396` (`graph_query_screenshot`), `:400-421` (`graph_query_similar`), `:425-441` (`graph_query_brand_drift`). Total `server.registerTool` count = 12 across the file (verified by literal-match grep). Smoke test: all three queries returned coherent payloads against the marketplace fixture.

4. **Slice 5 indexer triggers absent from `commands/build.md` and `protocols/web-phase-branches.md`.** **RESOLVED.**
   - Was: no `Step *.idx` blocks for Slice 5.
   - Now: `protocols/web-phase-branches.md:97` (`Step 3.1.idx — Design references graph index`), `:378` (`Step 5.1.idx — Brand drift screenshots graph index`), `:469` (`Step 5.5.idx — Dogfood evidence graph index`). The third trigger is named `5.5.idx` in the protocol because the dogfood agent fires at Step 5.5 in the orchestration; the schema doc §7 calls it "Step 5.3.idx" because dogfood ran at 5.3 in an earlier orchestration. Note added at `web-phase-branches.md:471` reconciles the naming. iOS equivalent: `protocols/ios-phase-branches.md:183` covers Step 3.0.idx-ios. The 5.1/5.5 iOS variants intentionally do not exist (per §10 redline 4 — iOS deferred to Phase B).

5. **Stub dHash documented as perceptual but is byte-distribution.**
   - Read: `src/graph/util/dhash.ts:13-15` honestly disclaims this in the docstring; `src/graph/util/dhash.ts:25-53` samples 65 evenly-spaced bytes and compares adjacent samples.
   - Result: any test in Slice 5 schema §8 that exercises perceptual similarity (e.g. "two visually identical files produce the same hash" — schema §11 scenario 3) will pass on byte-identical fixtures but fail on visually-identical-yet-byte-different fixtures. The schema's validation checklist conflates "deterministic" with "perceptual"; only the former holds for the stub.
   - Fix: either ship Sharp + real dHash (production track), or amend Slice 5 schema §8 to mark perceptual checks as "deferred to production-extraction integration." Pick one — currently the stub passes a checklist that overstates its capability.

6. **`screenshot_depicts_screen` and `screenshot_evidences_finding` emit dangling edges if linked IDs are typoed.**
   - Read: `screenshot.ts:213-222` writes the edges using the caller-supplied `linkedScreenId` and `linkedFindingId` verbatim. No cross-check against `slice-1.json` (for `screen__*`) or against the dogfood findings index.
   - Result: a kebab mismatch between the screenshot's intended screen attribution and the actual `screen__*` ID emits an edge whose target node doesn't exist. `loadAllGraphs` (`src/graph/storage/index.ts:438-453`) doesn't validate edge targets. Consumers walking the edge get `undefined` joins.
   - Fix: post-process validation in the CLI dispatcher (after Bug #1 lands) — load `slice-1.json` and `evidence/dogfood/findings.json` if present, warn on each dangling reference. Out-of-scope for the pure parser. ~20 LOC in `bin/graph-index.ts`.

**Status summary (post stale-claim sweep, 2026-04-29):**

- **RESOLVED:** Bugs #1 (CLI image dispatch), #3 (query layer + MCP tools), #4 (indexer triggers). End-to-end smoke verified.
- **STILL OPEN — S2:** Bug #2 (dogfood side-channel `findings.json`). Routing walk works structurally; `linked_finding_id` is always null without the side-channel. Half-day prompt + indexer edit.
- **STILL OPEN — S2:** Bug #5 (stub dHash documentation overstates capability). Either ship Sharp-based real dHash (production track) or amend §8 checklist.
- **STILL OPEN — S3:** Bug #6 (dangling edge validation for typoed `linkedScreenId` / `linkedFindingId`). Out-of-scope for the parser; CLI post-process check.
- **Plus:** the entire production-extraction track per §2 (build the `screenshot-extractor` subagent, wire orchestrator dispatch + side-channel JSON, swap dHash util to Sharp). Outside the bug list because the stub is intentional per the user's request.

---

## Ship-readiness verdict

**YELLOW** — pending production vision integration. Wiring track resolved 2026-04-29.

Slice 5's schema (`docs/graph/11-slice5-schema.md`) is fully drafted and internally consistent. The stub extractor (`src/graph/parser/screenshot.ts`) is a faithful scaffold that emits the correct node and edge shapes. Slice 1-4 nodes are untouched (no clobbering, no edge contamination — verifiable on the validation checklist's last bullet).

**Wiring track (resolved 2026-04-29):**
- CLI dispatch for image directories: routed (`bin/graph-index.ts:32-137, 165-224`).
- Slice 5 query layer: shipped (`src/graph/storage/index.ts:928, 1027, 1066`).
- Slice 5 MCP tools: registered (`bin/mcp-servers/graph-mcp.ts:375, 400, 425`).
- Indexer triggers: present (`web-phase-branches.md:97, 378, 469`).

**Production-mode track (still open):**
- Multimodal subagent dispatch is stubbed (intentional, per §2 production work — ~1 day with subagent-driven extraction + Sharp-based real dHash).
- Dogfood side-channel `findings.json` not produced (Bug #2 — half-day).
- dHash is byte-sample, not perceptual (Bug #5 — bundle with Sharp dependency).

**Recommendation.** Ship Slice 5 as YELLOW with the stub explicitly tagged. Brand Guardian, LRR, and the feedback synthesizer can call the Slice 5 tools today and receive structurally-correct empty/stub results — they degrade gracefully. The production-extraction PR replaces stub captions/tags/palette/components with multimodal subagent dispatches and lands the dogfood side-channel. ~1 day bundled (the surface is smaller than originally scoped because subagent dispatch reuses the existing Agent tool path — no new SDK integration, no new auth).

Until production lands, Slice 5 is a working contract with stub semantics — lineage walks succeed, similarity ranking returns garbage. The stub proves the contract is implementable; only real images + real Vision calls prove it's correct.
