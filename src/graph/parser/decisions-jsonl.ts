// Deterministic JSONL parser for docs/plans/decisions.jsonl.
// Source of truth: docs/graph/09-slice4-schema.md §4.3.
// No LLM, no I/O — caller passes file path and content.

import { ids, sha256Hex } from "../ids.js";
import type {
  DecisionNode,
  ExtractError,
  ExtractResult,
  GraphEdge,
  GraphFragment,
  GraphNode,
  Relation,
} from "../types.js";

const PRODUCED_BY = "orchestrator-scribe";
const PRODUCED_AT_STEP = "cross-phase";
const VALID_STATUSES = new Set(["open", "triggered", "resolved"]);

interface RawRow {
  decision_id: string;
  summary: string;
  decided_by: string;
  related_decision_id: string | null;
  revisit_criterion?: string | null;
  status: "open" | "triggered" | "resolved";
  phase: string;
  step_id?: string | null;
  at?: string;
}

interface ParsedRow {
  raw: RawRow;
  line: number;
}

function loc(line: number): string {
  return `L${line}`;
}

function makeEdge(
  source: string,
  target: string,
  relation: Relation,
  sourceFile: string,
  line: number,
  decidedBy: string,
): GraphEdge {
  return {
    source,
    target,
    relation,
    confidence: "EXTRACTED",
    source_file: sourceFile,
    source_location: loc(line),
    produced_by_agent: decidedBy || PRODUCED_BY,
    produced_at_step: PRODUCED_AT_STEP,
  };
}

function isCommentOrBlank(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  return trimmed.startsWith("//") || trimmed.startsWith("#");
}

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

function validateRow(row: unknown, line: number): { ok: true; row: RawRow } | { ok: false; error: ExtractError } {
  if (typeof row !== "object" || row === null || Array.isArray(row)) {
    return { ok: false, error: { line, message: `Line ${line}: row is not a JSON object` } };
  }
  const r = row as Record<string, unknown>;

  // The on-disk field for the human-readable summary is `decision` (per
  // src/orchestrator/mcp/scribe.ts DecisionRow). The schema doc and the
  // DecisionNode type call it `summary`. Accept either, prefer `summary`
  // when both are present.
  const summaryRaw = r.summary ?? r.decision;
  if (typeof summaryRaw !== "string" || summaryRaw.length === 0) {
    return {
      ok: false,
      error: { line, message: `Line ${line}: missing or empty required field 'summary' (or 'decision')` },
    };
  }

  const requiredStrings = ["decision_id", "decided_by", "phase"] as const;
  for (const field of requiredStrings) {
    if (typeof r[field] !== "string" || (r[field] as string).length === 0) {
      return {
        ok: false,
        error: { line, message: `Line ${line}: missing or empty required field '${field}'` },
      };
    }
  }

  // related_decision_id is required by the spec, but scribe.ts didn't write it
  // for early rows (it became part of the row shape later). Tolerate missing
  // field as null — only reject when present and not string|null.
  const rel = "related_decision_id" in r ? r.related_decision_id : null;
  if (rel !== null && typeof rel !== "string") {
    return {
      ok: false,
      error: { line, message: `Line ${line}: 'related_decision_id' must be string or null` },
    };
  }

  if (typeof r.status !== "string" || !VALID_STATUSES.has(r.status)) {
    return {
      ok: false,
      error: {
        line,
        message: `Line ${line}: invalid 'status' value '${String(r.status)}' (must be open|triggered|resolved)`,
      },
    };
  }

  let revisit: string | null = null;
  if ("revisit_criterion" in r) {
    const rc = r.revisit_criterion;
    if (rc !== null && typeof rc !== "string") {
      return {
        ok: false,
        error: { line, message: `Line ${line}: 'revisit_criterion' must be string or null` },
      };
    }
    revisit = rc as string | null;
  }

  let stepId: string | null = null;
  if ("step_id" in r) {
    const s = r.step_id;
    if (s !== null && typeof s !== "string") {
      return {
        ok: false,
        error: { line, message: `Line ${line}: 'step_id' must be string or null` },
      };
    }
    stepId = s as string | null;
  }

  // Prefer `at` (spec); fall back to `timestamp` (on-disk per scribe.ts).
  let at: string | undefined;
  const atRaw = r.at ?? r.timestamp;
  if (atRaw !== undefined) {
    if (typeof atRaw !== "string") {
      return { ok: false, error: { line, message: `Line ${line}: 'at'/'timestamp' must be a string` } };
    }
    at = atRaw;
  }

  return {
    ok: true,
    row: {
      decision_id: r.decision_id as string,
      summary: summaryRaw,
      decided_by: r.decided_by as string,
      related_decision_id: rel as string | null,
      revisit_criterion: revisit,
      status: r.status as RawRow["status"],
      phase: r.phase as string,
      step_id: stepId,
      at,
    },
  };
}

function detectCycles(parsed: ParsedRow[]): string[] {
  // Build adjacency on related_decision_id pointers (covers both supersedes and relates_to edges
  // since both follow the same parent pointer). Detect cycles via iterative DFS coloring.
  const ids = new Set(parsed.map((p) => p.raw.decision_id));
  const next = new Map<string, string>();
  for (const p of parsed) {
    const target = p.raw.related_decision_id;
    if (target && ids.has(target)) next.set(p.raw.decision_id, target);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const id of ids) color.set(id, WHITE);

  const cycles: string[] = [];
  for (const start of ids) {
    if (color.get(start) !== WHITE) continue;
    // Iterative walk along single-pointer chain (next.get is ≤1 successor).
    const path: string[] = [];
    const onPath = new Set<string>();
    let node: string | undefined = start;
    while (node !== undefined) {
      const c = color.get(node);
      if (c === GRAY && onPath.has(node)) {
        const idx = path.indexOf(node);
        const cycleNodes = path.slice(idx).concat(node);
        cycles.push(cycleNodes.join(" -> "));
        break;
      }
      if (c === BLACK) break;
      color.set(node, GRAY);
      path.push(node);
      onPath.add(node);
      node = next.get(node);
    }
    for (const n of path) color.set(n, BLACK);
  }
  return cycles;
}

function compareRows(a: ParsedRow, b: ParsedRow): number {
  const aAt = a.raw.at;
  const bAt = b.raw.at;
  if (aAt && bAt) {
    if (aAt < bAt) return -1;
    if (aAt > bAt) return 1;
  } else if (aAt && !bAt) {
    return -1;
  } else if (!aAt && bAt) {
    return 1;
  }
  return a.raw.decision_id < b.raw.decision_id ? -1 : a.raw.decision_id > b.raw.decision_id ? 1 : 0;
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

export function extractDecisionsJsonl(input: { mdPath: string; mdContent: string }): ExtractResult {
  const { mdPath } = input;
  const content = stripBom(input.mdContent);
  const errors: ExtractError[] = [];
  const lines = content.split(/\r?\n/);

  // Pass 1: parse and validate every line. Fail-loud on any malformed/invalid row.
  const parsed: ParsedRow[] = [];
  const seenIds = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const text = lines[i];
    if (isCommentOrBlank(text)) continue;

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ line: lineNo, message: `Line ${lineNo}: malformed JSON: ${msg}` });
      return { ok: false, errors };
    }

    const validation = validateRow(json, lineNo);
    if (!validation.ok) {
      errors.push(validation.error);
      return { ok: false, errors };
    }

    const row = validation.row;
    const prior = seenIds.get(row.decision_id);
    if (prior !== undefined) {
      errors.push({
        line: lineNo,
        message: `Line ${lineNo}: duplicate decision_id '${row.decision_id}' (first seen at line ${prior})`,
      });
      return { ok: false, errors };
    }
    seenIds.set(row.decision_id, lineNo);
    parsed.push({ raw: row, line: lineNo });
  }

  // Determinism: sort by `at` chronological, fall back to decision_id lex.
  parsed.sort(compareRows);

  // Pass 2: emit nodes and edges with full context (need the parent's status to pick supersedes vs relates).
  const byId = new Map<string, ParsedRow>();
  for (const p of parsed) byId.set(p.raw.decision_id, p);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const p of parsed) {
    const r = p.raw;
    const nodeId = ids.decision(r.decision_id);
    const node: DecisionNode = {
      id: nodeId,
      label: r.decision_id,
      entity_type: "decision",
      source_file: mdPath,
      source_location: loc(p.line),
      confidence: "EXTRACTED",
      decision_id: r.decision_id,
      summary: r.summary,
      decided_by: r.decided_by,
      related_decision_id: r.related_decision_id,
      revisit_criterion: r.revisit_criterion ?? null,
      status: r.status,
      phase: r.phase,
      step_id: r.step_id ?? null,
    };
    nodes.push(node);

    if (r.related_decision_id) {
      const targetId = ids.decision(r.related_decision_id);
      const parent = byId.get(r.related_decision_id);
      // Supersedes when child is resolved AND parent exists in file with status open|triggered.
      // Otherwise relates_to (covers parent missing from file, parent already resolved, child not resolved).
      let relation: Relation = "decision_relates_to";
      if (
        r.status === "resolved" &&
        parent !== undefined &&
        (parent.raw.status === "open" || parent.raw.status === "triggered")
      ) {
        relation = "decision_supersedes";
      }
      edges.push(makeEdge(nodeId, targetId, relation, mdPath, p.line, r.decided_by));
    }
  }

  // Cycle detection on the related-decision pointer graph. Warning, not failure.
  const cycles = detectCycles(parsed);
  for (const cycle of cycles) {
    errors.push({
      line: 0,
      message: `WARNING: cycle detected in decision relations: ${cycle}`,
    });
  }

  const fragment: GraphFragment = {
    version: 1,
    schema: "buildanything-slice-4",
    source_file: mdPath,
    source_sha: sha256Hex(input.mdContent),
    produced_at: new Date().toISOString(),
    nodes: sortNodes(nodes),
    edges: sortEdges(edges),
  };

  return { ok: true, fragment, errors };
}
