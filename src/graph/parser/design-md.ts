// Deterministic extractor for DESIGN.md Pass 1 (Brand DNA + Do's/Don'ts).
// Source of truth: docs/graph/05-slice2-schema.md + protocols/design-md-authoring.md.

import YAML from "yaml";
import { ids, sha256Hex } from "../ids.js";
import type {
  BrandDnaGuidelineNode,
  BrandReferenceNode,
  DesignDocRootNode,
  DnaAxisNode,
  ExtractError,
  ExtractResult,
  GraphEdge,
  GraphFragment,
  GraphNode,
} from "../types.js";

const PRODUCED_BY = "design-brand-guardian";
const PRODUCED_AT_STEP = "3.0";
const REQUIRED_AXES = ["scope", "density", "character", "material", "motion", "type", "copy"] as const;
type AxisName = (typeof REQUIRED_AXES)[number];
const AXIS_SET = new Set<string>(REQUIRED_AXES);
const AXIS_WORD_REGEXES: ReadonlyArray<{ axis: AxisName; re: RegExp }> = REQUIRED_AXES.map((axis) => ({
  axis,
  re: new RegExp(`\\b${axis}\\b`, "i"),
}));

// --- Line / section helpers (mirrors product-spec.ts) ---

interface Line { n: number; text: string }
interface Section { heading: string; level: number; startLine: number; bodyLines: Line[] }
interface Ctx { mdPath: string; errors: ExtractError[]; nodes: GraphNode[]; edges: GraphEdge[] }

function loc(line: number): string { return `L${line}`; }
function pushError(ctx: Ctx, line: number, message: string): void { ctx.errors.push({ line, message }); }

function splitLines(content: string): Line[] {
  return content.split(/\r?\n/).map((text, i) => ({ n: i + 1, text }));
}

function isHeadingAtLevel(text: string, level: number): boolean {
  const prefix = "#".repeat(level) + " ";
  return text.startsWith(prefix) && text[level] !== "#";
}

function isHeadingAtOrAbove(text: string, level: number): boolean {
  for (let l = 1; l <= level; l++) if (isHeadingAtLevel(text, l)) return true;
  return false;
}

function partitionSections(lines: Line[], level: number, start: number, end: number): Section[] {
  const sections: Section[] = [];
  const prefix = "#".repeat(level) + " ";
  let i = start;
  while (i < end) {
    const line = lines[i];
    if (isHeadingAtLevel(line.text, level)) {
      const heading = line.text.slice(prefix.length).trim();
      let j = i + 1;
      while (j < end && !isHeadingAtOrAbove(lines[j].text, level)) j++;
      sections.push({ heading, level, startLine: line.n, bodyLines: lines.slice(i + 1, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}

function findH3Sections(bodyLines: Line[]): Section[] {
  const sections: Section[] = [];
  let i = 0;
  while (i < bodyLines.length) {
    const line = bodyLines[i];
    if (isHeadingAtLevel(line.text, 3)) {
      const heading = line.text.slice(4).trim();
      let j = i + 1;
      while (j < bodyLines.length && !isHeadingAtOrAbove(bodyLines[j].text, 3)) j++;
      sections.push({ heading, level: 3, startLine: line.n, bodyLines: bodyLines.slice(i + 1, j) });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}

function truncateLabel(text: string): string {
  return text.length > 80 ? text.slice(0, 77) + "..." : text;
}

function makeEdge(
  source: string, target: string, relation: GraphEdge["relation"],
  sourceFile: string, sourceLoc?: string,
): GraphEdge {
  return {
    source, target, relation, confidence: "EXTRACTED",
    source_file: sourceFile, source_location: sourceLoc,
    produced_by_agent: PRODUCED_BY, produced_at_step: PRODUCED_AT_STEP,
  };
}

// --- YAML frontmatter ---

interface FrontmatterResult {
  name: string; description: string; yamlPass2Populated: boolean; endLine: number;
}

function parseFrontmatter(lines: Line[], ctx: Ctx): FrontmatterResult | null {
  if (lines.length === 0 || lines[0].text.trim() !== "---") {
    pushError(ctx, 1, "Missing YAML frontmatter (no opening `---` at line 1)");
    return null;
  }
  let closeIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].text.trim() === "---") { closeIdx = i; break; }
  }
  if (closeIdx < 0) {
    pushError(ctx, 1, "YAML frontmatter never closed (missing closing `---`)");
    return null;
  }
  const yamlText = lines.slice(1, closeIdx).map((l) => l.text).join("\n");
  let parsed: Record<string, unknown>;
  try {
    parsed = YAML.parse(yamlText) as Record<string, unknown>;
  } catch (e: unknown) {
    pushError(ctx, 1, `YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
  if (!parsed || typeof parsed !== "object") {
    pushError(ctx, 1, "YAML frontmatter is not an object");
    return null;
  }
  const name = typeof parsed["name"] === "string" ? parsed["name"].trim() : "";
  if (!name) {
    pushError(ctx, 1, "Missing required YAML key: `name`");
    return null;
  }
  const description = typeof parsed["description"] === "string" ? parsed["description"].trim() : "";
  const pass2Keys = ["colors", "typography", "rounded", "spacing", "components"];
  const yamlPass2Populated = pass2Keys.some((k) => {
    const v = parsed[k];
    if (v === null || v === undefined) return false;
    if (typeof v === "object" && Object.keys(v as object).length === 0) return false;
    if (typeof v === "string" && v.trim() === "") return false;
    return true;
  });
  return { name, description, yamlPass2Populated, endLine: lines[closeIdx].n + 1 };
}

// --- Overview helpers ---

function extractOverviewDescription(bodyLines: Line[]): string {
  const parts: string[] = [];
  for (const line of bodyLines) {
    if (isHeadingAtLevel(line.text, 3)) break;
    if (line.text.trim() === "") { if (parts.length > 0) break; continue; }
    parts.push(line.text.trim());
  }
  return parts.join(" ");
}

// --- Brand DNA ---

interface AxisParsed { name: AxisName; value: string; rationale: string; line: number }

function parseBrandDna(section: Section, _ctx: Ctx): AxisParsed[] {
  const axes: AxisParsed[] = [];
  const bulletRe = /^\s*-\s+\*\*([^:*]+)\*?\*?:\*?\*?\s*(.*)$/;
  const bodyLines = section.bodyLines;

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const m = line.text.match(bulletRe);
    if (!m) continue;
    const rawAxis = m[1].trim().toLowerCase();
    if (!AXIS_SET.has(rawAxis)) continue;

    const afterColon = m[2].trim();
    let value: string;
    let inlineRationale = "";
    const dashIdx = afterColon.indexOf("\u2014"); // em-dash
    if (dashIdx >= 0) {
      value = afterColon.slice(0, dashIdx).trim();
      inlineRationale = afterColon.slice(dashIdx + 1).trim();
    } else {
      value = afterColon;
    }

    const continuationParts: string[] = [];
    let j = i + 1;
    while (j < bodyLines.length) {
      const nextTrimmed = bodyLines[j].text.trim();
      if (nextTrimmed === "" || /^\s*-\s+\*\*/.test(bodyLines[j].text)) break;
      continuationParts.push(nextTrimmed);
      j++;
    }

    const rationale = [inlineRationale, ...continuationParts]
      .filter((s) => s.length > 0).join(" ").trim();

    axes.push({ name: rawAxis as AxisName, value, rationale, line: line.n });
  }
  return axes;
}

// --- Locked At ---

function parseLockedAt(section: Section | undefined): string {
  if (!section) return "";
  const isoRe = /\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z?)?/;
  for (const line of section.bodyLines) {
    const m = line.text.match(isoRe);
    if (m) return m[0];
  }
  return "";
}

// --- References ---

interface RefParsed { label: string; urlOrPath: string; exemplifiesAxes: string[]; line: number }

function parseReferences(section: Section | undefined): RefParsed[] {
  if (!section) return [];
  const refs: RefParsed[] = [];
  const urlRe = /https?:\/\/[^)\s]+/;

  for (const line of section.bodyLines) {
    const bulletMatch = line.text.match(/^\s*-\s+(.+)$/);
    if (!bulletMatch) continue;
    const raw = bulletMatch[1].trim();
    let url = "";
    let label = "";

    const mdLink = raw.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    if (mdLink) {
      label = mdLink[1].trim();
      url = mdLink[2].trim();
    } else {
      const urlMatch = raw.match(urlRe);
      if (urlMatch) {
        url = urlMatch[0];
        const beforeUrl = raw.slice(0, raw.indexOf(url));
        label = beforeUrl.replace(/\(\s*$/, "").replace(/\s*\u2014.*$/, "").trim();
        if (!label) label = url;
      } else {
        const dashIdx = raw.indexOf(" \u2014 ");
        label = dashIdx >= 0 ? raw.slice(0, dashIdx).trim() : raw.trim();
      }
    }

    const urlOrPath = url || label;
    const exemplifiesAxes = AXIS_WORD_REGEXES
      .filter(({ re }) => re.test(raw))
      .map(({ axis }) => axis as string)
      .slice()
      .sort();
    refs.push({ label, urlOrPath, exemplifiesAxes, line: line.n });
  }
  return refs;
}

// --- Do's and Don'ts ---

interface GuidelineParsed { polarity: "do" | "dont"; text: string; axisScope: string | null; line: number }

function parseDosAndDonts(section: Section, _ctx: Ctx): GuidelineParsed[] {
  const h3s = findH3Sections(section.bodyLines);
  const hasPatternA = h3s.some(
    (s) => /^do['\u2018\u2019]?s$/i.test(s.heading) || /^don['\u2018\u2019]?ts$/i.test(s.heading),
  );
  const guidelines: GuidelineParsed[] = [];

  if (hasPatternA) {
    for (const sub of h3s) {
      const headingLower = sub.heading.toLowerCase().replace(/['\u2018\u2019]/g, "");
      let polarity: "do" | "dont" | null = null;
      if (/^dos$/.test(headingLower)) polarity = "do";
      else if (/^donts$/.test(headingLower)) polarity = "dont";
      if (!polarity) continue;
      for (const line of sub.bodyLines) {
        const m = line.text.match(/^\s*-\s+(.+)$/);
        if (!m) continue;
        guidelines.push({ polarity, text: m[1].trim(), axisScope: matchAxisScope(m[1]), line: line.n });
      }
    }
  } else {
    for (const line of section.bodyLines) {
      const m = line.text.match(/^\s*-\s+(.+)$/);
      if (!m) continue;
      const raw = m[1].trim();
      const parsed = classifyGuideline(raw);
      if (!parsed) continue;
      guidelines.push({ polarity: parsed.polarity, text: parsed.text, axisScope: matchAxisScope(raw), line: line.n });
    }
  }
  return guidelines;
}

function classifyGuideline(raw: string): { polarity: "do" | "dont"; text: string } | null {
  if (/^don['\u2018\u2019]?t\s+/i.test(raw))
    return { polarity: "dont", text: raw.replace(/^don['\u2018\u2019]?t\s+/i, "").trim() };
  if (/^do\s+/i.test(raw))
    return { polarity: "do", text: raw.replace(/^do\s+/i, "").trim() };
  if (/^DON['\u2018\u2019]?T:\s*/i.test(raw))
    return { polarity: "dont", text: raw.replace(/^DON['\u2018\u2019]?T:\s*/i, "").trim() };
  if (/^DO:\s*/i.test(raw))
    return { polarity: "do", text: raw.replace(/^DO:\s*/i, "").trim() };
  if (raw.startsWith("\u2713") || raw.startsWith("\u2713"))
    return { polarity: "do", text: raw.slice(1).trim() };
  if (raw.startsWith("\u2717") || raw.startsWith("\u2717"))
    return { polarity: "dont", text: raw.slice(1).trim() };
  return null;
}

function matchAxisScope(text: string): string | null {
  const matches = AXIS_WORD_REGEXES.filter(({ re }) => re.test(text)).map(({ axis }) => axis as string);
  return matches.length === 1 ? matches[0] : null;
}

// --- Pass 2 detection ---

const PASS2_HEADINGS = new Set(["colors", "typography", "layout", "elevation & depth", "shapes", "components"]);
const PLACEHOLDER_RE = /^\s*(<!--.*-->|_<placeholder>_|TBD|TODO)\s*$/i;

function isPass2SectionPopulated(section: Section): boolean {
  for (const line of section.bodyLines) {
    const trimmed = line.text.trim();
    if (trimmed === "" || PLACEHOLDER_RE.test(trimmed)) continue;
    return true;
  }
  return false;
}

// --- Determinism: stable sort (mirrors product-spec.ts) ---

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

// --- Public entrypoint ---

export function extractDesignMd(input: { mdPath: string; mdContent: string }): ExtractResult {
  const { mdPath, mdContent } = input;
  const lines = splitLines(mdContent);
  const ctx: Ctx = { mdPath, errors: [], nodes: [], edges: [] };

  const fm = parseFrontmatter(lines, ctx);
  if (!fm) return { ok: false, errors: ctx.errors };

  const h2Sections = partitionSections(lines, 2, 0, lines.length);

  // Overview (required)
  const overviewSection =
    h2Sections.find((s) => /^overview$/i.test(s.heading.trim())) ??
    h2Sections.find((s) => /^brand\s*&\s*style$/i.test(s.heading.trim()));
  if (!overviewSection) {
    pushError(ctx, 1, "Missing required `## Overview` h2");
    return { ok: false, errors: ctx.errors };
  }

  const description = fm.description || extractOverviewDescription(overviewSection.bodyLines);

  // Brand DNA (required h3 inside Overview)
  const overviewH3s = findH3Sections(overviewSection.bodyLines);
  const brandDnaSections = overviewH3s.filter((s) => s.heading.toLowerCase() === "brand dna");

  if (brandDnaSections.length === 0) {
    pushError(ctx, overviewSection.startLine, "Missing required `### Brand DNA` h3 inside `## Overview`");
    return { ok: false, errors: ctx.errors };
  }
  if (brandDnaSections.length > 1) {
    pushError(ctx, brandDnaSections[1].startLine, "Duplicate `### Brand DNA` h3 inside `## Overview`");
    return { ok: false, errors: ctx.errors };
  }

  const axes = parseBrandDna(brandDnaSections[0], ctx);
  const foundAxisNames = new Set(axes.map((a) => a.name));
  for (const req of REQUIRED_AXES) {
    if (!foundAxisNames.has(req)) pushError(ctx, brandDnaSections[0].startLine, `Missing required axis: ${req}`);
  }
  if (ctx.errors.length > 0) return { ok: false, errors: ctx.errors };

  // Locked At (non-fatal if missing)
  const lockedAt = parseLockedAt(overviewH3s.find((s) => s.heading.toLowerCase() === "locked at"));

  // References (non-fatal if missing)
  const refs = parseReferences(overviewH3s.find((s) => s.heading.toLowerCase() === "references"));

  // Do's and Don'ts (required h2) — heading may use straight or curly apostrophes
  const dosSection = h2Sections.find((s) =>
    /^do['\u2018\u2019]?s\s+and\s+don['\u2018\u2019]?ts$/i.test(s.heading.trim()),
  );
  if (!dosSection) {
    pushError(ctx, 1, "Missing required `## Do's and Don'ts` h2");
    return { ok: false, errors: ctx.errors };
  }
  const guidelines = parseDosAndDonts(dosSection, ctx);

  // Pass completeness
  let pass2ProsePopulated = false;
  for (const s of h2Sections) {
    if (PASS2_HEADINGS.has(s.heading.toLowerCase()) && isPass2SectionPopulated(s)) {
      pass2ProsePopulated = true;
      break;
    }
  }
  const pass2 = fm.yamlPass2Populated || pass2ProsePopulated;
  const pass1 = axes.length === REQUIRED_AXES.length
    && axes.every((a) => a.value.length > 0)
    && guidelines.length >= 4;

  // --- Emit nodes and edges ---
  const rootId = ids.designDocRoot();
  const rootNode: DesignDocRootNode = {
    id: rootId, label: fm.name, entity_type: "design_doc_root",
    source_file: mdPath, source_location: "L1", confidence: "EXTRACTED",
    name: fm.name, description, locked_at: lockedAt,
    pass_complete: { pass1, pass2 },
  };
  ctx.nodes.push(rootNode);

  for (const axis of axes) {
    const axisId = ids.dnaAxis(axis.name);
    const node: DnaAxisNode = {
      id: axisId,
      label: `${axis.name.charAt(0).toUpperCase() + axis.name.slice(1)}: ${axis.value}`,
      entity_type: "dna_axis", source_file: mdPath, source_location: loc(axis.line),
      confidence: "EXTRACTED", axis_name: axis.name, value: axis.value, rationale: axis.rationale,
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge(rootId, axisId, "has_axis", mdPath, loc(axis.line)));
  }

  for (const ref of refs) {
    const refId = ids.brandReference(ref.urlOrPath);
    const node: BrandReferenceNode = {
      id: refId, label: ref.label, entity_type: "brand_reference",
      source_file: mdPath, source_location: loc(ref.line), confidence: "EXTRACTED",
      url_or_path: ref.urlOrPath, exemplifies_axes: ref.exemplifiesAxes,
    };
    ctx.nodes.push(node);
    for (const axisName of ref.exemplifiesAxes) {
      ctx.edges.push(makeEdge(refId, ids.dnaAxis(axisName), "references_axis", mdPath, loc(ref.line)));
    }
  }

  for (const g of guidelines) {
    const gId = ids.dnaGuideline(g.polarity, g.text);
    const node: BrandDnaGuidelineNode = {
      id: gId, label: truncateLabel(g.text), entity_type: "brand_dna_guideline",
      source_file: mdPath, source_location: loc(g.line), confidence: "EXTRACTED",
      polarity: g.polarity, text: g.text, axis_scope: g.axisScope,
    };
    ctx.nodes.push(node);
    // Slice 2 omits `forbids` edges — GraphEdge lacks edge-attribute fields for arbitrary strings.
    if (g.axisScope) {
      ctx.edges.push(makeEdge(gId, ids.dnaAxis(g.axisScope), "applies_to", mdPath, loc(g.line)));
    }
  }

  const fragment: GraphFragment = {
    version: 1, schema: "buildanything-slice-2",
    source_file: mdPath, source_sha: sha256Hex(mdContent),
    produced_at: new Date().toISOString(),
    nodes: sortNodes(ctx.nodes), edges: sortEdges(ctx.edges),
  };
  return { ok: true, fragment, errors: [] };
}
