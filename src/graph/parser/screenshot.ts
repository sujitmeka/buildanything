/**
 * Screenshot extractor — STUB for hypothetical environment.
 *
 * Slice 5 production mode will:
 *   - Replace stub captions/tags with multimodal subagent dispatches
 *   - Add real image decoding (Sharp / @napi-rs/image) for dimensions + palette
 *   - Cache extractions by SHA256 of image bytes to avoid redundant API calls
 *
 * The basename--class ID convention ensures the same image bytes posted under
 * different image classes (e.g. "reference" vs "brand_drift") produce distinct
 * node IDs, preventing ID collisions in the graph.
 *
 * Source of truth: docs/graph/11-slice5-schema.md
 *
 * @module
 */

import { createHash } from "node:crypto";
import { ids, kebab } from "../ids.js";
import type {
  BrandDriftObservationNode,
  Confidence,
  DogfoodFindingNode,
  GraphEdge,
  GraphNode,
  ImageComponentDetectionNode,
  Relation,
  ScreenshotNode,
} from "../types.js";
import { dhash } from "../util/dhash.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCED_BY_AGENT = "screenshot-extractor-stub";
const PRODUCED_AT_STEP = "varies";

/**
 * Stub nodes are INFERRED: caption/dna_axis_tags/palette are LLM-derived even in production.
 */
const SCREENSHOT_STUB_CONFIDENCE: Confidence = "INFERRED";

/** Schema tag for Slice 5 fragments — referenced in doc comment above. */
const SCHEMA_TAG = "buildanything-slice-5";

const VALID_IMAGE_CLASSES = new Set(["reference", "brand_drift", "dogfood"] as const);

const DNA_AXIS_KEYWORDS = [
  "scope",
  "density",
  "character",
  "material",
  "motion",
  "type",
  "copy",
] as const;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScreenshotInput {
  imagePath: string;
  imageClass: "reference" | "brand_drift" | "dogfood";
  imageBytes: Uint8Array;
  linkedScreenId?: string | null;
  linkedFindingId?: string | null;
  findingSeverity?: "critical" | "major" | "minor";
  findingDescription?: string;
}

export interface ScreenshotExtractResult {
  ok: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  errors: { message: string }[];
}

export interface BrandDriftObservationInput {
  prodScreenshotId: string;
  referenceScreenshotId: string;
  axis: "scope" | "density" | "character" | "material" | "motion" | "type" | "copy";
  score: number;
  verdict: "drift" | "ok" | "needs-review";
  observationId: string;
}

export interface BrandDriftObservationResult {
  ok: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  errors: { message: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEdge(
  source: string,
  target: string,
  relation: Relation,
  sourceFile: string,
): GraphEdge {
  return {
    source,
    target,
    relation,
    confidence: "EXTRACTED",
    source_file: sourceFile,
    source_location: "L0",
    produced_by_agent: PRODUCED_BY_AGENT,
    produced_at_step: PRODUCED_AT_STEP,
  };
}

function basenameNoExt(filePath: string): string {
  const last = filePath.split("/").pop() ?? filePath;
  const dotIdx = last.lastIndexOf(".");
  return dotIdx > 0 ? last.slice(0, dotIdx) : last;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function extractScreenshot(input: ScreenshotInput): ScreenshotExtractResult {
  const errors: { message: string }[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // -- Validation -----------------------------------------------------------

  if (!input.imagePath || !input.imagePath.trim()) {
    errors.push({ message: "imagePath is empty or whitespace" });
    return { ok: false, nodes, edges, errors };
  }

  if (!input.imageBytes || input.imageBytes.length === 0) {
    errors.push({ message: "imageBytes is empty" });
    return { ok: false, nodes, edges, errors };
  }

  if (!VALID_IMAGE_CLASSES.has(input.imageClass as any)) {
    errors.push({
      message: `imageClass "${input.imageClass}" is not one of: reference, brand_drift, dogfood`,
    });
    return { ok: false, nodes, edges, errors };
  }

  // -- Compute hashes -------------------------------------------------------

  const perceptualHash = dhash(input.imageBytes);
  const contentSha8 = createHash("sha256")
    .update(input.imageBytes)
    .digest("hex")
    .slice(0, 8);

  const rawBasename = basenameNoExt(input.imagePath);

  // CRITICAL ID-collision fix: include imageClass in the basename used for ID
  // so that the same bytes sent under different classes produce different IDs.
  const idBasename = `${rawBasename}--${input.imageClass}`;
  const screenshotId = ids.screenshot(kebab(idBasename), contentSha8);

  // -- Class-aware stub extraction ------------------------------------------

  let caption: string;
  let dnaAxisTags: string[];
  let dominantPalette: string[];

  if (input.imageClass === "reference") {
    caption = "Stub caption — Slice 5 production mode dispatches a multimodal subagent";

    // Heuristic: scan rawBasename for DNA axis keywords
    const lower = rawBasename.toLowerCase();
    dnaAxisTags = DNA_AXIS_KEYWORDS.filter((kw) => lower.includes(kw));

    dominantPalette = ["#000000", "#FFFFFF"];
  } else {
    caption = `Stub caption (${input.imageClass}) — Slice 5 production mode derives this from a multimodal subagent dispatch`;
    dnaAxisTags = [];
    dominantPalette = [];
  }

  // -- Dogfood finding node (emitted before screenshot so we can reference its id) --

  const isDogfoodWithFinding =
    input.imageClass === "dogfood" &&
    input.linkedFindingId &&
    input.linkedFindingId.trim();

  const resolvedFindingId = isDogfoodWithFinding
    ? ids.dogfoodFinding(input.linkedFindingId!)
    : null;

  if (isDogfoodWithFinding) {
    const findingNode: DogfoodFindingNode = {
      id: resolvedFindingId!,
      label: input.linkedFindingId!,
      entity_type: "dogfood_finding",
      source_file: input.imagePath,
      source_location: "L0",
      confidence: SCREENSHOT_STUB_CONFIDENCE,
      finding_id: input.linkedFindingId!,
      severity: input.findingSeverity ?? "minor",
      description:
        input.findingDescription ??
        "Stub finding — Slice 5 production mode reads evidence/dogfood/findings.json",
      screenshot_id: screenshotId,
      affected_screen_id: input.linkedScreenId ?? null,
    };
    nodes.push(findingNode);
  }

  // -- Screenshot node ------------------------------------------------------

  const screenshotNode: ScreenshotNode = {
    id: screenshotId,
    label: rawBasename,
    entity_type: "screenshot",
    source_file: input.imagePath,
    source_location: "L0",
    confidence: SCREENSHOT_STUB_CONFIDENCE,
    image_path: input.imagePath,
    image_class: input.imageClass,
    caption,
    perceptual_hash: perceptualHash,
    dominant_palette: dominantPalette,
    image_dimensions: "0x0",
    dna_axis_tags: dnaAxisTags,
    linked_screen_id: input.linkedScreenId ?? null,
    linked_finding_id: resolvedFindingId,
  };
  nodes.push(screenshotNode);

  // -- Component detection (reference class only) ---------------------------

  if (input.imageClass === "reference") {
    const detectionId = ids.imageComponentDetection(
      screenshotId,
      "stub-component",
      1,
    );
    const detectionNode: ImageComponentDetectionNode = {
      id: detectionId,
      label: "stub-component",
      entity_type: "image_component_detection",
      source_file: input.imagePath,
      source_location: "L0",
      confidence: SCREENSHOT_STUB_CONFIDENCE,
      screenshot_id: screenshotId,
      component_label: "stub-component",
      bounding_box: null,
      detection_confidence: null,
    };
    nodes.push(detectionNode);
    edges.push(
      makeEdge(screenshotId, detectionId, "image_has_component_detection", input.imagePath),
    );
  }

  // -- Linking edges --------------------------------------------------------

  if (input.linkedScreenId && input.linkedScreenId.trim()) {
    edges.push(
      makeEdge(screenshotId, input.linkedScreenId, "screenshot_depicts_screen", input.imagePath),
    );
  }

  if (isDogfoodWithFinding) {
    edges.push(
      makeEdge(screenshotId, resolvedFindingId!, "screenshot_evidences_finding", input.imagePath),
    );
  }

  return { ok: true, nodes, edges, errors };
}

export function extractBrandDriftObservation(
  input: BrandDriftObservationInput,
): BrandDriftObservationResult {
  const errors: { message: string }[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  if (!input.prodScreenshotId || !input.prodScreenshotId.trim()) {
    errors.push({ message: "prodScreenshotId is empty" });
  }
  if (!input.referenceScreenshotId || !input.referenceScreenshotId.trim()) {
    errors.push({ message: "referenceScreenshotId is empty" });
  }
  if (!input.observationId || !input.observationId.trim()) {
    errors.push({ message: "observationId is empty" });
  }
  if (errors.length > 0) {
    return { ok: false, nodes, edges, errors };
  }

  const nodeId = ids.brandDriftObservation(input.observationId);

  const node: BrandDriftObservationNode = {
    id: nodeId,
    label: input.observationId,
    entity_type: "brand_drift_observation",
    source_file: "<brand-guardian>",
    source_location: "L0",
    confidence: "INFERRED",
    observation_id: input.observationId,
    prod_screenshot_id: input.prodScreenshotId,
    reference_screenshot_id: input.referenceScreenshotId,
    axis: input.axis,
    score: input.score,
    verdict: input.verdict,
  };
  nodes.push(node);

  const edgeBase = {
    confidence: "INFERRED" as Confidence,
    source_file: "<brand-guardian>",
    source_location: "L0",
    produced_by_agent: "design-brand-guardian",
    produced_at_step: "5.1",
  };

  edges.push({
    source: nodeId,
    target: input.prodScreenshotId,
    relation: "prod_drifts_from_reference_prod",
    ...edgeBase,
  });

  edges.push({
    source: nodeId,
    target: input.referenceScreenshotId,
    relation: "prod_drifts_from_reference_ref",
    ...edgeBase,
  });

  return { ok: true, nodes, edges, errors };
}
