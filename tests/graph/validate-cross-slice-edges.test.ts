import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCrossSliceEdges } from '../../src/graph/storage/index.js';
import type { GraphFragment } from '../../src/graph/types.js';

function makeFragment(overrides: Partial<GraphFragment> = {}): GraphFragment {
  return {
    version: 1,
    schema: 'buildanything-slice-1',
    source_file: '<test>',
    source_sha: '0'.repeat(64),
    produced_at: new Date().toISOString(),
    nodes: [],
    edges: [],
    ...overrides,
  };
}

describe('validateCrossSliceEdges', () => {
  it('returns empty array when all edges are valid', () => {
    const frag = makeFragment({
      nodes: [
        { id: 'a', label: 'A', entity_type: 'feature', source_file: '', source_location: '', confidence: 'EXTRACTED' } as any,
        { id: 'b', label: 'B', entity_type: 'screen', source_file: '', source_location: '', confidence: 'EXTRACTED' } as any,
      ],
      edges: [
        { source: 'a', target: 'b', relation: 'has_screen', confidence: 'EXTRACTED', source_file: '', source_location: '', produced_by_agent: '', produced_at_step: '' } as any,
      ],
    });
    assert.deepEqual(validateCrossSliceEdges(frag), []);
  });

  it('detects dangling target', () => {
    const frag = makeFragment({
      nodes: [
        { id: 'a', label: 'A', entity_type: 'feature', source_file: '', source_location: '', confidence: 'EXTRACTED' } as any,
      ],
      edges: [
        { source: 'a', target: 'missing', relation: 'has_screen', confidence: 'EXTRACTED', source_file: '', source_location: '', produced_by_agent: '', produced_at_step: '' } as any,
      ],
    });
    const warnings = validateCrossSliceEdges(frag);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Dangling edge: has_screen from a to missing — target node not found/);
  });

  it('detects dangling source', () => {
    const frag = makeFragment({
      nodes: [
        { id: 'b', label: 'B', entity_type: 'screen', source_file: '', source_location: '', confidence: 'EXTRACTED' } as any,
      ],
      edges: [
        { source: 'ghost', target: 'b', relation: 'has_screen', confidence: 'EXTRACTED', source_file: '', source_location: '', produced_by_agent: '', produced_at_step: '' } as any,
      ],
    });
    const warnings = validateCrossSliceEdges(frag);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Dangling edge: has_screen from ghost to b — source node not found/);
  });

  it('returns empty array for fragment with no edges', () => {
    const frag = makeFragment({
      nodes: [{ id: 'a', label: 'A', entity_type: 'feature', source_file: '', source_location: '', confidence: 'EXTRACTED' } as any],
    });
    assert.deepEqual(validateCrossSliceEdges(frag), []);
  });
});
