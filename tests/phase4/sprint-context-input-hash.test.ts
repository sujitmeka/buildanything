import { describe, it } from 'node:test';
import assert from 'node:assert';
import { inputHash, shouldInvalidate, SprintContextInput } from '../../src/orchestrator/phase4-shared-context';

const base: SprintContextInput = {
  buildState: { status: 'green' },
  refs: { api: '/v1', db: 'postgres' },
  architecture: 'modular-monolith',
  qualityTargets: { coverage: 80 },
};

describe('inputHash', () => {
  it('returns a 16-char hex string', () => {
    const h = inputHash(base);
    assert.strictEqual(h.length, 16);
    assert.match(h, /^[0-9a-f]{16}$/);
  });

  it('is consistent for identical inputs', () => {
    assert.strictEqual(inputHash(base), inputHash({ ...base }));
  });

  it('differs when architecture changes', () => {
    const altered = { ...base, architecture: 'microservices' };
    assert.notStrictEqual(inputHash(base), inputHash(altered));
  });

  it('differs when refs change', () => {
    const altered = { ...base, refs: { api: '/v2' } };
    assert.notStrictEqual(inputHash(base), inputHash(altered));
  });

  it('differs when qualityTargets change', () => {
    const altered = { ...base, qualityTargets: { coverage: 95 } };
    assert.notStrictEqual(inputHash(base), inputHash(altered));
  });

  it('differs when iosFeatures change', () => {
    const a = { ...base, iosFeatures: ['HealthKit'] };
    const b = { ...base, iosFeatures: ['StoreKit2'] };
    assert.notStrictEqual(inputHash(a), inputHash(b));
  });

  it('treats undefined iosFeatures same as null (normalised)', () => {
    const withUndefined = { ...base };
    const withExplicitUndefined = { ...base, iosFeatures: undefined };
    assert.strictEqual(inputHash(withUndefined), inputHash(withExplicitUndefined));
  });

  it('ignores buildState changes (not an input to rendered content)', () => {
    const altered = { ...base, buildState: { status: 'red', extra: true } };
    assert.strictEqual(inputHash(base), inputHash(altered));
  });
});

describe('shouldInvalidate with inputHash', () => {
  it('returns false when inputs have not changed', () => {
    const h = inputHash(base);
    assert.strictEqual(shouldInvalidate(h, base), false);
  });

  it('returns true when refs change', () => {
    const h = inputHash(base);
    const mutated = { ...base, refs: { api: '/v2', db: 'postgres' } };
    assert.strictEqual(shouldInvalidate(h, mutated), true);
  });

  it('returns true when architecture changes', () => {
    const h = inputHash(base);
    const mutated = { ...base, architecture: 'serverless' };
    assert.strictEqual(shouldInvalidate(h, mutated), true);
  });

  it('returns false when only buildState changes', () => {
    const h = inputHash(base);
    const mutated = { ...base, buildState: { status: 'red' } };
    assert.strictEqual(shouldInvalidate(h, mutated), false);
  });
});
