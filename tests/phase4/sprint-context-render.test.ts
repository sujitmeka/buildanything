import { describe, it } from 'node:test';
import assert from 'node:assert';
import { renderSprintContext, shouldInvalidate, SprintContextInput } from '../../src/orchestrator/phase4-shared-context';

const base: SprintContextInput = {
  buildState: { status: 'green' },
  refs: { api: '/v1', db: 'postgres' },
  architecture: 'modular-monolith',
  qualityTargets: { coverage: 80 },
};

describe('sprint-context render', () => {
  it('renders content with architecture and quality sections', () => {
    const block = renderSprintContext(base);
    assert.ok(block.content.includes('## Architecture Snapshot'));
    assert.ok(block.content.includes('modular-monolith'));
    assert.ok(block.content.includes('"coverage": 80'));
  });

  it('produces a 16-char hex hash', () => {
    const block = renderSprintContext(base);
    assert.strictEqual(block.hash.length, 16);
    assert.match(block.hash, /^[0-9a-f]{16}$/);
  });

  it('invalidates when refs mutate', () => {
    const block = renderSprintContext(base);
    const mutated = { ...base, refs: { api: '/v2', db: 'postgres' } };
    assert.strictEqual(shouldInvalidate(block.hash, mutated), true);
  });
});
