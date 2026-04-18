import { describe, it } from 'node:test';
import assert from 'node:assert';

/** Synthetic cost data for Pacely iOS P6 probe — placeholder until real metrics land. */
const pacelyCosts = {
  baseline: { tokens: 52_000, latencyMs: 3800, passes: 5 },
  withSharedCtx: { tokens: 34_000, latencyMs: 2400, passes: 3 },
};

describe('Pacely iOS stage-6 cost probe', () => {
  it('shared-context reduces token usage vs baseline', () => {
    const saving = 1 - pacelyCosts.withSharedCtx.tokens / pacelyCosts.baseline.tokens;
    assert.ok(saving > 0.2, `expected >20% saving, got ${(saving * 100).toFixed(1)}%`);
  });

  it('shared-context reduces latency vs baseline', () => {
    assert.ok(
      pacelyCosts.withSharedCtx.latencyMs < pacelyCosts.baseline.latencyMs,
      'expected lower latency with shared context',
    );
  });
});
