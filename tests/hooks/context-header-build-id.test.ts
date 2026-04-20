import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  renderContextHeader,
  invalidateCache,
  isCacheValid,
  type ContextHeaderInput,
} from '../../src/orchestrator/hooks/context-header.js';

const base: ContextHeaderInput = {
  projectType: 'web',
  phase: 3,
};

describe('context-header buildId cache key', () => {
  beforeEach(() => {
    invalidateCache();
  });

  it('same buildId + same inputs → cache hit (identical object ref)', () => {
    const a = renderContextHeader(base, 'build-1');
    const b = renderContextHeader({ ...base }, 'build-1');
    // Singleton cache returns the exact same object on a hit
    assert.strictEqual(a, b);
  });

  it('different buildId + same inputs → cache miss (re-render)', () => {
    const a = renderContextHeader(base, 'build-1');
    const b = renderContextHeader({ ...base }, 'build-2');
    // Content is identical but the object should be freshly rendered
    assert.notStrictEqual(a, b);
    // Content and hash still match since inputs are the same
    assert.strictEqual(a.content, b.content);
    assert.strictEqual(a.hash, b.hash);
  });

  it('invalidateCache clears the buildId (forces re-render)', () => {
    const a = renderContextHeader(base, 'build-1');
    invalidateCache();
    const b = renderContextHeader({ ...base }, 'build-1');
    // After invalidation, even the same buildId produces a new object
    assert.notStrictEqual(a, b);
  });

  it('isCacheValid respects buildId when provided', () => {
    renderContextHeader(base, 'build-1');
    assert.strictEqual(isCacheValid(3, 'build-1'), true);
    assert.strictEqual(isCacheValid(3, 'build-2'), false);
  });

  it('isCacheValid without buildId ignores build dimension', () => {
    renderContextHeader(base, 'build-1');
    // Omitting buildId falls back to phase-only check (backward compat)
    assert.strictEqual(isCacheValid(3), true);
    assert.strictEqual(isCacheValid(4), false);
  });
});
