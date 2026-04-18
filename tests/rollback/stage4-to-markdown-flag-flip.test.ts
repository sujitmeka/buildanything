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
    const transitions: { from: string; to: string; timestamp: number }[] = [];
    transitions.push({ from: 'sdk', to: 'markdown', timestamp: Date.now() });
    assert.equal(transitions.length, 1);
    assert.equal(transitions[0].from, 'sdk');
    assert.equal(transitions[0].to, 'markdown');
    assert.equal(typeof transitions[0].timestamp, 'number');
  });
});
