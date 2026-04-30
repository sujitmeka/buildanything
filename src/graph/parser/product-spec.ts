// Deterministic, schema-aware extractor for product-spec.md.
// Source of truth: docs/graph/04-slice1-schema.md + protocols/product-spec-schema.md.
// No LLM, no I/O. Caller passes the markdown content and path.

import { ids, kebab, sha256Hex } from "../ids.js";
import type {
  AcceptanceCriterionNode,
  BusinessRuleNode,
  ExtractError,
  ExtractResult,
  FailureModeNode,
  FeatureNode,
  GraphEdge,
  GraphFragment,
  GraphNode,
  PersonaConstraintNode,
  PersonaNode,
  Relation,
  ScreenNode,
  StateNode,
  TransitionNode,
} from "../types.js";

const PRODUCED_BY = "product-spec-writer";
const PRODUCED_AT_STEP = "1.6";
const META_STATE_NAMES = new Set([
  "loading",
  "stale",
  "offline",
  "disabled",
  "permission-denied",
]);

interface Line {
  n: number; // 1-based line number
  text: string; // raw text, no trailing newline
}

interface Section {
  heading: string; // e.g. "App Overview", "Feature: Checkout", "States"
  level: number; // 2 = ##, 3 = ###
  startLine: number; // line number of the heading itself
  bodyLines: Line[]; // all lines until the next heading at <= same level
}

interface Ctx {
  mdPath: string;
  errors: ExtractError[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  personasByKey: Map<string, PersonaNode>; // canonical persona label → node
}

function loc(line: number): string {
  return `L${line}`;
}

function pushError(ctx: Ctx, line: number, message: string): void {
  ctx.errors.push({ line, message });
}

function splitLines(content: string): Line[] {
  const raw = content.split(/\r?\n/);
  return raw.map((text, i) => ({ n: i + 1, text }));
}

// Walk lines and produce sections at the requested heading levels (2 or 3).
// A section ends at the next heading of equal or shallower level.
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
      sections.push({
        heading,
        level,
        startLine: line.n,
        bodyLines: lines.slice(bodyStart, j),
      });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}

function isHeadingAtLevel(text: string, level: number): boolean {
  const prefix = "#".repeat(level) + " ";
  if (!text.startsWith(prefix)) return false;
  // make sure it's exactly this level, not deeper
  return text[level] !== "#";
}

function isHeadingAtOrAbove(text: string, level: number): boolean {
  for (let l = 1; l <= level; l++) {
    if (isHeadingAtLevel(text, l)) return true;
  }
  return false;
}

// Parse a markdown pipe table from a slice of lines starting at the first
// non-blank, non-comment line. Returns headers (lowercased, trimmed) +
// rows (each row keyed by header). Each cell tracks its source line number
// (the row line, not per-cell — multi-line cells are not supported here).
interface TableRow {
  cells: Record<string, string>;
  line: number;
}

function parseTable(body: Line[]): { headers: string[]; rows: TableRow[] } | null {
  // Find a header+separator pair anywhere in the body. A section may have a
  // grounding paragraph before the table.
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

  const headerLine = significant[headerIdx];
  const headers = splitRow(headerLine.text).map((h) => h.toLowerCase());
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
  // Strip leading/trailing pipes, then split.
  let s = text.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

// =============================================================================
// Top-level: App Overview persona table
// =============================================================================

function parsePersonas(ctx: Ctx, section: Section): void {
  const table = parseTable(section.bodyLines);
  if (!table) {
    pushError(ctx, section.startLine, "App Overview: persona table not found or malformed");
    return;
  }
  const required = ["persona", "role", "primary jtbd", "relationship to other personas"];
  for (const r of required) {
    if (!table.headers.includes(r)) {
      pushError(
        ctx,
        section.startLine,
        `App Overview: persona table missing required column "${r}"`,
      );
      return;
    }
  }
  if (table.rows.length < 1) {
    pushError(ctx, section.startLine, "App Overview: persona table has zero rows");
    return;
  }

  let primaryCount = 0;
  for (const row of table.rows) {
    const rawName = row.cells["persona"] ?? "";
    if (!rawName) {
      pushError(ctx, row.line, "Persona row missing name");
      continue;
    }
    const isPrimary = /\(primary\)/i.test(rawName);
    if (isPrimary) primaryCount++;
    const cleanLabel = rawName.replace(/\(primary\)/gi, "").trim();
    const role = row.cells["role"] ?? "";
    const jtbd = row.cells["primary jtbd"] ?? "";
    const relationship = row.cells["relationship to other personas"] ?? "";
    if (!role || !jtbd) {
      pushError(ctx, row.line, `Persona "${cleanLabel}" missing role or JTBD`);
      continue;
    }
    const node: PersonaNode = {
      id: ids.persona(cleanLabel),
      label: cleanLabel,
      entity_type: "persona",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      description: relationship,
      role,
      is_primary: isPrimary,
      primary_jtbd: jtbd,
    };
    ctx.nodes.push(node);
    ctx.personasByKey.set(cleanLabel.toLowerCase(), node);
  }

  if (primaryCount !== 1) {
    pushError(
      ctx,
      section.startLine,
      `App Overview: expected exactly one (primary) persona, found ${primaryCount}`,
    );
  }
}

// =============================================================================
// Top-level: Screen Inventory
// =============================================================================

interface ScreenInfo {
  rawName: string;
  description: string;
  featureNames: string[];
}

function parseScreenInventory(ctx: Ctx, section: Section): ScreenInfo[] {
  const table = parseTable(section.bodyLines);
  if (!table) {
    pushError(ctx, section.startLine, "Screen Inventory: table not found or malformed");
    return [];
  }
  const required = ["screen", "description", "features"];
  for (const r of required) {
    if (!table.headers.includes(r)) {
      pushError(
        ctx,
        section.startLine,
        `Screen Inventory: missing required column "${r}"`,
      );
      return [];
    }
  }

  const out: ScreenInfo[] = [];
  for (const row of table.rows) {
    const rawName = row.cells["screen"] ?? "";
    const description = row.cells["description"] ?? "";
    const features = row.cells["features"] ?? "";
    if (!rawName) {
      pushError(ctx, row.line, "Screen Inventory: row missing screen name");
      continue;
    }
    const featureNames = features
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const countMatch = rawName.match(/\((\d+)\s+screens?\)/i);
    const cleanName = rawName.replace(/\(\d+\s+screens?\)/i, "").trim();
    const count = countMatch ? Number.parseInt(countMatch[1], 10) : undefined;

    const node: ScreenNode = {
      id: ids.screen(cleanName),
      label: cleanName,
      entity_type: "screen",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      description,
      feature_ids: featureNames.map((f) => ids.feature(f)),
      ...(count ? { count } : {}),
    };
    ctx.nodes.push(node);
    out.push({ rawName: cleanName, description, featureNames });

    // has_screen edges per feature attribution
    for (const fname of featureNames) {
      ctx.edges.push({
        source: ids.feature(fname),
        target: node.id,
        relation: "has_screen",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(row.line),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP,
      });
    }
  }
  return out;
}

// =============================================================================
// Top-level: Cross-Feature Interactions
// =============================================================================

function parseCrossFeature(ctx: Ctx, section: Section): void {
  // Bullets like "- Auth → Checkout: user must be authenticated"
  // Persona-crossing variants: "- Order Placement (Buyer) → Order Notification (Seller): ..."
  const arrow = /^\s*-\s+(.+?)\s*(?:→|->)\s*(.+?)\s*:\s*(.*)$/u;
  for (const line of section.bodyLines) {
    const m = line.text.match(arrow);
    if (!m) continue;
    const lhs = m[1].trim();
    const rhs = m[2].trim();
    // Strip trailing "(Persona)" annotations from each side; the feature
    // name is what precedes any parenthetical.
    const lhsFeature = lhs.replace(/\s*\([^)]*\)\s*$/u, "").trim();
    const rhsFeatureRaw = rhs.replace(/\s*\([^)]*\)\s*$/u, "").trim();
    // RHS may also list multiple comma-separated features (e.g.
    // "Auth, Checkout, Dashboard"). Fan out one edge per target.
    const rhsFeatures = rhsFeatureRaw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const target of rhsFeatures) {
      ctx.edges.push({
        source: ids.feature(lhsFeature),
        target: ids.feature(target),
        relation: "depends_on",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP,
      });
    }
  }
}

// =============================================================================
// Per-feature
// =============================================================================

function parseFeature(ctx: Ctx, section: Section): void {
  const headingLabel = section.heading.replace(/^Feature:\s*/i, "").trim();
  if (!headingLabel) {
    pushError(ctx, section.startLine, "Feature heading missing name");
    return;
  }
  const featureNode: FeatureNode = {
    id: ids.feature(headingLabel),
    label: headingLabel,
    entity_type: "feature",
    source_file: ctx.mdPath,
    source_location: loc(section.startLine),
    confidence: "EXTRACTED",
    name: headingLabel,
    kebab_anchor: kebab(headingLabel),
  };
  ctx.nodes.push(featureNode);

  // Re-tokenize this feature's body to extract ### subsections.
  const subSections = partitionSubsections(section.bodyLines);
  const stateNamesInOrder: { name: string; line: number; isInitial: boolean }[] = [];

  for (const sub of subSections) {
    const lower = sub.heading.toLowerCase();
    if (lower === "states") {
      parseStates(ctx, featureNode, sub, stateNamesInOrder);
    } else if (lower === "transitions") {
      parseTransitions(ctx, featureNode, sub);
    } else if (lower === "business rules") {
      parseBusinessRules(ctx, featureNode, sub);
    } else if (lower === "failure modes") {
      parseFailureModes(ctx, featureNode, sub);
    } else if (lower === "acceptance criteria") {
      parseAcceptanceCriteria(ctx, featureNode, sub);
    } else if (lower === "persona constraints") {
      parsePersonaConstraints(ctx, featureNode, sub);
    }
    // Other subsections (Data Requirements, Happy Path, Empty States,
    // Notification Triggers, etc.) are intentionally ignored in Slice 1.
  }
}

function partitionSubsections(body: Line[]): Section[] {
  // Treat the body as a virtual document; reuse partitionSections at level 3.
  // Need to feed line objects with their absolute line numbers.
  const sections: Section[] = [];
  let i = 0;
  while (i < body.length) {
    const line = body[i];
    if (isHeadingAtLevel(line.text, 3)) {
      const heading = line.text.slice(4).trim();
      const start = i + 1;
      let j = start;
      while (j < body.length && !isHeadingAtOrAbove(body[j].text, 3)) j++;
      sections.push({
        heading,
        level: 3,
        startLine: line.n,
        bodyLines: body.slice(start, j),
      });
      i = j;
    } else {
      i++;
    }
  }
  return sections;
}

// ----- States -----

function parseStates(
  ctx: Ctx,
  feature: FeatureNode,
  section: Section,
  collect: { name: string; line: number; isInitial: boolean }[],
): void {
  // Two accepted forms:
  //   "States: idle (initial), loading, loaded, empty, error"
  //   bullets:  "- idle (initial)"   "- loading"
  const inline = section.bodyLines.find((l) => /^\s*states\s*:/i.test(l.text));
  let entries: { name: string; isInitial: boolean; line: number }[] = [];

  if (inline) {
    const after = inline.text.replace(/^\s*states\s*:\s*/i, "");
    entries = after
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => ({
        name: s.replace(/\(initial\)/i, "").trim(),
        isInitial: /\(initial\)/i.test(s),
        line: inline.n,
      }));
  } else {
    for (const line of section.bodyLines) {
      const m = line.text.match(/^\s*-\s+(.+?)\s*$/);
      if (!m) continue;
      const raw = m[1];
      entries.push({
        name: raw.replace(/\(initial\)/i, "").trim(),
        isInitial: /\(initial\)/i.test(raw),
        line: line.n,
      });
    }
  }

  if (entries.length === 0) {
    pushError(ctx, section.startLine, `Feature "${feature.label}": States section is empty`);
    return;
  }

  // If nothing is explicitly marked (initial), the first entry is initial.
  if (!entries.some((e) => e.isInitial)) {
    entries[0].isInitial = true;
  }

  for (const e of entries) {
    const stateNode: StateNode = {
      id: ids.state(feature.name, e.name),
      label: e.name,
      entity_type: "state",
      source_file: ctx.mdPath,
      source_location: loc(e.line),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      is_initial: e.isInitial,
      meta_state: META_STATE_NAMES.has(kebab(e.name)),
    };
    ctx.nodes.push(stateNode);
    ctx.edges.push({
      source: feature.id,
      target: stateNode.id,
      relation: "has_state",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(e.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP,
    });
    if (e.isInitial) {
      ctx.edges.push({
        source: feature.id,
        target: stateNode.id,
        relation: "has_initial_state",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(e.line),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP,
      });
    }
    collect.push({ name: e.name, line: e.line, isInitial: e.isInitial });
  }
}

// ----- Transitions -----

function parseTransitions(ctx: Ctx, feature: FeatureNode, section: Section): void {
  const table = parseTable(section.bodyLines);
  if (!table) {
    pushError(
      ctx,
      section.startLine,
      `Feature "${feature.label}": Transitions table not found or malformed`,
    );
    return;
  }
  // header may be "from → to" with arrow, or "from->to". Find the from→to col.
  const fromToKey = table.headers.find((h) => /from\s*(?:→|->)\s*to/u.test(h));
  if (!fromToKey) {
    pushError(
      ctx,
      section.startLine,
      `Feature "${feature.label}": Transitions table missing "From → To" column`,
    );
    return;
  }
  for (const row of table.rows) {
    const fromTo = row.cells[fromToKey] ?? "";
    const m = fromTo.match(/^(.+?)\s*(?:→|->)\s*(.+)$/u);
    if (!m) {
      pushError(ctx, row.line, `Transition row malformed: "${fromTo}"`);
      continue;
    }
    const from = m[1].trim();
    const to = m[2].trim();
    const trigger = row.cells["trigger"] ?? "";
    const preconditions = row.cells["preconditions"] ?? "";
    const sideEffects = row.cells["side effects"] ?? "";

    const fromId = ids.state(feature.name, from);
    const toId = ids.state(feature.name, to);
    const transitionNode: TransitionNode = {
      id: ids.transition(feature.name, from, to),
      label: `${from} → ${to}`,
      entity_type: "transition",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      confidence: "EXTRACTED",
      from_state_id: fromId,
      to_state_id: toId,
      trigger,
      preconditions,
      side_effects: sideEffects,
    };
    ctx.nodes.push(transitionNode);
    ctx.edges.push({
      source: fromId,
      target: toId,
      relation: "transitions_to",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP,
    });
    ctx.edges.push({
      source: fromId,
      target: transitionNode.id,
      relation: "triggered_by_transition",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(row.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP,
    });
  }
}

// ----- Business Rules -----

function parseBusinessRules(ctx: Ctx, feature: FeatureNode, section: Section): void {
  const bullets = collectBullets(section.bodyLines);
  for (const b of bullets) {
    const text = b.text.trim();
    if (!text) continue;
    const decisionNeeded = /\[DECISION NEEDED/i.test(text);
    const value = extractRuleValue(text);
    const node: BusinessRuleNode = {
      id: ids.businessRule(feature.name, text),
      label: text.length > 80 ? text.slice(0, 77) + "..." : text,
      entity_type: "business_rule",
      source_file: ctx.mdPath,
      source_location: loc(b.line),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      text,
      value,
      decision_needed: decisionNeeded,
    };
    ctx.nodes.push(node);
    ctx.edges.push({
      source: feature.id,
      target: node.id,
      relation: "has_rule",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(b.line),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP,
    });
  }
}

function extractRuleValue(text: string): string | null {
  // Prefer "= <value>" explicit assignment, else first numeric+unit run.
  const eq = text.match(/=\s*([^.\[]+?)(?:\s*\[|$)/);
  if (eq) return eq[1].trim();
  const num = text.match(
    /(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?|days?|items?|orders?|requests?|%|percent|MB|GB|KB|ms)/i,
  );
  if (num) return `${num[1]} ${num[2]}`;
  return null;
}

// ----- Failure Modes -----

function parseFailureModes(ctx: Ctx, feature: FeatureNode, section: Section): void {
  // Multi-line bullet structure:
  //   - <trigger> →
  //     User sees: "..."
  //     User can: ...
  //     System: ...
  // Bullets are separated by either a blank line or the start of a new "- " bullet.
  const blocks = splitFailureBlocks(section.bodyLines);
  for (const block of blocks) {
    if (block.length === 0) continue;
    const headLine = block[0];
    const headText = headLine.text.replace(/^\s*-\s+/, "").trim();
    // Trigger is the part before a trailing arrow if present.
    const trigger = headText.replace(/\s*(?:→|->)\s*$/u, "").trim();
    if (!trigger) continue;

    const userSees = readLabel(block, /^\s*user\s+sees\s*:/i);
    const userCan = readLabel(block, /^\s*user\s+can\s*:/i);
    const systemDoes = readLabel(block, /^\s*system\s*:/i);

    const node: FailureModeNode = {
      id: ids.failureMode(feature.name, trigger),
      label: trigger,
      entity_type: "failure_mode",
      source_file: ctx.mdPath,
      source_location: loc(headLine.n),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      trigger,
      user_sees: userSees,
      user_can: userCan,
      system_does: systemDoes,
    };
    ctx.nodes.push(node);
    ctx.edges.push({
      source: feature.id,
      target: node.id,
      relation: "has_failure_mode",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(headLine.n),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP,
    });
  }
}

function splitFailureBlocks(body: Line[]): Line[][] {
  const blocks: Line[][] = [];
  let current: Line[] = [];
  for (const line of body) {
    const isBulletStart = /^\s*-\s+/.test(line.text);
    if (isBulletStart) {
      if (current.length > 0) blocks.push(current);
      current = [line];
    } else if (line.text.trim() === "") {
      if (current.length > 0) {
        blocks.push(current);
        current = [];
      }
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);
  return blocks;
}

function readLabel(block: Line[], pattern: RegExp): string {
  const idx = block.findIndex((l) => pattern.test(l.text));
  if (idx < 0) return "";
  // Take the text after the label, plus any non-labelled continuation lines
  // until we hit another label or end of block.
  const first = block[idx].text.replace(pattern, "").trim();
  const labelStartRe = /^\s*(user\s+sees|user\s+can|system)\s*:/i;
  const parts: string[] = [];
  if (first) parts.push(first.replace(/^"+|"+$/g, ""));
  for (let i = idx + 1; i < block.length; i++) {
    const t = block[i].text.trim();
    if (!t) break;
    if (labelStartRe.test(t)) break;
    parts.push(t.replace(/^"+|"+$/g, ""));
  }
  return parts.join(" ").trim();
}

// ----- Acceptance Criteria -----

function parseAcceptanceCriteria(ctx: Ctx, feature: FeatureNode, section: Section): void {
  const re = /^\s*-\s+\[\s\]\s+(.+)$/;
  for (const line of section.bodyLines) {
    const m = line.text.match(re);
    if (!m) continue;
    const text = m[1].trim();
    if (!text) continue;
    const node: AcceptanceCriterionNode = {
      id: ids.acceptanceCriterion(feature.name, text),
      label: text.length > 80 ? text.slice(0, 77) + "..." : text,
      entity_type: "acceptance_criterion",
      source_file: ctx.mdPath,
      source_location: loc(line.n),
      confidence: "EXTRACTED",
      feature_id: feature.id,
      text,
      verified: false,
    };
    ctx.nodes.push(node);
    ctx.edges.push({
      source: feature.id,
      target: node.id,
      relation: "has_acceptance",
      confidence: "EXTRACTED",
      source_file: ctx.mdPath,
      source_location: loc(line.n),
      produced_by_agent: PRODUCED_BY,
      produced_at_step: PRODUCED_AT_STEP,
    });
  }
}

// ----- Persona Constraints -----

function parsePersonaConstraints(ctx: Ctx, feature: FeatureNode, section: Section): void {
  // Block structure (per protocols/product-spec-schema.md):
  //   - Persona: <name> [(primary)] — <one-liner> [src]
  //     Constraint: <text> [src]
  //     Constraint: <text> [src]
  //   - Persona: <other> ...
  let currentPersona: PersonaNode | null = null;

  for (const line of section.bodyLines) {
    const text = line.text;
    const personaMatch = text.match(/^\s*-\s+Persona\s*:\s*(.+?)\s+(?:—|--|-)\s+(.*)$/u);
    if (personaMatch) {
      const rawName = personaMatch[1].trim();
      const cleanName = rawName.replace(/\(primary\)/gi, "").trim();
      const found = ctx.personasByKey.get(cleanName.toLowerCase());
      if (!found) {
        pushError(
          ctx,
          line.n,
          `Feature "${feature.label}": persona "${cleanName}" not found in App Overview persona table`,
        );
        currentPersona = null;
      } else {
        currentPersona = found;
      }
      continue;
    }
    const constraintMatch = text.match(/^\s*Constraint\s*:\s*(.+)$/i);
    if (constraintMatch && currentPersona) {
      const full = constraintMatch[1].trim();
      // Last [src] suffix is the citation; everything before is the constraint.
      const citeMatch = full.match(/\[([^\]]+)\]\s*$/);
      const constraintText = citeMatch ? full.slice(0, citeMatch.index).trim() : full;
      const citedSource = citeMatch ? citeMatch[1].trim() : "";
      const node: PersonaConstraintNode = {
        id: ids.personaConstraint(feature.name, constraintText),
        label:
          constraintText.length > 80 ? constraintText.slice(0, 77) + "..." : constraintText,
        entity_type: "persona_constraint",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        confidence: "EXTRACTED",
        feature_id: feature.id,
        persona_id: currentPersona.id,
        constraint_text: constraintText,
        cited_source: citedSource,
      };
      ctx.nodes.push(node);
      ctx.edges.push({
        source: node.id,
        target: feature.id,
        relation: "constrains",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP,
      });
      ctx.edges.push({
        source: node.id,
        target: currentPersona.id,
        relation: "applies_to_persona",
        confidence: "EXTRACTED",
        source_file: ctx.mdPath,
        source_location: loc(line.n),
        produced_by_agent: PRODUCED_BY,
        produced_at_step: PRODUCED_AT_STEP,
      });
    }
  }
}

// =============================================================================
// Bullet collector (treats indented continuations as part of the same bullet)
// =============================================================================

function collectBullets(body: Line[]): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let current: { text: string; line: number } | null = null;
  for (const line of body) {
    const m = line.text.match(/^(\s*)-\s+(.+)$/);
    if (m) {
      if (current) out.push(current);
      current = { text: m[2].trim(), line: line.n };
    } else if (current && /^\s+\S/.test(line.text)) {
      current.text += " " + line.text.trim();
    } else if (line.text.trim() === "") {
      if (current) {
        out.push(current);
        current = null;
      }
    }
  }
  if (current) out.push(current);
  return out;
}

// =============================================================================
// Determinism: stable sort
// =============================================================================

function sortNodes(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function sortEdges(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((a, b) => {
    const k = (e: GraphEdge): string =>
      `${e.relation} ${e.source} ${e.target} ${e.source_location ?? ""}`;
    const ka = k(a);
    const kb = k(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// =============================================================================
// Public entrypoint
// =============================================================================

export function extractProductSpec(input: { mdPath: string; mdContent: string }): ExtractResult {
  const { mdPath, mdContent } = input;
  const lines = splitLines(mdContent);
  const ctx: Ctx = {
    mdPath,
    errors: [],
    nodes: [],
    edges: [],
    personasByKey: new Map(),
  };

  const topSections = partitionSections(lines, 2, 0, lines.length);
  const byHeading = (name: string): Section | undefined =>
    topSections.find((s) => s.heading.trim().toLowerCase() === name.toLowerCase());

  const required = ["App Overview", "Screen Inventory", "Cross-Feature Interactions"];
  for (const r of required) {
    if (!byHeading(r)) {
      pushError(ctx, 1, `Missing required top-level section: "## ${r}"`);
    }
  }
  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }

  // 1. Personas first — features need persona lookup.
  const overviewSection = byHeading("App Overview")!;
  parsePersonas(ctx, overviewSection);

  // 2. Features (we want the feature nodes to exist before screen edges so
  //    that has_screen edges target real feature ids; though screens encode
  //    the target id directly via kebab, this also catches stray feature
  //    names that don't match any feature heading — out of scope for fail
  //    loud, but the feature_ids array reflects the inventory verbatim).
  const featureSections = topSections.filter((s) => /^Feature\s*:/i.test(s.heading));
  if (featureSections.length === 0) {
    pushError(ctx, 1, "No `## Feature: ...` sections found");
  }
  for (const fs of featureSections) parseFeature(ctx, fs);

  // 3. Screen inventory (after personas; doesn't depend on features but
  //    emits feature-targeted edges).
  parseScreenInventory(ctx, byHeading("Screen Inventory")!);

  // 4. Cross-feature interactions (depends on nothing, but emits feature edges).
  parseCrossFeature(ctx, byHeading("Cross-Feature Interactions")!);

  if (ctx.errors.length > 0) {
    return { ok: false, errors: ctx.errors };
  }

  const fragment: GraphFragment = {
    version: 1,
    schema: "buildanything-slice-1",
    source_file: mdPath,
    source_sha: sha256Hex(mdContent),
    produced_at: new Date().toISOString(),
    nodes: sortNodes(ctx.nodes),
    edges: sortEdges(ctx.edges),
  };
  return { ok: true, fragment, errors: [] };
}
