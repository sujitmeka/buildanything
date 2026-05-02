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
  queryFeatureList,
  queryScreen,
  queryAcceptance,
  queryDna,
  queryManifest,
  queryToken,
  queryDependencies,
  queryCrossContracts,
  queryDecisions,
  queryScreenshot,
  queryScreenshotSimilar,
  queryBrandDrift,
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
  full: z.boolean().optional(),
};

const queryAcceptanceShape = {
  feature_id: z.string().min(1),
};

const queryManifestShape = {
  slot: z.string().optional(),
};

const queryTokenShape = {
  name: z.string().min(1),
};

const queryDependenciesShape = {
  feature_id: z.string().min(1),
};

const queryCrossContractsShape = {
  endpoint: z.string().min(1),
};

const queryDecisionsShape = {
  status: z.enum(["open", "triggered", "resolved"]).optional(),
  phase: z.string().optional(),
  decided_by: z.string().optional(),
};

const queryScreenshotShape = {
  id: z.string().min(1),
};

const queryScreenshotSimilarShape = {
  screenshot_id: z.string().min(1),
  threshold: z.number().int().min(0).max(64).optional(),
};

const queryBrandDriftShape = {};

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
    "graph_list_features",
    {
      description:
        "Returns all feature IDs, labels, and kebab anchors from the indexed product-spec. No arguments. Used by the orchestrator at Step 5.2 to enumerate features for Track B dispatch.",
      inputSchema: {},
    },
    async () => {
      try {
        const loaded = loadOrError("graph_list_features", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryFeatureList(loaded.fragment);
        return okResult(result);
      } catch (err) {
        return errResult("graph_list_features", err);
      }
    },
  );

  server.registerTool(
    "graph_query_screen",
    {
      description:
        "Returns one screen inventory row plus its owning features and the states from those features that surface here, sourced from product-spec.md via the Slice 1 indexer. Set full: true to receive Slice 3 enrichment (wireframe text + sections + states + component uses with manifest joined inline + key copy + tokens used).",
      inputSchema: queryScreenShape,
    },
    async ({ screen_id, full }) => {
      try {
        const loaded = loadOrError("graph_query_screen", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = full
          ? queryScreen(loaded.fragment, screen_id, { full: true })
          : queryScreen(loaded.fragment, screen_id);
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

  server.registerTool(
    "graph_query_token",
    {
      description:
        "Returns a design token by exact dot-path name (e.g. 'colors.primary'). Sourced from DESIGN.md Pass 2 via the Slice 3 indexer (Step 3.4).",
      inputSchema: queryTokenShape,
    },
    async ({ name }) => {
      try {
        const loaded = loadOrError("graph_query_token", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryToken(loaded.fragment, name);
        if (!result) {
          return errResult(
            "graph_query_token",
            `Token '${name}' not found. Either DESIGN.md Pass 2 has not been indexed at ${loaded.path}, or the token name doesn't exist in the design system.`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_token", err);
      }
    },
  );

  server.registerTool(
    "graph_query_dependencies",
    {
      description:
        "Returns the full dependency closure for one feature: API endpoints provided + consumed (with module + auth_required), feature-level depends_on / depended_on_by, and the per-feature task DAG (each task with size, depends_on, behavioral_test, assigned_phase). Sourced from architecture.md + sprint-tasks.md via the Slice 4 indexer (Steps 2.3.1, 2.3.2). Primary call for the Product Owner's wave grouping.",
      inputSchema: queryDependenciesShape,
    },
    async ({ feature_id }) => {
      try {
        const loaded = loadOrError("graph_query_dependencies", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryDependencies(loaded.fragment, feature_id);
        if (!result) {
          return errResult(
            "graph_query_dependencies",
            `Feature '${feature_id}' not found, OR Slice 4 (architecture/sprint-tasks) not yet indexed at ${process.cwd()}/.buildanything/graph/.`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_dependencies", err);
      }
    },
  );

  server.registerTool(
    "graph_query_cross_contracts",
    {
      description:
        "Returns the contract definition (request_schema + response_schema as verbatim JSON-string blobs, auth_required, error_codes), the providing feature, and all consumer features for one endpoint. Sourced from architecture.md via the Slice 4 indexer (Step 2.3.1). Used by Phase 4 implementers for pre-write contract verification.",
      inputSchema: queryCrossContractsShape,
    },
    async ({ endpoint }) => {
      try {
        const loaded = loadOrError("graph_query_cross_contracts", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryCrossContracts(loaded.fragment, endpoint);
        if (!result) {
          return errResult(
            "graph_query_cross_contracts",
            `Endpoint '${endpoint}' not found in indexed architecture.`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_cross_contracts", err);
      }
    },
  );

  server.registerTool(
    "graph_query_decisions",
    {
      description:
        "Returns decision rows filtered by optional status / phase / decided_by (AND-combined). Each result includes resolved related_decision and superseded_by walks. Sourced from decisions.jsonl via the Slice 4 indexer. Returns an empty array (NOT an error) when no decisions match — empty input returns every decision. Used by the LRR aggregator's backward-routing walk and by the feedback synthesizer's open-decision lookup.",
      inputSchema: queryDecisionsShape,
    },
    async ({ status, phase, decided_by }) => {
      try {
        const loaded = loadOrError("graph_query_decisions", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const filter: { status?: "open" | "triggered" | "resolved"; phase?: string; decided_by?: string } = {};
        if (status !== undefined) filter.status = status;
        if (phase !== undefined) filter.phase = phase;
        if (decided_by !== undefined) filter.decided_by = decided_by;
        const result = queryDecisions(loaded.fragment, filter);
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_decisions", err);
      }
    },
  );

  server.registerTool(
    "graph_query_screenshot",
    {
      description:
        "Returns full screenshot node fields (image_path, image_class, caption, perceptual_hash, dominant_palette, image_dimensions, dna_axis_tags) plus the linked screen, linked finding, and any brand_drift_observations that reference this screenshot. Sourced from screenshots indexed via the Slice 5 indexer (Steps 3.1.idx, 5.1.idx, 5.3.idx). Used by the feedback synthesizer to resolve dogfood findings to owning screen/feature/task via deterministic graph walk.",
      inputSchema: queryScreenshotShape,
    },
    async ({ id }) => {
      try {
        const loaded = loadOrError("graph_query_screenshot", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryScreenshot(loaded.fragment, id);
        if (!result) {
          return errResult(
            "graph_query_screenshot",
            `Screenshot '${id}' not found in graph at ${loaded.path}.`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_screenshot", err);
      }
    },
  );

  server.registerTool(
    "graph_query_similar",
    {
      description:
        "Returns screenshots whose perceptual_hash falls within the Hamming distance threshold (default 10) of the given screenshot. Output: { input_hash, matches: [{ screenshot_id, image_path, image_class, hamming_distance, dna_axis_tags }] } sorted by ascending distance. Sourced from the Slice 5 indexer. Used by Brand Guardian (Phase 5.1, drift mode) to find matching design references for a production screenshot.",
      inputSchema: queryScreenshotSimilarShape,
    },
    async ({ screenshot_id, threshold }) => {
      try {
        const loaded = loadOrError("graph_query_similar", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryScreenshotSimilar(loaded.fragment, screenshot_id, threshold);
        if (!result) {
          return errResult(
            "graph_query_similar",
            `Screenshot '${screenshot_id}' not found in graph at ${loaded.path}.`,
          );
        }
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_similar", err);
      }
    },
  );

  server.registerTool(
    "graph_query_brand_drift",
    {
      description:
        "Returns all brand_drift_observation nodes with verdicts, sorted by descending score, with prod_screenshot and reference_screenshot resolved inline. Sourced from the Slice 5 indexer (Step 5.1.idx). Returns an empty observations array (NOT an error) when none have been recorded yet. Used by the Phase 6 LRR Brand chapter aggregator to render drift findings backed by graph walks rather than prose grep.",
      inputSchema: queryBrandDriftShape,
    },
    async () => {
      try {
        const loaded = loadOrError("graph_query_brand_drift", process.cwd());
        if (isErrPayload(loaded)) return loaded;
        const result = queryBrandDrift(loaded.fragment);
        return okResult(result);
      } catch (err) {
        return errResult("graph_query_brand_drift", err);
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
