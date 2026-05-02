// Deterministic extractor for DESIGN.md Pass 2 (design tokens from YAML frontmatter).
// Source of truth: docs/graph/07-slice3-schema.md §4.2 + protocols/design-md-spec.md.
// Sibling to design-md.ts (Pass 1) — invoked by CLI dispatch in parallel.

import YAML from "yaml";
import { ids, sha256Hex } from "../ids.js";
import type {
  ExtractError,
  ExtractResult,
  GraphEdge,
  GraphFragment,
  GraphNode,
  TokenNode,
} from "../types.js";

const PRODUCED_BY_WEB = "design-ui-designer";
const PRODUCED_AT_STEP_WEB = "3.4";
const PRODUCED_BY_IOS = "ios-swift-ui-design";
const PRODUCED_AT_STEP_IOS = "3.2-ios";
const SCHEMA = "buildanything-slice-3" as const;

type TokenLayer = TokenNode["layer"];
type AxisName = NonNullable<TokenNode["axis_provenance"]>;

const SKIP_KEYS = new Set(["version", "name", "description"]);

const KNOWN_OBJECT_KEYS: Record<string, TokenLayer> = {
  colors: "color",
  typography: "typography",
  rounded: "shape",
  spacing: "spacing",
  components: "component",
};

// Keys that allow a primitive top-level value (emit one token).
const PRIMITIVE_OK_KEYS = new Set(["rounded", "spacing"]);

interface Ctx {
  mdPath: string;
  errors: ExtractError[];
}

// --- Helpers ---

function parseFrontmatter(content: string): { yaml: string; found: boolean } {
  const lines = content.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") return { yaml: "", found: false };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      return { yaml: lines.slice(1, i).join("\n"), found: true };
    }
  }
  return { yaml: "", found: false };
}

function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

function layerForKey(key: string): TokenLayer {
  if (key in KNOWN_OBJECT_KEYS) return KNOWN_OBJECT_KEYS[key];
  if (key.startsWith("motion-")) return "motion";
  if (key.startsWith("elevation-")) return "elevation";
  if (key.startsWith("shape-")) return "shape";
  if (key.startsWith("type-")) return "type";
  return "component"; // catchall
}

function getAxisProvenance(name: string, layer: TokenLayer): AxisName | null {
  const lower = name.toLowerCase();
  if (lower.includes("glass") || lower.includes("blur")) return "material";
  if (layer === "color") return "character";
  if (layer === "typography") {
    if (name === "typography.scale" || name.endsWith(".scale")) return "density";
    return "type";
  }
  if (layer === "shape") return "character";
  if (layer === "spacing") return "density";
  if (layer === "motion") return "motion";
  if (layer === "elevation") return "material";
  if (layer === "type") return "type";
  if (layer === "component") return null;
  return null;
}

function typographyCategory(key: string): string {
  const idx = key.indexOf("-");
  return idx > 0 ? key.slice(0, idx) : key;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function emptyFragment(mdPath: string, mdContent: string): GraphFragment {
  return {
    version: 1,
    schema: SCHEMA,
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: new Date().toISOString(),
    nodes: [],
    edges: [],
  };
}

// --- Token collection ---

interface RawToken {
  name: string;
  value: string;
  layer: TokenLayer;
  category: string | null;
}

function collectTokens(
  parsed: Record<string, unknown>,
  ctx: Ctx,
): RawToken[] | null {
  const tokens: RawToken[] = [];

  for (const key of Object.keys(parsed)) {
    if (SKIP_KEYS.has(key)) continue;
    const val = parsed[key];
    if (val === null || val === undefined) continue;

    const isKnown = key in KNOWN_OBJECT_KEYS;
    const layer = layerForKey(key);

    if (isKnown) {
      // Empty object → skip
      if (isPlainObject(val) && Object.keys(val).length === 0) continue;

      // Primitive at top level
      if (!isPlainObject(val)) {
        if (PRIMITIVE_OK_KEYS.has(key)) {
          tokens.push({ name: key, value: String(val), layer, category: null });
          continue;
        }
        ctx.errors.push({ line: 1, message: `${key}: expected object, got ${typeof val}` });
        return null;
      }

      const obj = val as Record<string, unknown>;

      if (key === "colors") {
        for (const ck of Object.keys(obj)) {
          tokens.push({ name: `colors.${ck}`, value: String(obj[ck]), layer: "color", category: ck });
        }
      } else if (key === "typography") {
        for (const tk of Object.keys(obj)) {
          const tv = obj[tk];
          const value = isPlainObject(tv) ? stableStringify(tv) : String(tv);
          tokens.push({ name: `typography.${tk}`, value, layer: "typography", category: typographyCategory(tk) });
        }
      } else if (key === "rounded" || key === "spacing") {
        for (const sk of Object.keys(obj)) {
          tokens.push({ name: `${key}.${sk}`, value: String(obj[sk]), layer, category: sk });
        }
      } else if (key === "components") {
        for (const ck of Object.keys(obj)) {
          const cv = obj[ck];
          const value = isPlainObject(cv) ? stableStringify(cv) : String(cv);
          tokens.push({ name: `components.${ck}`, value, layer: "component", category: null });
        }
      }
    } else {
      // Non-standard top-level key
      const value = isPlainObject(val) ? stableStringify(val) : String(val);
      tokens.push({ name: key, value, layer, category: null });
    }
  }

  return tokens;
}

// --- Main ---

export function extractDesignMdTokens(input: { mdPath: string; mdContent: string; projectType?: "web" | "ios" }): ExtractResult {
  const { mdPath, mdContent, projectType } = input;
  const producedBy = projectType === "ios" ? PRODUCED_BY_IOS : PRODUCED_BY_WEB;
  const producedAtStep = projectType === "ios" ? PRODUCED_AT_STEP_IOS : PRODUCED_AT_STEP_WEB;
  const { yaml, found } = parseFrontmatter(mdContent);

  if (!found) return { ok: true, fragment: emptyFragment(mdPath, mdContent), errors: [] };

  let parsed: unknown;
  try {
    parsed = YAML.parse(yaml);
  } catch (e: unknown) {
    return { ok: false, errors: [{ line: 1, message: `YAML parse error: ${e instanceof Error ? e.message : String(e)}` }] };
  }

  if (!parsed || !isPlainObject(parsed)) {
    return { ok: true, fragment: emptyFragment(mdPath, mdContent), errors: [] };
  }

  const ctx: Ctx = { mdPath, errors: [] };
  const rawTokens = collectTokens(parsed as Record<string, unknown>, ctx);
  if (rawTokens === null) return { ok: false, errors: ctx.errors };
  if (rawTokens.length === 0) return { ok: true, fragment: emptyFragment(mdPath, mdContent), errors: [] };

  const nodes: GraphNode[] = rawTokens.map((t): TokenNode => ({
    id: ids.token(t.layer, t.name),
    label: t.name,
    entity_type: "token",
    source_file: mdPath,
    source_location: "L1",
    confidence: "EXTRACTED",
    name: t.name,
    value: t.value,
    layer: t.layer,
    axis_provenance: getAxisProvenance(t.name, t.layer),
    category: t.category,
  }));

  const edges: GraphEdge[] = [];
  for (const node of nodes) {
    const tn = node as TokenNode;
    if (tn.axis_provenance !== null) {
      edges.push({
        source: tn.id,
        target: ids.dnaAxis(tn.axis_provenance),
        relation: "token_derived_from",
        confidence: "EXTRACTED",
        source_file: mdPath,
        source_location: "L1",
        produced_by_agent: producedBy,
        produced_at_step: producedAtStep,
      });
    }
  }

  nodes.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) => `${a.relation} ${a.source} ${a.target}`.localeCompare(`${b.relation} ${b.source} ${b.target}`));

  const fragment: GraphFragment = {
    version: 1,
    schema: SCHEMA,
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: new Date().toISOString(),
    nodes,
    edges,
  };

  return { ok: true, fragment, errors: [] };
}
