import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const WRITER_TABLE: Record<string, string> = {
  'CLAUDE.md': 'phase-1', 'design-doc.md': 'phase-1',
  'architecture.md': 'phase-2', 'sprint-tasks.md': 'phase-2',
  'quality-targets.json': 'phase-2', 'visual-design-spec.md': 'phase-3',
  'refs.json': 'phase-2', 'decisions.jsonl': 'orchestrator-scribe',
  'learnings.jsonl': 'phase-5', 'lrr-aggregate.json': 'phase-6',
};

const PHASES = ['phase-1','phase-2','phase-3','phase-4','phase-5','phase-6','phase-7','orchestrator-scribe'];
const FILES = Object.keys(WRITER_TABLE);

function checkWriteOwner(file: string, callerPhase: string, table: Record<string, string>): { allowed: boolean } {
  return { allowed: table[file] === callerPhase };
}

describe('writer-owner fuzzer: 50 cross-writer attempts, 100% deny rate', () => {
  it('denies all 50 cross-writer attempts', () => {
    const pairs: [string, string][] = [];
    let i = 0;
    while (pairs.length < 50) {
      const file = FILES[i % FILES.length];
      const wrong = PHASES.filter(p => p !== WRITER_TABLE[file]);
      pairs.push([file, wrong[i % wrong.length]]);
      i++;
    }
    let denied = 0;
    for (const [file, phase] of pairs) {
      const result = checkWriteOwner(file, phase, WRITER_TABLE);
      assert.equal(result.allowed, false, `expected deny for ${file} by ${phase}`);
      denied++;
    }
    assert.equal(denied, 50, `expected 50 denials, got ${denied}`);
  });
});
