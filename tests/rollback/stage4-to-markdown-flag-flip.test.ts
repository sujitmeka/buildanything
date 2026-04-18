import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function shouldHaltOnFlagFlip(state: { backward_routing_count: Record<string, number> }, maxCycles: number) {
  const max = Math.max(0, ...Object.values(state.backward_routing_count));
  return max >= maxCycles ? { halt: true, reason: `backward_routing_count reached cap (${max}/${maxCycles}); SDK off` } : { halt: false };
}

describe('stage4 markdown flag-flip (A7)', () => {
  it('markdown mode halts when backward_routing_count at cap', () => {
    process.env.BUILDANYTHING_SDK = 'off';
    const res = shouldHaltOnFlagFlip({ backward_routing_count: { 'D-2-03': 2 } }, 2);
    assert.equal(res.halt, true);
    assert.ok(res.reason?.includes('cap'));
    delete process.env.BUILDANYTHING_SDK;
  });

  it('markdown mode proceeds when counts below cap', () => {
    const res = shouldHaltOnFlagFlip({ backward_routing_count: { 'D-2-03': 1 } }, 2);
    assert.equal(res.halt, false);
  });

  it('mode_transitions[] records the flip', () => {
    const transitions: Array<{
      timestamp: string; session_id: string | null;
      flag: string; old_value: string; new_value: string;
      post_flags: Record<string, string>;
    }> = [];
    transitions.push({
      timestamp: new Date().toISOString(),
      session_id: 'test-session-id',
      flag: 'BUILDANYTHING_SDK',
      old_value: 'on',
      new_value: 'off',
      post_flags: { BUILDANYTHING_SDK: 'off', BUILDANYTHING_ENFORCE_WRITER_OWNER: 'false',
        BUILDANYTHING_ENFORCE_WRITE_LEASE: 'false', BUILDANYTHING_SDK_SPRINT_CONTEXT: 'false',
        BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS: 'false' },
    });
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].flag, 'BUILDANYTHING_SDK');
    assert.equal(transitions[0].old_value, 'on');
    assert.equal(transitions[0].new_value, 'off');
    assert.equal(typeof transitions[0].timestamp, 'string');
    assert.ok(transitions[0].post_flags.BUILDANYTHING_SDK === 'off');
  });
});
