import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MAX_CYCLES = 2;
function dualCounterCheck(perDecision: Record<string, number>, perPhase: Record<string, number>, decisionId: string, targetPhase: string): { action: 'allow' | 'escalate_to_user' } {
  const d = (perDecision[decisionId] ?? 0) + 1;
  const p = (perPhase[targetPhase] ?? 0) + 1;
  perDecision[decisionId] = d;
  perPhase[targetPhase] = p;
  return { action: d > MAX_CYCLES || p > MAX_CYCLES ? 'escalate_to_user' : 'allow' };
}

describe('backward-routing per-target-phase counter (A6)', () => {
  it('per-target-phase counter increments independently', () => {
    const perD: Record<string, number> = {}, perP: Record<string, number> = {};
    dualCounterCheck(perD, perP, 'D-1', 'phase-2');
    dualCounterCheck(perD, perP, 'D-2', 'phase-3');
    assert.equal(perP['phase-2'], 1);
    assert.equal(perP['phase-3'], 1);
  });
  it('escalation when per-target-phase exceeds cap even if per-decision is under', () => {
    const perD: Record<string, number> = {}, perP: Record<string, number> = { 'phase-2': 2 };
    const r = dualCounterCheck(perD, perP, 'D-new', 'phase-2');
    assert.equal(r.action, 'escalate_to_user');
    assert.equal(perD['D-new'], 1); // per-decision still low
  });
  it('escalation when per-decision exceeds cap', () => {
    const perD: Record<string, number> = { 'D-1': 2 }, perP: Record<string, number> = {};
    const r = dualCounterCheck(perD, perP, 'D-1', 'phase-5');
    assert.equal(r.action, 'escalate_to_user');
  });
});
