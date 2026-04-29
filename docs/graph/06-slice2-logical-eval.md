# Slice 2 — Logical Evaluation (Hypothetical Build Walkthrough)

**Date:** 2026-04-26
**Status:** Pre-implementation thought experiment. No code run.
**Scope:** Trace what would happen during a real `/build` now that Slice 2 parsers, MCP tools, and storage exist — and surface wiring gaps the schema doc papers over.

Paired with `docs/graph/05-slice2-schema.md` §11. §11 enumerates parser-level failure modes; this file traces a pipeline run and identifies windows where consumers query data that hasn't been indexed.

---

## 1. Walkthrough — happy path

A greenfield web build, fintech idea.

- **T+0 (Phase 1.6 ends).** `product-spec-writer` returns. Orchestrator runs `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/product-spec.md` (`commands/build.md:516`); `bin/graph-index.ts:21` dispatches to `extractProductSpec` and writes `slice-1.json`. **Queryable:** `graph_query_feature/screen/acceptance`. **Not yet:** `graph_query_dna` returns `null` because no `design_doc_root` node exists (`storage/index.ts:300`); `graph_query_manifest` returns `null` (`storage/index.ts:384`).
- **T+5 (Phase 2 ends).** Architecture and sprint-tasks on disk. No new graph index — Phase 2 artifacts are file-only in Slice 2's scope.
- **T+15 (Step 3.0 web).** `design-brand-guardian` writes `DESIGN.md` Pass 1 (`web-phase-branches.md:53`). **Expected:** orchestrator runs `graph-index.js DESIGN.md`; `slice-2-dna.json` written; `graph_query_dna` returns `pass_complete: { pass1: true, pass2: false }`. **Actual:** no Step 3.0.idx exists in `commands/build.md` or `protocols/web-phase-branches.md`. Indexing never fires. See §10.
- **T+25 (Step 3.2).** `design-ui-designer` writes `component-manifest.md`. Same gap — no Step 3.2.idx. `slice-2-manifest.json` never produced.
- **T+30 through T+90 (Steps 3.2b, 3.3, 3.3b, 3.4, 3.5, 3.6, 3.7, 3.8 — Phase 4.1 PO).** Anything calling `graph_query_dna()` returns `null`.
- **T+95 (Phase 4.2.a Briefing Officer).** `agents/briefing-officer.md:34` lists `graph_query_dna()` and `graph_query_manifest()` as primary sources. Both return `null`. BO falls back per `briefing-officer.md:39-45` to file reads of `DESIGN.md` and `component-manifest.md`. The brief assembles correctly but Slice 2's claimed token savings collapse to zero on every build.

**Consumer-window gap.** Phase 3 dispatches after Step 3.0 expect DNA in the rendered CONTEXT header (`commands/build.md:93`, `web-phase-branches.md:13`); the header still resolves DNA via direct file-read of `DESIGN.md`, not `graph_query_dna()`. So broken indexer wiring is invisible at Phase 3 — but catastrophic at Phase 4 because BO's graph-first affordance silently degrades to file-fallback.

---

## 2. Walkthrough — partial failure (lint fails at 3.8)

Brand Guardian's Pass 1 + Pass 2 has a broken token reference. `hooks/design-md-lint.ts` runs at Step 3.8 (`web-phase-branches.md:204`), classifies the finding as `broken-ref`, writes `docs/plans/evidence/design-md-lint.json`, exits 2.

- **Indexing already happened.** Hypothetically — if Step 3.0.idx were wired, it ran at T+15 BEFORE the lint gate. The graph fragment is on disk regardless of lint outcome.
- **What does `graph_query_dna().lint_status` return?** `storage/index.ts:322` reads `.buildanything/graph/lint-status.json`. **That file is never written.** `design-md-lint.ts:184` writes `docs/plans/evidence/design-md-lint.json`. Two different paths. **`lint_status` will always be `null`** until this is fixed.
- **Does BO know to flag it?** No — the brief surfaces `lint_status` from the DNA query, but `null` cannot detect a fail. Implementers see a clean-looking brief while the design lock is broken.
- **What SHOULD happen.** `hooks/design-md-lint.ts:184` should also write `.buildanything/graph/lint-status.json` with `{ status: "pass"|"warn"|"fail", ran_at, broken_refs, warnings }` after the existing write. Five-line patch:

  ```ts
  const lintStatusPath = resolve(cwd, ".buildanything/graph/lint-status.json");
  ensureDir(lintStatusPath);
  writeFileSync(lintStatusPath, JSON.stringify({
    status: brokenRefs > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    ran_at: summary.ran_at, broken_refs: brokenRefs, warnings,
  }, null, 2));
  ```

  Bug confirmed by reading the actual code, not hypothetical.

---

## 3. Walkthrough — re-entry from Phase 5/6

Phase 6 LRR routes a BLOCK back to Phase 3 (re-lock DNA — Density was wrong for the persona). Re-entry at Step 3.0 per `web-phase-branches.md:687`.

- **Re-run.** `design-brand-guardian` rewrites `DESIGN.md` Pass 1. Indexer (still hypothetically wired) re-fires. `slice-2-dna.json` is overwritten via `saveGraph`'s atomic tmp+rename (`storage/index.ts:84-94`). Old fragment dropped wholesale.
- **ID stability.** `dna_axis__density` ID stays the same — `ids.ts` (per schema §3) hashes axis name only. The `value` field changes. Correct.
- **Guideline orphans.** `dna_guideline__do__{sha256_8(text)}` IDs are content-hashed. Re-run with edited Do's/Don'ts produces different IDs. Old guideline nodes are NOT in the new fragment. Because `saveGraph` overwrites the full Pass 1 snapshot, orphan risk is zero — there is no merge step.
- **Cross-fragment edge integrity.** `dna_governs` edges from `slice-2-dna.json` to `slice-2-manifest.json` (schema §2 — Material axis dictating variant naming): if Step 3.0 re-runs but Step 3.2 does not, the new dna fragment may emit `dna_governs` edges to manifest IDs that still exist. ID stability rescues us. But if the new Material value diverges, the existing manifest's variants may now violate the new naming rule. Slice 2 does not catch this — schema §2 says the parser walks DESIGN.md only. Cross-fragment integrity is Slice 4's job.
- **Verdict:** wholesale-overwrite is correct. Cross-fragment edge consistency is a known Slice 4 gap.

---

## 4. Component manifest re-index after page-spec edits

Step 3.3 (`web-phase-branches.md:103`) writes page-specs *after* Step 3.2 wrote the manifest. A page-spec may reference a slot the manifest doesn't have — e.g. `notification-toast` because a screen's empty state shows a transient toast.

- **Effect.** BO calls `graph_query_manifest("notification-toast")` → `{ entries: [], by_slot: {} }` per `storage/index.ts:393-398`. Per `briefing-officer.md:39-45` empty-result is NOT a failure-fallback trigger (which is for tool-not-found, schema mismatch, missing fragment). BO records "manifest-gap; implementer uses sensible default" without falling back to file read.
- **Is this OK?** Half-OK. The implementer just wrote a custom `notification-toast` from scratch. The cleanup agent (Slice 2 ships its tool surface but defers prompt — schema §6.2) won't revert because `hard_gate: false` matches "no entry exists at all." Net: silent drift back to from-scratch components — exactly the Slice 0 problem.
- **What Phase 3 should do.** `web-phase-branches.md:217` describes a manifest-gap escape hatch — implementer writes + decision-log row + post-build catalog update. Reactive. A cleaner fix is a Step 3.3.5 ("manifest reconciliation") that diffs page-spec slot references against `slice-2-manifest.json`'s `by_slot` keys; if page-specs introduce new slots, re-dispatch `design-ui-designer` with the gap list.
- **Recommendation:** add a 6-line orchestrator check in `commands/build.md` between Step 3.3 and 3.4. Out of Slice 2 scope; flag for Slice 3.

---

## 5. iOS variant edge cases

`protocols/ios-phase-branches.md:184` describes Step 3.2-ios (Pass 2 of `DESIGN.md` for iOS). There is **no `component-manifest.md` writer in the iOS branch** — `grep "component-manifest" ios-phase-branches.md` returns zero matches.

- **BO on iOS.** `graph_query_manifest()` returns `null`. Falls through to file-read of `docs/plans/component-manifest.md` — file does not exist on iOS builds. BO logs warning per `briefing-officer.md:45` (`[graph-fallback: file-read used because file missing]`) and proceeds without manifest data.
- **DNA still works.** Per `ios-phase-branches.md:182`, `design-brand-guardian` writes Pass 1 of DESIGN.md for iOS too. `bin/graph-index.ts:24-26` keys on filename only. Slice 2 dispatch is platform-agnostic.
- **Why the asymmetry is OK.** SwiftUI standard library + `DESIGN.md` `## Components` YAML (`ios-phase-branches.md:184` — `nav-tab-bar`, `list-row`, `card-elevated`) covers slot picks at a different layer. iOS BO doesn't need a separate manifest — Slice 3 will index DESIGN.md's `components:` YAML as `component_token` nodes.
- **Asymmetry to document.** `agents/briefing-officer.md` should note that on iOS, `graph_query_manifest()` returning `null` is *expected*, not a fallback trigger. Two-line edit.

---

## 6. Multi-persona × DNA — interaction effects

A marketplace with Buyer (3-step checkout, `product-spec.md` L142) + Seller (payout SLA visibility, L156). DNA = Brutalist Character + Dense Density.

- **BO assembly.** Per `briefing-officer.md:118` ("All personas, every brief"), Persona field carries BOTH constraints. DNA card from `graph_query_dna()` — 7 axes, single set. Component picks via `graph_query_manifest("checkout-form")`.
- **Where conflicts hide.** Brutalist + Dense + 3-step checkout co-exist fine. But DNA = Brutalist Character + Aggressive Motion paired with an "elderly user, accessibility-first" persona constraint clashes hard. Step 3.2b DNA Persona Check (`web-phase-branches.md:101`) catches this at lock time, BEFORE Phase 4. But persona constraints may evolve in `product-spec.md` updates *after* Step 3.0; the check only runs once.
- **Incompatibility matrix vs runtime conflict.** `protocols/design-md-authoring.md` §3 catches DNA-internal contradictions. It does NOT catch DNA × persona-constraint conflicts — runtime concerns the Step 3.2b agent narrates in prose, not enforced mechanically.
- **What the pipeline does.** Step 3.2b emits `dna-persona-check.md`; if mismatches exist, backward edge to Step 3.0. After re-lock, no automatic re-validation. **Gap:** no Slice-2 edge `dna_axis -conflicts_with-> persona_constraint`. Adding one is Slice 4 territory.

---

## 7. The "what hasn't been indexed yet" problem

MCP tools return `null` for "not indexed" — `storage/index.ts:300` (queryDna) and `:384` (queryManifest). BO's fallback at `briefing-officer.md:42` covers null. Slice 3 introduces new windows.

- **Theoretical Slice 3 implementer scenario.** Phase 4 implementer dispatches at T+95. DESIGN.md Pass 1 indexed at T+15. Pass 2 indexing is Slice 3's Step 3.4.idx. Mid-build the implementer calls `graph_query_dna()` and gets `pass_complete: { pass1: true, pass2: false }`. Pass 2 token data isn't there.
- **What does the tool return?** Per `storage/index.ts:269-292`, `DnaQueryResult` ALWAYS includes `pass_complete`. The implementer must check this flag before relying on Pass 2 fields. Slice 3 will add a `tokens` block that's empty when `pass2: false`.
- **Contract that needs documenting.** `agents/briefing-officer.md:34` describes `graph_query_dna()` without telling consumers to check `pass_complete`. Fix: one-bullet append: "Check `pass_complete.pass1` before consuming axes/guidelines; check `pass_complete.pass2` before consuming tokens (Slice 3+)."

---

## 8. Race conditions in indexing

Two parallel `/build` invocations against the same project (CI alongside local).

- **Fragment writes.** `saveGraph` (`storage/index.ts:84-94`) uses tmp+rename. Last writer wins, POSIX rename is atomic on the same filesystem. No corruption.
- **Indexer concurrency.** Both processes compute fragments in memory and rename to target. Survivor is whichever rename completed last. Acceptable.
- **Lint side-channel.** `hooks/design-md-lint.ts:185` uses `writeFileSync(summaryPath, ...)` — NOT atomic. Parallel runs could partial-write and produce truncated JSON; `queryDna`'s catch at `storage/index.ts:332` falls back to `null`. Survivable but noisy.
- **Build log append.** `design-md-lint.ts:198` uses `appendFileSync`. POSIX guarantees `O_APPEND` is atomic for writes ≤ PIPE_BUF (4KB). Safe.
- **Recommendation (out of Slice 2):** patch `design-md-lint.ts:185` to tmp+rename. ~6 lines. Slice 2.5 follow-up.

---

## 9. Token budget — does this actually save anything?

Slice 1 claim: ~58% Phase 4 token reduction. Slice 2 adds DNA + manifest queries. Net delta?

- **DNA card cost.** 7 axes × ~50 chars = ~350 chars ≈ 90 tokens. Prior CONTEXT-header approach (`commands/build.md:93`) resolved DNA via file-read and pasted the same block. **Net: ~0.** Savings come from cleaner programmatic access, not raw token reduction.
- **Manifest entries.** ~15 entries × ~100 chars = ~1500 chars ≈ 380 tokens. Prior approach: BO grepped the ~3KB manifest and pasted relevant rows. Per-task targeted query (`graph_query_manifest(slot)`) returns one row at a time = ~100 chars × 5 tasks ≈ 125 tokens per brief. **Net: -65% on manifest data per brief.** Real savings.
- **DESIGN.md guidelines.** `## Do's and Don'ts` is ~1KB raw markdown when pasted; `graph_query_dna().guidelines` returns ~640 chars. Modest saving.
- **Net Slice 2 savings on top of Slice 1.** Roughly +5-10% additional reduction at Phase 4. Cumulative Phase 4 token-cost vs. Slice 0 baseline: ~63-68% reduction *once indexer triggers ship*. Until they do, savings = 0.

---

## 10. Open follow-ups for Slice 3+

Things this walkthrough surfaced that Slice 2 doesn't resolve:

- **CRITICAL — indexer triggers not wired.** `commands/build.md` lacks Step 3.0.idx and Step 3.2.idx. Schema §7 specifies them but no insertion was made. Without these, parsers run only via manual `bin/graph-index.js` invocation. **Must ship in a follow-up patch, not a future slice.**
- **CRITICAL — lint status path mismatch.** `hooks/design-md-lint.ts:184` writes `docs/plans/evidence/design-md-lint.json`; `src/graph/storage/index.ts:322` reads `.buildanything/graph/lint-status.json`. `graph_query_dna().lint_status` returns `null` permanently until bridged.
- **Lint side-channel atomic write.** `design-md-lint.ts:185` should use tmp+rename.
- **iOS manifest absence.** `briefing-officer.md` should note that on iOS `graph_query_manifest()` returning `null` is expected, not a fallback trigger.
- **DESIGN.md re-index orphans.** Wholesale-replace works for single fragment; cross-fragment edges (`dna_governs` from DNA → manifest entries) are not validated when one source re-indexes.
- **Page-spec → manifest gap workflow.** No reconciliation between page-spec component refs and manifest slots. Currently silent drift; needs Step 3.3.5 diff or a Slice 3 `slot_referenced_by_page_spec` edge.
- **Implementer read-only DNA access (Slice 3).** Should ladder cleanly because `queryDna` returns the full result deterministically. `pass_complete` flag must be documented as a precondition.
- **Cross-feature contract enforcement.** Slice 4. Persona-constraint × DNA-axis conflict edges are the cleanest extension.
- **`design_md__root` ID merge guard.** `loadAllGraphs` (`storage/index.ts:438`) errors on duplicate IDs across fragments. Slice 3 token extractor must NOT re-emit the root node.

---

## Bugs surfaced (real, found in code, need fixing now)

1. **Lint status path mismatch — `graph_query_dna().lint_status` permanently `null`.**
   - Read: `src/graph/storage/index.ts:322` reads `.buildanything/graph/lint-status.json`.
   - Write: `hooks/design-md-lint.ts:184` writes `docs/plans/evidence/design-md-lint.json`.
   - Schema §10.1 calls this out as an open redline; it stayed open.
   - Fix: ~5 lines in `design-md-lint.ts` to additionally write `.buildanything/graph/lint-status.json`.

2. **Slice 2 indexer triggers not wired into orchestrator.**
   - Searched: `grep "Step 3.0.idx\|Step 3.2.idx\|graph-index.js DESIGN\|graph-index.js docs/plans/component-manifest"` across `commands/build.md`, `protocols/web-phase-branches.md`, `protocols/ios-phase-branches.md` — zero matches.
   - Result: parsers in `src/graph/parser/design-md.ts` and `src/graph/parser/component-manifest.ts` are sound but never run during a build. `slice-2-dna.json` and `slice-2-manifest.json` will not appear on disk. Every Slice 2 MCP query returns `null`. BO falls back to file reads on every brief — Slice 2's Phase 4 token savings = 0% until this lands.
   - Fix: insert `Step 3.0.idx` after `web-phase-branches.md:73` (and the matching block in `commands/build.md`); insert `Step 3.2.idx` after `web-phase-branches.md:95`; insert `Step 3.0.idx` after `ios-phase-branches.md:182`. Each block ~6 lines, mirrors `commands/build.md:510-518`.

3. **`design-md-lint.ts` non-atomic writes.**
   - `writeFileSync(summaryPath, ...)` at `hooks/design-md-lint.ts:186` and `appendFileSync` at `:198`. Parallel builds risk truncated JSON.
   - Fix: tmp+rename for the JSON write, ~6 lines.

4. **BO Cognitive Protocol Step 2 retains stale references.**
   - `agents/briefing-officer.md:69` instructs the BO to read `visual-design-spec.md` "until later slices" — but per `CLAUDE.md` ("DESIGN.md consolidation") that file no longer exists. Should reference `DESIGN.md` directly.
   - Fix: one-line edit in `briefing-officer.md:69`.

5. **No documented contract for `pass_complete` precondition.**
   - `agents/briefing-officer.md:34` describes `graph_query_dna()` without telling consumers to check `pass_complete.pass1` / `pass_complete.pass2`.
   - Fix: one-bullet append.

These five are blockers for Slice 2 to deliver any of its claimed value at runtime. The schema doc and the parsers are correct; the wiring is incomplete.
