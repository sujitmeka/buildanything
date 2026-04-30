// Slice 1 graph types. Source of truth: docs/graph/04-slice1-schema.md.
// Confidence semantics inherit Graphify's vocabulary even though Slice 1 is
// pure-deterministic (every edge is EXTRACTED). The field is preserved so
// later slices that introduce LLM extraction can extend without migration.

export type Confidence = "EXTRACTED" | "INFERRED" | "AMBIGUOUS";

export type EntityType =
  | "persona"
  | "feature"
  | "screen"
  | "state"
  | "transition"
  | "business_rule"
  | "failure_mode"
  | "acceptance_criterion"
  | "persona_constraint"
  // Slice 2 additions. Source of truth: docs/graph/05-slice2-schema.md.
  | "dna_axis"
  | "brand_dna_guideline"
  | "brand_reference"
  | "component_manifest_entry"
  | "component_slot"
  | "design_doc_root"
  // Slice 3 additions. Source of truth: docs/graph/07-slice3-schema.md.
  | "token"
  | "page_spec"
  | "wireframe_section"
  | "screen_state_slot"
  | "screen_component_use"
  | "key_copy"
  // Slice 4 additions. Source of truth: docs/graph/09-slice4-schema.md.
  | "architecture_module"
  | "api_contract"
  | "data_model"
  | "task"
  | "decision"
  // Slice 5 additions. Source of truth: docs/graph/11-slice5-schema.md.
  | "screenshot"
  | "image_component_detection"
  | "dogfood_finding"
  | "brand_drift_observation";

export type Relation =
  | "has_screen"
  | "has_state"
  | "has_initial_state"
  | "transitions_to"
  | "triggered_by_transition"
  | "has_rule"
  | "has_failure_mode"
  | "has_acceptance"
  | "constrains"
  | "applies_to_persona"
  | "depends_on"
  // Slice 2 additions. Source of truth: docs/graph/05-slice2-schema.md.
  | "has_axis"
  | "dna_governs"
  | "forbids"
  | "applies_to"
  | "slot_filled_by"
  | "manifest_uses_library"
  | "references_axis"
  // Slice 3 additions. Source of truth: docs/graph/07-slice3-schema.md.
  | "has_page_spec"
  | "has_section"
  | "has_screen_state"
  | "slot_used_on_screen"
  | "screen_uses_token"
  | "token_derived_from"
  | "key_copy_on_screen"
  // Slice 4 additions. Source of truth: docs/graph/09-slice4-schema.md.
  | "module_has_contract"
  | "module_has_data_model"
  | "task_implements_feature"
  | "task_touches_screen"
  | "task_depends_on"
  | "feature_provides_endpoint"
  | "feature_consumes_endpoint"
  | "decision_supersedes"
  | "decision_relates_to"
  | "decision_drove"
  // Slice 5 additions. Source of truth: docs/graph/11-slice5-schema.md.
  | "references_axis_image"
  | "screenshot_depicts_screen"
  | "screenshot_evidences_finding"
  | "image_has_component_detection"
  | "prod_drifts_from_reference_prod"
  | "prod_drifts_from_reference_ref"
  | "similar_to_image";

export interface NodeBase {
  id: string;
  label: string;
  entity_type: EntityType;
  source_file: string;
  source_location?: string; // "L42"
  confidence: Confidence;
}

export interface PersonaNode extends NodeBase {
  entity_type: "persona";
  description: string;
  role: string;
  is_primary: boolean;
  primary_jtbd: string;
}

export interface FeatureNode extends NodeBase {
  entity_type: "feature";
  name: string;
  kebab_anchor: string;
}

export interface ScreenNode extends NodeBase {
  entity_type: "screen";
  description: string;
  feature_ids: string[];
  count?: number; // populated when screen inventory says "Checkout (3 screens)" without naming all 3
}

export interface StateNode extends NodeBase {
  entity_type: "state";
  feature_id: string;
  is_initial: boolean;
  meta_state: boolean;
}

export interface TransitionNode extends NodeBase {
  entity_type: "transition";
  from_state_id: string;
  to_state_id: string;
  trigger: string;
  preconditions: string;
  side_effects: string;
}

export interface BusinessRuleNode extends NodeBase {
  entity_type: "business_rule";
  feature_id: string;
  text: string;
  value: string | null;
  decision_needed: boolean;
}

export interface FailureModeNode extends NodeBase {
  entity_type: "failure_mode";
  feature_id: string;
  trigger: string;
  user_sees: string;
  user_can: string;
  system_does: string;
}

export interface AcceptanceCriterionNode extends NodeBase {
  entity_type: "acceptance_criterion";
  feature_id: string;
  text: string;
  verified: boolean;
}

export interface PersonaConstraintNode extends NodeBase {
  entity_type: "persona_constraint";
  feature_id: string;
  persona_id: string;
  constraint_text: string;
  cited_source: string;
}

// Slice 2 additions. Source of truth: docs/graph/05-slice2-schema.md.

export interface DesignDocRootNode extends NodeBase {
  entity_type: "design_doc_root";
  name: string;
  description: string;
  locked_at: string; // ISO-8601 from `### Locked At`
  lint_status?: "pass" | "warn" | "fail" | null;
  pass_complete: { pass1: boolean; pass2: boolean };
}

export interface DnaAxisNode extends NodeBase {
  entity_type: "dna_axis";
  axis_name: "scope" | "density" | "character" | "material" | "motion" | "type" | "copy";
  value: string;
  rationale: string;
}

export interface BrandDnaGuidelineNode extends NodeBase {
  entity_type: "brand_dna_guideline";
  polarity: "do" | "dont";
  text: string;
  axis_scope: string | null;
}

export interface BrandReferenceNode extends NodeBase {
  entity_type: "brand_reference";
  url_or_path: string;
  exemplifies_axes: string[];
}

export interface ComponentManifestEntryNode extends NodeBase {
  entity_type: "component_manifest_entry";
  slot: string;
  library: string;
  variant: string;
  source_ref: string | null;
  hard_gate: boolean;
  fallback_plan?: string;
}

export interface ComponentSlotNode extends NodeBase {
  entity_type: "component_slot";
  slot_name: string;
}

// Slice 3 additions. Source of truth: docs/graph/07-slice3-schema.md.

export interface TokenNode extends NodeBase {
  entity_type: "token";
  name: string;
  value: string;
  layer: "color" | "typography" | "spacing" | "shape" | "elevation" | "motion" | "type" | "component";
  axis_provenance: "scope" | "density" | "character" | "material" | "motion" | "type" | "copy" | null;
  category: string | null;
}

export interface PageSpecNode extends NodeBase {
  entity_type: "page_spec";
  screen_id: string;
  wireframe_text: string;
  content_hierarchy: string[];
  route: string | null;
}

export interface WireframeSectionNode extends NodeBase {
  entity_type: "wireframe_section";
  section_name: string;
  parent_page_spec_id: string;
  order: number;
  prose: string;
}

export interface ScreenStateSlotNode extends NodeBase {
  entity_type: "screen_state_slot";
  screen_id: string;
  state_id: string;
  appearance_text: string;
}

export interface ScreenComponentUseNode extends NodeBase {
  entity_type: "screen_component_use";
  screen_id: string;
  slot: string;
  position_in_wireframe: string;
  prop_overrides: string;
}

export interface KeyCopyNode extends NodeBase {
  entity_type: "key_copy";
  screen_id: string;
  text: string;
  placement: string;
}

// Slice 4 additions. Source of truth: docs/graph/09-slice4-schema.md.

export interface ArchitectureModuleNode extends NodeBase {
  entity_type: "architecture_module";
  name: string;
  description: string;
  responsibilities: string[];
  tech_stack: string[];
}

export interface ApiContractNode extends NodeBase {
  entity_type: "api_contract";
  endpoint: string; // e.g. "POST /api/orders"
  module_id: string; // FK
  request_schema: string; // JSON-string blob
  response_schema: string; // JSON-string blob
  auth_required: boolean;
  error_codes: string[];
}

export interface DataModelNode extends NodeBase {
  entity_type: "data_model";
  entity_name: string;
  module_id: string;
  fields: string[]; // "name:type" pairs
  indexes: string[];
}

export interface TaskNode extends NodeBase {
  entity_type: "task";
  task_id: string; // e.g. "T-1"
  title: string;
  size: "S" | "M" | "L";
  behavioral_test: string;
  assigned_phase: string;
  feature_id: string | null;
  screen_ids: string[];
  owns_files: string[];
}

export interface DecisionNode extends NodeBase {
  entity_type: "decision";
  decision_id: string;
  summary: string;
  decided_by: string; // verbatim from JSONL — could be "code-architect", "human", etc.
  related_decision_id: string | null;
  revisit_criterion: string | null;
  status: "open" | "triggered" | "resolved";
  phase: string;
  step_id: string | null;
}

// Slice 5 additions. Source of truth: docs/graph/11-slice5-schema.md.

export interface ScreenshotNode extends NodeBase {
  entity_type: "screenshot";
  image_path: string;
  image_class: "reference" | "brand_drift" | "dogfood";
  caption: string;
  perceptual_hash: string; // 64-bit dHash as 16-char hex
  dominant_palette: string[]; // up to 5 hex colors
  image_dimensions: string; // e.g. "1280x720"
  dna_axis_tags: string[]; // axes this image exemplifies
  linked_screen_id: string | null;
  linked_finding_id: string | null;
}

export interface ImageComponentDetectionNode extends NodeBase {
  entity_type: "image_component_detection";
  screenshot_id: string;
  component_label: string;
  bounding_box: string | null;
  // Vision-model detection probability (0-1). Renamed from `confidence` to avoid collision
  // with NodeBase.confidence (EXTRACTED/INFERRED/AMBIGUOUS extraction-confidence vocabulary).
  detection_confidence: number | null;
}

export interface DogfoodFindingNode extends NodeBase {
  entity_type: "dogfood_finding";
  finding_id: string;
  severity: "critical" | "major" | "minor";
  description: string;
  screenshot_id: string;
  affected_screen_id: string | null;
}

export interface BrandDriftObservationNode extends NodeBase {
  entity_type: "brand_drift_observation";
  observation_id: string;
  prod_screenshot_id: string;
  reference_screenshot_id: string;
  axis: "scope" | "density" | "character" | "material" | "motion" | "type" | "copy";
  score: number;
  verdict: "drift" | "ok" | "needs-review";
}

export type GraphNode =
  | PersonaNode
  | FeatureNode
  | ScreenNode
  | StateNode
  | TransitionNode
  | BusinessRuleNode
  | FailureModeNode
  | AcceptanceCriterionNode
  | PersonaConstraintNode
  | DesignDocRootNode
  | DnaAxisNode
  | BrandDnaGuidelineNode
  | BrandReferenceNode
  | ComponentManifestEntryNode
  | ComponentSlotNode
  | TokenNode
  | PageSpecNode
  | WireframeSectionNode
  | ScreenStateSlotNode
  | ScreenComponentUseNode
  | KeyCopyNode
  | ArchitectureModuleNode
  | ApiContractNode
  | DataModelNode
  | TaskNode
  | DecisionNode
  | ScreenshotNode
  | ImageComponentDetectionNode
  | DogfoodFindingNode
  | BrandDriftObservationNode;

export interface GraphEdge {
  source: string;
  target: string;
  relation: Relation;
  confidence: Confidence;
  source_file: string;
  source_location?: string;
  produced_by_agent?: string; // forward-compat — Slice 1 sets "product-spec-writer"
  produced_at_step?: string; // forward-compat — Slice 1 sets "1.6"
}

export type Schema =
  | "buildanything-slice-1"
  | "buildanything-slice-2"
  | "buildanything-slice-3"
  | "buildanything-slice-4"
  | "buildanything-slice-5";

export interface GraphFragment {
  version: 1;
  schema: Schema;
  source_file: string;
  source_sha: string; // sha256 of product-spec.md content
  produced_at: string; // ISO timestamp
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ExtractError {
  line: number;
  message: string;
}

export interface ExtractResult {
  ok: boolean;
  fragment?: GraphFragment;
  errors: ExtractError[];
}
