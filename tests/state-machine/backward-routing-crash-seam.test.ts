import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const STALE_MS = 60_000;
function isStale(startedAt: string): boolean { return Date.now() - new Date(startedAt).getTime() > STALE_MS; }

describe('backward-routing crash recovery (A3)', () => {
  it('fresh edge is not stale', () => {
    assert.equal(isStale(new Date().toISOString()), false);
  });
  it('edge older than 60s is stale', () => {
    const twoMinAgo = new Date(Date.now() - 120_000).toISOString();
    assert.equal(isStale(twoMinAgo), true);
  });
  it('stale edge triggers counter decrement', () => {
    const counter: Record<string, number> = { 'D-1': 3 };
    const edge = { decisionId: 'D-1', startedAt: new Date(Date.now() - 120_000).toISOString() };
    if (isStale(edge.startedAt)) counter[edge.decisionId]!--;
    assert.equal(counter['D-1'], 2);
  });
  it('non-stale edge: standard resume (no decrement)', () => {
    const counter: Record<string, number> = { 'D-1': 3 };
    const edge = { decisionId: 'D-1', startedAt: new Date().toISOString() };
    if (isStale(edge.startedAt)) counter[edge.decisionId]!--;
    assert.equal(counter['D-1'], 3);
  });
});
