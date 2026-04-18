import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MAX_CYCLES = 2;
function cycleCounterCheck(count: Record<string, number>, decisionId: string): { action: 'allow' | 'escalate_to_user'; newCount: number } {
  const current = (count[decisionId] ?? 0) + 1;
  count[decisionId] = current;
  return { action: current > MAX_CYCLES ? 'escalate_to_user' : 'allow', newCount: current };
}

describe('backward-routing cycle counter', () => {
  it('first backward edge: allow', () => {
    const count: Record<string, number> = {};
    const r = cycleCounterCheck(count, 'D-1');
    assert.equal(r.newCount, 1);
    assert.equal(r.action, 'allow');
  });
  it('second backward edge: allow', () => {
    const count: Record<string, number> = { 'D-1': 1 };
    const r = cycleCounterCheck(count, 'D-1');
    assert.equal(r.newCount, 2);
    assert.equal(r.action, 'allow');
  });
  it('third backward edge: escalate', () => {
    const count: Record<string, number> = { 'D-1': 2 };
    const r = cycleCounterCheck(count, 'D-1');
    assert.equal(r.newCount, 3);
    assert.equal(r.action, 'escalate_to_user');
  });
  it('different decision IDs are independent', () => {
    const count: Record<string, number> = { 'D-2-01': 2, 'D-2-02': 1 };
    const r1 = cycleCounterCheck(count, 'D-2-01');
    const r2 = cycleCounterCheck(count, 'D-2-02');
    assert.equal(r1.action, 'escalate_to_user');
    assert.equal(r2.action, 'allow');
  });
});
