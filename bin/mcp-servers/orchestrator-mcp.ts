#!/usr/bin/env tsx
/**
 * Orchestrator stdio MCP server.
 *
 * This is the stdio bridge that Claude-Code-hosted sessions auto-start via
 * plugin.json's `mcpServers` block. It exposes the four orchestrator
 * toolsets — state_save, write_lease, cycle_counter, scribe — as a single
 * MCP server with 10 tools total.
 *
 * The Agent SDK code path (bin/buildanything-runtime.ts) registers the same
 * underlying handlers in-process via createSdkMcpServer; this file owns the
 * stdio path. Both import the same handler implementations from
 * src/orchestrator/mcp/*.ts — the bifurcation is only at the transport layer.
 *
 * Tools exposed:
 *   state-save: state_save, state_read, verify_integrity
 *   write-lease: acquire_write_lease, release_write_lease, list_write_leases
 *   cycle-counter: cycle_counter_check, clear_in_flight_edge, handle_stale_edge
 *   scribe: scribe_decision
 */

import { resolve } from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  stateSave,
  stateRead,
  verifyIntegrity,
} from "../../src/orchestrator/mcp/state-save.js";
import {
  acquireWriteLease,
  releaseLease,
  getActiveLeases,
  init as initWriteLease,
} from "../../src/orchestrator/mcp/write-lease.js";
import {
  cycleCounterCheck,
  clearInFlightEdge,
  handleStaleEdge,
  type CounterState,
} from "../../src/orchestrator/mcp/cycle-counter.js";
import { scribeDecision, loadCounters } from "../../src/orchestrator/mcp/scribe.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
  };
}

function errResult(toolName: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [
      { type: "text" as const, text: `${toolName} error: ${message}` },
    ],
  };
}

// ---------------------------------------------------------------------------
// Zod input shapes (mirror bin/adapters/*-tool.ts verbatim)
// ---------------------------------------------------------------------------

const stateSaveShape = {
  path: z.string().min(1),
  state: z.record(z.string(), z.unknown()),
};

const stateReadShape = {
  path: z.string().min(1),
};

const verifyIntegrityShape = {
  path: z.string().min(1),
  expected_sha256: z.string().min(1),
};

const acquireLeaseShape = {
  task_id: z.string().min(1),
  file_paths: z.array(z.string().min(1)).min(1),
};

const releaseLeaseShape = {
  task_id: z.string().min(1),
};

const listLeasesShape = {} as const;

const inFlightEdgeSchema = z.object({
  decision_id: z.string().min(1),
  target_phase: z.string().min(1),
  counter_value: z.number().int().nonnegative(),
  started_at: z.string().min(1),
});

const counterStateSchema = z.object({
  backward_routing_count: z.record(z.string(), z.number().int().nonnegative()),
  backward_routing_count_by_target_phase: z.record(z.string(), z.number().int().nonnegative()),
  in_flight_backward_edge: inFlightEdgeSchema.optional(),
});

const cycleCheckShape = {
  state: counterStateSchema,
  input: z.object({
    decision_id: z.string().min(1),
    target_phase: z.string().min(1),
  }),
  max_cycles: z.number().int().positive().optional(),
};

const clearEdgeShape = {
  state: counterStateSchema,
};

const staleEdgeShape = {
  state: counterStateSchema,
  threshold_ms: z.number().int().positive().optional(),
};

const rejectedAlternativeSchema = z.object({
  approach: z.string().min(1),
  reason: z.string().min(1),
  revisit_criterion: z.string().min(1),
});

const scribeShape = {
  phase: z.string().min(1),
  category: z.string().min(1),
  summary: z.string().min(1),
  decided_by: z.string().min(1),
  impact_level: z.enum(["low", "medium", "high", "critical"]),
  chosen_approach: z.string().min(1),
  rejected_alternatives: z.array(rejectedAlternativeSchema).max(3).optional(),
  ref: z.string().optional(),
};

// ---------------------------------------------------------------------------
// Server registration
// ---------------------------------------------------------------------------

const BUILD_STATE_PATH_REL = "docs/plans/.build-state.json";
const DECISIONS_PATH_REL = "docs/plans/decisions.jsonl";

function registerTools(server: McpServer, decisionsPath: string): void {
  // --- state_save toolset ------------------------------------------------

  server.registerTool(
    "state_save",
    {
      description:
        "Atomically persist state to a JSON file via write-to-.tmp + fsync + rename. Returns {success, path, sha256, bytesWritten}. Single writer for .build-state.json.",
      inputSchema: stateSaveShape,
    },
    async (args) => {
      try {
        const result = stateSave(args.path, args.state as Record<string, unknown>);
        return okResult(result);
      } catch (err) {
        return errResult("state_save", err);
      }
    },
  );

  server.registerTool(
    "state_read",
    {
      description:
        "Read state from a JSON file and compute its SHA-256 checksum. Returns {state, sha256}.",
      inputSchema: stateReadShape,
    },
    async (args) => {
      try {
        return okResult(stateRead(args.path));
      } catch (err) {
        return errResult("state_read", err);
      }
    },
  );

  server.registerTool(
    "verify_integrity",
    {
      description:
        "Verify a state file's SHA-256 matches the expected checksum. Returns {matches:boolean}.",
      inputSchema: verifyIntegrityShape,
    },
    async (args) => {
      try {
        const matches = verifyIntegrity(args.path, args.expected_sha256);
        return okResult({ matches });
      } catch (err) {
        return errResult("verify_integrity", err);
      }
    },
  );

  // --- write_lease toolset ----------------------------------------------

  server.registerTool(
    "acquire_write_lease",
    {
      description:
        "Acquire an exclusive write lease on one or more file paths for a task. Returns granted:true with the lease, or granted:false with conflict details when another task holds an overlapping lease.",
      inputSchema: acquireLeaseShape,
    },
    async (args) => {
      try {
        const result = acquireWriteLease(args.task_id, args.file_paths);
        return okResult(result);
      } catch (err) {
        return errResult("acquire_write_lease", err);
      }
    },
  );

  server.registerTool(
    "release_write_lease",
    {
      description:
        "Release all write leases held by a task. Called by SubagentStop hook on dispatch return. Returns released:true if a lease existed, false otherwise.",
      inputSchema: releaseLeaseShape,
    },
    async (args) => {
      try {
        const released = releaseLease(args.task_id);
        return okResult({ released });
      } catch (err) {
        return errResult("release_write_lease", err);
      }
    },
  );

  server.registerTool(
    "list_write_leases",
    {
      description:
        "List all active write leases (holder, paths, acquired_at). Read-only; intended for orchestrator diagnostics and .build-state.json persistence snapshots.",
      inputSchema: listLeasesShape,
    },
    async () => {
      try {
        const leases = getActiveLeases();
        return okResult({ leases });
      } catch (err) {
        return errResult("list_write_leases", err);
      }
    },
  );

  // --- cycle_counter toolset --------------------------------------------

  server.registerTool(
    "cycle_counter_check",
    {
      description:
        "Check and increment backward-routing counters (per-decision + per-target-phase). Returns {action: allow|escalate_to_user, decision_count, phase_count, state} where state is the mutated CounterState to persist via state_save.",
      inputSchema: cycleCheckShape,
    },
    async (args) => {
      try {
        const state = args.state as CounterState;
        const result = cycleCounterCheck(state, args.input, args.max_cycles);
        return okResult({ ...result, state });
      } catch (err) {
        return errResult("cycle_counter_check", err);
      }
    },
  );

  server.registerTool(
    "clear_in_flight_edge",
    {
      description:
        "Clear the in_flight_backward_edge field (called by target phase on re-entry). Returns {state} for the caller to persist via state_save.",
      inputSchema: clearEdgeShape,
    },
    async (args) => {
      try {
        const state = args.state as CounterState;
        clearInFlightEdge(state);
        return okResult({ state });
      } catch (err) {
        return errResult("clear_in_flight_edge", err);
      }
    },
  );

  server.registerTool(
    "handle_stale_edge",
    {
      description:
        "On --resume, if in_flight_backward_edge is older than threshold_ms (default 60000), decrement both counters and clear the edge. Returns {cleaned:boolean, state}.",
      inputSchema: staleEdgeShape,
    },
    async (args) => {
      try {
        const state = args.state as CounterState;
        const cleaned = handleStaleEdge(state, args.threshold_ms);
        return okResult({ cleaned, state });
      } catch (err) {
        return errResult("handle_stale_edge", err);
      }
    },
  );

  // --- scribe toolset ----------------------------------------------------

  server.registerTool(
    "scribe_decision",
    {
      description:
        "Append a decision row to docs/plans/decisions.jsonl. Single-writer per migration plan; validates against decisions.schema.json.",
      inputSchema: scribeShape,
    },
    async (args) => {
      try {
        const row = scribeDecision(args, decisionsPath);
        return okResult(row);
      } catch (err) {
        return errResult("scribe_decision", err);
      }
    },
  );
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const buildStatePath = resolve(cwd, BUILD_STATE_PATH_REL);
  const decisionsPath = resolve(cwd, DECISIONS_PATH_REL);

  // Hydrate in-memory stores from disk so they match persisted state across
  // restarts. Mirrors bin/buildanything-runtime.ts:235 (write-lease) and
  // bin/adapters/scribe-tool.ts:40 (scribe counters).
  initWriteLease(buildStatePath);
  loadCounters(decisionsPath);

  const server = new McpServer(
    { name: "buildanything-orchestrator", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  registerTools(server, decisionsPath);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(
    `[orchestrator-mcp] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
