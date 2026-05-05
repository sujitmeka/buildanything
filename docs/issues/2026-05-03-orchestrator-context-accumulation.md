# Critical Issue: Orchestrator Context Accumulation

**Date:** 2026-05-03 (updated 2026-05-04)
**Severity:** Critical — primary cost driver, blocks sustainable production builds
**Status:** Open — root causes identified, architectural solutions under evaluation

---

## The Orchestrator's Role

The orchestrator is an LLM (Claude on Opus) reading `build.md` (~130KB) in a single long-lived Claude Code session. It is an **engagement manager** — it does not write code, review code, run tests, or do design. Its job is to:

- Know where we are in the 8-phase pipeline
- Kick off the next phase/agent/team when the previous one finishes
- Track status of team members and subagents
- Coordinate handoffs between phases
- Allow the user to interact mid-build

It should be the lightest session in the entire build. Instead, it is the most expensive.

---

## Known Problem 1: Agent Team Feedback Loop (Intra-Phase Bloat)

**Observed in:** Phase 2 (5-architect debate), any phase using agent teams

### What happens

1. The orchestrator creates an agent team (`TeamCreate`) and dispatches 5 architects as teammates
2. The architects debate via `SendMessage` — this is valuable and works correctly
3. **The problem:** As team lead, the orchestrator receives all coordination traffic:
   - Idle heartbeat notifications every 2-4 seconds from each teammate (5 architects × heartbeat every few seconds = constant inbox traffic)
   - Message delivery notifications when teammates communicate
   - Status updates, task completions, shutdown handshakes
4. Every time the orchestrator processes an inbox message, it is a full LLM turn that re-sends the **entire accumulated context** as input tokens
5. The orchestrator's job during the debate is mostly just waiting — "are they done yet?" — but each check costs the full context price

### Impact

- Orchestrator context balloons from ~200K to ~1.5M tokens within a single phase
- At Opus rates ($15/M input), each orchestrator turn costs ~$22.50
- The Opus 5-hour usage limit was hit in under 10 minutes during the GoodTables test build (2026-05-03)
- The architects themselves are fine — they have their own context windows. The problem is entirely on the lead/orchestrator side

### Why this is hard

This is baked into how Claude Code agent teams work. The team lead is an LLM session. Every inbox read is an LLM turn. There is no way to "silently" process heartbeats without billing the full context. Hooks (`TeammateIdle`, `TaskCompleted`) can run shell scripts, but it is unclear whether they fully prevent the lead LLM from waking up to process messages.

### Cost model (Phase 2)

| Event | Frequency | Context size | Cost per event |
|-------|-----------|-------------|----------------|
| Idle heartbeat (per architect) | Every 2-4 sec | ~200K → ~1.5M (growing) | $3.00 → $22.50 |
| Message delivery | Per SendMessage | Same | Same |
| "Are they done?" check | Per orchestrator turn | Same | Same |

---

## Known Problem 2: Phase-to-Phase Context Drag (Inter-Phase Bloat)

### What happens

1. The orchestrator runs all 8 phases (0–7) in a single session
2. Each phase's agent outputs, tool calls, coordination traffic, and decisions accumulate in the orchestrator's context
3. There is no context boundary between phases
4. By Phase 3-4, the orchestrator is approaching the ~1M token limit and auto-compaction kicks in at ~95% capacity
5. Auto-compaction provides temporary relief but the orchestrator re-reads files to recover lost context, creating a sawtooth pattern — not a flat line

### The mismatch

The orchestrator's phase-to-phase duties are simple:
- Read the state file to know what phase we're in
- Kick off the next set of agents
- Check if they're done
- Advance the state machine

It does **not** need to retain the full output of what agents produced in prior phases. It just needs to know: where are we, what's the status, what's next. But because it's a single LLM session, it carries everything — every agent result, every coordination message, every tool call — forward into every subsequent phase.

### Cost model (cross-phase)

| Phase | Approx orchestrator context | Cost per orchestrator turn (Opus input) |
|-------|----------------------------|----------------------------------------|
| 0     | ~50K                       | $0.75                                  |
| 1     | ~200K                      | $3.00                                  |
| 2     | ~1.5M (post-debate)        | $22.50                                 |
| 3     | ~2M+                       | $30.00+                                |
| 4     | ~3M+ (compaction kicks in) | sawtooth pattern                       |

### Impact

- Later phases are disproportionately expensive even if they do less work
- A full `/build` run costs $50-100+ on Opus vs the target ~$14
- Model routing improvements (v2.1.2) help agent costs (~71% reduction) but don't touch the orchestrator, which is the dominant cost driver

---

## New Problem: Sequential Pipeline Speed

### What happens

The 8-phase pipeline runs sequentially in a single session. Each phase waits for the previous one to fully complete before starting. A full `/build` takes a long time — not just because of token cost, but because phases that could overlap are forced to wait.

### The opportunity: Git Worktrees as Parallel Sessions

Claude Code supports git worktrees (`--worktree` or `-w`) as a first-class feature for running **parallel sessions**. This is not just file isolation — each worktree is a completely independent Claude Code session with:

- Its own context window (starts clean, no inherited bloat)
- Its own ability to spawn subagents
- Its own ability to create agent teams
- Its own skills, MCP servers, CLAUDE.md
- Full tool access

This is fundamentally different from subagents (which run inside a parent session) or agent teams (which coordinate via shared task lists). Worktree sessions are independent Claude Code instances that share the same repo.

### What this could enable

Instead of one orchestrator session dragging accumulated context through all 8 phases:

- **Each phase (or group of phases) runs in its own worktree session** with a clean context
- Phases coordinate via files on disk (`.build-state.json`, output files in `docs/plans/`)
- Independent phases can run in parallel (e.g., parts of Phase 4 build tasks that don't depend on each other)
- Each session starts lean and stays lean — no inter-phase context drag
- A bloated Phase 2 team lead session gets thrown away; Phase 3 starts fresh

### What needs to be figured out

- **Orchestration logic:** Something needs to coordinate which worktree sessions to launch, when, and in what order. This could be a lightweight script, a thin LLM session, or a hook-based system.
- **State handoff:** Each worktree session needs to know where the build is, what prior phases produced, and what it's responsible for. The existing `.build-state.json` + `docs/plans/` file convention may already be sufficient.
- **User interaction:** The user currently talks to the orchestrator mid-build. With worktree sessions, which session does the user talk to? There may need to be a "control plane" session that stays alive.
- **Dependency graph:** Not all phases are strictly sequential. The dependency graph between phases needs to be mapped to determine what can actually overlap.

---

## Attempted Mitigations (insufficient for Known Problems 1 & 2)

1. **Model routing via agent frontmatter (v2.1.2)** — Confirmed working (Sonnet usage increased). Reduces agent costs ~71% but does not affect orchestrator cost.
2. **HARD-GATE preventing model override (v2.1.2)** — Prevents orchestrator from passing `model:` on Agent calls. Necessary but not sufficient.
3. **Compaction checkpoints at phase boundaries** — Discussed but not implemented. Band-aid — doesn't fix intra-phase bloat.

---

## Solution Directions

### For Known Problem 1 (Agent Team Lead Bloat)

| Approach | How it works | Saves | Effort | Solves root cause? |
|----------|-------------|-------|--------|-------------------|
| **Cheap disposable lead** | Run the team lead session on Sonnet/Haiku in a worktree. It bloats and gets thrown away. Orchestrator never touches the team traffic. | ~80% (cheaper model + disposable) | Medium | No — same bloat, just cheaper and isolated |
| **Hooks-based coordination** | Use `TeammateIdle`/`TaskCompleted` hooks to handle "are they done?" via shell scripts instead of LLM turns | Unknown | Low | Maybe — depends on whether hooks prevent LLM wake-ups |
| **Compaction sandwich** | Force compaction before and after the team phase | Low (Phase 2 still expensive, downstream phases cleaner) | Hours | No — band-aid |

### For Known Problem 2 (Phase-to-Phase Drag)

| Approach | How it works | Saves | Effort | Solves root cause? |
|----------|-------------|-------|--------|-------------------|
| **Worktree-per-phase** | Each phase runs in its own worktree session with clean context. Coordinate via state files on disk. | High — each phase starts at ~50K not ~1.5M+ | High | Yes |
| **Forced compaction at phase boundaries** | Compact between every phase transition | Medium | Low | Partially — lossy, sawtooth |
| **Session restart per phase** | Kill and restart the orchestrator session between phases, loading only state file | High | Medium | Yes, but loses interactivity |

### For New Problem (Pipeline Speed)

| Approach | How it works | Saves | Effort | Solves root cause? |
|----------|-------------|-------|--------|-------------------|
| **Worktree-based parallel pipeline** | Map phase dependency graph, run independent phases in parallel worktree sessions, coordinate via disk | Significant wall-clock time reduction | High | Yes |

### Combined Solution: Worktree-Based Build Architecture

The three problems converge on one architectural direction: **worktree sessions as the unit of execution**.

1. A lightweight coordinator (script or thin LLM session) reads `.build-state.json` and launches worktree sessions for each phase
2. Each phase session starts with clean context, runs its work (including agent teams if needed), writes outputs to `docs/plans/`, and exits
3. The coordinator advances the state machine when phase outputs appear on disk
4. Independent phases overlap in parallel worktree sessions
5. Agent team lead bloat is contained to disposable phase sessions (run on cheaper models)
6. The user interacts with the coordinator session, which stays lean because it never absorbs agent/team output

**Open questions:**
- Can the coordinator be a simple Node.js script that launches `claude --worktree <phase> -p "run phase N"` commands? Or does it need to be an LLM session for judgment calls?
- How do we handle Phase 1 brainstorming (interactive) vs Phase 4 build (autonomous)?
- What's the minimal state each phase session needs to start? (Likely: `.build-state.json` + `CLAUDE.md` + `docs/plans/` directory)
- How do we handle error recovery and re-entry (e.g., LRR backward routing from Phase 6 to Phase 2)?

### Estimated effort

- **Immediate (hours):** Compaction sandwich — force compaction at every phase boundary
- **Short-term (days):** Cheap disposable lead for Phase 2 — run team lead in a worktree on Sonnet
- **Medium-term (1-2 weeks):** Worktree-per-phase architecture — each phase in its own session
- **Long-term (2-4 weeks):** Full parallel pipeline with dependency graph and coordinator

---

## Related

- v2.1.2 changelog: model routing fix (`agent_type` + HARD-GATE)
- `docs/graph/13-final-status.md` §5: token savings estimate (projected -55% to -65% — assumed lean orchestrator)
- `protocols/state-schema.md`: existing state machine for phase coordination
- [Claude Code worktrees docs](https://code.claude.com/docs/en/worktrees): official parallel session support
- [Claude Code agent teams docs](https://code.claude.com/docs/en/agent-teams): team lead mechanics, heartbeat protocol, hooks
- [Claude Code subagents docs](https://code.claude.com/docs/en/sub-agents): subagent limitations (cannot spawn subagents)
