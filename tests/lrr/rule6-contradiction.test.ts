import { describe, it } from 'node:test';
import assert from 'node:assert';
import { aggregate, ChapterResult } from '../../src/lrr/aggregator';

const mkCh = (
  v: 'PASS' | 'BLOCK' | 'CONCERNS',
  findings: ChapterResult['findings'] = [],
): ChapterResult => ({
  chapter: 'ch',
  verdict: v,
  override_blocks_launch: false,
  findings,
});

describe('Rule 6 – cross-chapter contradiction via related_decision_id', () => {
  it('PASS + BLOCK on same decision_id → BLOCKED rule 6', () => {
    const r = aggregate([
      mkCh('PASS', [{ severity: 'low', description: 'all good', related_decision_id: 'D-42' }]),
      mkCh('BLOCK', [{ severity: 'high', description: 'not good', related_decision_id: 'D-42' }]),
    ]);
    assert.strictEqual(r.combined_verdict, 'BLOCKED');
    assert.strictEqual(r.triggered_rule, 6);
    assert.strictEqual(r.cross_chapter_contradiction, 'D-42');
  });

  it('same verdict on same decision_id → no contradiction', () => {
    const r = aggregate([
      mkCh('PASS', [{ severity: 'low', description: 'fine', related_decision_id: 'D-10' }]),
      mkCh('PASS', [{ severity: 'low', description: 'also fine', related_decision_id: 'D-10' }]),
    ]);
    assert.strictEqual(r.combined_verdict, 'PRODUCTION READY');
    assert.strictEqual(r.triggered_rule, 2);
  });

  it('findings without related_decision_id are ignored by Rule 6', () => {
    const r = aggregate([
      mkCh('PASS', [{ severity: 'low', description: 'identical text' }]),
      mkCh('BLOCK', [{ severity: 'high', description: 'identical text' }]),
    ]);
    // No decision_id → Rule 6 cannot fire; falls through to Rule 3 (BLOCK present)
    assert.strictEqual(r.combined_verdict, 'NEEDS WORK');
    assert.strictEqual(r.triggered_rule, 3);
  });

  it('multiple decision IDs, only one contradicted → still triggers Rule 6', () => {
    const r = aggregate([
      mkCh('PASS', [
        { severity: 'low', description: 'a', related_decision_id: 'D-1' },
        { severity: 'low', description: 'b', related_decision_id: 'D-2' },
      ]),
      mkCh('BLOCK', [
        { severity: 'high', description: 'c', related_decision_id: 'D-2' },
      ]),
      mkCh('PASS', [
        { severity: 'low', description: 'd', related_decision_id: 'D-1' },
      ]),
    ]);
    assert.strictEqual(r.combined_verdict, 'BLOCKED');
    assert.strictEqual(r.triggered_rule, 6);
    assert.strictEqual(r.cross_chapter_contradiction, 'D-2');
  });
});
