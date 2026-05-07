import { describe, it } from 'node:test';
import assert from 'node:assert';
import { aggregate, validateAggregateResult, ChapterResult, AggregateResult } from '../../src/lrr/aggregator';

const mkCh = (v: 'PASS' | 'BLOCK' | 'CONCERNS', chapter = 'ch'): ChapterResult => ({
  chapter, verdict: v, override_blocks_launch: false, findings: [],
});

describe('verdict validation – #7 audit fix', () => {
  it('rejects unknown chapter verdict', () => {
    assert.throws(
      () => aggregate([{ chapter: 'ch', verdict: 'CONDITIONAL_SHIP' as any, override_blocks_launch: false, findings: [] }]),
      /Invalid chapter verdict "CONDITIONAL_SHIP"/,
    );
  });

  it('rejects unknown combined_verdict in validateAggregateResult', () => {
    const fake: AggregateResult = {
      combined_verdict: 'CONDITIONAL_SHIP' as any,
      triggered_rule: 99,
      chapters: [mkCh('PASS')],
    };
    assert.throws(() => validateAggregateResult(fake), /Invalid combined_verdict/);
  });

  it('rejects softening BLOCK to PRODUCTION READY', () => {
    const fake: AggregateResult = {
      combined_verdict: 'PRODUCTION READY',
      triggered_rule: 2,
      chapters: [mkCh('PASS'), mkCh('BLOCK')],
    };
    assert.throws(() => validateAggregateResult(fake), /BLOCK cannot be softened/);
  });

  it('BLOCK chapter always produces NEEDS WORK or BLOCKED', () => {
    const r = aggregate([mkCh('PASS'), mkCh('BLOCK'), mkCh('PASS')]);
    assert.ok(
      r.combined_verdict === 'NEEDS WORK' || r.combined_verdict === 'BLOCKED',
      `Expected NEEDS WORK or BLOCKED, got ${r.combined_verdict}`,
    );
    // Must not throw
    validateAggregateResult(r);
  });

  it('all PASS produces PRODUCTION READY and passes validation', () => {
    const r = aggregate([mkCh('PASS'), mkCh('PASS'), mkCh('PASS')]);
    assert.strictEqual(r.combined_verdict, 'PRODUCTION READY');
    validateAggregateResult(r);
  });
});
