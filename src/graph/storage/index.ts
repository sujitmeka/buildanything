import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  openSync,
  fsyncSync,
  closeSync,
  readdirSync,
} from "node:fs";
import { join, resolve, dirname } from "node:path";

import type {
  GraphFragment,
  GraphNode,
  GraphEdge,
  FeatureNode,
  ScreenNode,
  StateNode,
  TransitionNode,
  BusinessRuleNode,
  FailureModeNode,
  AcceptanceCriterionNode,
  PersonaConstraintNode,
  DesignDocRootNode,
  DnaAxisNode,
  BrandDnaGuidelineNode,
  BrandReferenceNode,
  ComponentManifestEntryNode,
} from "../types.js";

// ── Path ────────────────────────────────────────────────────────────────

export function graphPath(projectDir: string): string {
  return join(resolve(projectDir), ".buildanything", "graph", "slice-1.json");
}

// ── Load ────────────────────────────────────────────────────────────────

export function loadGraph(projectDir: string): GraphFragment | null {
  const p = graphPath(projectDir);
  if (!existsSync(p)) return null;

  let raw: string;
  try {
    raw = readFileSync(p, "utf-8");
  } catch (err) {
    console.error(`graph/storage: failed to read ${p}: ${err}`);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`graph/storage: invalid JSON in ${p}: ${err}`);
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  // schema/version guard for forward compat
  if (obj.version !== 1 || obj.schema !== "buildanything-slice-1") {
    console.error(`graph/storage: unsupported version/schema in ${p}`);
    return null;
  }

  return parsed as GraphFragment;
}

// ── Save (atomic write) ────────────────────────────────────────────────

export function saveGraph(projectDir: string, fragment: GraphFragment, targetFile: string = "slice-1.json"): void {
  const dir = join(resolve(projectDir), ".buildanything", "graph");
  const target = join(dir, targetFile);
  const tmp = `${target}.tmp`;

  mkdirSync(dirname(target), { recursive: true });

  const content = JSON.stringify(fragment, null, 2) + "\n";

  try {
    writeFileSync(tmp, content, "utf-8");

    // fsync survives power loss
    const fd = openSync(tmp, "r+");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }

    renameSync(tmp, target);
  } catch (err) {
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch { /* best effort */ }
    throw err;
  }
}

// ── Query types ─────────────────────────────────────────────────────────

export interface FeatureQueryResult {
  feature: { id: string; label: string; kebab_anchor: string };
  screens: { id: string; label: string; description: string }[];
  states: { id: string; label: string; is_initial: boolean; meta_state: boolean }[];
  transitions: {
    from: string; to: string; trigger: string;
    preconditions: string; side_effects: string;
  }[];
  business_rules: { id: string; text: string; value: string | null; decision_needed: boolean }[];
  failure_modes: {
    trigger: string; user_sees: string; user_can: string; system_does: string;
  }[];
  persona_constraints: {
    constraint_text: string; applies_to_persona: string; cited_source: string;
  }[];
  acceptance_criteria: { id: string; text: string; verified: boolean }[];
  depends_on: string[];
}

export interface ScreenQueryResult {
  screen: { id: string; label: string; description: string };
  owning_features: string[];
  states_visible_here: { id: string; label: string }[];
}

export interface AcceptanceQueryResult {
  acceptance_criteria: { id: string; text: string; verified: boolean }[];
  business_rules_in_scope: { id: string; text: string; value: string | null; decision_needed: boolean }[];
  persona_constraints: {
    constraint_text: string; applies_to_persona: string; cited_source: string;
  }[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function nodesOfType<T extends GraphNode>(nodes: GraphNode[], t: T["entity_type"]): T[] {
  return nodes.filter((n): n is T => n.entity_type === t);
}

// ── queryFeature ────────────────────────────────────────────────────────

export function queryFeature(graph: GraphFragment, feature_id: string): FeatureQueryResult | null {
  const feature = graph.nodes.find(
    (n): n is FeatureNode => n.entity_type === "feature" && n.id === feature_id,
  );
  if (!feature) return null;

  const stateNodes = nodesOfType<StateNode>(graph.nodes, "state")
    .filter((s) => s.feature_id === feature_id);
  const stateIds = new Set(stateNodes.map((s) => s.id));

  const screens = nodesOfType<ScreenNode>(graph.nodes, "screen")
    .filter((s) => s.feature_ids.includes(feature_id))
    .map((s) => ({ id: s.id, label: s.label, description: s.description }))
    .sort(byId);

  const states = stateNodes
    .map((s) => ({ id: s.id, label: s.label, is_initial: s.is_initial, meta_state: s.meta_state }))
    .sort(byId);

  const transitions = nodesOfType<TransitionNode>(graph.nodes, "transition")
    .filter((t) => stateIds.has(t.from_state_id))
    .sort(byId)
    .map((t) => ({
      from: t.from_state_id, to: t.to_state_id, trigger: t.trigger,
      preconditions: t.preconditions, side_effects: t.side_effects,
    }));

  const business_rules = nodesOfType<BusinessRuleNode>(graph.nodes, "business_rule")
    .filter((r) => r.feature_id === feature_id)
    .sort(byId)
    .map((r) => ({ id: r.id, text: r.text, value: r.value, decision_needed: r.decision_needed }));

  const failure_modes = nodesOfType<FailureModeNode>(graph.nodes, "failure_mode")
    .filter((f) => f.feature_id === feature_id)
    .sort(byId)
    .map((f) => ({ trigger: f.trigger, user_sees: f.user_sees, user_can: f.user_can, system_does: f.system_does }));

  const persona_constraints = nodesOfType<PersonaConstraintNode>(graph.nodes, "persona_constraint")
    .filter((c) => c.feature_id === feature_id)
    .sort(byId)
    .map((c) => ({ constraint_text: c.constraint_text, applies_to_persona: c.persona_id, cited_source: c.cited_source }));

  const acceptance_criteria = nodesOfType<AcceptanceCriterionNode>(graph.nodes, "acceptance_criterion")
    .filter((a) => a.feature_id === feature_id)
    .sort(byId)
    .map((a) => ({ id: a.id, text: a.text, verified: a.verified }));

  const depends_on = graph.edges
    .filter((e) => e.relation === "depends_on" && e.source === feature_id)
    .map((e) => e.target)
    .sort();

  return {
    feature: { id: feature.id, label: feature.label, kebab_anchor: feature.kebab_anchor },
    screens, states, transitions, business_rules, failure_modes,
    persona_constraints, acceptance_criteria, depends_on,
  };
}

// ── queryScreen ─────────────────────────────────────────────────────────

export function queryScreen(graph: GraphFragment, screen_id: string): ScreenQueryResult | null {
  const screen = graph.nodes.find(
    (n): n is ScreenNode => n.entity_type === "screen" && n.id === screen_id,
  );
  if (!screen) return null;

  const owning_features = [...screen.feature_ids].sort();

  const allStates = nodesOfType<StateNode>(graph.nodes, "state");
  const seen = new Set<string>();
  const states_visible_here: { id: string; label: string }[] = [];
  for (const fid of owning_features) {
    for (const s of allStates) {
      if (s.feature_id === fid && !seen.has(s.id)) {
        seen.add(s.id);
        states_visible_here.push({ id: s.id, label: s.label });
      }
    }
  }
  states_visible_here.sort(byId);

  return {
    screen: { id: screen.id, label: screen.label, description: screen.description },
    owning_features,
    states_visible_here,
  };
}

// ── queryAcceptance ─────────────────────────────────────────────────────

export function queryAcceptance(graph: GraphFragment, feature_id: string): AcceptanceQueryResult | null {
  const feature = graph.nodes.find(
    (n) => n.entity_type === "feature" && n.id === feature_id,
  );
  if (!feature) return null;

  const acceptance_criteria = nodesOfType<AcceptanceCriterionNode>(graph.nodes, "acceptance_criterion")
    .filter((a) => a.feature_id === feature_id)
    .sort(byId)
    .map((a) => ({ id: a.id, text: a.text, verified: a.verified }));

  const business_rules_in_scope = nodesOfType<BusinessRuleNode>(graph.nodes, "business_rule")
    .filter((r) => r.feature_id === feature_id)
    .sort(byId)
    .map((r) => ({ id: r.id, text: r.text, value: r.value, decision_needed: r.decision_needed }));

  const persona_constraints = nodesOfType<PersonaConstraintNode>(graph.nodes, "persona_constraint")
    .filter((c) => c.feature_id === feature_id)
    .sort(byId)
    .map((c) => ({ constraint_text: c.constraint_text, applies_to_persona: c.persona_id, cited_source: c.cited_source }));

  return { acceptance_criteria, business_rules_in_scope, persona_constraints };
}

// ── DnaQueryResult ──────────────────────────────────────────────────────

const DNA_AXIS_ORDER = ["scope", "density", "character", "material", "motion", "type", "copy"] as const;

export interface DnaQueryResult {
  design_doc: {
    id: string;
    name: string;
    description: string;
    locked_at: string;
    pass_complete: { pass1: boolean; pass2: boolean };
  };
  axes: Array<{
    name: "scope" | "density" | "character" | "material" | "motion" | "type" | "copy";
    value: string;
    rationale: string;
  }>;
  guidelines: {
    dos: Array<{ id: string; text: string; axis_scope: string | null }>;
    donts: Array<{ id: string; text: string; axis_scope: string | null }>;
  };
  references: Array<{
    id: string;
    url_or_path: string;
    exemplifies_axes: string[];
  }>;
  lint_status: "pass" | "warn" | "fail" | null;
}

// ── queryDna ────────────────────────────────────────────────────────────

export function queryDna(graph: GraphFragment, projectDir: string = process.cwd()): DnaQueryResult | null {
  const root = graph.nodes.find(
    (n): n is DesignDocRootNode => n.entity_type === "design_doc_root",
  );
  if (!root) return null;

  const axisOrder = new Map(DNA_AXIS_ORDER.map((a, i) => [a, i]));
  const axes = nodesOfType<DnaAxisNode>(graph.nodes, "dna_axis")
    .sort((a, b) => (axisOrder.get(a.axis_name) ?? 99) - (axisOrder.get(b.axis_name) ?? 99))
    .map((a) => ({ name: a.axis_name, value: a.value, rationale: a.rationale }));

  const allGuidelines = nodesOfType<BrandDnaGuidelineNode>(graph.nodes, "brand_dna_guideline");
  const dos = allGuidelines
    .filter((g) => g.polarity === "do")
    .sort(byId)
    .map((g) => ({ id: g.id, text: g.text, axis_scope: g.axis_scope }));
  const donts = allGuidelines
    .filter((g) => g.polarity === "dont")
    .sort(byId)
    .map((g) => ({ id: g.id, text: g.text, axis_scope: g.axis_scope }));

  const references = nodesOfType<BrandReferenceNode>(graph.nodes, "brand_reference")
    .sort(byId)
    .map((r) => ({ id: r.id, url_or_path: r.url_or_path, exemplifies_axes: r.exemplifies_axes }));

  let lint_status: "pass" | "warn" | "fail" | null = null;
  const lintPath = join(resolve(projectDir), ".buildanything", "graph", "lint-status.json");
  if (existsSync(lintPath)) {
    try {
      const parsed = JSON.parse(readFileSync(lintPath, "utf-8")) as Record<string, unknown>;
      const s = parsed.status;
      if (s === "pass" || s === "warn" || s === "fail") {
        lint_status = s;
      } else {
        console.error(`graph/storage: invalid lint_status value in ${lintPath}`);
      }
    } catch {
      console.error(`graph/storage: failed to parse ${lintPath}`);
    }
  }

  return {
    design_doc: {
      id: root.id,
      name: root.name,
      description: root.description,
      locked_at: root.locked_at,
      pass_complete: root.pass_complete,
    },
    axes,
    guidelines: { dos, donts },
    references,
    lint_status,
  };
}

// ── ManifestQueryResult ─────────────────────────────────────────────────

export interface ManifestEntryView {
  slot: string;
  library: string;
  variant: string;
  source_ref: string | null;
  hard_gate: boolean;
  fallback_plan?: string;
}

export interface ManifestQueryResult {
  entries: ManifestEntryView[];
  by_slot: Record<string, ManifestEntryView>;
}

// ── queryManifest ───────────────────────────────────────────────────────

function toManifestEntry(node: ComponentManifestEntryNode): ManifestEntryView {
  const entry: ManifestEntryView = {
    slot: node.slot,
    library: node.library,
    variant: node.variant,
    source_ref: node.source_ref,
    hard_gate: node.hard_gate,
  };
  if (node.fallback_plan !== undefined) entry.fallback_plan = node.fallback_plan;
  return entry;
}

export function queryManifest(graph: GraphFragment, slot?: string): ManifestQueryResult | null {
  const manifestNodes = nodesOfType<ComponentManifestEntryNode>(graph.nodes, "component_manifest_entry");
  if (manifestNodes.length === 0) return null;

  const entries = manifestNodes
    .map(toManifestEntry)
    .sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0));

  const by_slot: Record<string, ManifestEntryView> = {};
  for (const e of entries) by_slot[e.slot] = e;

  if (slot !== undefined) {
    const match = by_slot[slot];
    return {
      entries: match ? [match] : [],
      by_slot: match ? { [slot]: match } : {},
    };
  }

  return { entries, by_slot };
}

// ── loadAllGraphs ───────────────────────────────────────────────────────

export function loadAllGraphs(projectDir: string): GraphFragment | null {
  const dir = join(resolve(projectDir), ".buildanything", "graph");
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "lint-status.json")
    .sort();

  const fragments: GraphFragment[] = [];
  for (const file of files) {
    const p = join(dir, file);
    try {
      const parsed = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
      if (
        parsed.version !== 1 ||
        (parsed.schema !== "buildanything-slice-1" && parsed.schema !== "buildanything-slice-2")
      ) {
        console.error(`graph/storage: unsupported version/schema in ${p}`);
        continue;
      }
      fragments.push(parsed as unknown as GraphFragment);
    } catch (err) {
      console.error(`graph/storage: failed to parse ${p}: ${err}`);
    }
  }

  if (fragments.length === 0) return null;

  const nodeMap = new Map<string, GraphNode>();
  for (const frag of fragments) {
    for (const node of frag.nodes) {
      if (nodeMap.has(node.id)) {
        console.error(`graph/storage: duplicate node id "${node.id}" across fragments`);
      }
      nodeMap.set(node.id, node);
    }
  }

  const edges: GraphEdge[] = [];
  for (const frag of fragments) edges.push(...frag.edges);

  const hasSlice2 = fragments.some((f) => f.schema === "buildanything-slice-2");
  const latestProducedAt = fragments.reduce(
    (max, f) => (f.produced_at > max ? f.produced_at : max),
    fragments[0].produced_at,
  );

  return {
    version: 1,
    schema: hasSlice2 ? "buildanything-slice-2" : "buildanything-slice-1",
    source_file: "<merged>",
    source_sha: "0".repeat(64),
    produced_at: latestProducedAt,
    nodes: [...nodeMap.values()],
    edges,
  };
}
