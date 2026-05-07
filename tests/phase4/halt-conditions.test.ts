import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkHaltConditions, HaltCondition } from '../../src/orchestrator/halt-conditions';

function makeTmp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'halt-cond-'));
  mkdirSync(join(dir, 'src'), { recursive: true });
  return dir;
}

describe('halt-condition assertions – #12 audit fix', () => {
  it('passes when no conditions file exists', () => {
    const dir = makeTmp();
    const r = checkHaltConditions(dir);
    assert.strictEqual(r.pass, true);
    assert.strictEqual(r.conditions_checked, 0);
  });

  it('passes when no violations found', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'src', 'map.ts'), 'const style = "custom-dark-v1";\n');
    const conditions: HaltCondition[] = [
      { id: 'no-streets', description: 'No default streets style', pattern: 'streets-v2', severity: 'critical' },
    ];
    const r = checkHaltConditions(dir, conditions);
    assert.strictEqual(r.pass, true);
    assert.strictEqual(r.violations.length, 0);
    assert.strictEqual(r.conditions_checked, 1);
  });

  it('detects violation when forbidden pattern is present', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'src', 'map.ts'), 'const style = "streets-v2";\n');
    const conditions: HaltCondition[] = [
      { id: 'no-streets', description: 'No default streets style', pattern: 'streets-v2', severity: 'critical' },
    ];
    const r = checkHaltConditions(dir, conditions);
    assert.strictEqual(r.pass, false);
    assert.strictEqual(r.violations.length, 1);
    assert.strictEqual(r.violations[0].condition_id, 'no-streets');
    assert.match(r.violations[0].match, /streets-v2/);
  });

  it('reports multiple violations across files', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'src', 'a.ts'), 'use("streets-v2");\n');
    writeFileSync(join(dir, 'src', 'b.ts'), 'use("streets-v2");\n');
    const conditions: HaltCondition[] = [
      { id: 'no-streets', description: 'No streets', pattern: 'streets-v2', severity: 'critical' },
    ];
    const r = checkHaltConditions(dir, conditions);
    assert.strictEqual(r.pass, false);
    assert.strictEqual(r.violations.length, 2);
  });

  it('checks multiple conditions independently', () => {
    const dir = makeTmp();
    writeFileSync(join(dir, 'src', 'app.ts'), 'const x = "safe";\n');
    const conditions: HaltCondition[] = [
      { id: 'no-foo', description: 'No foo', pattern: 'FORBIDDEN_FOO', severity: 'high' },
      { id: 'no-bar', description: 'No bar', pattern: 'FORBIDDEN_BAR', severity: 'critical' },
    ];
    const r = checkHaltConditions(dir, conditions);
    assert.strictEqual(r.pass, true);
    assert.strictEqual(r.conditions_checked, 2);
  });
});
