// Deterministic, schema-aware extractor for sprint-tasks.md.
// Source of truth: docs/graph/09-slice4-schema.md.
// No LLM, no I/O. Caller passes the markdown content and path.

import { ids, kebab, sha256Hex } from "../ids.js";
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
// Feature ID heuristic (title-only, case-insensitive)
// ---------------------------------------------------------------------------

type FeatureRule = { patterns: RegExp[]; featureKebab: string };

const FEATURE_RULES: FeatureRule[] = [
  { patterns: [/auth/i, /authentication/i, /login/i], featureKebab: "feature__auth" },
  { patterns: [/shopping cart/i], featureKebab: "feature__cart" },
  { patterns: [/cart/i], featureKebab: "feature__cart" },
  { patterns: [/checkout/i, /shipping form/i], featureKebab: "feature__checkout" },
  { patterns: [/order placement/i, /place order/i], featureKebab: "feature__order-placement" },
  { patterns: [/seller order/i, /seller inbox/i, /mark shipped/i, /payout/i, /fulfillment/i], featureKebab: "feature__seller-fulfillment" },
  { patterns: [/product listing/i, /product detail/i, /catalog/i, /search filters/i, /infinite scroll/i], featureKebab: "feature__product-discovery" },
  { patterns: [/order/i, /orders/i], featureKebab: "feature__orders" },
  { patterns: [/account settings/i, /account/i], featureKebab: "feature__account" },
  { patterns: [/receipt/i, /submit expense/i, /expense/i], featureKebab: "feature__expense-submission" },
  { patterns: [/my reports/i, /reports list/i], featureKebab: "feature__expense-submission" },
  { patterns: [/approval/i, /approve/i, /reject/i, /request-changes/i, /audit log/i, /audit/i], featureKebab: "feature__approval-workflow" },
];

function deriveFeatureId(title: string): string | null {
  for (const rule of FEATURE_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(title)) return rule.featureKebab;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Screen ID heuristic (title + behavioral test, case-insensitive)
// ---------------------------------------------------------------------------

type ScreenRule = { patterns: RegExp[]; screenId: string };

const SCREEN_RULES: ScreenRule[] = [
  { patterns: [/catalog page/i, /catalog/i], screenId: ids.screen("catalog") },
  { patterns: [/cart review/i, /cart-review/i], screenId: ids.screen("cart-review") },
  { patterns: [/checkout shipping/i, /shipping form/i], screenId: ids.screen("checkout-shipping") },
  { patterns: [/product detail/i, /\/product\//i], screenId: ids.screen("product-detail") },
  { patterns: [/seller inbox/i, /seller order inbox/i], screenId: ids.screen("seller-inbox") },
  { patterns: [/order fulfillment detail/i, /mark shipped/i], screenId: ids.screen("order-fulfillment-detail") },
  { patterns: [/payout dashboard/i, /payouts page/i], screenId: ids.screen("payout-dashboard") },
  { patterns: [/account settings/i, /account\.tsx/i, /\/account/i], screenId: ids.screen("account-settings") },
  { patterns: [/submit expense/i, /submit\.tsx/i], screenId: ids.screen("submit-expense") },
  { patterns: [/approval queue/i], screenId: ids.screen("approval-queue") },
  { patterns: [/admin audit log/i, /audit\.tsx/i], screenId: ids.screen("admin-audit-log") },
  { patterns: [/my reports/i, /my-reports/i], screenId: ids.screen("my-reports") },
];

function deriveScreenIds(title: string, behavioralTest: string): string[] {
  const text = `${title} ${behavioralTest}`;
  const matched = new Set<string>();
  for (const rule of SCREEN_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(text)) {
        matched.add(rule.screenId);
        break;
      }
    }
  }
  return [...matched].sort();
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
// Required columns
// ---------------------------------------------------------------------------

const REQUIRED_COLUMNS = [
  "task id",
  "title",
  "size",
  "dependencies",
  "behavioral test",
  "owns files",
  "implementing phase",
];

const VALID_SIZES = new Set(["S", "M", "L"]);

// ---------------------------------------------------------------------------
// Public entrypoint
// ---------------------------------------------------------------------------

export function extractSprintTasks(input: {
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
      errors: [{ line: 0, message: "No pipe tables found in sprint-tasks.md" }],
    };
  }

  // Collect all valid rows across tables
  const allRows: { row: TableRow; headers: string[]; headerLine: number }[] = [];

  for (const table of tables) {
    if (table.headers.length < 7) {
      pushError(
        ctx,
        table.headerLine,
        `Table has fewer than 7 columns (got ${table.headers.length})`,
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
    const featureId = deriveFeatureId(title);
    const screenIds = deriveScreenIds(title, behavioralTest);

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
