import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(
  readFileSync(resolve(__dirname, '../../protocols/state-schema.json'), 'utf-8')
);

const phaseSummaryDef = schema.$defs?.phase_summary;

describe('phase_summaries schema', () => {
  it('has a phase_summary definition in $defs', () => {
    assert.ok(phaseSummaryDef, 'phase_summary missing from $defs');
  });

  it('has phase_summaries in properties', () => {
    assert.ok(schema.properties.phase_summaries, 'phase_summaries missing from properties');
  });

  it('phase_summaries is NOT in the required array', () => {
    assert.ok(!schema.required.includes('phase_summaries'));
  });

  it('phase_summary has correct required fields', () => {
    assert.deepStrictEqual(
      phaseSummaryDef.required,
      ['phase', 'completed_at', 'artifacts', 'decisions', 'status']
    );
  });

  it('decisions has maxLength 300', () => {
    assert.equal(phaseSummaryDef.properties.decisions.maxLength, 300);
  });

  it('carry_forward has maxLength 200', () => {
    assert.equal(phaseSummaryDef.properties.carry_forward.maxLength, 200);
  });

  it('status enum contains exactly approved, approved_with_concerns, auto_approved', () => {
    assert.deepStrictEqual(
      phaseSummaryDef.properties.status.enum,
      ['approved', 'approved_with_concerns', 'auto_approved']
    );
  });
});
