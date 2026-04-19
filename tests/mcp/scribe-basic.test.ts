import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  scribeDecision,
  validate,
  reset,
  loadCounters,
  type ScribeInput,
} from '../../src/orchestrator/mcp/scribe';

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'scribe-'));
  return join(dir, 'decisions.jsonl');
}

function baseInput(overrides: Partial<ScribeInput> = {}): ScribeInput {
  return {
    phase: '1',
    summary: 'Use DynamoDB',
    decided_by: 'architect',
    impact_level: 'high',
    chosen_approach: 'DynamoDB single-table; pk=tenantId, sk=entityId',
    ref: 'docs/plans/architecture.md#persistence',
    ...overrides,
  };
}

describe('scribe handler', () => {
  beforeEach(() => reset());

  it('creates valid decision row with correct ID format', () => {
    const file = tmpFile();
    const row = scribeDecision(baseInput(), file);
    assert.match(row.decision_id, /^D-1-\d{2}$/);
    assert.equal(row.phase, '1');
    assert.equal(row.decided_by, 'architect');
    assert.equal(row.status, 'open');
    assert.equal(row.ref, 'docs/plans/architecture.md#persistence');
  });

  it('sequential ID allocation across calls in same phase', () => {
    const file = tmpFile();
    const ids = [1, 2, 3].map(
      () => scribeDecision(baseInput({ phase: '2' }), file).decision_id,
    );
    assert.deepEqual(ids, ['D-2-01', 'D-2-02', 'D-2-03']);
  });

  it('rejects invalid impact_level', () => {
    assert.throws(
      () =>
        scribeDecision(
          baseInput({ impact_level: 'invalid' as ScribeInput['impact_level'] }),
          tmpFile(),
        ),
      /Invalid impact_level/,
    );
  });

  it('appends to decisions.jsonl one JSON object per line', () => {
    const file = tmpFile();
    scribeDecision(baseInput({ phase: '3', summary: 's1' }), file);
    scribeDecision(baseInput({ phase: '3', summary: 's2' }), file);
    const lines = readFileSync(file, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 2);
    lines.forEach((l) => assert.doesNotThrow(() => JSON.parse(l)));
  });
});

// ---------------------------------------------------------------------------
// Bug 1 — scribe must reject empty / malformed ref up front
// ---------------------------------------------------------------------------

describe('scribe — ref validation (Bug 1)', () => {
  beforeEach(() => reset());

  it('rejects empty-string ref', () => {
    assert.throws(
      () => scribeDecision(baseInput({ ref: '' }), tmpFile()),
      /Invalid ref/,
    );
  });

  it('rejects ref missing required file extension', () => {
    assert.throws(
      () => scribeDecision(baseInput({ ref: 'docs/plans/architecture' }), tmpFile()),
      /Invalid ref/,
    );
  });

  it('rejects ref with disallowed file extension', () => {
    assert.throws(
      () => scribeDecision(baseInput({ ref: 'docs/notes.txt' }), tmpFile()),
      /Invalid ref/,
    );
  });

  it('accepts valid ref with anchor', () => {
    const file = tmpFile();
    const row = scribeDecision(
      baseInput({ ref: 'docs/plans/architecture.md#persistence/sqlite' }),
      file,
    );
    assert.equal(row.ref, 'docs/plans/architecture.md#persistence/sqlite');
  });

  it('writes the exact ref provided — no empty-string fallback', () => {
    const file = tmpFile();
    const row = scribeDecision(
      baseInput({ ref: 'protocols/decision-log.md' }),
      file,
    );
    const written = JSON.parse(readFileSync(file, 'utf-8').trim());
    assert.equal(written.ref, 'protocols/decision-log.md');
    assert.equal(row.ref, 'protocols/decision-log.md');
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — Phase -1 (iOS bootstrap) must be recordable end-to-end
// ---------------------------------------------------------------------------

describe('scribe — Phase -1 round-trip (Bug 2)', () => {
  beforeEach(() => reset());

  it('accepts phase="-1" and emits a decision_id matching the schema', () => {
    const file = tmpFile();
    const row = scribeDecision(
      baseInput({ phase: '-1', ref: 'docs/plans/design-doc.md#bootstrap' }),
      file,
    );
    assert.equal(row.phase, '-1');
    assert.equal(row.decision_id, 'D-N1-01');
    // Schema pattern from decisions.schema.json (post-fix).
    assert.match(row.decision_id, /^D-N?[0-9]+(\.[0-9]+)?-[0-9]{2,}$/);
  });

  it('round-trips the counter via loadCounters across a fresh process', () => {
    const file = tmpFile();
    scribeDecision(
      baseInput({ phase: '-1', ref: 'docs/plans/design-doc.md#bootstrap' }),
      file,
    );
    scribeDecision(
      baseInput({ phase: '-1', ref: 'docs/plans/design-doc.md#bootstrap' }),
      file,
    );

    // Simulate process restart: drop in-memory counters, reload from disk,
    // and confirm the next allocated ID continues the sequence.
    reset();
    loadCounters(file);
    const next = scribeDecision(
      baseInput({ phase: '-1', ref: 'docs/plans/design-doc.md#bootstrap' }),
      file,
    );
    assert.equal(next.decision_id, 'D-N1-03');
  });

  it('positive phases still encode without the N prefix', () => {
    const file = tmpFile();
    const row = scribeDecision(baseInput({ phase: '2.2' }), file);
    assert.equal(row.decision_id, 'D-2.2-01');
  });

  it('validate() rejects malformed negative phases', () => {
    assert.throws(() => validate(baseInput({ phase: '--1' })), /Invalid phase/);
    assert.throws(() => validate(baseInput({ phase: '-' })), /Invalid phase/);
    assert.throws(() => validate(baseInput({ phase: '-1.' })), /Invalid phase/);
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — `category` is dead; validate must not require it, scribe must not
// emit it, and unknown fields must not leak through.
// ---------------------------------------------------------------------------

describe('scribe — category field is gone (Bug 3)', () => {
  beforeEach(() => reset());

  it('validate() no longer requires category', () => {
    // Calling validate with the new ScribeInput shape (no category field) must
    // not throw — this is the regression that caught Bug 3.
    assert.doesNotThrow(() => validate(baseInput()));
  });

  it('written row contains no category property', () => {
    const file = tmpFile();
    scribeDecision(baseInput(), file);
    const written = JSON.parse(readFileSync(file, 'utf-8').trim());
    assert.equal(
      Object.prototype.hasOwnProperty.call(written, 'category'),
      false,
      'decision row leaked a category field',
    );
  });

  it('output row keys exactly match the schema-required set', () => {
    const file = tmpFile();
    scribeDecision(baseInput(), file);
    const written = JSON.parse(readFileSync(file, 'utf-8').trim());
    const expected = new Set([
      'decision_id',
      'phase',
      'timestamp',
      'decision',
      'chosen_approach',
      'rejected_alternatives',
      'decided_by',
      'ref',
      'status',
    ]);
    const actual = new Set(Object.keys(written));
    assert.deepEqual(actual, expected);
  });

  it('extra unknown fields on input are silently dropped from the row (not echoed back)', () => {
    const file = tmpFile();
    // Cast through unknown to bypass TS — we're proving runtime behavior.
    const sneaky = {
      ...baseInput(),
      category: 'arch',
      bogus: 'should-not-appear',
    } as unknown as ScribeInput;
    scribeDecision(sneaky, file);
    const written = JSON.parse(readFileSync(file, 'utf-8').trim());
    assert.equal(written.category, undefined);
    assert.equal(written.bogus, undefined);
  });

  it('file exists and is non-empty after write', () => {
    const file = tmpFile();
    scribeDecision(baseInput(), file);
    assert.equal(existsSync(file), true);
    assert.notEqual(readFileSync(file, 'utf-8').length, 0);
  });
});
