/**
 * Adapter: wraps Kiro's write-lease handler (acquire/release/list) in the
 * SdkMcpToolDefinition shape required by @anthropic-ai/claude-agent-sdk.
 *
 * Kiro's file (src/orchestrator/mcp/write-lease.ts) is owned by Kiro and must
 * not be edited; this adapter lives here to preserve that boundary and to
 * keep the SDK-specific zod/CallToolResult surface out of the handler core.
 *
 * Spec: docs/migration/sdk-hybrid/MIGRATION-PLAN-FINAL.md §A5
 * Task: 2.3.4
 */

import { z } from "zod";
import {
  acquireWriteLease,
  releaseLease,
  getActiveLeases,
} from "../../src/orchestrator/mcp/write-lease.js";

type ToolConstructor = typeof import("@anthropic-ai/claude-agent-sdk").tool;

const acquireInputShape = {
  task_id: z.string().min(1),
  file_paths: z.array(z.string().min(1)).min(1),
};

const releaseInputShape = {
  task_id: z.string().min(1),
};

const listInputShape = {} as const;

export function buildAcquireWriteLeaseTool(tool: ToolConstructor) {
  return tool(
    "acquire_write_lease",
    "Acquire an exclusive write lease on one or more file paths for a task. Returns granted:true with the lease, or granted:false with conflict details when another task holds an overlapping lease.",
    acquireInputShape,
    async (args) => {
      try {
        const result = await acquireWriteLease(args.task_id, args.file_paths);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result),
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
              text: `acquire_write_lease error: ${message}`,
            },
          ],
        };
      }
    },
  );
}

export function buildReleaseWriteLeaseTool(tool: ToolConstructor) {
  return tool(
    "release_write_lease",
    "Release all write leases held by a task. Called by SubagentStop hook on dispatch return. Returns released:true if a lease existed, false otherwise.",
    releaseInputShape,
    async (args) => {
      try {
        const released = releaseLease(args.task_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ released }),
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
              text: `release_write_lease error: ${message}`,
            },
          ],
        };
      }
    },
  );
}

export function buildListWriteLeasesTool(tool: ToolConstructor) {
  return tool(
    "list_write_leases",
    "List all active write leases (holder, paths, acquired_at). Read-only; intended for orchestrator diagnostics and .build-state.json persistence snapshots.",
    listInputShape,
    async () => {
      try {
        const leases = getActiveLeases();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ leases }),
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
              text: `list_write_leases error: ${message}`,
            },
          ],
        };
      }
    },
  );
}
