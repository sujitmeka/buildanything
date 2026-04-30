// Deterministic, schema-aware extractor for component-manifest.md.
// Source of truth: docs/graph/05-slice2-schema.md §4.2.
// No LLM, no I/O. Caller passes the markdown content and path.

import { ids, kebab, sha256Hex } from "../ids.js";
import type {
  ComponentManifestEntryNode,
  ComponentSlotNode,
  ExtractError,
  ExtractResult,
  GraphEdge,
  GraphFragment,
  GraphNode,
} from "../types.js";

const PRODUCED_BY = "design-ui-designer";
const PRODUCED_AT_STEP = "3.2";

const HARD_GATE_RE = /\[(?:hg|hard-gate)\]|\(hg\)/i;
const SEP_RE = /^\s*\|?\s*[-:| ]+\s*\|?\s*$/;
const EXPECTED_HEADERS = ["slot", "library", "variant", "source ref", "notes"];

interface Line {
  n: number;
  text: string;
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

function splitRow(text: string): string[] {
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

interface TableRow {
  cells: string[]; // raw cell values in column order
  line: number;
}

interface Table {
  headerLine: number;
  rows: TableRow[];
}

// Find all pipe tables in the file. A table starts with a header row
// followed immediately by a separator row. Rows continue until a non-pipe
// line or end of file.
function findTables(lines: Line[]): Table[] {
  const tables: Table[] = [];
  let i = 0;
  while (i < lines.length - 1) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (
      cur.text.includes("|") &&
      next.text.includes("|") &&
      SEP_RE.test(next.text)
    ) {
      const rows: TableRow[] = [];
      let j = i + 2;
      while (j < lines.length) {
        const ln = lines[j];
        if (!ln.text.includes("|")) break;
        // Skip separator-only rows (all dashes/colons/whitespace/pipes)
        if (SEP_RE.test(ln.text)) { j++; continue; }
        const cells = splitRow(ln.text);
        // Skip empty rows (all cells blank)
        if (cells.every((c) => c === "")) { j++; continue; }
        rows.push({ cells, line: ln.n });
        j++;
      }
      tables.push({ headerLine: cur.n, rows });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

function isEmptyRef(s: string): boolean {
  const t = s.trim();
  return t === "" || t === "—" || t === "-" || t === "–";
}

function sortNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function sortEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((a, b) => {
    const k = (e: GraphEdge): string => `${e.relation} ${e.source} ${e.target}`;
    return k(a) < k(b) ? -1 : k(a) > k(b) ? 1 : 0;
  });
}

export function extractComponentManifest(input: {
  mdPath: string;
  mdContent: string;
}): ExtractResult {
  const { mdPath, mdContent } = input;
  const lines = splitLines(mdContent);
  const ctx: Ctx = { mdPath, errors: [], nodes: [], edges: [] };

  const tables = findTables(lines);
  if (tables.length === 0) {
    return {
      ok: false,
      errors: [{ line: 0, message: "No pipe tables found in component manifest" }],
    };
  }

  // Validate headers and collect all rows across tables
  const allRows: TableRow[] = [];
  for (const table of tables) {
    const headerCells = splitRow(lines[table.headerLine - 1].text);
    const normalized = headerCells.map((h) => h.toLowerCase().trim());

    if (normalized.length < 5) {
      pushError(ctx, table.headerLine, `L${table.headerLine}: table has fewer than 5 columns`);
      continue;
    }
    let headerOk = true;
    for (let c = 0; c < EXPECTED_HEADERS.length; c++) {
      if (normalized[c] !== EXPECTED_HEADERS[c]) {
        pushError(
          ctx,
          table.headerLine,
          `Table header must be: Slot | Library | Variant | Source ref | Notes (got "${headerCells[c]}" at column ${c + 1})`,
        );
        headerOk = false;
        break;
      }
    }
    if (!headerOk) continue;
    allRows.push(...table.rows);
  }

  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }

  // Track slots for dedup: kebab → first line number
  const slotSeen = new Map<string, number[]>();

  for (const row of allRows) {
    const rawSlot = row.cells[0] ?? "";
    const slotKebab = kebab(rawSlot);
    if (!slotKebab) {
      pushError(ctx, row.line, `Empty slot name at L${row.line}`);
      continue;
    }

    const existing = slotSeen.get(slotKebab);
    if (existing) {
      existing.push(row.line);
    } else {
      slotSeen.set(slotKebab, [row.line]);
    }
  }

  // Check for duplicates
  for (const [slotKebab, lineNums] of slotSeen) {
    if (lineNums.length > 1) {
      const refs = lineNums.map((n) => `L${n}`).join(" and ");
      pushError(ctx, lineNums[0], `Duplicate slot "${slotKebab}" at ${refs}`);
    }
  }

  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }

  // Emit nodes and edges
  const emittedSlots = new Set<string>();

  for (const row of allRows) {
    const rawSlot = row.cells[0] ?? "";
    const slotKebab = kebab(rawSlot);
    const rawLibrary = (row.cells[1] ?? "").trim();
    const rawVariant = (row.cells[2] ?? "").trim();
    const rawSourceRef = (row.cells[3] ?? "").trim();
    const rawNotes = (row.cells[4] ?? "").trim();

    const isTbd =
      rawLibrary.toLowerCase() === "tbd" || rawVariant.toLowerCase() === "tbd";

    const library = rawLibrary.toLowerCase();
    const variant = isTbd ? rawVariant.toLowerCase() : rawVariant.trim();
    const sourceRef = isEmptyRef(rawSourceRef) ? null : rawSourceRef;
    const hardGate = isTbd ? false : HARD_GATE_RE.test(rawNotes);
    const fallbackProse = rawNotes.replace(HARD_GATE_RE, "").trim();

    const entryNode: ComponentManifestEntryNode = {
      id: ids.manifestEntry(rawSlot),
      label: slotKebab,
      entity_type: "component_manifest_entry",
      source_file: mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      slot: slotKebab,
      library,
      variant,
      source_ref: sourceRef,
      hard_gate: hardGate,
      ...(fallbackProse ? { fallback_plan: fallbackProse } : {}),
    };
    ctx.nodes.push(entryNode);

    // Emit ComponentSlotNode (deduplicated)
    if (!emittedSlots.has(slotKebab)) {
      emittedSlots.add(slotKebab);
      const slotNode: ComponentSlotNode = {
        id: ids.componentSlot(rawSlot),
        label: slotKebab,
        entity_type: "component_slot",
        source_file: mdPath,
        source_location: loc(row.line),
        confidence: "EXTRACTED",
        slot_name: slotKebab,
      };
      ctx.nodes.push(slotNode);
    }

    // Edge: slot → manifest entry
    ctx.edges.push({
      source: ids.componentSlot(rawSlot),
      target: ids.manifestEntry(rawSlot),
      relation: "slot_filled_by",
      confidence: "EXTRACTED",
      source_file: mdPath,
      source_location: loc(row.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP,
    });
  }

  const fragment: GraphFragment = {
    version: 1,
    schema: "buildanything-slice-2",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: new Date().toISOString(),
    nodes: sortNodes(ctx.nodes),
    edges: sortEdges(ctx.edges),
  };

  return { ok: true, fragment, errors: [] };
}
