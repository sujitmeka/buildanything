import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function checkWriteOwner(filePath: string, currentPhase: string, table: Record<string, string>): { allowed: boolean; reason?: string } {
  const owner = table[filePath];
  if (!owner) return { allowed: false, reason: `${filePath} has no owner — default-deny` };
  if (owner === currentPhase) return { allowed: true };
  return { allowed: false, reason: `${filePath} owned by ${owner}, not ${currentPhase}` };
}

const TABLE: Record<string, string> = {
  'CLAUDE.md': 'phase-1',
  'design-doc.md': 'phase-1',
  'architecture.md': 'phase-2',
  'backend-tasks.md': 'phase-2',
  'quality-targets.json': 'phase-2',
  'visual-design-spec.md': 'phase-3',
  'refs.json': 'phase-2',
  'decisions.jsonl': 'orchestrator-scribe',
};

describe('writer-owner invariant', () => {
  it('P4 case 1: phase-1 can write CLAUDE.md', () => assert.ok(checkWriteOwner('CLAUDE.md', 'phase-1', TABLE).allowed));
  it('P4 case 2: phase-2 cannot write CLAUDE.md', () => assert.equal(checkWriteOwner('CLAUDE.md', 'phase-2', TABLE).allowed, false));
  it('P4 case 3: phase-2 can write architecture.md', () => assert.ok(checkWriteOwner('architecture.md', 'phase-2', TABLE).allowed));
  it('P4 case 4: phase-4 cannot write architecture.md', () => assert.equal(checkWriteOwner('architecture.md', 'phase-4', TABLE).allowed, false));
  it('P4 case 5: orchestrator-scribe can write decisions.jsonl', () => assert.ok(checkWriteOwner('decisions.jsonl', 'orchestrator-scribe', TABLE).allowed));
  it('P4 case 6: phase-4 cannot write decisions.jsonl', () => assert.equal(checkWriteOwner('decisions.jsonl', 'phase-4', TABLE).allowed, false));
  it('P4 case 7: phase-3 can write visual-design-spec.md', () => assert.ok(checkWriteOwner('visual-design-spec.md', 'phase-3', TABLE).allowed));
  it('iOS: phase-4 implementer cannot write project.pbxproj directly', () => assert.equal(checkWriteOwner('project.pbxproj', 'phase-4', TABLE).allowed, false));
});
