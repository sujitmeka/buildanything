import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractScreenshot } from '../../src/graph/parser/screenshot.js';
import type {
  GraphEdge,
  GraphNode,
  ImageComponentDetectionNode,
  ScreenshotNode,
} from '../../src/graph/types.js';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'screenshots',
);

const REF_PATH = join(FIXTURES_DIR, 'marketplace-hero-reference.png');
const PROD_PATH = join(FIXTURES_DIR, 'marketplace-hero-prod.png');
const DASHBOARD_PATH = join(FIXTURES_DIR, 'dashboard-card-reference.png');
const DOGFOOD_PATH = join(FIXTURES_DIR, 'dogfood-error-1.png');

function readBytes(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}

function nodesOfType<T extends GraphNode>(
  nodes: GraphNode[],
  t: T['entity_type'],
): T[] {
  return nodes.filter((n): n is T => n.entity_type === t);
}

describe('extractScreenshot — reference class', () => {
  it('emits 1 screenshot node + 1 component detection + 1 edge', () => {
    const result = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'reference',
      imageBytes: readBytes(REF_PATH),
    });
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
    assert.equal(nodesOfType<ScreenshotNode>(result.nodes, 'screenshot').length, 1);
    const detections = nodesOfType<ImageComponentDetectionNode>(
      result.nodes,
      'image_component_detection',
    );
    assert.equal(detections.length, 1);
    const detectionEdges = result.edges.filter(
      (e: GraphEdge) => e.relation === 'image_has_component_detection',
    );
    assert.equal(detectionEdges.length, 1);
    assert.equal(detectionEdges[0].source, result.nodes[0].id);
    assert.equal(detectionEdges[0].target, detections[0].id);
  });

  it('inferred dna_axis_tags from filename when filename contains an axis name', () => {
    // "material" is a DNA axis keyword — synthesize a path that contains it.
    const synthPath = join(FIXTURES_DIR, 'pricing-material-hero.png');
    const result = extractScreenshot({
      imagePath: synthPath,
      imageClass: 'reference',
      imageBytes: readBytes(REF_PATH),
    });
    assert.equal(result.ok, true);
    const shot = nodesOfType<ScreenshotNode>(result.nodes, 'screenshot')[0];
    assert.ok(shot.dna_axis_tags.includes('material'));
  });
});

describe('extractScreenshot — brand_drift class', () => {
  it('emits 1 screenshot node + screenshot_depicts_screen edge when linkedScreenId provided', () => {
    const result = extractScreenshot({
      imagePath: PROD_PATH,
      imageClass: 'brand_drift',
      imageBytes: readBytes(PROD_PATH),
      linkedScreenId: 'screen__pricing',
    });
    assert.equal(result.ok, true);
    assert.equal(nodesOfType<ScreenshotNode>(result.nodes, 'screenshot').length, 1);
    // brand_drift skips component detection
    assert.equal(
      nodesOfType<ImageComponentDetectionNode>(result.nodes, 'image_component_detection').length,
      0,
    );
    const depicts = result.edges.filter(
      (e: GraphEdge) => e.relation === 'screenshot_depicts_screen',
    );
    assert.equal(depicts.length, 1);
    assert.equal(depicts[0].target, 'screen__pricing');
  });
});

describe('extractScreenshot — dogfood class', () => {
  it('emits 1 screenshot node + screenshot_evidences_finding edge when linkedFindingId provided', () => {
    const result = extractScreenshot({
      imagePath: DOGFOOD_PATH,
      imageClass: 'dogfood',
      imageBytes: readBytes(DOGFOOD_PATH),
      linkedFindingId: 'dogfood_finding__f-001',
    });
    assert.equal(result.ok, true);
    assert.equal(nodesOfType<ScreenshotNode>(result.nodes, 'screenshot').length, 1);
    const evidences = result.edges.filter(
      (e: GraphEdge) => e.relation === 'screenshot_evidences_finding',
    );
    assert.equal(evidences.length, 1);
    assert.equal(evidences[0].target, 'dogfood_finding__f-001');
  });
});

describe('extractScreenshot — validation', () => {
  it('empty bytes → ok: false', () => {
    const result = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'reference',
      imageBytes: new Uint8Array(),
    });
    assert.equal(result.ok, false);
    assert.equal(result.nodes.length, 0);
    assert.ok(result.errors.length > 0);
  });

  it('empty path → ok: false', () => {
    const result = extractScreenshot({
      imagePath: '',
      imageClass: 'reference',
      imageBytes: readBytes(REF_PATH),
    });
    assert.equal(result.ok, false);
    assert.equal(result.nodes.length, 0);
    assert.ok(result.errors.length > 0);
  });

  it('invalid imageClass (cast through any) → ok: false at runtime', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'bogus' as any,
      imageBytes: readBytes(REF_PATH),
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  });
});

describe('extractScreenshot — properties', () => {
  it('idempotent: same bytes + path + class produce identical nodes/edges', () => {
    const bytes = readBytes(REF_PATH);
    const a = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'reference',
      imageBytes: bytes,
    });
    const b = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'reference',
      imageBytes: bytes,
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepStrictEqual(
      a.nodes.map((n) => n.id).sort(),
      b.nodes.map((n) => n.id).sort(),
    );
    assert.deepStrictEqual(
      a.edges.map((e) => `${e.source}->${e.target}:${e.relation}`).sort(),
      b.edges.map((e) => `${e.source}->${e.target}:${e.relation}`).sort(),
    );
  });

  it('different imageClass on identical bytes produces different screenshot IDs', () => {
    const bytes = readBytes(REF_PATH);
    const ref = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'reference',
      imageBytes: bytes,
    });
    const drift = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'brand_drift',
      imageBytes: bytes,
    });
    const refShot = nodesOfType<ScreenshotNode>(ref.nodes, 'screenshot')[0];
    const driftShot = nodesOfType<ScreenshotNode>(drift.nodes, 'screenshot')[0];
    assert.notEqual(refShot.id, driftShot.id);
  });

  it('perceptual_hash is exactly 16 hex chars', () => {
    const result = extractScreenshot({
      imagePath: DASHBOARD_PATH,
      imageClass: 'reference',
      imageBytes: readBytes(DASHBOARD_PATH),
    });
    assert.equal(result.ok, true);
    const shot = nodesOfType<ScreenshotNode>(result.nodes, 'screenshot')[0];
    assert.match(shot.perceptual_hash, /^[0-9a-f]{16}$/);
  });
});
