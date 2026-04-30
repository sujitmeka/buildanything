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
  TokenNode,
  PageSpecNode,
  WireframeSectionNode,
  ScreenStateSlotNode,
  ScreenComponentUseNode,
  KeyCopyNode,
  ApiContractNode,
  TaskNode,
  DecisionNode,
  ScreenshotNode,
  ImageComponentDetectionNode,
  DogfoodFindingNode,
  BrandDriftObservationNode,
} from "../types.js";
import { hammingDistance } from "../util/dhash.js";

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

export function queryScreen(graph: GraphFragment, screen_id: string): ScreenQueryResult | null;
export function queryScreen(graph: GraphFragment, screen_id: string, opts: { full: true }): ScreenFullQueryResult | null;
export function queryScreen(graph: GraphFragment, screen_id: string, opts?: { full?: boolean }): ScreenQueryResult | ScreenFullQueryResult | null;
export function queryScreen(graph: GraphFragment, screen_id: string, opts?: { full?: boolean }): ScreenQueryResult | ScreenFullQueryResult | null {
  if (opts?.full) return queryScreenFull(graph, screen_id);

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
        (parsed.schema !== "buildanything-slice-1" && parsed.schema !== "buildanything-slice-2" && parsed.schema !== "buildanything-slice-3" && parsed.schema !== "buildanything-slice-4" && parsed.schema !== "buildanything-slice-5")
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

  const hasSlice5 = fragments.some((f) => f.schema === "buildanything-slice-5");
  const hasSlice4 = fragments.some((f) => f.schema === "buildanything-slice-4");
  const hasSlice3 = fragments.some((f) => f.schema === "buildanything-slice-3");
  const hasSlice2 = fragments.some((f) => f.schema === "buildanything-slice-2");
  const latestProducedAt = fragments.reduce(
    (max, f) => (f.produced_at > max ? f.produced_at : max),
    fragments[0].produced_at,
  );

  return {
    version: 1,
    schema: hasSlice5 ? "buildanything-slice-5" : hasSlice4 ? "buildanything-slice-4" : hasSlice3 ? "buildanything-slice-3" : hasSlice2 ? "buildanything-slice-2" : "buildanything-slice-1",
    source_file: "<merged>",
    source_sha: "0".repeat(64),
    produced_at: latestProducedAt,
    nodes: [...nodeMap.values()],
    edges,
  };
}

// ── TokenQueryResult ────────────────────────────────────────────────────

export interface TokenQueryResult {
  token: {
    id: string;
    name: string;
    value: string;
    layer: TokenNode["layer"];
    axis_provenance: TokenNode["axis_provenance"];
    category: string | null;
  };
  derived_from_axis_id: string | null;
}

// ── queryToken ──────────────────────────────────────────────────────────

export function queryToken(graph: GraphFragment, name: string): TokenQueryResult | null {
  const token = graph.nodes.find(
    (n): n is TokenNode => n.entity_type === "token" && n.name === name,
  );
  if (!token) return null;

  let derived_from_axis_id: string | null = null;
  if (token.axis_provenance !== null) {
    const edge = graph.edges.find(
      (e) => e.relation === "token_derived_from" && e.source === token.id,
    );
    derived_from_axis_id = edge ? edge.target : null;
  }

  return {
    token: {
      id: token.id,
      name: token.name,
      value: token.value,
      layer: token.layer,
      axis_provenance: token.axis_provenance,
      category: token.category,
    },
    derived_from_axis_id,
  };
}

// ── ScreenFullQueryResult ───────────────────────────────────────────────

export interface ScreenFullQueryResult {
  screen: { id: string; label: string; description: string };
  owning_features: string[];
  states_visible_here: { id: string; label: string }[];
  page_spec: {
    id: string;
    wireframe_text: string;
    content_hierarchy: string[];
    route: string | null;
  } | null;
  sections: { id: string; section_name: string; order: number; prose: string }[];
  screen_state_slots: { state_id: string; appearance_text: string }[];
  component_uses: {
    slot: string;
    position_in_wireframe: string;
    prop_overrides: string;
    manifest_entry?: { library: string; variant: string; hard_gate: boolean; source_ref: string | null };
  }[];
  key_copy: { text: string; placement: string }[];
  tokens_used: { name: string; value: string; layer: string }[];
}

// ── queryScreenFull ─────────────────────────────────────────────────────

export function queryScreenFull(graph: GraphFragment, screen_id: string): ScreenFullQueryResult | null {
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

  const screenResult = { id: screen.id, label: screen.label, description: screen.description };

  const pageSpec = graph.nodes.find(
    (n): n is PageSpecNode => n.entity_type === "page_spec" && n.screen_id === screen_id,
  );

  if (!pageSpec) {
    return {
      screen: screenResult,
      owning_features,
      states_visible_here,
      page_spec: null,
      sections: [],
      screen_state_slots: [],
      component_uses: [],
      key_copy: [],
      tokens_used: [],
    };
  }

  const sections = nodesOfType<WireframeSectionNode>(graph.nodes, "wireframe_section")
    .filter((s) => s.parent_page_spec_id === pageSpec.id)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, section_name: s.section_name, order: s.order, prose: s.prose }));

  const screen_state_slots = nodesOfType<ScreenStateSlotNode>(graph.nodes, "screen_state_slot")
    .filter((s) => s.screen_id === screen_id)
    .sort(byId)
    .map((s) => ({ state_id: s.state_id, appearance_text: s.appearance_text }));

  const manifestNodes = nodesOfType<ComponentManifestEntryNode>(graph.nodes, "component_manifest_entry");
  const manifestBySlot = new Map<string, ComponentManifestEntryNode>();
  for (const m of manifestNodes) manifestBySlot.set(m.slot, m);

  const componentUseNodes = nodesOfType<ScreenComponentUseNode>(graph.nodes, "screen_component_use")
    .filter((c) => c.screen_id === screen_id)
    .sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0));

  const component_uses: ScreenFullQueryResult["component_uses"] = componentUseNodes.map((c) => {
    const entry: ScreenFullQueryResult["component_uses"][number] = {
      slot: c.slot,
      position_in_wireframe: c.position_in_wireframe,
      prop_overrides: c.prop_overrides,
    };
    const manifest = manifestBySlot.get(c.slot);
    if (manifest) {
      entry.manifest_entry = {
        library: manifest.library,
        variant: manifest.variant,
        hard_gate: manifest.hard_gate,
        source_ref: manifest.source_ref,
      };
    }
    return entry;
  });

  const key_copy = nodesOfType<KeyCopyNode>(graph.nodes, "key_copy")
    .filter((k) => k.screen_id === screen_id)
    .sort(byId)
    .map((k) => ({ text: k.text, placement: k.placement }));

  const bracedRe = /\{([a-z][a-zA-Z0-9._-]*)\}/g;
  const prefixRe = /\btokens\.([a-z][a-zA-Z0-9._-]*)/g;
  const tokenNames = new Set<string>();
  for (const c of componentUseNodes) {
    for (const re of [bracedRe, prefixRe]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(c.prop_overrides)) !== null) {
        tokenNames.add(m[1]);
      }
    }
  }

  const allTokens = nodesOfType<TokenNode>(graph.nodes, "token");
  const tokenByName = new Map<string, TokenNode>();
  for (const t of allTokens) tokenByName.set(t.name, t);

  const tokens_used: ScreenFullQueryResult["tokens_used"] = [];
  for (const name of [...tokenNames].sort()) {
    const t = tokenByName.get(name);
    if (t) tokens_used.push({ name: t.name, value: t.value, layer: t.layer });
  }

  return {
    screen: screenResult,
    owning_features,
    states_visible_here,
    page_spec: {
      id: pageSpec.id,
      wireframe_text: pageSpec.wireframe_text,
      content_hierarchy: pageSpec.content_hierarchy,
      route: pageSpec.route,
    },
    sections,
    screen_state_slots,
    component_uses,
    key_copy,
    tokens_used,
  };
}

// ── DependenciesQueryResult ─────────────────────────────────────────────

export interface DependenciesQueryResult {
  feature: { id: string; label: string };
  provides: Array<{ endpoint: string; module: string; auth_required: boolean }>;
  consumes: Array<{ endpoint: string; module: string; auth_required: boolean }>;
  depended_on_by_features: string[];
  depends_on_features: string[];
  task_dag: Array<{
    task_id: string;
    title: string;
    size: "S" | "M" | "L";
    depends_on: string[];
    behavioral_test: string;
    assigned_phase: string;
    owns_files: string[];
  }>;
}

// ── queryDependencies ───────────────────────────────────────────────────

export function queryDependencies(graph: GraphFragment, feature_id: string): DependenciesQueryResult | null {
  const feature = graph.nodes.find(
    (n): n is FeatureNode => n.entity_type === "feature" && n.id === feature_id,
  );
  if (!feature) return null;

  const contractById = new Map<string, ApiContractNode>();
  for (const n of nodesOfType<ApiContractNode>(graph.nodes, "api_contract")) {
    contractById.set(n.id, n);
  }

  const taskById = new Map<string, TaskNode>();
  for (const n of nodesOfType<TaskNode>(graph.nodes, "task")) {
    taskById.set(n.id, n);
  }

  const toEndpointEntry = (contractId: string) => {
    const c = contractById.get(contractId);
    if (!c) return null;
    return { endpoint: c.endpoint, module: c.module_id, auth_required: c.auth_required };
  };

  const provides = graph.edges
    .filter((e) => e.relation === "feature_provides_endpoint" && e.source === feature_id)
    .map((e) => toEndpointEntry(e.target))
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.endpoint < b.endpoint ? -1 : a.endpoint > b.endpoint ? 1 : 0));

  const consumes = graph.edges
    .filter((e) => e.relation === "feature_consumes_endpoint" && e.source === feature_id)
    .map((e) => toEndpointEntry(e.target))
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.endpoint < b.endpoint ? -1 : a.endpoint > b.endpoint ? 1 : 0));

  const depends_on_features = graph.edges
    .filter((e) => e.relation === "depends_on" && e.source === feature_id)
    .map((e) => e.target)
    .sort();

  const depended_on_by_features = graph.edges
    .filter((e) => e.relation === "depends_on" && e.target === feature_id)
    .map((e) => e.source)
    .sort();

  const task_dag = graph.edges
    .filter((e) => e.relation === "task_implements_feature" && e.target === feature_id)
    .map((e) => taskById.get(e.source))
    .filter((t): t is TaskNode => t !== undefined)
    .map((t) => {
      const depends_on = graph.edges
        .filter((e) => e.relation === "task_depends_on" && e.source === t.id)
        .map((e) => {
          const dep = taskById.get(e.target);
          return dep ? dep.task_id : null;
        })
        .filter((x): x is string => x !== null)
        .sort();
      return {
        task_id: t.task_id,
        title: t.title,
        size: t.size,
        depends_on,
        behavioral_test: t.behavioral_test,
        assigned_phase: t.assigned_phase,
        owns_files: t.owns_files,
      };
    })
    .sort((a, b) => (a.task_id < b.task_id ? -1 : a.task_id > b.task_id ? 1 : 0));

  return {
    feature: { id: feature.id, label: feature.label },
    provides,
    consumes,
    depended_on_by_features,
    depends_on_features,
    task_dag,
  };
}

// ── CrossContractsQueryResult ───────────────────────────────────────────

export interface CrossContractsQueryResult {
  contract: {
    endpoint: string;
    module_id: string;
    request_schema: string;
    response_schema: string;
    auth_required: boolean;
    error_codes: string[];
  };
  providing_feature: string | null;
  consumers: string[];
}

// ── queryCrossContracts ─────────────────────────────────────────────────

export function queryCrossContracts(graph: GraphFragment, endpoint: string): CrossContractsQueryResult | null {
  const contract = graph.nodes.find(
    (n): n is ApiContractNode => n.entity_type === "api_contract" && n.endpoint === endpoint,
  );
  if (!contract) return null;

  const providers = graph.edges
    .filter((e) => e.relation === "feature_provides_endpoint" && e.target === contract.id)
    .map((e) => e.source)
    .sort();
  const providing_feature = providers.length > 0 ? providers[0] : null;

  const consumers = [
    ...new Set(
      graph.edges
        .filter((e) => e.relation === "feature_consumes_endpoint" && e.target === contract.id)
        .map((e) => e.source),
    ),
  ].sort();

  return {
    contract: {
      endpoint: contract.endpoint,
      module_id: contract.module_id,
      request_schema: contract.request_schema,
      response_schema: contract.response_schema,
      auth_required: contract.auth_required,
      error_codes: contract.error_codes,
    },
    providing_feature,
    consumers,
  };
}

// ── DecisionFilter / DecisionView ───────────────────────────────────────

export interface DecisionFilter {
  status?: "open" | "triggered" | "resolved";
  phase?: string;
  decided_by?: string;
}

export interface DecisionView {
  id: string;
  decision_id: string;
  summary: string;
  decided_by: string;
  related_decision_id: string | null;
  revisit_criterion: string | null;
  status: "open" | "triggered" | "resolved";
  phase: string;
  step_id: string | null;
  related_decision?: { id: string; summary: string; status: string };
  superseded_by?: { id: string; summary: string };
}

// ── queryDecisions ──────────────────────────────────────────────────────

export function queryDecisions(graph: GraphFragment, filter: DecisionFilter): DecisionView[] {
  const allDecisions = nodesOfType<DecisionNode>(graph.nodes, "decision");

  const decisionByNodeId = new Map<string, DecisionNode>();
  const decisionByDecisionId = new Map<string, DecisionNode>();
  for (const d of allDecisions) {
    decisionByNodeId.set(d.id, d);
    decisionByDecisionId.set(d.decision_id, d);
  }

  const matched = allDecisions.filter((d) => {
    if (filter.status !== undefined && d.status !== filter.status) return false;
    if (filter.phase !== undefined && d.phase !== filter.phase) return false;
    if (filter.decided_by !== undefined && d.decided_by !== filter.decided_by) return false;
    return true;
  });

  const views: DecisionView[] = matched.map((d) => {
    const view: DecisionView = {
      id: d.id,
      decision_id: d.decision_id,
      summary: d.summary,
      decided_by: d.decided_by,
      related_decision_id: d.related_decision_id,
      revisit_criterion: d.revisit_criterion,
      status: d.status,
      phase: d.phase,
      step_id: d.step_id,
    };

    if (d.related_decision_id !== null) {
      const related = decisionByDecisionId.get(d.related_decision_id);
      if (related) {
        view.related_decision = { id: related.id, summary: related.summary, status: related.status };
      }
    }

    if (d.status === "open" || d.status === "triggered") {
      const candidates = allDecisions
        .filter((o) => o.related_decision_id === d.decision_id && o.status === "resolved")
        .sort(byId);
      if (candidates.length > 0) {
        view.superseded_by = { id: candidates[0].id, summary: candidates[0].summary };
      }
    }

    return view;
  });

  return views.sort((a, b) => (a.decision_id < b.decision_id ? -1 : a.decision_id > b.decision_id ? 1 : 0));
}

// ── ScreenshotQueryResult ───────────────────────────────────────────────

export interface ScreenshotQueryResult {
  screenshot: {
    id: string;
    image_path: string;
    image_class: "reference" | "brand_drift" | "dogfood";
    caption: string;
    perceptual_hash: string;
    dominant_palette: string[];
    image_dimensions: string;
    dna_axis_tags: string[];
  };
  linked_screen?: { id: string; label: string };
  linked_finding?: { id: string; severity: string; description: string };
  drift_observations?: Array<{
    id: string;
    axis: string;
    score: number;
    verdict: string;
    paired_screenshot: { id: string; image_class: string };
  }>;
  component_detections?: Array<{ id: string; component_label: string; bounding_box: string | null; detection_confidence: number | null }>;
}

// ── queryScreenshot ─────────────────────────────────────────────────────

export function queryScreenshot(graph: GraphFragment, screenshot_id: string): ScreenshotQueryResult | null {
  const shot = graph.nodes.find(
    (n): n is ScreenshotNode => n.entity_type === "screenshot" && n.id === screenshot_id,
  );
  if (!shot) return null;

  const result: ScreenshotQueryResult = {
    screenshot: {
      id: shot.id,
      image_path: shot.image_path,
      image_class: shot.image_class,
      caption: shot.caption,
      perceptual_hash: shot.perceptual_hash,
      dominant_palette: shot.dominant_palette,
      image_dimensions: shot.image_dimensions,
      dna_axis_tags: shot.dna_axis_tags,
    },
  };

  if (shot.linked_screen_id !== null) {
    const screen = graph.nodes.find(
      (n): n is ScreenNode => n.entity_type === "screen" && n.id === shot.linked_screen_id,
    );
    if (screen) result.linked_screen = { id: screen.id, label: screen.label };
  }

  if (shot.linked_finding_id !== null) {
    const finding = graph.nodes.find(
      (n): n is DogfoodFindingNode => n.entity_type === "dogfood_finding" && n.id === shot.linked_finding_id,
    );
    if (finding) result.linked_finding = { id: finding.id, severity: finding.severity, description: finding.description };
  }

  const allObservations = nodesOfType<BrandDriftObservationNode>(graph.nodes, "brand_drift_observation");
  const driftObs: ScreenshotQueryResult["drift_observations"] = [];
  for (const obs of allObservations) {
    let pairedId: string | null = null;
    if (obs.prod_screenshot_id === screenshot_id) pairedId = obs.reference_screenshot_id;
    else if (obs.reference_screenshot_id === screenshot_id) pairedId = obs.prod_screenshot_id;
    else continue;

    const paired = graph.nodes.find(
      (n): n is ScreenshotNode => n.entity_type === "screenshot" && n.id === pairedId,
    );
    if (!paired) continue;

    driftObs.push({
      id: obs.id,
      axis: obs.axis,
      score: obs.score,
      verdict: obs.verdict,
      paired_screenshot: { id: paired.id, image_class: paired.image_class },
    });
  }
  if (driftObs.length > 0) {
    result.drift_observations = driftObs.sort(byId);
  }

  const detectionMap = new Map<string, { id: string; component_label: string; bounding_box: string | null; detection_confidence: number | null }>();

  for (const edge of graph.edges) {
    if (edge.relation === "image_has_component_detection" && edge.source === screenshot_id) {
      const det = graph.nodes.find(
        (n): n is ImageComponentDetectionNode => n.entity_type === "image_component_detection" && n.id === edge.target,
      );
      if (det) {
        detectionMap.set(det.id, { id: det.id, component_label: det.component_label, bounding_box: det.bounding_box, detection_confidence: det.detection_confidence });
      }
    }
  }

  // Defensive fallback: include detection nodes whose screenshot_id field points here
  for (const det of nodesOfType<ImageComponentDetectionNode>(graph.nodes, "image_component_detection")) {
    if (det.screenshot_id === screenshot_id && !detectionMap.has(det.id)) {
      detectionMap.set(det.id, { id: det.id, component_label: det.component_label, bounding_box: det.bounding_box, detection_confidence: det.detection_confidence });
    }
  }

  if (detectionMap.size > 0) {
    result.component_detections = [...detectionMap.values()].sort(byId);
  }

  return result;
}

// ── SimilarQueryResult ──────────────────────────────────────────────────

export interface SimilarQueryResult {
  query_screenshot: { id: string; perceptual_hash: string };
  matches: Array<{
    screenshot_id: string;
    image_class: string;
    perceptual_hash: string;
    distance: number;
  }>;
}

// ── queryScreenshotSimilar ──────────────────────────────────────────────

export function queryScreenshotSimilar(
  graph: GraphFragment,
  screenshot_id: string,
  threshold: number = 5,
): SimilarQueryResult | null {
  const query = graph.nodes.find(
    (n): n is ScreenshotNode => n.entity_type === "screenshot" && n.id === screenshot_id,
  );
  if (!query) return null;

  const allShots = nodesOfType<ScreenshotNode>(graph.nodes, "screenshot");
  const matches: SimilarQueryResult["matches"] = [];
  for (const other of allShots) {
    if (other.id === screenshot_id) continue;
    const distance = hammingDistance(query.perceptual_hash, other.perceptual_hash);
    if (distance <= threshold) {
      matches.push({ screenshot_id: other.id, image_class: other.image_class, perceptual_hash: other.perceptual_hash, distance });
    }
  }
  matches.sort((a, b) => a.distance - b.distance || (a.screenshot_id < b.screenshot_id ? -1 : a.screenshot_id > b.screenshot_id ? 1 : 0));

  return { query_screenshot: { id: query.id, perceptual_hash: query.perceptual_hash }, matches };
}

// ── BrandDriftQueryResult ───────────────────────────────────────────────

export interface BrandDriftQueryResult {
  observations: Array<{
    id: string;
    prod_screenshot_id: string;
    reference_screenshot_id: string;
    axis: string;
    score: number;
    verdict: "drift" | "ok" | "needs-review";
  }>;
}

// ── queryBrandDrift ─────────────────────────────────────────────────────

export function queryBrandDrift(graph: GraphFragment): BrandDriftQueryResult {
  const observations = nodesOfType<BrandDriftObservationNode>(graph.nodes, "brand_drift_observation")
    .map((o) => ({
      id: o.id,
      prod_screenshot_id: o.prod_screenshot_id,
      reference_screenshot_id: o.reference_screenshot_id,
      axis: o.axis,
      score: o.score,
      verdict: o.verdict,
    }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { observations };
}
