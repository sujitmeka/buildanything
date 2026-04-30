// Stable ID generation for Slice 1 nodes. Determinism matters: same
// product-spec.md → identical IDs → SHA256 cache hits. Source of truth for
// the rules: docs/graph/04-slice1-schema.md §3.

import { createHash } from "node:crypto";

const KEBAB_REPLACE = /[^a-z0-9]+/g;
const KEBAB_TRIM = /^-+|-+$/g;

export function kebab(input: string): string {
  return input
    .toLowerCase()
    .replace(KEBAB_REPLACE, "-")
    .replace(KEBAB_TRIM, "");
}

// Strip-and-normalize before hashing so trivial wording changes (whitespace,
// punctuation) don't churn IDs. Internal whitespace collapses to single
// spaces; surrounding whitespace and trailing punctuation are dropped.
export function normalizeForHash(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function sha256_8(input: string): string {
  return createHash("sha256")
    .update(normalizeForHash(input))
    .digest("hex")
    .slice(0, 8);
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export const ids = {
  feature: (name: string): string => `feature__${kebab(name)}`,
  screen: (name: string): string => `screen__${kebab(name)}`,
  state: (featureName: string, stateName: string): string =>
    `state__${kebab(featureName)}__${kebab(stateName)}`,
  transition: (featureName: string, fromState: string, toState: string): string =>
    `transition__${kebab(featureName)}__${kebab(fromState)}__${kebab(toState)}`,
  businessRule: (featureName: string, text: string): string =>
    `rule__${kebab(featureName)}__${sha256_8(text)}`,
  failureMode: (featureName: string, trigger: string): string =>
    `failure__${kebab(featureName)}__${sha256_8(trigger)}`,
  acceptanceCriterion: (featureName: string, text: string): string =>
    `accept__${kebab(featureName)}__${sha256_8(text)}`,
  persona: (label: string): string => `persona__${kebab(label)}`,
  personaConstraint: (featureName: string, text: string): string =>
    `pconstraint__${kebab(featureName)}__${sha256_8(text)}`,
  // Slice 2 additions. Source of truth: docs/graph/05-slice2-schema.md.
  designDocRoot: (): string => "design_md__root",
  dnaAxis: (axisName: string): string => `dna_axis__${kebab(axisName)}`,
  dnaGuideline: (polarity: "do" | "dont", text: string): string =>
    `dna_guideline__${polarity}__${sha256_8(text)}`,
  brandReference: (urlOrLabel: string): string =>
    `brand_reference__${sha256_8(urlOrLabel)}`,
  manifestEntry: (slot: string): string => `manifest_entry__${kebab(slot)}`,
  componentSlot: (slot: string): string => `slot__${kebab(slot)}`,
  // Slice 3 additions. Source of truth: docs/graph/07-slice3-schema.md.
  token: (layer: string, name: string): string =>
    `token__${kebab(layer)}__${kebab(name)}`,
  pageSpec: (screenName: string): string =>
    `page_spec__${kebab(screenName)}`,
  wireframeSection: (screenName: string, sectionName: string, order: number): string =>
    `wireframe_section__${kebab(screenName)}__${kebab(sectionName)}__${order}`,
  screenStateSlot: (screenName: string, stateName: string): string =>
    `screen_state_slot__${kebab(screenName)}__${kebab(stateName)}`,
  screenComponentUse: (screenName: string, slot: string, position: string): string =>
    `screen_component_use__${kebab(screenName)}__${kebab(slot)}__${kebab(position)}`,
  keyCopy: (screenName: string, text: string): string =>
    `key_copy__${kebab(screenName)}__${sha256_8(text)}`,
  // Slice 4 additions. Source of truth: docs/graph/09-slice4-schema.md.
  architectureModule: (name: string): string => `module__${kebab(name)}`,
  apiContract: (endpoint: string): string => `api_contract__${kebab(endpoint)}`,
  dataModel: (entityName: string): string => `data_model__${kebab(entityName)}`,
  task: (taskId: string): string => `task__${kebab(taskId)}`,
  decision: (decisionId: string): string => `decision__${kebab(decisionId)}`,
  // Slice 5 additions. Source of truth: docs/graph/11-slice5-schema.md.
  screenshot: (basenameKebab: string, contentSha256First8: string): string =>
    `screenshot__${basenameKebab}__${contentSha256First8}`,
  imageComponentDetection: (screenshotId: string, label: string, order: number): string =>
    `image_component_detection__${screenshotId.replace(/^screenshot__/, "")}__${kebab(label)}__${order}`,
  dogfoodFinding: (findingId: string): string => `dogfood_finding__${kebab(findingId)}`,
  brandDriftObservation: (observationId: string): string => `brand_drift_observation__${kebab(observationId)}`,
};
