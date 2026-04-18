// PLACEHOLDER — active when Stage 2 task 2.1.3 wires the default-deny hook
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

type Result = { allowed: boolean; reason?: string };
type Table = Record<string, string>;

const DENY_MSG = 'path not in writer-owner table — please add to phase-graph.yaml or route through scribe MCP';

function checkWritePermission(path: string, table: Table): Result {
  return path in table ? { allowed: true } : { allowed: false, reason: DENY_MSG };
}

describe('writer-owner default-deny policy', () => {
  const table: Table = { 'CLAUDE.md': 'phase-1', 'architecture.md': 'phase-2' };

  it('known path is allowed', () => {
    assert.deepStrictEqual(checkWritePermission('CLAUDE.md', table), { allowed: true });
  });

  it('unknown path is denied with explicit error', () => {
    assert.deepStrictEqual(checkWritePermission('some/random/file.ts', table), { allowed: false, reason: DENY_MSG });
  });

  it('default-deny is fail-closed (empty table denies everything)', () => {
    const result = checkWritePermission('any-file.ts', {});
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, DENY_MSG);
  });
});
