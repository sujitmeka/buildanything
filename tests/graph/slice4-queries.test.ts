import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractProductSpec } from '../../src/graph/parser/product-spec.js';
import { extractDesignMd } from '../../src/graph/parser/design-md.js';
import { extractDesignMdTokens } from '../../src/graph/parser/design-md-pass2.js';
import { extractComponentManifest } from '../../src/graph/parser/component-manifest.js';
import { extractPageSpec } from '../../src/graph/parser/page-spec.js';
import { extractArchitecture } from '../../src/graph/parser/architecture.js';
import { extractBackendTasks } from '../../src/graph/parser/backend-tasks.js';
import { extractDecisionsJsonl } from '../../src/graph/parser/decisions-jsonl.js';
import { ids } from '../../src/graph/ids.js';
import {
  queryDependencies,
  queryCrossContracts,
  queryDecisions,
  loadAllGraphs,
  saveGraph,
} from '../../src/graph/storage/index.js';
import type {
  DecisionNode,
  GraphFragment,
  GraphEdge,
  ScreenNode,
  TaskNode,
} from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const tmpDirs: string[] = [];

function newTmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'graph-slice4-'));
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

function parseFixture(
  name: string,
  parser: (input: { mdPath: string; mdContent: string }) => { ok: boolean; fragment?: GraphFragment; errors: unknown[] },
): GraphFragment {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  const result = parser({ mdPath: p, mdContent: md });
  if (!result.ok || !result.fragment) throw new Error(`fixture ${name} failed to parse`);
  return result.fragment;
}

function makeDecisionRow(overrides: Record<string, unknown>): string {
  const base = {
    decision_id: 'D-1',
    decision: 'Some decision',
    decided_by: 'human',
    phase: '1',
    status: 'open',
    related_decision_id: null,
    at: '2026-04-25T12:00:00Z',
  };
  return JSON.stringify({ ...base, ...overrides });
}

function makeBridgeFragment(edges: GraphEdge[]): GraphFragment {
  return {
    version: 1,
    schema: 'buildanything-slice-1',
    source_file: '<bridge>',
    source_sha: '0'.repeat(64),
    produced_at: new Date().toISOString(),
    nodes: [],
    edges,
  };
}

function makeBridgeEdge(source: string, target: string, relation: GraphEdge['relation']): GraphEdge {
  return {
    source,
    target,
    relation,
    confidence: 'EXTRACTED',
    source_file: '<bridge>',
    source_location: 'L0',
  };
}

describe('queryDependencies -- slice-4', () => {
  it('slice-1-only graph: returns non-null with empty provides, consumes, task_dag', () => {
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    const result = queryDependencies(slice1, 'feature__product-discovery');
    assert.ok(result);
    assert.deepStrictEqual(result.provides, []);
    assert.deepStrictEqual(result.consumes, []);
    assert.deepStrictEqual(result.task_dag, []);
  });

  it('merged graph with bridge: provides populated for feature__order-placement', () => {
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const arch = parseFixture('architecture-marketplace.md', extractArchitecture);
    saveGraph(tmp, arch, 'slice-4-architecture.json');
    const bridge = makeBridgeFragment([
      makeBridgeEdge('feature__order-placement', 'api_contract__post-api-orders', 'feature_provides_endpoint'),
    ]);
    saveGraph(tmp, bridge, 'slice-1-bridge.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryDependencies(merged, 'feature__order-placement');
    assert.ok(result);
    assert.ok(
      result.provides.some((p) => p.endpoint === 'POST /api/orders'),
      'expected POST /api/orders in provides',
    );
  });

  it('task_dag for feature__order-placement has T-7 with depends_on [T-3, T-5]', () => {
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const tasks = parseFixture('backend-tasks-marketplace.md', extractBackendTasks);
    saveGraph(tmp, tasks, 'slice-4-tasks.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryDependencies(merged, 'feature__order-placement');
    assert.ok(result);
    assert.equal(result.task_dag.length, 4);
    const t7 = result.task_dag.find((t) => t.task_id === 'T-7');
    assert.ok(t7, 'expected T-7 in task_dag');
    assert.deepStrictEqual(t7.depends_on, ['T-3', 'T-5']);
    assert.deepStrictEqual(t7.owns_files, ['src/api/orders.ts']);
  });

  it('depends_on_features populated from slice-1 cross-feature edges', () => {
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    // Find any cross-feature depends_on edge to validate
    const featureIds = new Set(
      slice1.nodes.filter((n) => n.entity_type === 'feature').map((n) => n.id),
    );
    const crossEdge = slice1.edges.find(
      (e) => e.relation === 'depends_on' && featureIds.has(e.source) && featureIds.has(e.target),
    );
    assert.ok(crossEdge, 'expected at least one cross-feature depends_on edge');
    const result = queryDependencies(slice1, crossEdge.source);
    assert.ok(result);
    assert.ok(
      result.depends_on_features.includes(crossEdge.target),
      `expected ${crossEdge.target} in depends_on_features`,
    );
  });
});

describe('queryCrossContracts -- slice-4', () => {
  it('returns non-null for POST /api/orders with providing_feature', () => {
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const arch = parseFixture('architecture-marketplace.md', extractArchitecture);
    saveGraph(tmp, arch, 'slice-4-architecture.json');
    const bridge = makeBridgeFragment([
      makeBridgeEdge('feature__order-placement', 'api_contract__post-api-orders', 'feature_provides_endpoint'),
    ]);
    saveGraph(tmp, bridge, 'slice-1-bridge.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryCrossContracts(merged, 'POST /api/orders');
    assert.ok(result);
    assert.equal(result.contract.endpoint, 'POST /api/orders');
    assert.equal(result.providing_feature, 'feature__order-placement');
  });

  it('returns null for missing endpoint', () => {
    const arch = parseFixture('architecture-marketplace.md', extractArchitecture);
    const result = queryCrossContracts(arch, 'GET /api/nope');
    assert.equal(result, null);
  });

  it('consumers array has multiple entries when multiple features consume one contract', () => {
    const tmp = newTmp();
    const arch = parseFixture('architecture-marketplace.md', extractArchitecture);
    saveGraph(tmp, arch, 'slice-4-architecture.json');
    const bridge = makeBridgeFragment([
      makeBridgeEdge('feature__order-placement', 'api_contract__get-api-products', 'feature_consumes_endpoint'),
      makeBridgeEdge('feature__seller-fulfillment', 'api_contract__get-api-products', 'feature_consumes_endpoint'),
    ]);
    saveGraph(tmp, bridge, 'slice-1-bridge.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryCrossContracts(merged, 'GET /api/products');
    assert.ok(result);
    assert.ok(result.consumers.length >= 2, `expected >= 2 consumers, got ${result.consumers.length}`);
  });
});

describe('queryDecisions -- slice-4', () => {
  function parseInlineDecisions(jsonl: string): GraphFragment {
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: jsonl });
    if (!result.ok || !result.fragment) throw new Error(`inline decisions failed: ${JSON.stringify(result.errors)}`);
    return result.fragment;
  }

  const threeRowJsonl = [
    makeDecisionRow({ decision_id: 'D-1', status: 'open', phase: '1' }),
    makeDecisionRow({ decision_id: 'D-2', status: 'resolved', phase: '2', at: '2026-04-25T12:01:00Z' }),
    makeDecisionRow({ decision_id: 'D-3', status: 'open', phase: '2', at: '2026-04-25T12:02:00Z' }),
  ].join('\n');

  it('filter by status=open returns only open decisions', () => {
    const frag = parseInlineDecisions(threeRowJsonl);
    const views = queryDecisions(frag, { status: 'open' });
    assert.ok(views.length > 0);
    assert.ok(views.every((v) => v.status === 'open'));
  });

  it('filter by phase=2 returns only phase 2 decisions', () => {
    const frag = parseInlineDecisions(threeRowJsonl);
    const views = queryDecisions(frag, { phase: '2' });
    assert.ok(views.length > 0);
    assert.ok(views.every((v) => v.phase === '2'));
  });

  it('filter by status=open AND phase=2 returns intersection', () => {
    const frag = parseInlineDecisions(threeRowJsonl);
    const views = queryDecisions(frag, { status: 'open', phase: '2' });
    assert.equal(views.length, 1);
    assert.equal(views[0].decision_id, 'D-3');
  });

  it('empty filter returns all decisions sorted by decision_id', () => {
    const frag = parseInlineDecisions(threeRowJsonl);
    const views = queryDecisions(frag, {});
    assert.equal(views.length, 3);
    assert.deepStrictEqual(
      views.map((v) => v.decision_id),
      ['D-1', 'D-2', 'D-3'],
    );
  });

  it('superseded_by populated: D-2 resolved supersedes D-1 open', () => {
    const jsonl = [
      makeDecisionRow({ decision_id: 'D-1', status: 'open', related_decision_id: null }),
      makeDecisionRow({ decision_id: 'D-2', status: 'resolved', related_decision_id: 'D-1', at: '2026-04-25T12:01:00Z' }),
    ].join('\n');
    const frag = parseInlineDecisions(jsonl);
    const views = queryDecisions(frag, {});
    const d1View = views.find((v) => v.decision_id === 'D-1');
    assert.ok(d1View);
    assert.ok(d1View.superseded_by, 'expected superseded_by on D-1');
    assert.equal(d1View.superseded_by.id, ids.decision('D-2'));
  });

  it('related_decision populated when target is in graph; absent when target is missing', () => {
    // Case 1: D-2 relates to D-1 (both in graph)
    const jsonl1 = [
      makeDecisionRow({ decision_id: 'D-1', status: 'open', related_decision_id: null, decision: 'Foo decision' }),
      makeDecisionRow({ decision_id: 'D-2', status: 'open', related_decision_id: 'D-1', decision: 'Bar decision', at: '2026-04-25T12:01:00Z' }),
    ].join('\n');
    const frag1 = parseInlineDecisions(jsonl1);
    const views1 = queryDecisions(frag1, {});
    const d2View = views1.find((v) => v.decision_id === 'D-2');
    assert.ok(d2View);
    assert.ok(d2View.related_decision, 'expected related_decision on D-2');
    assert.equal(d2View.related_decision.id, ids.decision('D-1'));
    assert.equal(d2View.related_decision.summary, 'Foo decision');
    const d1View = views1.find((v) => v.decision_id === 'D-1');
    assert.ok(d1View);
    assert.equal(d1View.related_decision, undefined, 'D-1 has no related_decision_id');

    // Case 2: D-2 relates to D-MISSING (not in graph)
    const jsonl2 = [
      makeDecisionRow({ decision_id: 'D-2', status: 'open', related_decision_id: 'D-MISSING', decision: 'Bar decision' }),
    ].join('\n');
    const frag2 = parseInlineDecisions(jsonl2);
    const views2 = queryDecisions(frag2, {});
    const d2View2 = views2.find((v) => v.decision_id === 'D-2');
    assert.ok(d2View2);
    assert.equal(d2View2.related_decision, undefined, 'D-MISSING not in graph, so no related_decision');
    assert.equal(d2View2.related_decision_id, 'D-MISSING');
  });
});

describe('slice-4 end-to-end: all 4 slices merged', () => {
  function buildE2eTmp(): { tmp: string; merged: GraphFragment } {
    const tmp = newTmp();

    // Slice 1: product-spec
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');

    // Slice 2: design-md pass1
    const designMd = parseFixture('design-md-pass1-marketplace.md', extractDesignMd);
    saveGraph(tmp, designMd, 'slice-2-design.json');

    // Slice 2: component manifest
    const manifest = parseFixture('component-manifest-marketplace.md', extractComponentManifest);
    saveGraph(tmp, manifest, 'slice-2-manifest.json');

    // Slice 3: design-md pass2 tokens
    const tokens = parseFixture('design-md-pass2-marketplace.md', extractDesignMdTokens);
    saveGraph(tmp, tokens, 'slice-3-tokens.json');

    // Slice 3: page-spec cart-review
    const cartPage = parseFixture('page-specs/cart-review.md', extractPageSpec);
    saveGraph(tmp, cartPage, 'slice-3-pages-cart.json');

    // Slice 4: architecture
    const arch = parseFixture('architecture-marketplace.md', extractArchitecture);
    saveGraph(tmp, arch, 'slice-4-architecture.json');

    // Slice 4: backend-tasks
    const tasks = parseFixture('backend-tasks-marketplace.md', extractBackendTasks);
    saveGraph(tmp, tasks, 'slice-4-tasks.json');

    // Slice 4: decisions (inline 3-row)
    const decisionsJsonl = [
      makeDecisionRow({ decision_id: 'D-TEST-1', status: 'open', phase: '1' }),
      makeDecisionRow({ decision_id: 'D-TEST-2', status: 'resolved', phase: '2', related_decision_id: 'D-TEST-1', at: '2026-04-25T12:01:00Z' }),
      makeDecisionRow({ decision_id: 'D-TEST-3', status: 'open', phase: '2', at: '2026-04-25T12:02:00Z' }),
    ].join('\n');
    const decisionsResult = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: decisionsJsonl });
    if (!decisionsResult.ok || !decisionsResult.fragment) throw new Error('decisions parse failed');
    saveGraph(tmp, decisionsResult.fragment, 'slice-4-decisions.json');

    // Bridge: feature_provides_endpoint and feature_consumes_endpoint edges
    const bridge = makeBridgeFragment([
      makeBridgeEdge('feature__order-placement', 'api_contract__post-api-orders', 'feature_provides_endpoint'),
      makeBridgeEdge('feature__product-discovery', 'api_contract__get-api-products', 'feature_provides_endpoint'),
      makeBridgeEdge('feature__order-placement', 'api_contract__get-api-products', 'feature_consumes_endpoint'),
    ]);
    saveGraph(tmp, bridge, 'slice-1-bridge.json');

    const merged = loadAllGraphs(tmp);
    assert.ok(merged, 'loadAllGraphs should return non-null');
    return { tmp, merged };
  }

  it('merged schema is buildanything-slice-4', () => {
    const { merged } = buildE2eTmp();
    assert.equal(merged.schema, 'buildanything-slice-4');
  });

  it('queryDependencies: provides includes POST /api/orders, task_dag has T-7', () => {
    const { merged } = buildE2eTmp();
    const result = queryDependencies(merged, 'feature__order-placement');
    assert.ok(result);
    assert.ok(result.provides.some((p) => p.endpoint === 'POST /api/orders'));
    assert.equal(result.task_dag.length, 4);
    const t7 = result.task_dag.find((t) => t.task_id === 'T-7');
    assert.ok(t7, 'expected T-7 in task_dag');
    assert.deepStrictEqual(t7.depends_on, ['T-3', 'T-5']);
  });

  it('queryCrossContracts: POST /api/orders has providing_feature order-placement', () => {
    const { merged } = buildE2eTmp();
    const result = queryCrossContracts(merged, 'POST /api/orders');
    assert.ok(result);
    assert.equal(result.providing_feature, 'feature__order-placement');
  });

  it('queryDecisions: returns 3 views, open filter returns subset', () => {
    const { merged } = buildE2eTmp();
    const all = queryDecisions(merged, {});
    assert.ok(all.length >= 3);
    const open = queryDecisions(merged, { status: 'open' });
    assert.ok(open.length > 0);
    assert.ok(open.length < all.length);
  });

  // Explicit chain: feature -> task -> task DAG
  it('chain: feature__order-placement -> task__t-7 -> depends_on [T-3, T-5]', () => {
    const { merged } = buildE2eTmp();
    const result = queryDependencies(merged, 'feature__order-placement');
    assert.ok(result);
    assert.equal(result.task_dag.length, 4);
    const t7 = result.task_dag.find((t) => t.task_id === 'T-7');
    assert.ok(t7, 'expected T-7 in task_dag');
    assert.ok(t7.title.includes('Order placement'));
    assert.deepStrictEqual(t7.depends_on, ['T-3', 'T-5']);
  });
});

describe('slice-4 edge cases', () => {
  it('forward-reference: related_decision_id pointing to non-existent D-FUTURE does not crash', () => {
    const jsonl = makeDecisionRow({ decision_id: 'D-1', status: 'open', related_decision_id: 'D-FUTURE' });
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: jsonl });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const edge = result.fragment.edges.find(
      (e) => e.source === ids.decision('D-1') && e.target === ids.decision('D-FUTURE'),
    );
    assert.ok(edge, 'expected edge to D-FUTURE');
    // queryDecisions should not crash and should not populate related_decision
    const views = queryDecisions(result.fragment, {});
    assert.equal(views.length, 1);
    assert.equal(views[0].related_decision, undefined);
  });

  it('orphan task: empty Feature column produces feature_id null and no task_implements_feature edge', () => {
    const md = [
      '| Task ID | Title | Size | Dependencies | Behavioral Test | Owns Files | Implementing Phase | Feature | Screens |',
      '|---|---|---|---|---|---|---|---|---|',
      '| T-99 | Setup deployment scripts | S | — | verify deploy works | — | phase-4 | — | — |',
    ].join('\n');
    const result = extractBackendTasks({ mdPath: '<inline>', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const task = result.fragment.nodes.find((n) => n.id === 'task__t-99') as TaskNode | undefined;
    assert.ok(task);
    assert.equal(task.feature_id, null);
    const featureEdge = result.fragment.edges.find(
      (e) => e.relation === 'task_implements_feature' && e.source === 'task__t-99',
    );
    assert.equal(featureEdge, undefined, 'no task_implements_feature edge for orphan task');
  });
});
;
