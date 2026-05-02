import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractScreenshot } from '../../src/graph/parser/screenshot.js';
import {
  loadAllGraphs,
  queryBrandDrift,
  queryScreenshot,
  queryScreenshotSimilar,
  saveGraph,
} from '../../src/graph/storage/index.js';
import type {
  BrandDriftObservationNode,
  GraphEdge,
  GraphFragment,
  GraphNode,
  ScreenNode,
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

const tmpDirs: string[] = [];

function newTmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'graph-slice5-'));
  tmpDirs.push(d);
  return d;
}

after(() => {
  for (const d of tmpDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

function readBytes(p: string): Uint8Array {
  return new Uint8Array(readFileSync(p));
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function makeFragment(nodes: GraphNode[], edges: GraphEdge[] = []): GraphFragment {
  return {
    version: 1,
    schema: 'buildanything-slice-5',
    source_file: '<test>',
    source_sha: '0'.repeat(64),
    produced_at: new Date().toISOString(),
    nodes: [...nodes].sort(byId),
    edges,
  };
}

function extractToFragment(
  imagePath: string,
  imageClass: 'reference' | 'brand_drift' | 'dogfood',
  opts: { linkedScreenId?: string; linkedFindingId?: string } = {},
): { fragment: GraphFragment; screenshotId: string } {
  const result = extractScreenshot({
    imagePath,
    imageClass,
    imageBytes: readBytes(imagePath),
    linkedScreenId: opts.linkedScreenId ?? null,
    linkedFindingId: opts.linkedFindingId ?? null,
  });
  if (!result.ok) {
    throw new Error(`extractScreenshot failed: ${JSON.stringify(result.errors)}`);
  }
  const shot = result.nodes.find((n): n is ScreenshotNode => n.entity_type === 'screenshot')!;
  return {
    fragment: makeFragment(result.nodes, result.edges),
    screenshotId: shot.id,
  };
}

function makeScreenNode(id: string, label: string): ScreenNode {
  return {
    id,
    label,
    entity_type: 'screen',
    source_file: '<test>',
    source_location: 'L0',
    confidence: 'EXTRACTED',
    description: `${label} screen`,
    feature_ids: [],
  };
}

function makeBrandDriftObservation(
  observationId: string,
  prodId: string,
  refId: string,
  axis: BrandDriftObservationNode['axis'],
  score: number,
  verdict: BrandDriftObservationNode['verdict'],
): BrandDriftObservationNode {
  return {
    id: `brand_drift_observation__${observationId}`,
    label: observationId,
    entity_type: 'brand_drift_observation',
    source_file: '<test>',
    source_location: 'L0',
    confidence: 'EXTRACTED',
    observation_id: observationId,
    prod_screenshot_id: prodId,
    reference_screenshot_id: refId,
    axis,
    score,
    verdict,
  };
}

describe('queryScreenshot', () => {
  it('returns null when screenshot id is not in graph', () => {
    const empty = makeFragment([]);
    assert.equal(queryScreenshot(empty, 'screenshot__missing__deadbeef'), null);
  });

  it('returns populated linked_screen when linkedScreenId is set and screen exists', () => {
    const { fragment, screenshotId } = extractToFragment(PROD_PATH, 'brand_drift', {
      linkedScreenId: 'screen__pricing',
    });
    const merged = makeFragment(
      [...fragment.nodes, makeScreenNode('screen__pricing', 'Pricing')],
      fragment.edges,
    );
    const result = queryScreenshot(merged, screenshotId);
    assert.ok(result);
    assert.ok(result.linked_screen);
    assert.equal(result.linked_screen!.id, 'screen__pricing');
    assert.equal(result.linked_screen!.label, 'Pricing');
  });
});

describe('queryScreenshotSimilar', () => {
  it('returns null when query screenshot id is missing', () => {
    const empty = makeFragment([]);
    assert.equal(
      queryScreenshotSimilar(empty, 'screenshot__missing__deadbeef'),
      null,
    );
  });

  it('returns matches array with low distance when 2 fixtures have close hashes', () => {
    const a = extractToFragment(REF_PATH, 'reference');
    const b = extractToFragment(PROD_PATH, 'brand_drift');
    const merged = makeFragment([...a.fragment.nodes, ...b.fragment.nodes]);
    const result = queryScreenshotSimilar(merged, a.screenshotId, 5);
    assert.ok(result);
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].screenshot_id, b.screenshotId);
    assert.ok(
      result.matches[0].distance <= 5,
      `expected distance ≤ 5, got ${result.matches[0].distance}`,
    );
  });

  it('threshold=0 only matches exact-hash screenshots', () => {
    // ref vs prod has distance 1 → threshold 0 excludes prod, threshold 1 includes it.
    const a = extractToFragment(REF_PATH, 'reference');
    const b = extractToFragment(PROD_PATH, 'brand_drift');
    const merged = makeFragment([...a.fragment.nodes, ...b.fragment.nodes]);
    const t0 = queryScreenshotSimilar(merged, a.screenshotId, 0);
    assert.ok(t0);
    assert.equal(t0.matches.length, 0, 'threshold=0 should exclude distance-1 match');

    const t1 = queryScreenshotSimilar(merged, a.screenshotId, 1);
    assert.ok(t1);
    assert.equal(t1.matches.length, 1, 'threshold=1 should include distance-1 match');
  });

  it('returns empty matches when graph has only the query screenshot', () => {
    const { fragment, screenshotId } = extractToFragment(REF_PATH, 'reference');
    const result = queryScreenshotSimilar(fragment, screenshotId);
    assert.ok(result);
    assert.deepStrictEqual(result.matches, []);
  });

  it('high-distance pair (ref vs dashboard) excluded at default threshold', () => {
    const a = extractToFragment(REF_PATH, 'reference');
    const b = extractToFragment(DASHBOARD_PATH, 'reference');
    const merged = makeFragment([...a.fragment.nodes, ...b.fragment.nodes]);
    const result = queryScreenshotSimilar(merged, a.screenshotId);
    assert.ok(result);
    assert.equal(result.matches.length, 0, 'distance ~36 should be above default threshold 5');
  });
});

describe('queryBrandDrift', () => {
  it('returns empty observations array when graph has no brand_drift_observation nodes', () => {
    const empty = makeFragment([]);
    const result = queryBrandDrift(empty);
    assert.deepStrictEqual(result.observations, []);
  });

  it('returns 2 observations sorted by score descending', () => {
    const ref = extractToFragment(REF_PATH, 'reference');
    const prod = extractToFragment(PROD_PATH, 'brand_drift');
    const obs1 = makeBrandDriftObservation(
      'bdo-001',
      prod.screenshotId,
      ref.screenshotId,
      'material',
      0.62,
      'drift',
    );
    const obs2 = makeBrandDriftObservation(
      'bdo-002',
      prod.screenshotId,
      ref.screenshotId,
      'density',
      0.81,
      'drift',
    );
    const merged = makeFragment([
      ...ref.fragment.nodes,
      ...prod.fragment.nodes,
      obs1,
      obs2,
    ]);
    const result = queryBrandDrift(merged);
    assert.equal(result.observations.length, 2);
    assert.equal(result.observations[0].id, obs2.id, 'higher score should sort first');
    assert.equal(result.observations[1].id, obs1.id);
    assert.ok(result.observations[0].score >= result.observations[1].score);
  });

  it('preserves all three verdict values: drift | ok | needs-review', () => {
    const ref = extractToFragment(REF_PATH, 'reference');
    const prod = extractToFragment(PROD_PATH, 'brand_drift');
    const verdicts: BrandDriftObservationNode['verdict'][] = ['drift', 'ok', 'needs-review'];
    const obsNodes = verdicts.map((v, i) =>
      makeBrandDriftObservation(
        `bdo-${i + 1}`,
        prod.screenshotId,
        ref.screenshotId,
        'material',
        0.5 + i * 0.1,
        v,
      ),
    );
    const merged = makeFragment([
      ...ref.fragment.nodes,
      ...prod.fragment.nodes,
      ...obsNodes,
    ]);
    const result = queryBrandDrift(merged);
    const seen = new Set(result.observations.map((o) => o.verdict));
    for (const v of verdicts) {
      assert.ok(seen.has(v), `expected verdict "${v}" preserved`);
    }
  });
});

describe('slice 5 end-to-end: extract → save → loadAllGraphs → query', () => {
  it('extracts 4 fixtures, persists, reloads, and queries each one', () => {
    const tmp = newTmp();

    const refExtract = extractScreenshot({
      imagePath: REF_PATH,
      imageClass: 'reference',
      imageBytes: readBytes(REF_PATH),
    });
    const prodExtract = extractScreenshot({
      imagePath: PROD_PATH,
      imageClass: 'brand_drift',
      imageBytes: readBytes(PROD_PATH),
      linkedScreenId: 'screen__pricing',
    });
    const dashExtract = extractScreenshot({
      imagePath: DASHBOARD_PATH,
      imageClass: 'reference',
      imageBytes: readBytes(DASHBOARD_PATH),
    });
    const dogfoodExtract = extractScreenshot({
      imagePath: DOGFOOD_PATH,
      imageClass: 'dogfood',
      imageBytes: readBytes(DOGFOOD_PATH),
      linkedFindingId: 'f-001',
    });

    for (const r of [refExtract, prodExtract, dashExtract, dogfoodExtract]) {
      assert.equal(r.ok, true);
    }

    const allNodes: GraphNode[] = [
      ...refExtract.nodes,
      ...prodExtract.nodes,
      ...dashExtract.nodes,
      ...dogfoodExtract.nodes,
      makeScreenNode('screen__pricing', 'Pricing'),
    ];
    const allEdges: GraphEdge[] = [
      ...refExtract.edges,
      ...prodExtract.edges,
      ...dashExtract.edges,
      ...dogfoodExtract.edges,
    ];

    saveGraph(tmp, makeFragment(allNodes, allEdges), 'slice-5.json');
    const merged = loadAllGraphs(tmp);
    assert.ok(merged);
    assert.equal(merged.schema, 'buildanything-slice-5');

    const ids = [
      refExtract.nodes.find((n) => n.entity_type === 'screenshot')!.id,
      prodExtract.nodes.find((n) => n.entity_type === 'screenshot')!.id,
      dashExtract.nodes.find((n) => n.entity_type === 'screenshot')!.id,
      dogfoodExtract.nodes.find((n) => n.entity_type === 'screenshot')!.id,
    ];

    for (const id of ids) {
      const result = queryScreenshot(merged, id);
      assert.ok(result, `queryScreenshot returned null for ${id}`);
      assert.equal(result.screenshot.id, id);
    }

    // The brand_drift fixture has linked_screen populated.
    const prodResult = queryScreenshot(merged, ids[1]);
    assert.ok(prodResult!.linked_screen);
    assert.equal(prodResult!.linked_screen!.id, 'screen__pricing');
  });
});
