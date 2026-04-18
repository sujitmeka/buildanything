import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const VALID_IMPACTS = ['low', 'medium', 'high', 'critical'] as const;
type Impact = (typeof VALID_IMPACTS)[number];
const counters: Record<string, number> = {};

function scribeDecision(
  { phase, category, summary, decided_by, impact_level }: { phase: string; category: string; summary: string; decided_by: string; impact_level: string },
  file?: string
) {
  if (!VALID_IMPACTS.includes(impact_level as Impact)) throw new Error(`Invalid impact_level: ${impact_level}`);
  const key = phase;
  counters[key] = (counters[key] ?? 0) + 1;
  const row = { id: `D-${phase}-${String(counters[key]).padStart(2, '0')}`, phase, category, summary, decided_by, impact_level };
  if (file) writeFileSync(file, JSON.stringify(row) + '\n', { flag: 'a' });
  return row;
}

describe('scribe', () => {
  it('creates valid decision row with correct ID format', () => {
    counters['1'] = 0;
    const row = scribeDecision({ phase: '1', category: 'arch', summary: 'Use DynamoDB', decided_by: 'architect', impact_level: 'high' });
    assert.match(row.id, /^D-\d+-\d{2}$/);
    assert.equal(row.category, 'arch');
    assert.equal(row.decided_by, 'architect');
  });

  it('sequential ID allocation', () => {
    counters['2'] = 0;
    const ids = [1, 2, 3].map(() => scribeDecision({ phase: '2', category: 'api', summary: 's', decided_by: 'dev', impact_level: 'low' }).id);
    assert.deepEqual(ids, ['D-2-01', 'D-2-02', 'D-2-03']);
  });

  it('rejects invalid impact_level', () => {
    assert.throws(() => scribeDecision({ phase: '1', category: 'x', summary: 'x', decided_by: 'x', impact_level: 'invalid' }), /Invalid impact_level/);
  });

  it('appends to decisions.jsonl', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribe-'));
    const file = join(dir, 'decisions.jsonl');
    counters['3'] = 0;
    scribeDecision({ phase: '3', category: 'a', summary: 's1', decided_by: 'd', impact_level: 'medium' }, file);
    scribeDecision({ phase: '3', category: 'b', summary: 's2', decided_by: 'd', impact_level: 'critical' }, file);
    const lines = readFileSync(file, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 2);
    lines.forEach(l => assert.doesNotThrow(() => JSON.parse(l)));
  });
});
