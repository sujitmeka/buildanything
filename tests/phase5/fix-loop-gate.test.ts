import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fixLoopGate, Finding } from '../../src/orchestrator/fix-loop-gate';

describe('fix-loop gate – #6 audit fix', () => {
  const high = (id: string, status?: 'open' | 'fixed'): Finding => ({ finding_id: id, severity: 'high', status });
  const critical = (id: string, status?: 'open' | 'fixed'): Finding => ({ finding_id: id, severity: 'critical', status });
  const low = (id: string): Finding => ({ finding_id: id, severity: 'low' });

  it('blocks exit after cycle 1 when HIGH findings remain', () => {
    const r = fixLoopGate([high('f1'), high('f2'), low('f3')], 1);
    assert.strictEqual(r.may_exit, false);
    assert.strictEqual(r.remaining_high, 2);
    assert.strictEqual(r.cycle, 1);
  });

  it('blocks exit after cycle 1 when CRITICAL findings remain', () => {
    const r = fixLoopGate([critical('f1')], 1);
    assert.strictEqual(r.may_exit, false);
    assert.strictEqual(r.remaining_critical, 1);
  });

  it('allows exit after cycle 1 when all HIGH/CRITICAL are fixed', () => {
    const r = fixLoopGate([high('f1', 'fixed'), critical('f2', 'fixed'), low('f3')], 1);
    assert.strictEqual(r.may_exit, true);
  });

  it('allows exit after cycle 2 even with remaining HIGH', () => {
    const r = fixLoopGate([high('f1'), high('f2')], 2);
    assert.strictEqual(r.may_exit, true);
    assert.match(r.reason, /Max cycles/);
    assert.strictEqual(r.remaining_high, 2);
  });

  it('allows exit when only LOW findings remain', () => {
    const r = fixLoopGate([low('f1'), low('f2')], 1);
    assert.strictEqual(r.may_exit, true);
  });

  it('treats undefined status as open', () => {
    const r = fixLoopGate([high('f1')], 1);
    assert.strictEqual(r.may_exit, false);
  });
});
