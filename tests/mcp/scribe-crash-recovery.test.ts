import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  scribeDecision,
  reset,
  type ScribeInput,
} from '../../src/orchestrator/mcp/scribe';

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scribe-crash-'));
  return join(dir, 'decisions.jsonl');
}

function baseInput(overrides: Partial<ScribeInput> = {}): ScribeInput {
  return {
    phase: '1',
    summary: 'Use DynamoDB',
    decided_by: 'architect',
    impact_level: 'high',
    chosen_approach: 'DynamoDB single-table',
    ref: 'docs/plans/architecture.md#persistence',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fix 3 — Crash recovery: counter rehydration + atomic write
// ---------------------------------------------------------------------------

describe('scribe — crash recovery (Fix 3)', () => {
  beforeEach(() => reset());

  it('after simulated crash (reset counters), scribeDecision continues the ID sequence', () => {
    const file = tmpFile();

    // Write two decisions in phase 4
    scribeDecision(baseInput({ phase: '4' }), file);
    scribeDecision(baseInput({ phase: '4' }), file);

    // Simulate crash: wipe in-memory counters but leave the file intact
    reset();

    // Next call should auto-rehydrate from disk and continue at 03
    const row = scribeDecision(baseInput({ phase: '4' }), file);
    assert.equal(row.decision_id, 'D-4-03');
  });

  it('after simulated crash, multiple phases rehydrate independently', () => {
    const file = tmpFile();

    scribeDecision(baseInput({ phase: '1' }), file);
    scribeDecision(baseInput({ phase: '1' }), file);
    scribeDecision(baseInput({ phase: '2' }), file);

    // Simulate crash
    reset();

    const r1 = scribeDecision(baseInput({ phase: '1' }), file);
    const r2 = scribeDecision(baseInput({ phase: '2' }), file);
    assert.equal(r1.decision_id, 'D-1-03');
    assert.equal(r2.decision_id, 'D-2-02');
  });

  it('file is valid JSONL after atomic write', () => {
    const file = tmpFile();

    scribeDecision(baseInput({ phase: '1', summary: 'first' }), file);
    scribeDecision(baseInput({ phase: '1', summary: 'second' }), file);

    // Simulate crash + one more write
    reset();
    scribeDecision(baseInput({ phase: '1', summary: 'third' }), file);

    const content = readFileSync(file, 'utf-8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 3);

    // Every line must be valid JSON
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line), `Invalid JSON line: ${line}`);
    }

    // Verify the summaries are in order
    const summaries = lines.map((l) => JSON.parse(l).decision);
    assert.deepEqual(summaries, ['first', 'second', 'third']);
  });

  it('no .tmp file left behind after successful write', () => {
    const file = tmpFile();
    scribeDecision(baseInput(), file);

    const { existsSync } = require('node:fs');
    assert.equal(existsSync(`${file}.tmp`), false);
  });
});
