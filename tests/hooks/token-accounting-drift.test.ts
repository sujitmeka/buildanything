import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import {
  recordUsage,
  reset,
  getCumulativeCost,
  calculateCost,
} from '../../src/orchestrator/hooks/token-accounting';

const USAGE = { input_tokens: 1_000_000, output_tokens: 0 }; // $3.00 per call

let tmp: string;

beforeEach(() => {
  reset();
  tmp = mkdtempSync(join(tmpdir(), 'ta-drift-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('cumulativeCost cross-build drift', () => {
  it('drifts when reset() is NOT called between builds', () => {
    const log = join(tmp, 'build-log.md');

    // --- Build 1 ---
    const b1 = recordUsage(log, { phase: 1, step: '1.1', usage: USAGE });
    assert.strictEqual(b1.cumulative_usd, 3);

    // --- Build 2 (no reset) ---
    const b2 = recordUsage(log, { phase: 1, step: '1.1', usage: USAGE });
    // Without reset, cumulative carries over → $6 instead of $3
    assert.strictEqual(b2.cumulative_usd, 6, 'cumulative drifted across builds');
  });

  it('does NOT drift when reset() is called between builds', () => {
    const log = join(tmp, 'build-log.md');

    // --- Build 1 ---
    const b1 = recordUsage(log, { phase: 1, step: '1.1', usage: USAGE });
    assert.strictEqual(b1.cumulative_usd, 3);

    // --- Build 2 (with reset) ---
    reset();
    const b2 = recordUsage(log, { phase: 1, step: '1.1', usage: USAGE });
    assert.strictEqual(b2.cumulative_usd, 3, 'cumulative restarted after reset');
  });
});

describe('startingCost parameter', () => {
  it('seeds cumulative from a persisted value', () => {
    const log = join(tmp, 'build-log.md');
    const persistedCost = 1.5; // e.g. read from a previous build-log

    const entry = recordUsage(
      log,
      { phase: 2, step: '2.1', usage: USAGE },
      persistedCost,
    );

    assert.strictEqual(entry.cumulative_usd, 4.5, '1.5 persisted + 3.0 new');
    assert.strictEqual(getCumulativeCost(), 4.5, 'module state updated');
  });

  it('defaults to current cumulativeCost when omitted (backward compat)', () => {
    const log = join(tmp, 'build-log.md');

    // First call seeds from 0
    recordUsage(log, { phase: 1, step: '1.1', usage: USAGE });
    // Second call should default to current cumulative (3.0)
    const second = recordUsage(log, { phase: 1, step: '1.2', usage: USAGE });
    assert.strictEqual(second.cumulative_usd, 6);
  });

  it('explicit startingCost=0 restarts accumulation', () => {
    const log = join(tmp, 'build-log.md');

    recordUsage(log, { phase: 1, step: '1.1', usage: USAGE }); // cumulative = 3
    const fresh = recordUsage(
      log,
      { phase: 1, step: '1.2', usage: USAGE },
      0,
    );
    assert.strictEqual(fresh.cumulative_usd, 3, 'restarted from 0');
  });
});

describe('calculateCost', () => {
  it('computes correct cost for input-only usage', () => {
    assert.strictEqual(calculateCost(USAGE), 3);
  });

  it('includes cache pricing', () => {
    const cost = calculateCost({
      input_tokens: 0,
      output_tokens: 0,
      cache_read: 1_000_000,
      cache_create: 1_000_000,
    });
    // 0.30 + 3.75 = 4.05
    assert.strictEqual(cost, 4.05);
  });
});
