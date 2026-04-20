import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  calculateCost,
  PRICING_TABLE,
  type TokenUsage,
} from '../../src/orchestrator/hooks/token-accounting';

/** 1M input tokens — easy to reason about costs */
const BASE_USAGE: TokenUsage = { input_tokens: 1_000_000, output_tokens: 0 };

/** Full usage with all token types at 1M each */
const FULL_USAGE: TokenUsage = {
  input_tokens: 1_000_000,
  output_tokens: 1_000_000,
  cache_read: 1_000_000,
  cache_create: 1_000_000,
};

describe('calculateCost model-keyed pricing', () => {
  it('defaults to Sonnet pricing when model is omitted', () => {
    const cost = calculateCost(BASE_USAGE);
    assert.strictEqual(cost, 3.0, 'should use Sonnet input rate $3/Mtok');
  });

  it('defaults to Sonnet pricing when model is undefined', () => {
    const cost = calculateCost(BASE_USAGE, undefined);
    assert.strictEqual(cost, 3.0);
  });

  it('uses Haiku pricing for claude-haiku-3-5', () => {
    const cost = calculateCost(BASE_USAGE, 'claude-haiku-3-5');
    assert.strictEqual(cost, 0.8, 'Haiku input rate is $0.80/Mtok');
  });

  it('uses Opus pricing for claude-opus-4-5', () => {
    const cost = calculateCost(BASE_USAGE, 'claude-opus-4-5');
    assert.strictEqual(cost, 15.0, 'Opus input rate is $15/Mtok');
  });

  it('falls back to Sonnet for unknown model strings', () => {
    const cost = calculateCost(BASE_USAGE, 'claude-unknown-99');
    assert.strictEqual(cost, 3.0, 'unknown model should fall back to Sonnet');
  });

  it('falls back to Sonnet for empty string model', () => {
    const cost = calculateCost(BASE_USAGE, '');
    assert.strictEqual(cost, 3.0, 'empty string should fall back to Sonnet');
  });

  it('computes full Haiku cost across all token types', () => {
    const cost = calculateCost(FULL_USAGE, 'claude-haiku-3-5');
    const expected = 0.80 + 4.0 + 0.08 + 1.00; // 5.88
    assert.strictEqual(cost, expected);
  });

  it('computes full Opus cost across all token types', () => {
    const cost = calculateCost(FULL_USAGE, 'claude-opus-4-5');
    const expected = 15.0 + 75.0 + 1.50 + 18.75; // 110.25
    assert.strictEqual(cost, expected);
  });

  it('computes full Sonnet cost across all token types (explicit model)', () => {
    const cost = calculateCost(FULL_USAGE, 'claude-sonnet-4-5');
    const expected = 3.0 + 15.0 + 0.30 + 3.75; // 22.05
    assert.strictEqual(cost, expected);
  });

  it('Sonnet explicit matches Sonnet default (no model)', () => {
    const explicit = calculateCost(FULL_USAGE, 'claude-sonnet-4-5');
    const defaulted = calculateCost(FULL_USAGE);
    assert.strictEqual(explicit, defaulted);
  });
});

describe('PRICING_TABLE export', () => {
  it('contains entries for all three models', () => {
    assert.ok(PRICING_TABLE['claude-sonnet-4-5'], 'Sonnet entry exists');
    assert.ok(PRICING_TABLE['claude-haiku-3-5'], 'Haiku entry exists');
    assert.ok(PRICING_TABLE['claude-opus-4-5'], 'Opus entry exists');
  });

  it('Haiku is cheaper than Sonnet across all rate types', () => {
    const h = PRICING_TABLE['claude-haiku-3-5'];
    const s = PRICING_TABLE['claude-sonnet-4-5'];
    assert.ok(h.input < s.input);
    assert.ok(h.output < s.output);
    assert.ok(h.cache_read < s.cache_read);
    assert.ok(h.cache_create < s.cache_create);
  });

  it('Opus is more expensive than Sonnet across all rate types', () => {
    const o = PRICING_TABLE['claude-opus-4-5'];
    const s = PRICING_TABLE['claude-sonnet-4-5'];
    assert.ok(o.input > s.input);
    assert.ok(o.output > s.output);
    assert.ok(o.cache_read > s.cache_read);
    assert.ok(o.cache_create > s.cache_create);
  });
});
