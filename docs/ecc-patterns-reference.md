# ECC Patterns Reference (Internal)

Patterns extracted from everything-claude-code that are relevant to buildanything.
Ranked by integration priority.

---

## Tier 1: High Impact — Integrate Now

### 1. De-Sloppify Pattern
Two focused agents outperform one constrained agent. After implementation, spawn a dedicated cleanup agent that ONLY fixes code quality — no new features, no architecture changes. The implementer optimizes for "make it work," the cleaner optimizes for "make it right."

**Where it applies:** Phase 5 (after each task implementation), Phase 6 (hardening fixes).

### 2. Author-Bias Elimination
The reviewer must NEVER share a context window with the implementer. When the measurement agent and fix agent in a metric loop share context, the fix agent unconsciously optimizes for the metric rather than actual quality. Separate context = honest measurement.

**Where it applies:** metric-loop.md — explicit rule that measure and fix agents are independent spawns.

### 3. Verification Loop (6-Phase Gate)
ECC runs Build → Type-Check → Lint → Test → Security-Scan → Diff-Review as a single compound check producing READY / NOT READY. Fast, deterministic, catches regressions before expensive audit agents run.

**Where it applies:** After Phase 4 scaffolding, after every Phase 5 task, before Phase 6, before Phase 7. Could be a protocol file: `commands/protocols/verify.md`.

### 4. Structured Handoff Documents
ECC's orchestrate command passes scoped handoff docs between agents in a chain — not the full architecture dump, but only: (a) relevant architecture section, (b) results from the previous agent, (c) specific acceptance criteria. Reduces noise, improves agent focus.

**Where it applies:** Phase 2 architecture agents, Phase 5 task agents, Phase 6 audit→fix chains.

---

## Tier 2: Medium Impact — Integrate Soon

### 5. Strategic Compaction Awareness
ECC tracks tool call count and suggests compaction at phase boundaries rather than mid-task. Add a check at each quality gate: "If context usage > 70%, trigger compaction before starting next phase." Prevents mid-metric-loop compaction which loses iteration state.

**Where it applies:** Every quality gate in build.md.

### 6. Build-Fix Protocol (One Error at a Time)
When builds break, don't dump all errors on a fix agent. Fix the FIRST error, rebuild, check if others cascade-resolved. Most build errors are cascading — fixing the root clears 5-10 downstream errors.

**Where it applies:** Phase 4 scaffolding, Phase 5 when builds break mid-task. Could be a protocol: `commands/protocols/build-fix.md`.

### 7. Eval Harness Pattern
Instead of subjective "audit" agents, define formal eval cases with pass@k metrics. "Does endpoint X return 401 without auth? Run 5 times, pass@5 required." More rigorous and reproducible than narrative audits.

**Where it applies:** Phase 6 hardening — especially API testing and security audit agents.

---

## Tier 3: Nice to Have — Defer to v2

### 8. Instinct System (Continuous Learning)
Hook-driven observation + project-scoped instincts with confidence scoring and decay. Lets buildanything learn from past builds: "Next.js projects always need X config." Complex, requires persistent state beyond a single build session.

**Deferral reason:** Requires cross-session persistence infrastructure. Single-build focus for v1.

### 9. Continuous Claude PR Loop (Multi-Day)
Pattern for multi-day autonomous work with CI gates between sessions. Relevant if builds span multiple sessions.

**Deferral reason:** Autonomous mode already handles single-session overnight builds. Multi-session is v2.

### 10. Tiered Complexity Routing
Route simple tasks to Haiku, complex to Sonnet/Opus. Reduces cost but adds configuration complexity. Users can set model preferences themselves.

**Deferral reason:** Low ROI relative to implementation complexity. Users control model selection.

---

## Source
Extracted from `~/.claude/plugins/cache/everything-claude-code/everything-claude-code/1.7.0/` on 2026-03-10.
