# Worktree Orchestration Pattern

**Date:** 2026-05-05
**Status:** Confirmed viable (tested 2026-05-04)
**Solves:** Inter-phase context drag, agent team lead bloat, pipeline speed

---

## Core Pattern

The main session (user-facing, interactive) never does heavy work. It launches headless worktree sessions for each phase. Each worktree session starts with clean context, does its work, writes outputs to disk, and exits. The main session polls for completion and advances the state machine.

```
claude -p --worktree <name> --model <model> "<prompt>"
```

- `--worktree <name>` — creates an isolated git worktree checkout + fresh Claude Code session
- `--model <model>` — sets the model for that session (haiku for coordination, sonnet/opus for real work)
- `-p` — non-interactive (headless), no terminal UI, runs as background process
- The prompt tells the session what to do
- Session exits when done; worktree is cleaned up automatically if no file changes

---

## Confirmed Capabilities (tested 2026-05-04)

| Capability | Works? | Notes |
|---|---|---|
| `claude -p --worktree` launches a fresh session | ✅ | Own context window, clean start |
| Headless session can call TeamCreate | ✅ | Full team management |
| Headless session can spawn teammates (Agent tool) | ✅ | Unlike subagents, full sessions have Agent tool |
| Teammates communicate via SendMessage | ✅ | Peer-to-peer, doesn't go through lead |
| Headless session can TeamDelete | ✅ | Proper shutdown handshake |
| Headless session can write files to disk | ✅ | Shared repo (same git worktree) |
| Main session can poll for output files | ✅ | Standard file existence check |
| `--model` flag sets session model | ✅ | Haiku for cheap leads, Opus for real work |

---

## How to Launch a Worktree Phase

### From the main session (orchestrator):

```bash
claude -p --worktree phase-2-arch --model haiku \
  "You are the Phase 2 team lead for buildanything. Your ONLY job is coordination — do NOT do architecture work yourself.

  1. Read docs/plans/.build-state.json to confirm phase=2
  2. Read docs/plans/design-doc.md and docs/plans/product-spec.md (these are your inputs)
  3. Call TeamCreate with team_name 'phase-2-architects'
  4. Spawn 4 teammates: [architect prompts here]
  5. Wait for all 4 to idle
  6. Call TeamDelete
  7. Write 'complete' to docs/plans/.phase-2-signal

  If any teammate crashes, log the error to docs/plans/build-log.md and still write the signal file with status 'partial'.
  "
```

### Main session waits:

```bash
while [ ! -f docs/plans/.phase-2-signal ]; do sleep 5; done
```

Or use a subagent with a Bash tool call that blocks until the file appears.

### Main session continues:

Reads the signal file, checks status, advances `.build-state.json`, proceeds to next phase.

---

## Signal File Convention

Each worktree phase writes a signal file when done:

```
docs/plans/.phase-<N>-signal
```

Contents (JSON):
```json
{
  "status": "complete",
  "phase": 2,
  "step": "2.2d",
  "outputs": ["docs/plans/phase-2-contracts/*.md"],
  "errors": [],
  "timestamp": "2026-05-05T01:00:00Z"
}
```

Status values: `complete`, `partial` (some work done, errors logged), `failed`.

Main session reads this to decide whether to proceed, retry, or ask the user.

---

## Model Selection Per Phase

| Phase | Session type | Model | Why |
|---|---|---|---|
| 0+1 | Main session (interactive) | Opus | User brainstorming needs intelligence |
| 2 (team lead) | Headless worktree | **Haiku** | Just coordination — create team, wait, delete |
| 2 (architects) | Teammates spawned by lead | Sonnet/Opus | Actual architecture thinking |
| 3 | Headless worktree | Sonnet | Design work, autonomous |
| 4 setup | Headless worktree | Sonnet | Scaffolding + PO planning |
| 4 features | Headless worktrees (parallel) | Sonnet | Code implementation |
| 5 | Headless worktree | Sonnet | Auditing (read-heavy) |
| 6 | Headless worktree | Sonnet | LRR judges + aggregator |
| 7 | Headless worktree | Sonnet | Ship (docs + deploy) |

---

## Phase 2 Specific Configuration

Phase 2 is the most complex because it uses agent teams.

### Architecture:

```
Main session (Opus, interactive)
  │
  ├── [Phase 0+1 runs here — brainstorming, gates]
  │
  ├── Bash: claude -p --worktree phase-2-arch --model haiku "<lead prompt>"
  │     │
  │     ├── TeamCreate("phase-2-architects")
  │     ├── Spawn: backend-architect (Sonnet)
  │     ├── Spawn: frontend-architect (Sonnet)
  │     ├── Spawn: data-engineer (Sonnet)
  │     ├── Spawn: performance-benchmarker (Sonnet)
  │     │
  │     │   [architects debate via SendMessage — peer to peer]
  │     │   [heartbeats go to Haiku lead — cheap, disposable]
  │     │
  │     ├── All idle detected
  │     ├── TeamDelete
  │     └── Write .phase-2-signal
  │
  ├── [Main session detects signal, presents Gate 2 to user]
  │
  ├── Bash: claude -p --worktree phase-2-synth --model sonnet "<synthesizer prompt>"
  │     │
  │     ├── Reads all 4 contract files from disk
  │     ├── Writes architecture.md
  │     ├── Writes sprint-tasks.md
  │     ├── Runs refs indexer
  │     └── Write .phase-2-synth-signal
  │
  └── [Main session continues to Phase 3]
```

### Why split debate and synthesis into two worktrees:

- The debate worktree (Haiku lead) bloats from heartbeats — throw it away
- The synthesis worktree (Sonnet) starts clean, reads contracts from disk, produces clean output
- Neither pollutes the main session

---

## Phase 4 Parallel Features Configuration

Phase 4 spawns dynamic worktrees per feature within each wave.

### Architecture:

```
Main session
  │
  ├── Bash: claude -p --worktree phase-4-setup --model sonnet "<scaffold + PO planning>"
  │     └── Writes feature-delegation-plan.json + .phase-4-setup-signal
  │
  ├── [Main session reads delegation plan, determines wave 1 features]
  │
  ├── For each feature in wave (PARALLEL):
  │   ├── Bash: claude -p --worktree phase-4-feat-auth --model sonnet "<feature prompt>" &
  │   ├── Bash: claude -p --worktree phase-4-feat-dashboard --model sonnet "<feature prompt>" &
  │   └── Bash: claude -p --worktree phase-4-feat-settings --model sonnet "<feature prompt>" &
  │
  ├── Wait for all: while [ ! -f .phase-4-feat-*-signal ]; do sleep 5; done
  │
  ├── Merge branches: git merge phase-4-feat-auth phase-4-feat-dashboard ...
  │
  ├── Bash: claude -p --worktree phase-4-accept --model sonnet "<PO acceptance>"
  │
  └── [Repeat for wave 2...]
```

### File conflict prevention:

- Each feature worktree works on its own branch (automatic with `--worktree`)
- Features SHOULD touch different files (PO plans this)
- If merge conflicts occur: main session launches a conflict-resolution worktree
- Write-lease MCP needs cross-process awareness (future work — use lockfile on disk)

---

## Prompt Template for Worktree Sessions

Every worktree session prompt follows this structure:

```
You are [role] for the buildanything plugin, Phase [N].

CONTEXT (read these files before starting):
- docs/plans/.build-state.json (current state)
- [phase-specific input files]

YOUR TASK:
[specific instructions]

OUTPUT:
- Write results to: [specific paths]
- When done, write signal: docs/plans/.phase-<N>-signal with JSON: {"status": "complete", ...}

CONSTRAINTS:
- Do NOT read or modify files outside your scope
- Do NOT interact with the user (this is headless)
- If you encounter an error, write it to the signal file with status "failed"
```

---

## Main Session Orchestration Loop

The main session's job is minimal:

```
1. Run Phase 0+1 interactively (brainstorm, gates)
2. Compact context
3. For each remaining phase:
   a. Construct the worktree prompt (from phase-graph.yaml dispatch table)
   b. Launch: claude -p --worktree <name> --model <model> "<prompt>"
   c. Wait for signal file
   d. Read signal, check status
   e. If failed: ask user what to do
   f. If complete: update .build-state.json, proceed
   g. If gate needed: present to user (interactive)
4. Show final summary
```

Main session context never exceeds ~100K (build.md + state file + minimal conversation).

---

## Backward Routing with Worktrees

When Phase 6 LRR says BLOCK and routes back to Phase 2:

1. Main session reads the backward routing payload from `evidence/lrr-routing.json`
2. Launches a new worktree: `claude -p --worktree phase-2-reentry --model sonnet`
3. Prompt includes the re-entry template: `{blocking_finding, prior_output, decision_row}`
4. The re-entry worktree reads the existing contracts, revises only the affected architect's domain
5. Writes updated files + signal

The re-entry worktree doesn't need memory of the original debate — it has the contracts on disk and the specific finding to address.

---

## Cleanup

- Worktrees with no changes are auto-cleaned by Claude Code on exit
- Worktrees with commits stay until merged or manually removed
- Signal files are ephemeral — can be cleaned after state machine advances
- Team files (`~/.claude/teams/`) are cleaned by TeamDelete within the worktree session

---

## Phase Map: What Gets Worktree'd

| Phase | Worktree? | Model | Reason |
|---|---|---|---|
| 0 | ❌ Main session | Opus | Classification, needs conversation context |
| 1 | ❌ Main session | Opus | Interactive brainstorming with user |
| Gate 1 | ❌ Main session | Opus | User approval |
| 2 (team lead) | ✅ Headless worktree | Haiku | Disposable — absorbs heartbeat bloat |
| 2 (synthesis) | ✅ Headless worktree | Sonnet | Reads contracts from disk, writes architecture.md |
| Gate 2 | ❌ Main session | Opus | User approval |
| 3 | ✅ Headless worktree | Sonnet | Autonomous design work |
| 4 (setup + PO) | ✅ Headless worktree | Sonnet | Scaffold + delegation planning |
| 4 (features) | ✅ Parallel headless worktrees | Sonnet | One per feature per wave |
| 4 (acceptance) | ✅ Headless worktree | Sonnet | PO reviews merged result |
| 5 | ✅ Headless worktree | Sonnet | Audit (read-heavy, subagents inside) |
| 6 | ✅ Headless worktree | Sonnet | LRR judges + aggregator |
| 6 (backward route) | ❌ Main session decides | Opus | User-facing decision on re-entry |
| 7 | ✅ Headless worktree | Sonnet | Ship (docs + deploy) |

**Main session stays alive the entire build.** It handles: user interaction, gate approvals, backward routing decisions, state machine advancement, and launching/monitoring worktrees.

---

## Known Issues (Phase 4 Parallel Only)

These only apply when multiple feature worktrees run simultaneously. Sequential phases (2, 3, 5, 6, 7) are unaffected.

### 1. decisions.jsonl — concurrent append race

**Problem:** Each parallel feature worktree has its own scribe MCP instance. If two features write decision rows at the same time, they assign duplicate IDs and may corrupt the file with interleaved writes.

**Fix:** Each feature worktree writes to its own local file (e.g., `decisions-feat-auth.jsonl`). After all features in a wave complete and branches merge, the main session concats the per-feature files into the main `decisions.jsonl` and re-assigns global sequential IDs. Simple append + renumber.

**Severity:** Low — only matters for Phase 4 parallel features. Easy fix.

### 2. write-lease MCP — cross-process invisibility

**Problem:** The write-lease system (which prevents two agents from editing the same file) runs in-memory per session. Parallel feature worktrees each have their own lease manager and can't see each other's claims. Two features could both claim the same shared file (e.g., `src/lib/utils.ts`) without knowing.

**Fix (short-term):** Rely on git merge to catch conflicts. The Product Owner's delegation plan assigns features to different parts of the codebase, so conflicts should be rare. When merge conflicts occur, launch a conflict-resolution worktree.

**Fix (long-term):** Move lease state to a shared lockfile on disk that all worktree sessions check before writing. Requires cross-process file locking (flock or similar).

**Severity:** Medium — only matters for Phase 4 parallel features. Edge case if PO plans well.

---

## Migration Path

1. **Immediate:** Implement Phase 2 worktree (Haiku lead + architect debate). Biggest cost win.
2. **Next:** Phase 3, 5, 6, 7 as sequential worktrees (context isolation). No new infra needed.
3. **Then:** Phase 4 parallel feature worktrees (speed win). Requires decisions.jsonl concat + merge strategy.
4. **Last:** Full orchestration loop in main session with phase-graph.yaml dispatch table.

Each step is independently shippable and testable.
