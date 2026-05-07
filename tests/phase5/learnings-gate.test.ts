import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { learningsGate } from '../../src/orchestrator/learnings-gate';

function makeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'learnings-gate-'));
  mkdirSync(join(dir, 'docs', 'plans'), { recursive: true });
  return dir;
}

describe('learnings gate – #9 audit fix', () => {
  it('fails when file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'learnings-gate-'));
    const r = learningsGate(dir);
    assert.strictEqual(r.pass, false);
    assert.match(r.reason, /not found/);
  });

  it('fails when file is empty', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'docs', 'plans', 'learnings.jsonl'), '');
    const r = learningsGate(dir);
    assert.strictEqual(r.pass, false);
    assert.match(r.reason, /empty/);
  });

  it('fails when file has no valid pattern_type rows', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'docs', 'plans', 'learnings.jsonl'), '{"foo":"bar"}\n');
    const r = learningsGate(dir);
    assert.strictEqual(r.pass, false);
    assert.match(r.reason, /no valid rows/);
  });

  it('passes with valid PITFALL row', () => {
    const dir = makeTmp();
    const row = JSON.stringify({ pattern_type: 'PITFALL', top_issue: 'test', fix_applied: 'fix' });
    writeFileSync(join(dir, 'docs', 'plans', 'learnings.jsonl'), row + '\n');
    const r = learningsGate(dir);
    assert.strictEqual(r.pass, true);
    assert.strictEqual(r.rowCount, 1);
  });

  it('skips malformed lines gracefully', () => {
    const dir = makeTmp();
    const valid = JSON.stringify({ pattern_type: 'PATTERN', top_issue: 'x', fix_applied: 'y' });
    writeFileSync(join(dir, 'docs', 'plans', 'learnings.jsonl'), 'not json\n' + valid + '\n');
    const r = learningsGate(dir);
    assert.strictEqual(r.pass, true);
    assert.strictEqual(r.rowCount, 1);
  });
});
