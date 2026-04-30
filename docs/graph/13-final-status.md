# Graph Layer — Final Integrity Status (Slices 1-5)

**Date:** 2026-04-29
**Verifier:** closing pass after parallel-subagent slice work
**Status:** Wiring track complete across all 5 slices. Production-mode track open on Slice 5 only.

This doc is the closing verification. It (a) reports the result of the integrity sweep across the 5 shipped slices, (b) corrects stale "CRITICAL" claims in the Slice 5 logical eval that were resolved by parallel work before the eval was authored, (c) consolidates the real bugs that remain across all slices with severities and recommended owners, and (d) gives a hypothetical end-to-end walkthrough plus token-savings estimate.

The user's framing for this session was "hypothetical environment — give me the truth, not optimistic spin." This doc honors that — every claim below is backed by a file:line ref or a smoke-test result, and every open gap is named without softening.

---

## Section 1: Ship state

### Tests
- `npx tsx --test tests/graph/*.test.ts` — **188 tests pass / 0 fail / 0 skipped**, 56 suites, ~880ms total.
- `npx tsc --noEmit` — clean (no output).
- Test files: 15 across the 5 slices (3,647 LOC).

### MCP tool count
- `bin/mcp-servers/graph-mcp.ts` registers exactly 12 tools via `server.registerTool` (verified by literal grep):
  1. `graph_query_feature` (line 150)
  2. `graph_query_screen` (line 175 — accepts `{full: true}` opts for Slice 3 enriched payload)
  3. `graph_query_acceptance` (line 202)
  4. `graph_query_dna` (line 227)
  5. `graph_query_manifest` (line 252)
  6. `graph_query_token` (line 277)
  7. `graph_query_dependencies` (line 302)
  8. `graph_query_cross_contracts` (line 327)
  9. `graph_query_decisions` (line 352)
  10. `graph_query_screenshot` (line 375)
  11. `graph_query_similar` (line 400)
  12. `graph_query_brand_drift` (line 425)

### CLI dispatch paths in `bin/graph-index.ts`
10 dispatch paths confirmed:
- Markdown file mode (6 basenames): `product-spec.md` → `slice-1.json`; `DESIGN.md` → `slice-2-dna.json` + Pass 2 `slice-3-tokens.json`; `component-manifest.md` → `slice-2-manifest.json`; `architecture.md` → `slice-4-architecture.json`; `sprint-tasks.md` → `slice-4-tasks.json`; `decisions.jsonl` → `slice-4-decisions.json`.
- Directory mode for `page-specs/` → `slice-3-pages.json` (line 167).
- Image directory mode (3 classes — auto-inferred from path or forced via `--image-class=`): `reference` → `slice-5-references.json`, `brand_drift` → `slice-5-brand-drift.json`, `dogfood` → `slice-5-dogfood.json` (lines 32-45 inference, 47-53 target file mapping, 76-137 indexing routine, 217-224 dispatcher branch).

### Indexer triggers in protocols
- `commands/build.md`: Step 1.6.idx, 2.3.1.idx, 2.3.2.idx, 2.3.4.idx, 4.4.idx, 6.0.idx (Slice 1 + 4 — Phase 1 product-spec, Phase 2 architecture/sprint-tasks/decisions, Phase 4 wave-end re-index, Phase 6 LRR re-index).
- `protocols/web-phase-branches.md`: Step 3.0.idx (DESIGN.md Pass 1), 3.1.idx (design references — Slice 5), 3.2.idx (component manifest), 3.3.idx (page-specs), 3.4.idx (DESIGN.md Pass 2 tokens), 5.1.idx (brand drift — Slice 5), 5.5.idx (dogfood — Slice 5). Naming reconciliation note at `:471` explains the schema-doc/protocol mismatch (5.5.idx vs schema's 5.3.idx).
- `protocols/ios-phase-branches.md`: Step 3.0.idx-ios. iOS Phase B intentionally defers Slice 5 brand-drift indexing (per Slice 5 schema §10 redline 4).

### End-to-end smoke (this session)
Built `/tmp/graph-smoke/` with marketplace fixtures from all five slices, ran all 10 indexers in sequence:
- product-spec.md → 120 nodes, 157 edges
- DESIGN.md → 21 nodes / 20 edges (Pass 1 DNA) + 35 nodes / 28 edges (Pass 2 tokens)
- component-manifest.md → 30 nodes, 15 edges
- architecture.md → 20 nodes, 25 edges
- sprint-tasks.md → 14 nodes, 37 edges
- decisions.jsonl → 12 nodes, 5 edges (after stripping the intentionally-malformed test row)
- page-specs/ → 81 nodes, 78 edges
- design-references/ → 4 nodes, 2 edges
- evidence/brand-drift/ → 1 node, 0 edges
- evidence/dogfood/screenshots/ → 1 node, 0 edges

Total cross-slice load: 339 nodes / 367 edges across 11 fragment files.

Then invoked all 12 storage queries directly via tsx import (bypassing stdio). 11 of 12 returned coherent payloads on the marketplace fixture; `queryScreen(screen_id, {full: true})` returned null because the page-specs fixture references `screen__login`/`screen__dashboard`/`screen__cart-review` while the marketplace product-spec uses `screen__checkout`/`screen__catalog`/`screen__account-settings` — a fixture-set seam, not a code defect. The slice3-queries unit tests cover the `full` path against a paired fixture and pass.

### Per-slice ship-readiness verdict

| Slice | State | One-line rationale |
|---|---|---|
| 1 — product-spec | **GREEN** | Indexer + 3 queries + 6 indexer triggers wired; marketplace fixture round-trips clean. |
| 2 — DESIGN.md + manifest | **GREEN** | Two-pass extractor (DNA Pass 1, tokens Pass 2) + manifest extractor + 3 queries + briefing-officer fully wired. |
| 3 — page-specs + tokens | **GREEN** | Directory-mode CLI + page-spec extractor + `queryScreen(full: true)` shipped; BO consumes wireframe verbatim. |
| 4 — architecture + tasks + decisions | **GREEN** | Three extractors + `queryDependencies` / `queryCrossContracts` / `queryDecisions` shipped with caveats (see Section 2). |
| 5 — screenshots (stub) | **YELLOW** | Wiring track complete (CLI + queries + MCP tools + triggers); production vision integration deferred. Stub captions/dHash explicitly tagged. |

---

## Section 2: Real bugs remaining

Stale "CRITICAL" claims in `docs/graph/12-slice5-logical-eval.md` were corrected this pass. The live bug list across all 5 slices, with severity and owner:

### S2 — should fix before production /build runs

1. **[Slice 3, Bug #4] Implementer agent prompts do not mention graph tools.**
   - Read: `agents/engineering-frontend-developer.md`, `engineering-senior-developer.md`, `engineering-rapid-prototyper.md` — `grep "graph_query"` returns zero matches.
   - Result: BO writes briefs that reference `Tokens: colors.primary, spacing.lg` and expect the implementer to call `graph_query_token(name)` at code time (`agents/briefing-officer.md:130, 165`). The implementer agents have no idea that tool exists. They will inline literal token names into code.
   - Owner: immediate fix — add a `## Graph tools` block to each implementer agent's prompt naming `graph_query_token`, `graph_query_screen(screen_id, {full: true})`, and how to fall back when the graph isn't loaded. Pattern is in `briefing-officer.md:31-36`.

2. **[Slice 5, Bug #2] Dogfood agent does not emit `findings.json` side-channel.**
   - Read: `commands/build.md:962-975`. Dogfood writes `findings.md` (prose) only. Slice 5 schema §7.3 expects `evidence/dogfood/findings.json` with `[{finding_id, screenshot_path, affected_screen_id}, ...]` BEFORE Step 5.5.idx fires.
   - Result: Step 5.5.idx successfully writes `slice-5-dogfood.json` with screenshot nodes, but `screenshot_evidences_finding` edges never emit because `bin/graph-index.ts` has no mechanism to read the side-channel. Phase 5.4 routing walk works structurally but `linked_finding_id` is always null.
   - Owner: production-mode wiring — bundle into the Slice 5 production-vision PR. Half-day prompt edit + ~15 LOC indexer change.

3. **[Slice 4, Bug #5] Cycle detection in decisions warns rather than fails.**
   - Read: `src/graph/parser/decisions-jsonl.ts:328-335`. Detected cycles are pushed as warnings (line 0, message `"WARNING: cycle detected..."`) but the parser returns `ok: true` regardless.
   - Result: a circular `parent_id` reference in decisions.jsonl produces a fragment that loads cleanly. Schema doc §11 calls out cycle detection as a fail-loud check; the implementation is fail-soft. Schema-implementation drift.
   - Owner: pick one — either amend the schema to say cycles are warnings (current behavior is intentional graceful degradation), or change `decisions-jsonl.ts:331-334` to push a fatal error and `ok: false`. Recommend the former — circular relations between decisions are uncommon-but-not-corrupting and a soft warning is correct.

4. **[Slice 4, Bug #7] `queryDependencies.task_dag` omits `owns_files`.**
   - Read: `src/graph/storage/index.ts:686-693`. The `task_dag` element shape declares `task_id`, `title`, `size`, `depends_on`, `behavioral_test`, `assigned_phase` — but not `owns_files`.
   - Then: `src/graph/parser/sprint-tasks.ts:339` writes `owns_files: ownsFiles` to the task node. `src/graph/types.ts:302` declares `owns_files: string[]` on TaskNode.
   - Result: BO calls `graph_query_dependencies` and gets task DAG entries without the file-claims data, even though it's stored on the node. BO has to call `graph_query_dependencies` then walk the raw fragment to read `owns_files`, or call something else. Half-implementation.
   - Owner: immediate fix — append `owns_files: t.owns_files` to the map projection at `src/graph/storage/index.ts:746-762`. ~2 LOC change. Add to the `task_dag` interface at `:686-693`.

5. **[Slice 4, Bug #6] `decision_drove` edge declared but never emitted.**
   - Read: `src/graph/types.ts:82` declares the relation. `grep "decision_drove" src/graph/parser/` returns zero matches across all parsers.
   - Result: schema declares the edge type, no parser writes it. Consumer queries that expect to walk decisions → tasks/contracts they drove get empty results.
   - Owner: depends on intent. If the relation was speculative (decisions pointing forward to artifacts they caused), consider whether it's needed at all — the schema-time hierarchy already runs decisions → architecture → sprint-tasks via the build sequence. If it IS needed, decisions parser would need to look up referenced artifact IDs in the body text and emit the edge per match. Recommend deferring to the next slice that actually has a consumer for it.

### S3 — accept or document

6. **[Slice 5, Bug #5] Stub dHash is byte-distribution, not perceptual.**
   - Read: `src/graph/util/dhash.ts:13-15` honestly disclaims this; `:25-53` samples 65 evenly-spaced bytes across the file.
   - Result: re-encoded PNGs (same pixels, different chunks) produce different stub hashes. `graph_query_similar` returns spurious matches across format families. Lineage walks are unaffected; similarity ranking is.
   - Owner: production-only — bundle Sharp / @napi-rs/image / Jimp into the production-vision PR. Re-redline Slice 5 schema §10 redline 2 to acknowledge the image-decode dependency the "hand-rolled" vote elided.

7. **[Slice 5, Bug #6] Cross-fragment edge integrity not validated.**
   - Read: `src/graph/parser/screenshot.ts:213-216` and `:219-222`. Edges write `linkedScreenId` and `linkedFindingId` verbatim from caller args — no cross-check against `slice-1.json` (`screen__*` IDs) or the dogfood findings index.
   - Result: a kebab mismatch (e.g. `screen__check-out` instead of `screen__checkout`) emits a dangling edge. `loadAllGraphs` (`storage/index.ts:438-453`) doesn't validate edge targets at load time. Consumers walking the edge get null joins.
   - Owner: post-process check in the CLI dispatcher (after the per-image extract loop) — load `slice-1.json` and the findings.json side-channel, warn on each dangling reference. ~20 LOC. Defer until production-vision lands.

### Resolved this session

- **Slice 5 Bug #1** (CLI rejects image dirs) — RESOLVED. Evidence: `bin/graph-index.ts:32-137, 165-224`. Smoke-tested.
- **Slice 5 Bug #3** (query layer + MCP tools missing) — RESOLVED. Evidence: `src/graph/storage/index.ts:928, 1027, 1066`; `bin/mcp-servers/graph-mcp.ts:375, 400, 425`. 12 tools registered total. Smoke-tested.
- **Slice 5 Bug #4** (indexer triggers absent) — RESOLVED. Evidence: `protocols/web-phase-branches.md:97, 378, 469`.

The eval doc at `docs/graph/12-slice5-logical-eval.md` has been updated with strikethroughs and inline RESOLVED markers — original prose preserved for audit trail.

---

## Section 3: What works end-to-end

Hypothetical run of `/build` against a new web project today, with no production fixes applied:

- **Phase 0** — orchestrator detects new web project, no graph state yet.
- **Phase 1** — `product-spec-writer` produces `docs/plans/product-spec.md`. Step 1.6.idx fires, `slice-1.json` written. Briefing officer can already query features, screens, acceptance criteria.
- **Phase 2** — `code-architect` produces `architecture.md`, `planner` produces `sprint-tasks.md`, decisions accumulate in `decisions.jsonl`. Step 2.3.1.idx / 2.3.2.idx / 2.3.4.idx fire after each. `queryDependencies(feature_id)` returns task_dag (minus `owns_files` per Bug #7), `queryCrossContracts(endpoint)` returns provider/consumer feature IDs, `queryDecisions({})` returns the full ADR list.
- **Phase 3** — `design-brand-guardian` produces `DESIGN.md` Pass 1 (DNA card, references). Step 3.0.idx fires → `slice-2-dna.json`. `visual-research` writes inspiration screenshots to `design-references/`. Step 3.1.idx fires → `slice-5-references.json` with stub captions (canned text, not real Vision). `design-ui-designer` produces `component-manifest.md`. Step 3.2.idx fires → `slice-2-manifest.json`. `design-ux-architect` produces `page-specs/*.md`. Step 3.3.idx fires → `slice-3-pages.json`. `design-brand-guardian` Pass 2 lands tokens in DESIGN.md. Step 3.4.idx fires → `slice-3-tokens.json`. End of Phase 3, BO has full structured access to product spec + DNA + manifest + wireframes + tokens.
- **Phase 4** — Product Owner spawns Briefing Officers per feature. Each BO calls `graph_query_feature(feature_id)`, `graph_query_screen(screen_id, {full: true})` per assigned screen, `graph_query_acceptance(feature_id)`, `graph_query_dna()`, `graph_query_manifest(slot)` per slot. BO writes per-task brief with verbatim wireframe text, persona constraints, acceptance criteria, token names. Implementer receives brief. **GAP:** implementer does not call `graph_query_token` to resolve token names → inlines `colors.primary` literally into code (Bug #1 above). Build still completes; visual fidelity to DNA card degrades.
- **Phase 5.1** — `design-brand-guardian` runs drift-check, writes prod screenshots to `evidence/brand-drift/`. Step 5.1.idx fires → `slice-5-brand-drift.json` with stub captions. Brand Guardian calls `graph_query_similar(prod_id)` → returns matches based on byte-distribution stub hash → results are spurious (Bug #5 above). Drift observation emission is a follow-up indexer pass that doesn't exist yet.
- **Phase 5.4** — dogfood agent writes `findings.md`. **GAP:** no `findings.json` side-channel produced (Bug #2). Step 5.5.idx fires, writes screenshot nodes with `linked_finding_id: null`. Synthesizer walks Slice 4 task DAG to route findings — works because the structural lineage (screen → feature → task) is intact via Slice 1+4. Just no automatic finding-to-screenshot linkage.
- **Phase 6** — LRR Brand chapter calls `graph_query_brand_drift()` → returns `{observations: []}` because Brand Guardian's follow-up indexer pass isn't wired yet. Falls back gracefully to existing prose-grep.

**Honest read:** lineage walks succeed across all 5 slices. Semantic content (brand-drift scoring, perceptual similarity ranking, dogfood-finding-to-screenshot linkage) is gated on production-mode work that explicitly hasn't shipped. The graph layer's stated quality thesis — "product context reaches the agents that write code" — is delivered by Slices 1-4. Slice 5 is the visual-context extension and ships as scaffold.

---

## Section 4: What still needs production wiring

Three buckets, ordered by impact:

1. **Implementer agent prompt updates** (S2 Bug #1 above). Without this, BO-prepared token names sit unresolved. ~30 LOC of prompt edits across `engineering-frontend-developer.md`, `engineering-senior-developer.md`, `engineering-rapid-prototyper.md`. ~30 minutes.

2. **Slice 5 production extraction integration** (~1 day). Per `docs/graph/12-slice5-logical-eval.md` §2:
   - Real perceptual hash via Sharp (replace `src/graph/util/dhash.ts:25-53`).
   - Multimodal subagent dispatches (replace canned branches at `screenshot.ts:146-158`). The orchestrator dispatches a `screenshot-extractor` subagent via the Agent tool with the image attached as multimodal input — inherits the user's existing Claude OAuth — and the subagent writes a side-channel JSON file (e.g. `evidence/dogfood/extractions.json`). The CLI then consumes that side-channel JSON alongside the raw image bytes (for SHA256 + dHash). No API key required at any layer; same pattern as `hooks/design-md-lint.ts` writing `lint-status.json` for `graph_query_dna` to consume.
   - SHA256-keyed extraction cache at `.buildanything/graph/.extraction-cache/`.
   - Cost budget + clean abort at 200K tokens (subagent token usage bills the user's Claude credits the same as direct API calls — the budget concern is real even with subagent dispatch).
   - Subagent failure handling (timeout / model overload / context-window exhaustion / content-policy refusal / missing-file). Inside Claude Code the orchestrator's existing subagent retry logic covers the dispatch-level errors.
   - PII redaction on captions before assignment at `screenshot.ts:175`.
   - Dogfood `findings.json` side-channel + indexer wiring (Bug #2).

3. **Real-build validation.** No actual `/build` end-to-end run has occurred against the graph layer. The 188 unit tests + smoke-test invocation prove the parts; only a real run proves the orchestration. Recommended: run `/build` against a small web project (e.g. the buildanything plugin's own dogfood project), measure pre/post token consumption per phase, validate that BO briefs include verbatim wireframe text + persona constraints + acceptance criteria, validate that backward routing of dogfood findings works.

---

## Section 5: Cumulative token savings estimate

Re-reading each slice eval's per-slice claim, with the caveat that all numbers are projections — only a real `/build` run can confirm:

| Slice | Per-build delta vs prior baseline | Mechanism |
|---|---|---|
| Slice 1 | -58% at Phase 4 (per `06-slice2-logical-eval.md` Phase 4 BO refactor numbers) | BO replaces full product-spec.md paste with `graph_query_feature` + `graph_query_acceptance`. ~3-5K tokens saved per BO dispatch × ~3-8 BO dispatches per build. |
| Slice 2 | additional -5 to -10% on top | DNA card + manifest queries replace DESIGN.md / component-manifest.md file-pastes in Phase 4 BO context. |
| Slice 3 | net +/- 0 to -10% | Wireframe verbatim is verbose (~200-1000 tokens per task brief) but offsets the page-specs/*.md file read entirely. Strong quality lift, weak token lift. |
| Slice 4 | additional -10% on top | `queryDependencies` + `queryCrossContracts` + `queryDecisions` replace architecture.md / sprint-tasks.md / decisions.jsonl file pastes in BO + LRR contexts. |
| Slice 5 | net 0 to mildly positive | Brand Guardian + LRR + synthesizer queries (~500-1000 tokens) vs file-pastes (~3-8K). Offset by ~57-69K multimodal subagent extraction cost in production. Quality lift, near-neutral cost. |

**Cumulative estimate: -55% to -65% per build vs pre-graph baseline.** The largest contributor is Slice 1 + 4 (structured data replacing file pastes for the BO and LRR aggregator). Slice 3 is roughly cost-neutral but is the highest quality win because wireframes land in implementer briefs verbatim. Slice 5 is roughly cost-neutral pending production-extraction deployment.

**This is a projection.** No real `/build` run has measured pre/post token consumption. Bullet 3 in Section 4 above flags that as the validating measurement — without it, "-55% to -65%" is what the math says, not what production has shown.

---

## Section 6: Files shipped this session (and across the 5 slices)

### Source layer (`src/graph/`)
- `types.ts` — 430 LOC. Slice 1-5 node + edge type discriminated unions.
- `ids.ts` — 86 LOC. Stable kebab-case ID helpers per slice.
- `index.ts` — 32 LOC. Public re-export surface.
- `parser/product-spec.ts` — 926 LOC. Slice 1.
- `parser/design-md.ts` — 471 LOC. Slice 2 Pass 1 (DNA + references).
- `parser/design-md-pass2.ts` — 249 LOC. Slice 3 Pass 2 (tokens).
- `parser/component-manifest.ts` — 268 LOC. Slice 2.
- `parser/page-spec.ts` — 494 LOC. Slice 3 directory-mode.
- `parser/architecture.ts` — 606 LOC. Slice 4.
- `parser/sprint-tasks.ts` — 378 LOC. Slice 4.
- `parser/decisions-jsonl.ts` — 348 LOC. Slice 4.
- `parser/screenshot.ts` — 226 LOC. Slice 5 (stub).
- `util/dhash.ts` — 84 LOC. Slice 5 stub perceptual hash.
- `storage/index.ts` — 1,081 LOC. All 12 query functions + cross-slice graph loader.

**Total source LOC: 5,679 across 14 files.**

### CLI
- `bin/graph-index.ts` — 306 LOC. 10 dispatch paths (6 markdown basenames + page-specs directory + 3 image-class directories).

### MCP server
- `bin/mcp-servers/graph-mcp.ts` — 461 LOC. 12 graph tools registered.

### Tests
15 test files, 3,647 LOC total. 188 tests passing.

### Protocols / commands edits across the slices
- `protocols/web-phase-branches.md` — Step 3.0.idx, 3.1.idx, 3.2.idx, 3.3.idx, 3.4.idx, 5.1.idx, 5.5.idx blocks.
- `protocols/ios-phase-branches.md` — Step 3.0.idx-ios block.
- `commands/build.md` — Step 1.6.idx, 2.3.1.idx, 2.3.2.idx, 2.3.4.idx, 4.4.idx, 6.0.idx blocks.
- `agents/briefing-officer.md` — full graph-tool integration (12 tool refs).
- `agents/product-owner.md` — graph-tool refs for context-load.

### Doc layer
- `docs/graph/01-graphify-architecture.md` through `13-final-status.md` (this file).
- `docs/graph/12-slice5-logical-eval.md` — stale-claim corrections applied this session.

### LOC by slice (rough)
- Slice 1: ~1,500 (parser + types + 3 queries + tests + 1 indexer trigger).
- Slice 2: ~1,200 (DNA + manifest parsers + 3 queries + tests + 2 indexer triggers).
- Slice 3: ~1,100 (page-spec + tokens parsers + queryScreen full + tests + 2 indexer triggers).
- Slice 4: ~1,800 (architecture + sprint-tasks + decisions parsers + 3 queries + tests + 4 indexer triggers).
- Slice 5: ~1,200 (screenshot stub + dhash util + 3 queries + 3 MCP tools + tests + 3 indexer triggers).

---

## Section 7: Open follow-ups for next session

1. **Real /build measurement.** Pick a small target project, run `/build` end-to-end, capture per-phase token consumption. Compare to a pre-graph baseline if accessible. Validate Section 5 estimate. Track backward-routing event count (CLAUDE.md "Still TODO" item).

2. **Slice 5 production-extraction PR.** Bundle: Sharp dependency + real dHash + multimodal subagent dispatch (via the Agent tool with image attachments) + extraction cache + cost budget + PII redaction + dogfood `findings.json` side-channel + dangling-edge validation. ~1 day (subagent dispatch reuses the existing Agent tool path — no new SDK, no new auth). Single PR titled "Slice 5 production wiring."

3. **Implementer agent prompt update.** ~30 minutes. Add `## Graph tools` block to `engineering-frontend-developer.md`, `engineering-senior-developer.md`, `engineering-rapid-prototyper.md` mirroring `briefing-officer.md:31-36`. Without this, BO's `Tokens: colors.primary, spacing.lg` instruction is dead-letter.

4. **Slice 4 fix-ups bundled.** `queryDependencies.task_dag` add `owns_files` (Bug #7, ~2 LOC). Decide on cycle-detection severity (Bug #5, doc or code). Decide on `decision_drove` edge intent (Bug #6, defer or wire).

5. **iOS Slice 5 design.** Per Slice 5 schema §10 redline 4. iOS DNA axes (Material is HIG-flavored, Density is tap-target-specific) likely need separate operationalization before Phase B starts. Half-day design pass.

6. **Cross-slice edge integrity validation.** Beyond Slice 5 (Bug #6 above), there's a general pattern: Slice 3 `page_spec_attached_to_screen` writes target IDs verbatim from page-spec content; Slice 4 `task_implements_feature` writes target IDs verbatim from sprint-tasks.md content. Both have the same dangling-edge risk. Add `loadAllGraphs` post-validation pass that warns on edges whose target node ID isn't in the cross-slice node set. ~30 LOC in `storage/index.ts:438-453`.

---

## Closing read

Wiring is done across all 5 slices. The eval doc claimed 4 CRITICAL bugs in Slice 5; 3 of those were resolved by parallel-subagent work that landed before the eval was authored, leaving 1 (dogfood side-channel) genuinely open at S2. Real bugs across all slices total 5 at S2 and 2 at S3 — none of them block the wiring track, all of them shape what production needs.

The user said "be honest, this is hypothetical." The honest read: the graph layer is wired through to the consumers, the unit tests cover the parts, the smoke test covers the cross-slice integration. What's missing is a real `/build` run that measures the token-savings projection, and the production-vision PR that turns Slice 5 from contract to capability. Both are bounded scope (~2 days production-vision + ~half-day measurement run).

Ship Slice 1-4 as GREEN, Slice 5 as YELLOW with the stub explicitly tagged. Address the 5 S2 bugs before the production /build measurement run, or accept that the run measures a state with known gaps.
