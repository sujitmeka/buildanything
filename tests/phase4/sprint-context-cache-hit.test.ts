import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderSprintContext, shouldInvalidate, SprintContextInput } from '../../src/orchestrator/phase4-shared-context';

const base: SprintContextInput = {
  buildState: { status: 'green' },
  refs: { api: '/v1' },
  architecture: 'microservices',
  qualityTargets: { coverage: 90 },
};

describe('sprint-context cache-hit', () => {
  it('same input produces identical hash (cache hit)', () => {
    const a = renderSprintContext(base);
    const b = renderSprintContext({ ...base });
    assert.strictEqual(a.hash, b.hash);
  });

  it('shouldInvalidate returns false for unchanged input', () => {
    const block = renderSprintContext(base);
    assert.strictEqual(shouldInvalidate(block.hash, base), false);
  });

  it('different buildState alone does not change hash (not in content)', () => {
    const altered = { ...base, buildState: { status: 'red' } };
    const a = renderSprintContext(base);
    const b = renderSprintContext(altered);
    assert.strictEqual(a.hash, b.hash);
  });
});
