// Slice 1 module barrel. Public surface for orchestrator + MCP handlers.

export * from "./types.js";
export { ids, kebab, sha256_8, sha256Hex, normalizeForHash } from "./ids.js";
export { extractProductSpec } from "./parser/product-spec.js";
export { extractDesignMd } from "./parser/design-md.js";
export { extractComponentManifest } from "./parser/component-manifest.js";
export {
  loadGraph,
  saveGraph,
  queryFeature,
  queryScreen,
  queryAcceptance,
  graphPath,
} from "./storage/index.js";
