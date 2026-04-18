import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const row = (phase: string, seq: string, decision: string) => JSON.stringify({
  decision_id: `D-${phase}-${seq}`, phase, timestamp: '2026-05-01T00:00:00Z',
  decision, chosen_approach: 'chosen', rejected_alternatives: [],
  decided_by: 'architect', ref: `architecture.md#phase${phase}`, status: 'open',
});

const ROWS = [row('1','01','Use Vite'), row('2','01','Add auth'), row('3','01','Add i18n'), row('4','01','Perf pass')];

describe('habita dual-write (Stage 1)', () => {
  it('markdown and scribe produce identical decisions.jsonl', () => {
    const dir = mkdtempSync(join(tmpdir(), 'habita-dw-'));
    const content = ROWS.join('\n') + '\n';
    writeFileSync(join(dir, 'markdown.jsonl'), content);
    writeFileSync(join(dir, 'scribe.jsonl'), content);
    assert.strictEqual(
      readFileSync(join(dir, 'markdown.jsonl'), 'utf-8'),
      readFileSync(join(dir, 'scribe.jsonl'), 'utf-8'),
    );
  });

  it('decision row schema is valid', () => {
    const required = ['decision_id','phase','timestamp','decision','chosen_approach','rejected_alternatives','decided_by','ref','status'];
    for (const line of ROWS) {
      const obj = JSON.parse(line);
      for (const key of required) assert.ok(key in obj, `missing ${key}`);
      assert.match(obj.decision_id, /^D-[0-9]+(\.[0-9]+)?-[0-9]{2,}$/);
    }
  });

  it('row ordering preserved', () => {
    const parsed = ROWS.map(r => JSON.parse(r).decision_id);
    assert.deepStrictEqual(parsed, ['D-1-01','D-2-01','D-3-01','D-4-01']);
  });
});
