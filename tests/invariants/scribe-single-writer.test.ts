import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function checkScribeAccess(callerType: string, targetFile: string) {
  if (targetFile === 'decisions.jsonl' && callerType !== 'orchestrator-scribe')
    return { denied: true, reason: 'only orchestrator-scribe can write decisions.jsonl' };
  return { denied: false };
}

const denied = ['code-architect', 'engineering-frontend-developer', 'engineering-senior-developer', 'security-reviewer', 'a11y-architect'];

describe('scribe-single-writer', () => {
  for (const caller of denied) {
    it(`${caller} denied`, () => {
      const r = checkScribeAccess(caller, 'decisions.jsonl');
      assert.equal(r.denied, true);
      assert.equal((r as any).reason, 'only orchestrator-scribe can write decisions.jsonl');
    });
  }

  it('orchestrator-scribe allowed', () => {
    const r = checkScribeAccess('orchestrator-scribe', 'decisions.jsonl');
    assert.equal(r.denied, false);
    assert.equal((r as any).reason, undefined);
  });
});
