// Deterministic, schema-aware extractor for backend-tasks.md.
// Source of truth: docs/graph/09-slice4-schema.md.
// No LLM, no I/O. Caller passes the markdown content and path.

import { ids, sha256Hex } from "../ids.js";
import type {
  ExtractError,
  ExtractResult,
  GraphEdge,
  GraphFragment,
  GraphNode,
  Relation,
  TaskNode,
} from "../types.js";

const PRODUCED_BY = "planner";
const PRODUCED_AT_STEP = "2.3.2";

// ---------------------------------------------------------------------------
// Shared helpers (same pattern as component-manifest.ts / page-spec.ts)
// ---------------------------------------------------------------------------

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

const SEP_RE = /^\s*\|?\s*[-:| ]+\s*\|?\s*$/;

interface TableRow {
  cells: Record<string, string>;
  line: number;
}

interface Table {
  headerLine: number;
  headers: string[];
  rows: TableRow[];
}

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
      const headers = splitRow(cur.text).map((h) => h.toLowerCase().trim());
      const rows: TableRow[] = [];
      let j = i + 2;
      while (j < lines.length) {
        const ln = lines[j];
        if (!ln.text.includes("|")) break;
        if (SEP_RE.test(ln.text)) { j++; continue; }
        const cells = splitRow(ln.text);
        if (cells.every((c) => c === "")) { j++; continue; }
        const row: Record<string, string> = {};
        for (let c = 0; c < headers.length; c++) {
          row[headers[c]] = (cells[c] ?? "").trim();
        }
        rows.push({ cells: row, line: ln.n });
        j++;
      }
      tables.push({ headerLine: cur.n, headers, rows });
      i = j;
    } else {
      i++;
    }
  }
  return tables;
}

function isEmptyRef(s: string): boolean {
  const t = s.trim();
  return t === "" || t === "\u2014" || t === "-" || t === "\u2013";
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

// ---------------------------------------------------------------------------
// Owns-files parsing
// ---------------------------------------------------------------------------

function parseOwnsFiles(raw: string): string[] {
  if (isEmptyRef(raw)) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Required columns (no 'screens' for backend tasks)
// ---------------------------------------------------------------------------

const REQUIRED_COLUMNS = [
  "task id",
  "title",
  "size",
  "dependencies",
  "behavioral test",
  "owns files",
  "implementing phase",
  "feature",
];

const VALID_SIZES = new Set(["S", "M", "L"]);

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function extractBackendTasks(input: {
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
      errors: [{ line: 0, message: "No pipe tables found in backend-tasks.md" }],
    };
  }

  // Collect all valid rows across tables
  const allRows: { row: TableRow; headers: string[]; headerLine: number }[] = [];

  for (const table of tables) {
    if (table.headers.length < 8) {
      pushError(
        ctx,
        table.headerLine,
        `Table has fewer than 8 columns (got ${table.headers.length})`,
      );
      continue;
    }

    for (const col of REQUIRED_COLUMNS) {
      if (!table.headers.includes(col)) {
        const displayName = col
          .split(" ")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
        pushError(ctx, table.headerLine, `Missing required column: '${displayName}'`);
      }
    }

    if (ctx.errors.length > 0) continue;

    for (const row of table.rows) {
      allRows.push({ row, headers: table.headers, headerLine: table.headerLine });
    }
  }

  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }

  // Track task IDs for duplicate detection
  const taskIdSeen = new Map<string, number>();

  for (const { row } of allRows) {
    const rawTaskId = row.cells["task id"] ?? "";
    if (rawTaskId.trim() === "") {
      pushError(ctx, row.line, `Anonymous task at L${row.line} — Task ID is required`);
      continue;
    }

    const taskIdLower = rawTaskId.toLowerCase();
    const prev = taskIdSeen.get(taskIdLower);
    if (prev !== undefined) {
      pushError(
        ctx,
        row.line,
        `Duplicate Task ID '${rawTaskId}' at L${prev} and L${row.line}`,
      );
      continue;
    }
    taskIdSeen.set(taskIdLower, row.line);

    const size = (row.cells["size"] ?? "").trim().toUpperCase();
    if (!VALID_SIZES.has(size)) {
      pushError(
        ctx,
        row.line,
        `Invalid Size '${(row.cells["size"] ?? "").trim()}' at L${row.line} — must be S, M, or L`,
      );
      continue;
    }

    const taskId = rawTaskId.trim();
    const title = (row.cells["title"] ?? "").trim();
    const behavioralTest = (row.cells["behavioral test"] ?? "").trim();
    const implementingPhase = (row.cells["implementing phase"] ?? "").trim();
    const ownsFiles = parseOwnsFiles(row.cells["owns files"] ?? "");
    const featureRaw = (row.cells['feature'] ?? '').trim();
    const featureId = isEmptyRef(featureRaw) ? null : ids.feature(featureRaw);

    // Optional Screens column — comma-separated screen names. Backend tasks
    // typically have no screens; UI-touching backend tasks (form scaffolds, RPC
    // wiring on a specific page) name the screen so the graph carries a
    // task_touches_screen edge for downstream BO + Track B queries.
    const screensRaw = (row.cells["screens"] ?? "").trim();
    const screenIds = isEmptyRef(screensRaw)
      ? []
      : screensRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((name) => ids.screen(name));

    const node: TaskNode = {
      id: ids.task(taskId),
      label: title,
      entity_type: "task",
      source_file: mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      task_id: taskId,
      title,
      size: size as "S" | "M" | "L",
      behavioral_test: behavioralTest,
      assigned_phase: implementingPhase,
      feature_id: featureId,
      screen_ids: screenIds,
      owns_files: ownsFiles,
    };
    ctx.nodes.push(node);

    // Feature edge
    if (featureId) {
      ctx.edges.push(makeEdge(ctx, node.id, featureId, "task_implements_feature", row.line));
    }

    // Screen edges
    for (const screenId of screenIds) {
      ctx.edges.push(makeEdge(ctx, node.id, screenId, "task_touches_screen", row.line));
    }

    // Dependency edges
    const depsRaw = (row.cells["dependencies"] ?? "").trim();
    if (!isEmptyRef(depsRaw)) {
      const deps = depsRaw.split(",").map((d) => d.trim()).filter((d) => d.length > 0);
      for (const dep of deps) {
        ctx.edges.push(makeEdge(ctx, node.id, ids.task(dep), "task_depends_on", row.line));
      }
    }
  }

  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
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
