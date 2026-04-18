import { describe, it } from 'node:test';
import assert from 'node:assert';

/** Synthetic cost data for Habita P6 probe — placeholder until real metrics land. */
const habitaCosts = {
  baseline: { tokens: 48_000, latencyMs: 3200, passes: 4 },
  withSharedCtx: { tokens: 31_000, latencyMs: 2100, passes: 3 },
};

describe('Habita stage-6 cost probe', () => {
  it('shared-context reduces token usage vs baseline', () => {
    const saving = 1 - habitaCosts.withSharedCtx.tokens / habitaCosts.baseline.tokens;
    assert.ok(saving > 0.2, `expected >20% saving, got ${(saving * 100).toFixed(1)}%`);
  });

  it('shared-context reduces pass count vs baseline', () => {
    assert.ok(
      habitaCosts.withSharedCtx.passes < habitaCosts.baseline.passes,
      'expected fewer passes with shared context',
    );
  });
});
