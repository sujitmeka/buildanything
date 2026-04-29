#!/usr/bin/env tsx
/**
 * Graph stdio MCP server (Slice 1).
 *
 * Exposes the three structured-query tools that Briefing Officers use to
 * pull feature/screen/acceptance slices out of the Slice 1 graph fragment
 * (`.buildanything/graph/slice-1.json`). The fragment is produced at end of
 * Step 1.6 by the product-spec extractor.
 *
 * Tools exposed:
 *   graph_query_feature, graph_query_screen, graph_query_acceptance
 *
 * Tool inputs/outputs follow docs/graph/04-slice1-schema.md §5.
 *
 * Fallback contract: when no graph fragment exists (pre-Step-1.6, or extractor
 * failure), each tool returns an isError result whose message starts with
 * "No graph fragment at <path>." — Briefing Officers detect that prefix and
 * fall back to direct reads of docs/plans/product-spec.md.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  loadGraph,
  loadAllGraphs,
  queryFeature,
  queryScreen,
  queryAcceptance,
  queryDna,
  queryManifest,
  graphPath,
} from "../../src/graph/storage/index.js";
import type { GraphFragment } from "../../src/graph/types.js";

// ---------------------------------------------------------------------------
// Helpers (mirror orchestrator-mcp.ts)
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
// Zod input shapes
// ---------------------------------------------------------------------------

const queryFeatureShape = {
  feature_id: z.string().min(1),
};

const queryScreenShape = {
  screen_id: z.string().min(1),
};

const queryAcceptanceShape = {
  feature_id: z.string().min(1),
};

const queryManifestShape = {
  slot: z.string().optional(),
};

// ---------------------------------------------------------------------------
// Graph load helper
// ---------------------------------------------------------------------------

interface LoadedGraph {
  fragment: GraphFragment;
  path: string;
}

function loadOrError(toolName: string, cwd: string): LoadedGraph | ReturnType<typeof errResult> {
  const path = graphPath(cwd);
  const fragment = loadAllGraphs(cwd);
  if (!fragment) {
    return {
      isError: true as const,
      content: [
        {
          type: "text" as const,
          text: `${toolName} error: No graph fragment at ${path}. Run the indexer at end of Step 1.6 or fall back to direct file reads of product-spec.md.`,
        },
      ],
    };
  }
  return { fragment, path };
}

function isErrPayload(x: unknown): x is ReturnType<typeof errResult> {
  return typeof x === "object" && x !== null && "isError" in x && (x as { isError: unknown }).isError === true;
}

// ---------------------------------------------------------------------------
// Server registration
// ---------------------------------------------------------------------------

function registerTools(server: McpServer): void {
  server.registerTool(
    "graph_query_feature",
    {
      description:
        "Returns full structured spec slice for one feature (screens, states, transitions, business rules, failure modes, persona constraints, acceptance criteria, depends_on), sourced from product-spec.md via the Slice 1 indexer.",
      inputSchema: queryFeatureShape,
    },
    async ({ feature_id }) => {
      try {
        const loaded = loadOrError("graph_query_feature", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryFeature(loaded.fragment, feature_id);
        if (!result) {
          return errResult(
            "graph_query_feature",
            `feature_id "${feature_id}" not found in graph at ${loaded.path}`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_feature", err);
      }
    },
  );

  server.registerTool(
    "graph_query_screen",
    {
      description:
        "Returns one screen's inventory row plus its owning features and the states from those features that surface here, sourced from product-spec.md via the Slice 1 indexer.",
      inputSchema: queryScreenShape,
    },
    async ({ screen_id }) => {
      try {
        const loaded = loadOrError("graph_query_screen", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryScreen(loaded.fragment, screen_id);
        if (!result) {
          return errResult(
            "graph_query_screen",
            `screen_id "${screen_id}" not found in graph at ${loaded.path}`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_screen", err);
      }
    },
  );

  server.registerTool(
    "graph_query_acceptance",
    {
      description:
        "Returns the acceptance criteria, in-scope business rules, and persona constraints for one feature, sourced from product-spec.md via the Slice 1 indexer.",
      inputSchema: queryAcceptanceShape,
    },
    async ({ feature_id }) => {
      try {
        const loaded = loadOrError("graph_query_acceptance", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryAcceptance(loaded.fragment, feature_id);
        if (!result) {
          return errResult(
            "graph_query_acceptance",
            `feature_id "${feature_id}" not found in graph at ${loaded.path}`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_acceptance", err);
      }
    },
  );

  server.registerTool(
    "graph_query_dna",
    {
      description:
        "Returns the 7-axis Visual DNA card + Do's/Don'ts + references + lint status. Sourced from DESIGN.md via the Slice 2 indexer (Step 3.0).",
      inputSchema: {},
    },
    async () => {
      try {
        const loaded = loadOrError("graph_query_dna", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryDna(loaded.fragment, process.cwd());
        if (!result) {
          return errResult(
            "graph_query_dna",
            `DESIGN.md not yet indexed at ${process.cwd()}/.buildanything/graph/. Run the indexer at end of Step 3.0 or fall back to direct file read of DESIGN.md.`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_dna", err);
      }
    },
  );

  server.registerTool(
    "graph_query_manifest",
    {
      description:
        "Returns component manifest entries (slot → library + variant + HARD-GATE flag). Optional slot arg returns single entry; without slot returns all. Sourced from component-manifest.md via the Slice 2 indexer (Step 3.2).",
      inputSchema: queryManifestShape,
    },
    async ({ slot }) => {
      try {
        const loaded = loadOrError("graph_query_manifest", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryManifest(loaded.fragment, slot);
        if (result === null) {
          return errResult(
            "graph_query_manifest",
            "component-manifest.md not yet indexed. Run the indexer at end of Step 3.2 or fall back to direct file read.",
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_manifest", err);
      }
    },
  );
}

async function main(): Promise<void> {
  const server = new McpServer(
    { name: "buildanything-graph", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(
    `[graph-mcp] fatal: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
