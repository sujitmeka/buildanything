/**
 * Verifies that the async mutex in acquireWriteLease serializes concurrent
 * callers so that overlapping lease requests are correctly denied.
 *
 * The TOCTOU scenario: two async callers both call acquireWriteLease for
 * overlapping paths "at the same time". Without the mutex, both could read
 * the leases array before either persists, and both would be granted.
 * With the mutex, exactly one gets granted and the other gets a conflict.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireWriteLease,
  releaseLease,
  reset,
} from '../../src/orchestrator/mcp/write-lease.js';

describe('write-lease async mutex serialization', () => {
  beforeEach(() => {
    reset();
  });

  it('concurrent overlapping acquires: exactly one granted, one denied', async () => {
    // Fire two acquires for the same path concurrently (no await between them)
    const [r1, r2] = await Promise.all([
      acquireWriteLease('task-A', ['src/shared.ts']),
      acquireWriteLease('task-B', ['src/shared.ts']),
    ]);

    const granted = [r1, r2].filter(r => r.granted);
    const denied = [r1, r2].filter(r => !r.granted);

    assert.equal(granted.length, 1, 'exactly one caller should be granted');
    assert.equal(denied.length, 1, 'exactly one caller should be denied');
    assert.ok(denied[0].conflict, 'denied result should have conflict details');
    assert.deepEqual(denied[0].conflict!.paths, ['src/shared.ts']);
  });

  it('concurrent non-overlapping acquires: both granted', async () => {
    const [r1, r2] = await Promise.all([
      acquireWriteLease('task-A', ['src/a.ts']),
      acquireWriteLease('task-B', ['src/b.ts']),
    ]);

    assert.equal(r1.granted, true);
    assert.equal(r2.granted, true);
  });

  it('three concurrent acquires for same path: only first granted', async () => {
    const [r1, r2, r3] = await Promise.all([
      acquireWriteLease('task-A', ['src/shared.ts']),
      acquireWriteLease('task-B', ['src/shared.ts']),
      acquireWriteLease('task-C', ['src/shared.ts']),
    ]);

    const granted = [r1, r2, r3].filter(r => r.granted);
    const denied = [r1, r2, r3].filter(r => !r.granted);

    assert.equal(granted.length, 1, 'exactly one of three should be granted');
    assert.equal(denied.length, 2, 'two of three should be denied');
  });

  it('sequential acquires after release work correctly', async () => {
    const r1 = await acquireWriteLease('task-A', ['src/shared.ts']);
    assert.equal(r1.granted, true);

    releaseLease('task-A');

    const r2 = await acquireWriteLease('task-B', ['src/shared.ts']);
    assert.equal(r2.granted, true, 'should succeed after release');
  });

  it('partial overlap detected in concurrent calls', async () => {
    const [r1, r2] = await Promise.all([
      acquireWriteLease('task-A', ['src/a.ts', 'src/shared.ts']),
      acquireWriteLease('task-B', ['src/b.ts', 'src/shared.ts']),
    ]);

    const granted = [r1, r2].filter(r => r.granted);
    const denied = [r1, r2].filter(r => !r.granted);

    assert.equal(granted.length, 1, 'exactly one should be granted');
    assert.equal(denied.length, 1, 'exactly one should be denied');
    assert.deepEqual(denied[0].conflict!.paths, ['src/shared.ts']);
  });
});
