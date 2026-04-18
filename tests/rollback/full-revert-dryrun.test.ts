import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const makeState = (extra = {}) => ({ schema_version: 1, dispatch_count: 7, phase: 3, step: "3.2", ...extra });

describe('rollback dry-run (G4)', () => {
  it('SDK=off reads partial-migration state without corruption', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rollback-'));
    const file = join(dir, '.build-state.json');
    const state = makeState();
    writeFileSync(file, JSON.stringify(state));
    process.env.BUILDANYTHING_SDK = 'off';
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    assert.deepStrictEqual(parsed, state);
    delete process.env.BUILDANYTHING_SDK;
  });

  it('resume picks up at correct phase after flag flip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rollback-'));
    const file = join(dir, '.build-state.json');
    const state = makeState({ resume_point: { phase: 4, step: '4.1' } });
    writeFileSync(file, JSON.stringify(state));
    process.env.BUILDANYTHING_SDK = 'off';
    const parsed = JSON.parse(readFileSync(file, 'utf-8'));
    assert.deepStrictEqual(parsed.resume_point, { phase: 4, step: '4.1' });
    delete process.env.BUILDANYTHING_SDK;
  });

  it('no state mutation from SDK=off flip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rollback-'));
    const file = join(dir, '.build-state.json');
    const state = makeState({ resume_point: { phase: 4, step: '4.1' } });
    const snapshot = JSON.stringify(state);
    writeFileSync(file, snapshot);
    process.env.BUILDANYTHING_SDK = 'off';
    assert.strictEqual(readFileSync(file, 'utf-8'), snapshot);
    delete process.env.BUILDANYTHING_SDK;
  });
});
