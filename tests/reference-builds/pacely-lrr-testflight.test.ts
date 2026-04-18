import { describe, it } from 'node:test';
import assert from 'node:assert';
import { aggregate, applyStarRule, ChapterResult } from '../../src/lrr/aggregator';

const iosCh = (name: string, v: 'PASS'|'BLOCK'|'CONCERNS', findings: ChapterResult['findings'] = []): ChapterResult => ({
  chapter: name, verdict: v, override_blocks_launch: false, findings,
});

describe('Pacely LRR – iOS testflight simulation', () => {
  it('all iOS chapters PASS including eng-quality Maestro → PRODUCTION READY', () => {
    const chapters = [
      iosCh('eng-quality', 'PASS', [{ severity: 'info', description: 'Maestro: 42/42 passed' }]),
      iosCh('app-review-guidelines', 'PASS'),
      iosCh('privacy-nutrition', 'PASS'),
      iosCh('performance-budget', 'PASS'),
      iosCh('accessibility', 'PASS'),
    ];
    const r = applyStarRule(aggregate(chapters));
    assert.strictEqual(r.combined_verdict, 'PRODUCTION READY');
    assert.strictEqual(r.star_rule_triggered, false);
  });
  it('eng-quality BLOCK with decision id triggers star rule', () => {
    const chapters = [
      iosCh('eng-quality', 'BLOCK', [{ severity: 'critical', description: 'Maestro: 30/42 passed', related_decision_id: 'D-EQ-1' }]),
      iosCh('app-review-guidelines', 'PASS'),
      iosCh('privacy-nutrition', 'PASS'),
    ];
    const r = applyStarRule(aggregate(chapters));
    assert.strictEqual(r.combined_verdict, 'NEEDS WORK');
    assert.strictEqual(r.star_rule_triggered, true);
    assert.deepStrictEqual(r.star_rule_decision_ids, ['D-EQ-1']);
  });
  it('mixed CONCERNS across iOS chapters → NEEDS WORK', () => {
    const chapters = [
      iosCh('eng-quality', 'PASS'),
      iosCh('app-review-guidelines', 'CONCERNS'),
      iosCh('performance-budget', 'CONCERNS'),
    ];
    const r = aggregate(chapters);
    assert.strictEqual(r.combined_verdict, 'NEEDS WORK');
    assert.strictEqual(r.triggered_rule, 4);
  });
});
