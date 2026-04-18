import { describe, it } from 'node:test';
import assert from 'node:assert';
import { aggregate, applyStarRule, ChapterResult } from '../../src/lrr/aggregator';

const mkCh = (v: 'PASS'|'BLOCK', findings: ChapterResult['findings'] = []): ChapterResult => ({
  chapter: 'ch', verdict: v, override_blocks_launch: false, findings,
});

describe('⭐⭐ star rule', () => {
  it('triggers when BLOCK has related_decision_id', () => {
    const r = aggregate([mkCh('BLOCK', [{ severity: 'high', description: 'x', related_decision_id: 'D-1' }]), mkCh('PASS')]);
    const sr = applyStarRule(r);
    assert.strictEqual(sr.star_rule_triggered, true);
    assert.deepStrictEqual(sr.star_rule_decision_ids, ['D-1']);
  });
  it('does not trigger when no related_decision_id', () => {
    const r = aggregate([mkCh('BLOCK', [{ severity: 'high', description: 'x' }]), mkCh('PASS')]);
    const sr = applyStarRule(r);
    assert.strictEqual(sr.star_rule_triggered, false);
  });
  it('does not trigger on PRODUCTION READY', () => {
    const r = aggregate([mkCh('PASS'), mkCh('PASS')]);
    const sr = applyStarRule(r);
    assert.strictEqual(sr.star_rule_triggered, false);
  });
});
