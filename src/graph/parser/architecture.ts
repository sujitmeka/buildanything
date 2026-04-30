import { ids, kebab, sha256Hex } from "../ids.js";
import type {
  ApiContractNode,
  ArchitectureModuleNode,
  DataModelNode,
  ExtractError,
  ExtractResult,
  GraphEdge,
  GraphFragment,
  GraphNode,
  Relation,
} from "../types.js";

const PRODUCED_BY = "code-architect";
const PRODUCED_AT_STEP = "2.3.1";

const SKIP_HEADINGS = new Set(["overview", "scope", "out of scope"]);
const REQUIRED_MODULE_NAMES = ["frontend", "backend", "auth", "data model", "security", "infrastructure"];

const ENDPOINT_RE = /^\*\*(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s*]+)\*\*(.*)$/;

// Words that should never be treated as a feature hint when scanning path
// segments. Common HTTP/REST nouns and path-parameter placeholders.
const PATH_STOP_WORDS = new Set([
  "api",
  "v1",
  "v2",
  "v3",
  "id",
  "ids",
  "uuid",
  "list",
  "new",
  "edit",
  "create",
  "update",
  "delete",
  "search",
  "me",
  "self",
]);

// Common noise tokens for description-prose feature inference. The regex
// itself anchors on a verb ("provided by", "consumed by", etc.) so this list
// only filters obvious non-feature targets that follow.
const PROSE_STOP_WORDS = new Set(["the", "a", "an"]);

interface Line {
  n: number;
  text: string;
}

interface Section {
  heading: string;
  level: number;
  startLine: number;
  bodyLines: Line[];
}

interface Ctx {
  mdPath: string;
  errors: ExtractError[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

function loc(line: number): string {
  return `L${line}`;
}

function pushError(ctx: Ctx, line: number, message: string): void {
  ctx.errors.push({ line, message });
}

function splitLines(content: string): Line[] {
  return content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}

function isHeadingAtLevel(text: string, level: number): boolean {
  const prefix = "#".repeat(level) + " ";
  if (!text.startsWith(prefix)) return false;
  return text[level] !== "#";
}

function isHeadingAtOrAbove(text: string, level: number): boolean {
  for (let l = 1; l <= level; l++) {
    if (isHeadingAtLevel(text, l)) return true;
  }
  return false;
}

function partitionSections(lines: Line[], level: number, start: number, end: number): Section[] {
  const sections: Section[] = [];
  const headingPrefix = "#".repeat(level) + " ";
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (isHeadingAtLevel(line.text, level)) {
      const heading = line.text.slice(headingPrefix.length).trim();
      const bodyStart = i + 1;
      let j = bodyStart;
      while (j < end && !isHeadingAtOrAbove(lines[j].text, level)) j++;
      sections.push({ heading, level, startLine: line.n, bodyLines: lines.slice(bodyStart, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}

function makeEdge(
  ctx: Ctx,
  source: string,
  target: string,
  relation: Relation,
  line: number,
): GraphEdge {
  return {
    source,
    target,
    relation,
    confidence: "EXTRACTED",
    source_file: ctx.mdPath,
    source_location: loc(line),
    produced_by_agent: PRODUCED_BY,
    produced_at_step: PRODUCED_AT_STEP,
  };
}

function sortNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function sortEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((a, b) => {
    const k = (e: GraphEdge): string =>
      `${e.relation} ${e.source} ${e.target} ${e.source_location ?? ""}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}

function isTitleHeading(text: string): boolean {
  return /^architecture\s*:/i.test(text);
}

function extractDescription(bodyLines: Line[]): string {
  const parts: string[] = [];
  for (const line of bodyLines) {
    if (isHeadingAtOrAbove(line.text, 2)) break;
    const t = line.text.trim();
    if (t === "") {
      if (parts.length > 0) break;
      continue;
    }
    parts.push(t);
  }
  return parts.join(" ");
}

function extractBulletsUnderH3(bodyLines: Line[], h3Name: string): string[] {
  let inSection = false;
  const bullets: string[] = [];
  for (const line of bodyLines) {
    if (isHeadingAtLevel(line.text, 3)) {
      inSection = line.text.slice(4).trim().toLowerCase() === h3Name.toLowerCase();
      continue;
    }
    if (inSection) {
      if (isHeadingAtOrAbove(line.text, 3)) break;
      const m = line.text.match(/^\s*-\s+(.+)$/);
      if (m) bullets.push(m[1].trim());
    }
  }
  return bullets;
}

function splitParenAware(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of value) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

// Feature-attribution heuristics for api_contract nodes.
//
// The parser only sees architecture.md, not product-spec.md, so it cannot
// validate that the inferred feature_id corresponds to a real Slice 1 feature
// node. Edges are emitted optimistically against `feature__{kebab(name)}` IDs;
// the merged graph in loadAllGraphs resolves them when the Slice 1 fragment
// is also present. Unmatched edges are tolerable — queryDependencies and
// queryCrossContracts simply return empty arrays for unknown features.
//
// Resolution order (explicit annotations and heuristics all contribute; the
// resulting feature ID set is deduplicated per endpoint per relation):
//   1. Explicit annotation on heading line: `(provides: x)` / `(consumes: y)`
//   2. Description-prose phrasing: "provided by X", "consumed by X"
//   3. Path-segment inference (provides only): first non-stopword segment
//   4. Module-name match (provides only): module kebab matches a feature

interface EndpointAnnotation {
  provides: string[];
  consumes: string[];
}

function parseEndpointAnnotation(trailing: string): EndpointAnnotation {
  const provides: string[] = [];
  const consumes: string[] = [];
  const annotationRe = /\(\s*(provides|consumes)\s*:\s*([^)]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = annotationRe.exec(trailing)) !== null) {
    const kind = m[1].toLowerCase();
    const targets = m[2]
      .split(",")
      .map((s) => kebab(s.trim()))
      .filter((s) => s.length > 0);
    if (kind === "provides") provides.push(...targets);
    else consumes.push(...targets);
  }
  return { provides, consumes };
}

function inferFeatureFromPath(path: string): string | null {
  const segments = path
    .replace(/^\/+/, "")
    .split("/")
    .map((s) => s.replace(/^[:{].*[}]?$/, "").trim())
    .filter((s) => s.length > 0)
    .map((s) => kebab(s));
  for (const seg of segments) {
    if (seg && !PATH_STOP_WORDS.has(seg)) return seg;
  }
  return null;
}

function inferFeaturesFromProse(block: Line[]): EndpointAnnotation {
  const provides: string[] = [];
  const consumes: string[] = [];
  const re = /\b(provided|consumed|used)\s+by\s+([A-Za-z][A-Za-z0-9 _-]*?)(?=[.,;)\n]|$)/gi;
  for (const line of block) {
    const t = line.text;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const verb = m[1].toLowerCase();
      const target = kebab(m[2].trim());
      if (!target || PROSE_STOP_WORDS.has(target)) continue;
      if (verb === "provided") provides.push(target);
      else consumes.push(target);
    }
  }
  return { provides, consumes };
}

function inferFeatureFromModuleName(moduleName: string): string | null {
  const kebabbed = kebab(moduleName);
  const GENERIC = new Set([
    "frontend",
    "backend",
    "auth",
    "data-model",
    "security",
    "infrastructure",
    "api",
  ]);
  if (GENERIC.has(kebabbed)) return null;
  return kebabbed;
}

function emitFeatureEdges(
  ctx: Ctx,
  contractId: string,
  line: number,
  annotation: EndpointAnnotation,
): void {
  const seenProvides = new Set<string>();
  for (const f of annotation.provides) {
    if (!f || seenProvides.has(f)) continue;
    seenProvides.add(f);
    ctx.edges.push(
      makeEdge(ctx, `feature__${f}`, contractId, "feature_provides_endpoint", line),
    );
  }
  const seenConsumes = new Set<string>();
  for (const f of annotation.consumes) {
    if (!f || seenConsumes.has(f)) continue;
    seenConsumes.add(f);
    ctx.edges.push(
      makeEdge(ctx, `feature__${f}`, contractId, "feature_consumes_endpoint", line),
    );
  }
}

function isApiContractHeading(heading: string): boolean {
  const lower = heading.toLowerCase();
  return (
    lower.includes("api contract") ||
    lower.includes("api contracts") ||
    lower.includes("api endpoints") ||
    lower === "api"
  );
}

function parseApiContracts(
  ctx: Ctx,
  bodyLines: Line[],
  moduleId: string,
  moduleLine: number,
  moduleName: string,
): void {
  const h2Sections = partitionBodyH2(bodyLines);
  for (const sec of h2Sections) {
    if (!isApiContractHeading(sec.heading)) continue;
    parseEndpointsInSection(ctx, sec.bodyLines, moduleId, moduleName);
  }
}

function partitionBodyH2(bodyLines: Line[]): Section[] {
  const sections: Section[] = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (isHeadingAtLevel(line.text, 2)) {
      const heading = line.text.slice(3).trim();
      const start = i + 1;
      let j = start;
      while (j < bodyLines.length && !isHeadingAtOrAbove(bodyLines[j].text, 2)) j++;
      sections.push({ heading, level: 2, startLine: line.n, bodyLines: bodyLines.slice(start, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}

function parseEndpointsInSection(
  ctx: Ctx,
  lines: Line[],
  moduleId: string,
  moduleName: string,
): void {
  const endpointStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (ENDPOINT_RE.test(lines[i].text.trim())) endpointStarts.push(i);
  }

  for (let ei = 0; ei < endpointStarts.length; ei++) {
    const startIdx = endpointStarts[ei];
    const endIdx = ei + 1 < endpointStarts.length ? endpointStarts[ei + 1] : lines.length;
    const headLine = lines[startIdx];
    const m = headLine.text.trim().match(ENDPOINT_RE)!;
    const method = m[1];
    const path = m[2];
    const trailing = m[3] ?? "";
    const endpoint = `${method} ${path}`;
    const block = lines.slice(startIdx + 1, endIdx);

    let authRequired = false;
    let errorCodes: string[] = [];
    let requestSchema = "";
    let responseSchema = "";

    for (const line of block) {
      const t = line.text.trim();
      const authMatch = t.match(/^-\s+Auth\s+required\s*:\s*(.+)$/i);
      if (authMatch) {
        authRequired = /yes/i.test(authMatch[1]);
        continue;
      }
      const errorMatch = t.match(/^-\s+Error\s+codes\s*:\s*(.+)$/i);
      if (errorMatch) {
        errorCodes = splitParenAware(errorMatch[1]).map((s) => s.trim()).filter((s) => s.length > 0);
        continue;
      }
      const reqMatch = t.match(/^-\s+Request\s*:\s*(.+)$/i);
      if (reqMatch) {
        requestSchema = reqMatch[1].trim().replace(/^`+|`+$/g, "").trim();
        continue;
      }
      const resMatch = t.match(/^-\s+Response\s*:\s*(.+)$/i);
      if (resMatch) {
        responseSchema = resMatch[1].trim().replace(/^`+|`+$/g, "").trim();
        continue;
      }
    }

    const node: ApiContractNode = {
      id: ids.apiContract(endpoint),
      label: endpoint,
      entity_type: "api_contract",
      source_file: ctx.mdPath,
      source_location: loc(headLine.n),
      confidence: "EXTRACTED",
      endpoint,
      module_id: moduleId,
      request_schema: requestSchema,
      response_schema: responseSchema,
      auth_required: authRequired,
      error_codes: errorCodes,
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge(ctx, moduleId, node.id, "module_has_contract", headLine.n));

    const explicit = parseEndpointAnnotation(trailing);
    const merged: EndpointAnnotation = {
      provides: [...explicit.provides],
      consumes: [...explicit.consumes],
    };
    if (explicit.provides.length === 0 && explicit.consumes.length === 0) {
      const prose = inferFeaturesFromProse(block);
      merged.provides.push(...prose.provides);
      merged.consumes.push(...prose.consumes);
      const pathHint = inferFeatureFromPath(path);
      if (pathHint) merged.provides.push(pathHint);
      const moduleHint = inferFeatureFromModuleName(moduleName);
      if (moduleHint) merged.provides.push(moduleHint);
    }
    emitFeatureEdges(ctx, node.id, headLine.n, merged);
  }
}

function parseDataModels(ctx: Ctx, bodyLines: Line[], moduleId: string): void {
  const entityRe = /^\*\*([A-Za-z][A-Za-z0-9_]*)\*\*\s*$/;
  const entityStarts: number[] = [];
  for (let i = 0; i < bodyLines.length; i++) {
    if (entityRe.test(bodyLines[i].text.trim())) entityStarts.push(i);
  }

  for (let ei = 0; ei < entityStarts.length; ei++) {
    const startIdx = entityStarts[ei];
    const endIdx = ei + 1 < entityStarts.length ? entityStarts[ei + 1] : bodyLines.length;
    const headLine = bodyLines[startIdx];
    const entityName = headLine.text.trim().match(entityRe)![1];

    // Scan until next entity, h2, or h1
    let blockEnd = endIdx;
    for (let j = startIdx + 1; j < endIdx; j++) {
      if (isHeadingAtOrAbove(bodyLines[j].text, 2)) {
        blockEnd = j;
        break;
      }
    }
    const block = bodyLines.slice(startIdx + 1, blockEnd);

    let fields: string[] = [];
    let indexes: string[] = [];

    for (const line of block) {
      const t = line.text.trim();
      const fieldsMatch = t.match(/^-\s+Fields\s*:\s*(.+)$/i);
      if (fieldsMatch) {
        const raw = fieldsMatch[1];
        const parts = splitParenAware(raw);
        fields = parts
          .map((part) => {
            const colonIdx = part.indexOf(":");
            if (colonIdx < 0) return "";
            const name = part.slice(0, colonIdx).trim();
            let type = part.slice(colonIdx + 1).trim();
            const parenIdx = type.indexOf("(");
            if (parenIdx >= 0) type = type.slice(0, parenIdx).trim();
            if (!name || !type) return "";
            return `${name}:${type}`;
          })
          .filter((s) => s.length > 0);
        continue;
      }
      const indexMatch = t.match(/^-\s+Indexes\s*:\s*(.+)$/i);
      if (indexMatch) {
        const raw = indexMatch[1];
        const parts = splitParenAware(raw);
        indexes = parts
          .map((part) => {
            const parenIdx = part.indexOf("(");
            return (parenIdx >= 0 ? part.slice(0, parenIdx) : part).trim();
          })
          .filter((s) => s.length > 0);
        continue;
      }
    }

    const node: DataModelNode = {
      id: ids.dataModel(entityName),
      label: entityName,
      entity_type: "data_model",
      source_file: ctx.mdPath,
      source_location: loc(headLine.n),
      confidence: "EXTRACTED",
      entity_name: entityName,
      module_id: moduleId,
      fields,
      indexes,
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge(ctx, moduleId, node.id, "module_has_data_model", headLine.n));
  }
}

export function extractArchitecture(input: { mdPath: string; mdContent: string }): ExtractResult {
  const { mdPath, mdContent } = input;
  const lines = splitLines(mdContent);
  const ctx: Ctx = { mdPath, errors: [], nodes: [], edges: [] };

  // Collect h1 sections
  const h1Sections = partitionSections(lines, 1, 0, lines.length);

  // Also collect ## Module: Foo as module candidates
  interface ModuleCandidate {
    name: string;
    startLine: number;
    bodyLines: Line[];
  }
  const candidates: ModuleCandidate[] = [];

  for (const sec of h1Sections) {
    if (isTitleHeading(sec.heading)) continue;
    if (SKIP_HEADINGS.has(sec.heading.toLowerCase())) continue;
    candidates.push({ name: sec.heading, startLine: sec.startLine, bodyLines: sec.bodyLines });
  }

  // Also scan for ## Module: Foo
  for (const sec of h1Sections) {
    const h2s = partitionBodyH2(sec.bodyLines);
    for (const h2 of h2s) {
      const moduleMatch = h2.heading.match(/^Module\s*:\s*(.+)$/i);
      if (moduleMatch) {
        candidates.push({
          name: moduleMatch[1].trim(),
          startLine: h2.startLine,
          bodyLines: h2.bodyLines,
        });
      }
    }
  }

  // Check if any required module name appears
  const candidateNamesLower = candidates.map((c) => c.name.toLowerCase());
  const hasRequired = REQUIRED_MODULE_NAMES.some((req) =>
    candidateNamesLower.some((cn) => cn.includes(req)),
  );

  if (!hasRequired) {
    return {
      ok: false,
      errors: [
        {
          line: 1,
          message:
            "architecture.md has no recognizable module sections (none of: Frontend, Backend, Auth, Data Model, Security, Infrastructure)",
        },
      ],
    };
  }

  for (const cand of candidates) {
    const moduleId = ids.architectureModule(cand.name);
    const description = extractDescription(cand.bodyLines);
    const responsibilities = extractBulletsUnderH3(cand.bodyLines, "Responsibilities");
    const techStack = extractBulletsUnderH3(cand.bodyLines, "Tech Stack");

    const moduleNode: ArchitectureModuleNode = {
      id: moduleId,
      label: cand.name,
      entity_type: "architecture_module",
      source_file: mdPath,
      source_location: loc(cand.startLine),
      confidence: "EXTRACTED",
      name: cand.name,
      description,
      responsibilities,
      tech_stack: techStack,
    };
    ctx.nodes.push(moduleNode);

    // Parse API contracts within this module
    parseApiContracts(ctx, cand.bodyLines, moduleId, cand.startLine, cand.name);

    // Parse data models if this is the Data Model module
    if (cand.name.toLowerCase().includes("data model")) {
      parseDataModels(ctx, cand.bodyLines, moduleId);
    }
  }

  const fragment: GraphFragment = {
    version: 1,
    schema: "buildanything-slice-4",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: new Date().toISOString(),
    nodes: sortNodes(ctx.nodes),
    edges: sortEdges(ctx.edges),
  };
  return { ok: true, fragment, errors: [] };
}
