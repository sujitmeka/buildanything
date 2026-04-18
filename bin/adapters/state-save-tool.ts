/**
 * Adapter: wraps Kiro's state-save handler (stateSave/stateRead/verifyIntegrity)
 * in the SdkMcpToolDefinition shape required by @anthropic-ai/claude-agent-sdk.
 *
 * Kiro's file (src/orchestrator/mcp/state-save.ts) is owned by Kiro and must
 * not be edited; this adapter lives here to preserve that boundary and to
 * keep the SDK-specific zod/CallToolResult surface out of the handler core.
 *
 * Spec: docs/migration/sdk-hybrid/MIGRATION-PLAN-FINAL.md §4 Stage 3
 * Task: 3.2.4
 */

import { z } from "zod";
import {
  stateSave,
  stateRead,
  verifyIntegrity,
} from "../../src/orchestrator/mcp/state-save.js";

type ToolConstructor = typeof import("@anthropic-ai/claude-agent-sdk").tool;

const saveInputShape = {
  path: z.string().min(1),
  state: z.record(z.string(), z.unknown()),
};

const readInputShape = {
  path: z.string().min(1),
};

const verifyInputShape = {
  path: z.string().min(1),
  expected_sha256: z.string().min(1),
};

export function buildStateSaveTool(tool: ToolConstructor) {
  return tool(
    "state_save",
    "Atomically persist state to a JSON file via write-to-.tmp + fsync + rename. Returns {success, path, sha256, bytesWritten}. Single writer for .build-state.json.",
    saveInputShape,
    async (args) => {
      try {
        const result = stateSave(args.path, args.state as Record<string, unknown>);
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
              text: `state_save error: ${message}`,
            },
          ],
        };
      }
    },
  );
}

export function buildStateReadTool(tool: ToolConstructor) {
  return tool(
    "state_read",
    "Read state from a JSON file and compute its SHA-256 checksum. Returns {state, sha256}.",
    readInputShape,
    async (args) => {
      try {
        const result = stateRead(args.path);
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
              text: `state_read error: ${message}`,
            },
          ],
        };
      }
    },
  );
}

export function buildVerifyIntegrityTool(tool: ToolConstructor) {
  return tool(
    "verify_integrity",
    "Verify a state file's SHA-256 matches the expected checksum. Returns {matches:boolean}.",
    verifyInputShape,
    async (args) => {
      try {
        const matches = verifyIntegrity(args.path, args.expected_sha256);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ matches }),
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
              text: `verify_integrity error: ${message}`,
            },
          ],
        };
      }
    },
  );
}
