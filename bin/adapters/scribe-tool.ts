/**
 * Adapter: wraps Kiro's scribeDecision(input, filePath) handler in the
 * SdkMcpToolDefinition shape required by @anthropic-ai/claude-agent-sdk.
 *
 * Kiro's file (src/orchestrator/mcp/scribe.ts) is owned by Kiro and must
 * not be edited; this adapter lives here to preserve that boundary and to
 * keep the SDK-specific zod/CallToolResult surface out of the handler core.
 *
 * Spec: docs/migration/sdk-hybrid/MIGRATION-PLAN-FINAL.md §4 Stage 1
 * Task: 1.2.4
 */

import { resolve } from "node:path";
import { z } from "zod";
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { scribeDecision, loadCounters } from "../../src/orchestrator/mcp/scribe.js";

const DEFAULT_DECISIONS_PATH = "docs/plans/decisions.jsonl";

const rejectedAlternativeSchema = z.object({
  approach: z.string().min(1),
  reason: z.string().min(1),
  revisit_criterion: z.string().min(1),
});

const scribeInputShape = {
  phase: z.string().min(1),
  category: z.string().min(1),
  summary: z.string().min(1),
  decided_by: z.string().min(1),
  impact_level: z.enum(["low", "medium", "high", "critical"]),
  chosen_approach: z.string().min(1),
  rejected_alternatives: z.array(rejectedAlternativeSchema).max(3).optional(),
  ref: z.string().optional(),
};

export function buildScribeTool(cwd: string) {
  const decisionsPath = resolve(cwd, DEFAULT_DECISIONS_PATH);
  loadCounters(decisionsPath);

  return tool(
    "scribe_decision",
    "Append a decision row to docs/plans/decisions.jsonl. Single-writer per migration plan; validates against decisions.schema.json.",
    scribeInputShape,
    async (args) => {
      try {
        const row = scribeDecision(args, decisionsPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(row),
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
              text: `scribe_decision error: ${message}`,
            },
          ],
        };
      }
    },
  );
}
