import { describe, it } from 'node:test';
import assert from 'node:assert';
import { aggregate, ChapterResult } from '../../src/lrr/aggregator';

const ch = (v: 'PASS'|'CONCERNS', fSpawn = false, fConf = false): ChapterResult => ({
  chapter: 'ch', verdict: v, override_blocks_launch: false, findings: [], follow_up_spawned: fSpawn, follow_up_confirmed: fConf,
});

describe('follow-up flow', () => {
  it('spawned + confirmed promotes PASS to effective BLOCK → NEEDS WORK', () => {
    const r = aggregate([ch('PASS', true, true), ch('PASS'), ch('PASS')]);
    assert.strictEqual(r.combined_verdict, 'NEEDS WORK');
    assert.strictEqual(r.triggered_rule, 3);
  });
  it('spawned but NOT confirmed keeps original verdict', () => {
    const r = aggregate([ch('PASS', true, false), ch('PASS'), ch('PASS')]);
    // follow_up_spawned without confirmed does not promote, but spawned blocks Rule 2
    assert.notStrictEqual(r.combined_verdict, 'BLOCKED');
  });
  it('no follow-ups at all → PRODUCTION READY', () => {
    const r = aggregate([ch('PASS'), ch('PASS'), ch('PASS')]);
    assert.strictEqual(r.combined_verdict, 'PRODUCTION READY');
    assert.strictEqual(r.triggered_rule, 2);
  });
});
