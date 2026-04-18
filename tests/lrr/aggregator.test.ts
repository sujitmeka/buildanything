import { describe, it } from 'node:test';
import assert from 'node:assert';
import { aggregate, ChapterResult } from '../../src/lrr/aggregator';

const ch = (v: 'PASS'|'CONCERNS'|'BLOCK', ovr = false, fSpawn = false, fConf = false): ChapterResult => ({
  chapter: 'ch', verdict: v, override_blocks_launch: ovr, findings: [], follow_up_spawned: fSpawn, follow_up_confirmed: fConf,
});

describe('aggregate – 6 rules', () => {
  it('Rule 1: override_blocks_launch → BLOCKED', () => {
    const r = aggregate([ch('PASS'), ch('PASS', true), ch('PASS'), ch('PASS'), ch('PASS')]);
    assert.strictEqual(r.combined_verdict, 'BLOCKED');
    assert.strictEqual(r.triggered_rule, 1);
  });
  it('Rule 2: all PASS, no follow-ups → PRODUCTION READY', () => {
    const r = aggregate([ch('PASS'), ch('PASS'), ch('PASS'), ch('PASS'), ch('PASS')]);
    assert.strictEqual(r.combined_verdict, 'PRODUCTION READY');
    assert.strictEqual(r.triggered_rule, 2);
  });
  it('Rule 3: any BLOCK → NEEDS WORK', () => {
    const r = aggregate([ch('PASS'), ch('BLOCK'), ch('PASS'), ch('PASS'), ch('PASS')]);
    assert.strictEqual(r.combined_verdict, 'NEEDS WORK');
    assert.strictEqual(r.triggered_rule, 3);
  });
  it('Rule 4: any CONCERNS → NEEDS WORK', () => {
    const r = aggregate([ch('PASS'), ch('CONCERNS'), ch('PASS'), ch('PASS'), ch('PASS')]);
    assert.strictEqual(r.combined_verdict, 'NEEDS WORK');
    assert.strictEqual(r.triggered_rule, 4);
  });
  it('Rule 5: follow_up spawned+confirmed → effective BLOCK → NEEDS WORK', () => {
    const r = aggregate([ch('PASS'), ch('PASS', false, true, true), ch('PASS'), ch('PASS'), ch('PASS')]);
    assert.strictEqual(r.combined_verdict, 'NEEDS WORK');
    assert.strictEqual(r.triggered_rule, 3);
  });
});
