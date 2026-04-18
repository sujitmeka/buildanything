/**
 * Adapter: wraps Kiro's cycle-counter handlers in the SdkMcpToolDefinition
 * shape required by @anthropic-ai/claude-agent-sdk.
 *
 * Kiro's file (src/orchestrator/mcp/cycle-counter.ts) is owned by Kiro and
 * must not be edited; this adapter lives here to preserve that boundary and
 * to keep the SDK-specific zod/CallToolResult surface out of the handler core.
 *
 * Kiro's handlers mutate the CounterState object in place. The adapter echoes
 * the updated state back to the caller so the orchestrator can pipe it into
 * a single atomic state_save (A3 crash-seam protocol).
 *
 * Spec: docs/migration/sdk-hybrid/MIGRATION-PLAN-FINAL.md §4 Stage 4
 * Task: 4.2.4
 */

import { z } from "zod";
import {
  cycleCounterCheck,
  clearInFlightEdge,
  handleStaleEdge,
  type CounterState,
} from "../../src/orchestrator/mcp/cycle-counter.js";

type ToolConstructor = typeof import("@anthropic-ai/claude-agent-sdk").tool;

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

const checkInputShape = {
  state: counterStateSchema,
  input: z.object({
    decision_id: z.string().min(1),
    target_phase: z.string().min(1),
  }),
  max_cycles: z.number().int().positive().optional(),
};

const clearInputShape = {
  state: counterStateSchema,
};

const staleInputShape = {
  state: counterStateSchema,
  threshold_ms: z.number().int().positive().optional(),
};

export function buildCycleCounterCheckTool(tool: ToolConstructor) {
  return tool(
    "cycle_counter_check",
    "Check and increment backward-routing counters (per-decision + per-target-phase). Returns {action: allow|escalate_to_user, decision_count, phase_count, state} where state is the mutated CounterState to persist via state_save.",
    checkInputShape,
    async (args) => {
      try {
        const state = args.state as CounterState;
        const result = cycleCounterCheck(state, args.input, args.max_cycles);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...result, state }),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `cycle_counter_check error: ${message}`,
            },
          ],
        };
      }
    },
  );
}

export function buildClearInFlightEdgeTool(tool: ToolConstructor) {
  return tool(
    "clear_in_flight_edge",
    "Clear the in_flight_backward_edge field (called by target phase on re-entry). Returns {state} for the caller to persist via state_save.",
    clearInputShape,
    async (args) => {
      try {
        const state = args.state as CounterState;
        clearInFlightEdge(state);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ state }),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `clear_in_flight_edge error: ${message}`,
            },
          ],
        };
      }
    },
  );
}

export function buildHandleStaleEdgeTool(tool: ToolConstructor) {
  return tool(
    "handle_stale_edge",
    "On --resume, if in_flight_backward_edge is older than threshold_ms (default 60000), decrement both counters and clear the edge. Returns {cleaned:boolean, state}.",
    staleInputShape,
    async (args) => {
      try {
        const state = args.state as CounterState;
        const cleaned = handleStaleEdge(state, args.threshold_ms);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ cleaned, state }),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `handle_stale_edge error: ${message}`,
            },
          ],
        };
      }
    },
  );
}
