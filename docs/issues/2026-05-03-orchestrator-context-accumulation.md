# Critical Issue: Orchestrator Context Accumulation

**Date:** 2026-05-03
**Severity:** Critical — primary cost driver, blocks sustainable production builds
**Status:** Open — root cause identified, fix requires architectural change

---

## Problem

The orchestrator is an LLM (Claude on Opus) reading `build.md` (~130KB) in a single long-lived Claude Code session. Every phase's agent outputs, tool calls, and decisions accumulate in the orchestrator's context window. Because the Claude API bills the **full conversation history as input tokens on every turn**, the orchestrator's per-turn cost grows monotonically across the build.

Observed in a test build (GoodTables, 2026-05-03):
- Phase 0–1: orchestrator context ~200K tokens, manageable
- Phase 2 (5-architect debate via agent teams): orchestrator ballooned to **1.5M tokens**
- The orchestrator hit the Opus 5-hour usage limit in under 10 minutes
- Sonnet usage moved from 7% → 11% (model routing fix confirmed working), but Opus usage exploded because the orchestrator itself is on Opus and every turn bills the full 1.5M context

## Root Cause

The orchestrator is not a program — it is an LLM prompt (`commands/build.md`) interpreted by Claude in a single session. There is no context boundary between phases. The "SDK migration" (v2.0) moved tools (state_save, write_lease, cycle_counter, scribe) to MCP servers but left the orchestrator as an LLM session.

Every orchestrator turn — including trivial decisions like "are the agents done?" or "write a build-log line" — bills the full accumulated context as API input. At 1.5M tokens on Opus ($15/M input), a single orchestrator turn costs ~$22.50 in input alone.

### Cost accumulation model

| Phase | Approx orchestrator context | Cost per orchestrator turn (Opus input) |
|-------|----------------------------|----------------------------------------|
| 0     | ~50K                       | $0.75                                  |
| 1     | ~200K                      | $3.00                                  |
| 2     | ~1.5M (post-debate)        | $22.50                                 |
| 3     | ~2M+                       | $30.00+                                |
| 4     | ~3M+ (compaction kicks in) | sawtooth pattern                       |

Auto-compaction at ~95% of context window provides temporary relief but the orchestrator re-reads files to recover lost context, adding tokens back. The pattern is sawtooth, not flat.

### Phase 2 specifically

The 5-architect agent team debate is the worst offender. Agent teams feed results back to the orchestrator's context. Each architect produces ~50-100K tokens of output. The orchestrator accumulates all 5 before dispatching the synthesizer, pushing context from ~200K to ~1.5M in one phase.

## Impact

- A full `/build` run is economically unsustainable — estimated $50-100+ per build on Opus, vs the target ~$14 with proper model routing
- The Opus 5-hour usage limit is hit mid-build, stalling progress
- Later phases (4, 5, 6) are disproportionately expensive even if they do less work, because the orchestrator's context is already bloated from earlier phases
- Model routing improvements (v2.1.2) help agent costs but don't touch the orchestrator, which is the dominant cost

## Attempted Mitigations (insufficient)

1. **Model routing via agent frontmatter (v2.1.2)** — Confirmed working (Sonnet usage increased). Reduces agent costs ~71% but does not affect orchestrator cost, which is the primary driver.
2. **HARD-GATE preventing model override (v2.1.2)** — Prevents orchestrator from passing `model:` on Agent calls. Necessary but not sufficient.
3. **Compaction checkpoints at phase boundaries** — Discussed but not implemented. Would help but is a band-aid — the orchestrator still accumulates within each phase.

## Required Fix: Programmatic Orchestrator

Replace the LLM-as-orchestrator pattern with a Node.js (or Python) script that:

1. Reads `.build-state.json` to determine current phase
2. Dispatches agents via Claude Code CLI (`claude -p` with `--agent`) or the Agent SDK
3. Waits for completion by polling for output files on disk (not by accumulating results in context)
4. Runs graph indexer steps between phases
5. Advances the state machine by writing to `.build-state.json`
6. Invokes Claude (the LLM) **only** for: user interaction (brainstorming in Phase 1), judgment calls (gate reviews), and error recovery

The orchestrator's "context" becomes the state file + current phase dispatch table (~5K tokens), not the full build history (~1.5M+ tokens).

### What already exists

The plugin already has most of the pieces for this:
- State machine schema (`protocols/state-schema.json`, `protocols/state-schema.md`)
- Dispatch tables (currently in `build.md`, extractable to structured data)
- File-based coordination (graph slices, write-leases, evidence files)
- MCP tools for state management (state_save, write_lease, cycle_counter, scribe)
- Agent `.md` files with frontmatter (model, effort, tools, description)

### Estimated effort

1-2 weeks. The dispatch tables need to be extracted from `build.md` prose into structured config (JSON/YAML). The phase-gate logic needs to be codified. User interaction points (Phase 1 brainstorming, gate reviews) need a "hand off to LLM" escape hatch.

### Interim workaround

Until the programmatic orchestrator ships:
- Use subagents (not agent teams) for Phase 2 architects — each writes to disk, orchestrator gets only "done" confirmations
- Force compaction at every phase boundary
- Minimize orchestrator turns — batch decisions, don't poll

---

## Related

- v2.1.2 changelog: model routing fix (`agent_type` + HARD-GATE)
- `docs/graph/13-final-status.md` §5: token savings estimate (projected -55% to -65% — this projection assumed a lean orchestrator, which is not the current state)
- `protocols/state-schema.md`: existing state machine that the programmatic orchestrator would drive
