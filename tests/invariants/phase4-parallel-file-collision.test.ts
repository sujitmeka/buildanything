import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

type Lease = { holder: string; paths: string[] };
let leases: Lease[] = [];

function acquireWriteLease(taskId: string, filePaths: string[]): { granted: boolean; conflict?: { holder: string; paths: string[] } } {
  for (const lease of leases) {
    const overlap = filePaths.filter(p => lease.paths.includes(p));
    if (overlap.length > 0) return { granted: false, conflict: { holder: lease.holder, paths: overlap } };
  }
  leases.push({ holder: taskId, paths: filePaths });
  return { granted: true };
}

function releaseLease(taskId: string) {
  const idx = leases.findIndex(l => l.holder === taskId);
  if (idx >= 0) leases.splice(idx, 1);
}

describe('phase4-parallel-file-collision', () => {
  beforeEach(() => { leases = []; });

  it('first implementer acquires lease', () => {
    const r = acquireWriteLease('task-A', ['src/components/Button.tsx', 'src/styles/button.css']);
    assert.equal(r.granted, true);
    assert.equal(r.conflict, undefined);
  });

  it('second implementer gets lease_conflict on overlapping path', () => {
    acquireWriteLease('task-A', ['src/components/Button.tsx', 'src/styles/button.css']);
    const r = acquireWriteLease('task-B', ['src/components/Button.tsx', 'src/utils/helpers.ts']);
    assert.equal(r.granted, false);
    assert.deepEqual(r.conflict, { holder: 'task-A', paths: ['src/components/Button.tsx'] });
  });

  it('non-overlapping paths succeed', () => {
    acquireWriteLease('task-A', ['src/components/Button.tsx', 'src/styles/button.css']);
    const r = acquireWriteLease('task-C', ['src/pages/Home.tsx']);
    assert.equal(r.granted, true);
  });

  it('lease release allows re-acquisition', () => {
    acquireWriteLease('task-A', ['src/components/Button.tsx', 'src/styles/button.css']);
    releaseLease('task-A');
    const r = acquireWriteLease('task-B', ['src/components/Button.tsx', 'src/utils/helpers.ts']);
    assert.equal(r.granted, true);
  });

  it('ios project.pbxproj collision detected', () => {
    acquireWriteLease('task-X', ['ios/project.pbxproj']);
    const r = acquireWriteLease('task-Y', ['ios/project.pbxproj']);
    assert.equal(r.granted, false);
    assert.deepEqual(r.conflict, { holder: 'task-X', paths: ['ios/project.pbxproj'] });
  });
});
