import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDecisionsJsonl } from '../../src/graph/parser/decisions-jsonl.js';
import { ids } from '../../src/graph/ids.js';
import type { DecisionNode, GraphFragment } from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function nodesOfType<T extends { entity_type: string }>(
  fragment: GraphFragment,
  type: T['entity_type'],
): T[] {
  return fragment.nodes.filter((n): n is T & typeof n => n.entity_type === type) as T[];
}

function makeRow(overrides: Record<string, unknown>): string {
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

describe('decisions-jsonl parser -- inline fixtures', () => {
  it('5-row valid JSONL with no related_decision_id produces 5 nodes, 0 edges', () => {
    const lines = [
      makeRow({ decision_id: 'D-1' }),
      makeRow({ decision_id: 'D-2', at: '2026-04-25T12:01:00Z' }),
      makeRow({ decision_id: 'D-3', at: '2026-04-25T12:02:00Z' }),
      makeRow({ decision_id: 'D-4', at: '2026-04-25T12:03:00Z' }),
      makeRow({ decision_id: 'D-5', at: '2026-04-25T12:04:00Z' }),
    ].join('\n');
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const nodes = nodesOfType<DecisionNode>(result.fragment, 'decision');
    assert.equal(nodes.length, 5);
    assert.equal(result.fragment.edges.length, 0);
  });

  it('D-2 resolved with related D-1 open produces decision_supersedes edge', () => {
    const lines = [
      makeRow({ decision_id: 'D-1', status: 'open', related_decision_id: null }),
      makeRow({ decision_id: 'D-2', status: 'resolved', related_decision_id: 'D-1', at: '2026-04-25T12:01:00Z' }),
    ].join('\n');
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const nodes = nodesOfType<DecisionNode>(result.fragment, 'decision');
    assert.equal(nodes.length, 2);
    const edge = result.fragment.edges.find((e) => e.relation === 'decision_supersedes');
    assert.ok(edge, 'expected decision_supersedes edge');
    assert.equal(edge.source, ids.decision('D-2'));
    assert.equal(edge.target, ids.decision('D-1'));
  });

  it('related_decision_id pointing to missing row produces decision_relates_to edge', () => {
    const lines = makeRow({ decision_id: 'D-1', status: 'open', related_decision_id: 'D-MISSING' });
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    assert.equal(nodesOfType<DecisionNode>(result.fragment, 'decision').length, 1);
    const edge = result.fragment.edges.find((e) => e.relation === 'decision_relates_to');
    assert.ok(edge, 'expected decision_relates_to edge');
    assert.equal(edge.source, ids.decision('D-1'));
    assert.equal(edge.target, ids.decision('D-MISSING'));
  });

  it('cycle detection: D-A related D-B and D-B related D-A returns ok:false', () => {
    const lines = [
      makeRow({ decision_id: 'D-A', status: 'open', related_decision_id: 'D-B' }),
      makeRow({ decision_id: 'D-B', status: 'open', related_decision_id: 'D-A', at: '2026-04-25T12:01:00Z' }),
    ].join('\n');
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.message.startsWith('Cycle detected')));
  });

  it('invalid status DRAFT returns ok:false with error about invalid status', () => {
    const lines = makeRow({ decision_id: 'D-1', status: 'DRAFT' });
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.message.includes("invalid 'status'")));
  });

  it('BOM is stripped: single valid row after BOM parses ok:true with 1 node', () => {
    const bom = '\uFEFF';
    const lines = bom + makeRow({ decision_id: 'D-1' });
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    assert.equal(nodesOfType<DecisionNode>(result.fragment, 'decision').length, 1);
  });

  it('comment lines and blank lines are skipped', () => {
    const lines = [
      '// some comment',
      '# another comment',
      makeRow({ decision_id: 'D-1' }),
      '',
    ].join('\n');
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    assert.equal(nodesOfType<DecisionNode>(result.fragment, 'decision').length, 1);
  });

  it('duplicate decision_id returns ok:false', () => {
    const lines = [
      makeRow({ decision_id: 'D-1' }),
      makeRow({ decision_id: 'D-1', at: '2026-04-25T12:01:00Z' }),
    ].join('\n');
    const result = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.message.includes('duplicate decision_id')));
  });

  it('determinism: parsing twice produces byte-identical output (modulo produced_at)', () => {
    const lines = [
      makeRow({ decision_id: 'D-LATER', at: '2026-04-26T00:00:00Z' }),
      makeRow({ decision_id: 'D-EARLIER', at: '2026-04-25T00:00:00Z' }),
    ].join('\n');
    const a = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    const b = extractDecisionsJsonl({ mdPath: '<inline>', mdContent: lines });
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _ax, ...aRest } = a.fragment;
    const { produced_at: _bx, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });
});

describe('decisions-jsonl parser -- real fixture', () => {
  it('decisions.jsonl returns ok:false due to malformed line 14', () => {
    const p = join(FIXTURES, 'decisions.jsonl');
    const content = readFileSync(p, 'utf-8');
    const result = extractDecisionsJsonl({ mdPath: p, mdContent: content });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.message.includes('14')));
  });
});
