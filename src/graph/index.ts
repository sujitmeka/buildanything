// Slice 1 module barrel. Public surface for orchestrator + MCP handlers.

export * from "./types.js";
export { ids, kebab, sha256_8, sha256Hex, normalizeForHash } from "./ids.js";
export { extractProductSpec } from "./parser/product-spec.js";
export { extractDesignMd } from "./parser/design-md.js";
export { extractComponentManifest } from "./parser/component-manifest.js";
export { extractPageSpec } from "./parser/page-spec.js";
export { extractDesignMdTokens } from "./parser/design-md-pass2.js";
export { extractArchitecture } from "./parser/architecture.js";
export { extractSprintTasks } from "./parser/sprint-tasks.js";
export { extractBackendTasks } from "./parser/backend-tasks.js";
export { extractDecisionsJsonl } from "./parser/decisions-jsonl.js";
export { extractScreenshot } from "./parser/screenshot.js";
export {
  loadGraph,
  loadAllGraphs,
  saveGraph,
  queryFeature,
  queryScreen,
  queryAcceptance,
  queryDna,
  queryManifest,
  queryToken,
  queryScreenFull,
  queryDependencies,
  queryCrossContracts,
  queryDecisions,
  queryScreenshot,
  queryScreenshotSimilar,
  queryBrandDrift,
  graphPath,
} from "./storage/index.js";
