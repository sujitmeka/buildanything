// Deterministic, schema-aware extractor for page-spec markdown files.
// Source of truth: docs/graph/07-slice3-schema.md.
// No LLM, no I/O. Caller passes the markdown content and path.

import { ids, kebab, sha256Hex } from "../ids.js";
import type {
  ExtractError,
  ExtractResult,
  GraphEdge,
  GraphFragment,
  GraphNode,
  KeyCopyNode,
  PageSpecNode,
  Relation,
  ScreenComponentUseNode,
  ScreenStateSlotNode,
  WireframeSectionNode,
} from "../types.js";

const PRODUCED_BY = "design-ux-architect";
const PRODUCED_AT_STEP = "3.3";

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

interface TableRow {
  cells: Record<string, string>;
  line: number;
}

function parseTable(body: Line[]): { headers: string[]; rows: TableRow[] } | null {
  const sepRe = /^\s*\|?\s*[-:| ]+\s*\|?\s*$/;
  const significant = body.filter((l) => l.text.trim().length > 0);
  let headerIdx = -1;
  for (let i = 0; i < significant.length - 1; i++) {
    if (
      significant[i].text.includes("|") &&
      significant[i + 1].text.includes("|") &&
      sepRe.test(significant[i + 1].text)
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return null;
  const headers = splitRow(significant[headerIdx].text).map((h) => h.toLowerCase());
  const rows: TableRow[] = [];
  for (let i = headerIdx + 2; i < significant.length; i++) {
    const ln = significant[i];
    if (!ln.text.includes("|")) break;
    const cells = splitRow(ln.text);
    if (cells.length === 0) continue;
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (cells[c] ?? "").trim();
    }
    rows.push({ cells: row, line: ln.n });
  }
  return { headers, rows };
}

function splitRow(text: string): string[] {
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
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

function truncLabel(text: string): string {
  return text.length > 80 ? text.slice(0, 77) + "..." : text;
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

// ---------------------------------------------------------------------------
// Section parsers
// ---------------------------------------------------------------------------

function findH2(sections: Section[], name: string): Section | undefined {
  return sections.find((s) => s.heading.trim().toLowerCase() === name.toLowerCase());
}

function parseRoute(section: Section | undefined): string | null {
  if (!section) return null;
  for (const line of section.bodyLines) {
    const t = line.text.trim();
    if (!t) continue;
    const stripped = t.replace(/^`+|`+$/g, "").trim();
    if (!stripped || /^n\/a$/i.test(stripped) || /^modal$/i.test(stripped)) return null;
    return stripped;
  }
  return null;
}

function parseWireframe(
  ctx: Ctx,
  section: Section,
  screenName: string,
  pageSpecId: string,
): string | null {
  // Find fenced code block in bodyLines (including sub-headings like ### Desktop)
  let inFence = false;
  let fenceContent: string[] = [];
  let foundFence = false;
  for (const line of section.bodyLines) {
    if (!inFence && /^\s*```/.test(line.text)) {
      inFence = true;
      foundFence = true;
      continue;
    }
    if (inFence && /^\s*```/.test(line.text)) {
      inFence = false;
      break;
    }
    if (inFence) {
      fenceContent.push(line.text);
    }
  }
  if (!foundFence) {
    pushError(ctx, section.startLine, `## ASCII Wireframe section has no fenced code block`);
    return null;
  }
  const wireframeText = fenceContent.join("\n");

  // Scan for [SectionName] markers
  const markerRe = /\[([A-Z][A-Za-z0-9 :_-]*)\]/g;
  const seen = new Set<string>();
  const ordered: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(wireframeText)) !== null) {
    const name = m[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }

  for (let i = 0; i < ordered.length; i++) {
    const sectionName = ordered[i];
    const node: WireframeSectionNode = {
      id: ids.wireframeSection(screenName, sectionName, i),
      label: sectionName,
      entity_type: "wireframe_section",
      source_file: ctx.mdPath,
      source_location: loc(section.startLine),
      confidence: "EXTRACTED",
      section_name: sectionName,
      parent_page_spec_id: pageSpecId,
      order: i,
      prose: "",
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge(ctx, pageSpecId, node.id, "has_section", section.startLine));
  }

  return wireframeText;
}

function parseContentHierarchy(ctx: Ctx, section: Section): string[] | null {
  // Try table first
  const table = parseTable(section.bodyLines);
  if (table) {
    const sectionCol = table.headers.find((h) => h === "section" || h === "section name");
    if (sectionCol && table.rows.length > 0) {
      const entries = table.rows.map((r) => r.cells[sectionCol]!.trim()).filter((s) => s);
      if (entries.length > 0) return entries;
    }
  }
  // Try bulleted/numbered list
  const listRe = /^\s*(?:\d+\.|[-*])\s+(.+)$/;
  const entries: string[] = [];
  for (const line of section.bodyLines) {
    const m = line.text.match(listRe);
    if (m) entries.push(m[1].trim());
  }
  if (entries.length > 0) return entries;
  pushError(ctx, section.startLine, `## Content Hierarchy is empty`);
  return null;
}

function parseStates(
  ctx: Ctx,
  section: Section,
  screenName: string,
  screenId: string,
  pageSpecId: string,
): void {
  // Try table
  const table = parseTable(section.bodyLines);
  if (table && table.headers.includes("state") && table.headers.includes("appearance")) {
    for (const row of table.rows) {
      const stateName = (row.cells["state"] ?? "").trim();
      const appearance = (row.cells["appearance"] ?? "").trim();
      if (!stateName) continue;
      emitStateSlot(ctx, screenName, screenId, pageSpecId, stateName, appearance, row.line);
    }
    return;
  }
  // Try bullets
  const bulletRe = /^\s*-\s+(?:\*\*(.+?)\*\*\s*(?:—|--|-|:)?\s*(.*)$|(.+?):\s+(.*)$)/;
  for (const line of section.bodyLines) {
    const m = line.text.match(bulletRe);
    if (!m) continue;
    const stateName = (m[1] ?? m[3] ?? "").trim();
    const appearance = (m[2] ?? m[4] ?? "").trim();
    if (!stateName) continue;
    emitStateSlot(ctx, screenName, screenId, pageSpecId, stateName, appearance, line.n);
  }
}

function emitStateSlot(
  ctx: Ctx,
  screenName: string,
  screenId: string,
  pageSpecId: string,
  stateName: string,
  appearance: string,
  line: number,
): void {
  const node: ScreenStateSlotNode = {
    id: ids.screenStateSlot(screenName, stateName),
    label: stateName,
    entity_type: "screen_state_slot",
    source_file: ctx.mdPath,
    source_location: loc(line),
    confidence: "EXTRACTED",
    screen_id: screenId,
    state_id: kebab(stateName),
    appearance_text: appearance,
  };
  ctx.nodes.push(node);
  ctx.edges.push(makeEdge(ctx, pageSpecId, node.id, "has_screen_state", line));
}

function parseKeyCopy(
  ctx: Ctx,
  section: Section,
  screenName: string,
  screenId: string,
  pageSpecId: string,
): boolean {
  // Regex: capture text between first and last quote (straight or smart) on the line
  const quoteRe = /^\s*-\s+(?:\*\*)?["\u201C\u2018](.+)["\u201D\u2019](?:\*\*)?\s*(?:\u2014|--|(?:-\s))\s*(.*)$/;
  let count = 0;
  for (const line of section.bodyLines) {
    const m = line.text.match(quoteRe);
    if (!m) continue;
    const text = m[1].trim();
    let placement = m[2].trim();
    // Strip leading 'placement:' prefix
    placement = placement.replace(/^placement:\s*/i, "").trim();
    const node: KeyCopyNode = {
      id: ids.keyCopy(screenName, text),
      label: truncLabel(text),
      entity_type: "key_copy",
      source_file: ctx.mdPath,
      source_location: loc(line.n),
      confidence: "EXTRACTED",
      screen_id: screenId,
      text,
      placement,
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge(ctx, pageSpecId, node.id, "key_copy_on_screen", line.n));
    count++;
  }
  if (count === 0) {
    pushError(ctx, section.startLine, `## Key Copy yielded no parsed bullets`);
    return false;
  }
  return true;
}

function parseComponentPicks(
  ctx: Ctx,
  section: Section,
  screenName: string,
  screenId: string,
  pageSpecId: string,
): void {
  const table = parseTable(section.bodyLines);
  if (!table) return;
  const slotCol = table.headers.find((h) => h === "manifest slot" || h === "slot");
  const sectionCol = table.headers.find((h) => h === "section" || h === "section name");
  if (!slotCol || !sectionCol) return;
  const propsCol = table.headers.find((h) => h === "prop overrides" || h === "props" || h === "overrides");
  for (const row of table.rows) {
    const sectionName = (row.cells[sectionCol] ?? "").trim();
    let rawSlot = (row.cells[slotCol] ?? "").trim();
    // Strip surrounding backticks
    rawSlot = rawSlot.replace(/^`+|`+$/g, "");
    // Strip trailing italics parenthetical: *(...)* 
    rawSlot = rawSlot.replace(/\s*\*\([^)]*\)\*\s*$/, "").trim();
    // Strip trailing plain parenthetical too
    rawSlot = rawSlot.replace(/\s*\([^)]*\)\s*$/, "").trim();
    const slot = kebab(rawSlot);
    if (!slot || !sectionName) continue;
    const propOverrides = propsCol ? (row.cells[propsCol] ?? "").trim() : "";
    const node: ScreenComponentUseNode = {
      id: ids.screenComponentUse(screenName, slot, sectionName),
      label: `${slot} @ ${sectionName}`,
      entity_type: "screen_component_use",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      screen_id: screenId,
      slot,
      position_in_wireframe: sectionName,
      prop_overrides: propOverrides,
    };
    ctx.nodes.push(node);
    ctx.edges.push(makeEdge(ctx, pageSpecId, node.id, "slot_used_on_screen", row.line));
  }
}

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function extractPageSpec(input: { mdPath: string; mdContent: string }): ExtractResult {
  const { mdPath, mdContent } = input;
  const lines = splitLines(mdContent);
  const ctx: Ctx = { mdPath, errors: [], nodes: [], edges: [] };

  // Parse h1: # Page: <Screen Name>
  const h1 = lines.find((l) => isHeadingAtLevel(l.text, 1));
  const h1Match = h1?.text.match(/^#\s+Page:\s+(.+)$/);
  if (!h1 || !h1Match) {
    const found = h1 ? `Found: '${h1.text}'.` : "No h1 found.";
    pushError(
      ctx,
      h1?.n ?? 1,
      `Missing required h1 '# Page: <Screen Name>'. ${found} The first line of a page-spec must match this format exactly. See protocols/page-spec-schema.md §Required Sections.`,
    );
    return { ok: false, errors: ctx.errors };
  }
  const screenName = h1Match[1].trim();
  const screenId = ids.screen(screenName);
  const pageSpecId = ids.pageSpec(screenName);

  const h2Sections = partitionSections(lines, 2, 0, lines.length);

  // Route (optional)
  const route = parseRoute(findH2(h2Sections, "Route"));

  // ASCII Wireframe (required)
  const wireframeSec = findH2(h2Sections, "ASCII Wireframe");
  if (!wireframeSec) {
    pushError(
      ctx,
      1,
      "Missing required section '## ASCII Wireframe'. If the file uses '## Layout', '## Wireframe', or '## Layouts', rename to '## ASCII Wireframe'. See protocols/page-spec-schema.md §Required Sections.",
    );
    return { ok: false, errors: ctx.errors };
  }
  const wireframeText = parseWireframe(ctx, wireframeSec, screenName, pageSpecId);
  if (wireframeText === null) return { ok: false, errors: ctx.errors };

  // Content Hierarchy (required)
  const hierarchySec = findH2(h2Sections, "Content Hierarchy");
  if (!hierarchySec) {
    pushError(
      ctx,
      1,
      "Missing required section '## Content Hierarchy'. If the file uses '## Component inventory', '## Components', or '## Sections', rename to '## Content Hierarchy'. See protocols/page-spec-schema.md §Required Sections.",
    );
    return { ok: false, errors: ctx.errors };
  }
  const contentHierarchy = parseContentHierarchy(ctx, hierarchySec);
  if (!contentHierarchy) return { ok: false, errors: ctx.errors };

  // States (optional)
  const statesSec = findH2(h2Sections, "States");
  if (statesSec) parseStates(ctx, statesSec, screenName, screenId, pageSpecId);

  // Key Copy (required)
  const keyCopySec = findH2(h2Sections, "Key Copy");
  if (!keyCopySec) {
    pushError(
      ctx,
      1,
      "Missing required section '## Key Copy'. If the file uses '## Copy', '## Strings', or '## Microcopy', rename to '## Key Copy'. See protocols/page-spec-schema.md §Required Sections.",
    );
    return { ok: false, errors: ctx.errors };
  }
  if (!parseKeyCopy(ctx, keyCopySec, screenName, screenId, pageSpecId)) {
    return { ok: false, errors: ctx.errors };
  }

  // Component Picks (optional)
  const compSec = findH2(h2Sections, "Component Picks");
  if (compSec) parseComponentPicks(ctx, compSec, screenName, screenId, pageSpecId);

  // PageSpecNode
  const pageNode: PageSpecNode = {
    id: pageSpecId,
    label: screenName,
    entity_type: "page_spec",
    source_file: mdPath,
    source_location: loc(h1.n),
    confidence: "EXTRACTED",
    screen_id: screenId,
    wireframe_text: wireframeText,
    content_hierarchy: contentHierarchy,
    route,
  };
  ctx.nodes.push(pageNode);

  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }

  const fragment: GraphFragment = {
    version: 1,
    schema: "buildanything-slice-3",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: new Date().toISOString(),
    nodes: sortNodes(ctx.nodes),
    edges: sortEdges(ctx.edges),
  };
  return { ok: true, fragment, errors: [] };
}
