import { describe, it } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const iosRow = (id: string, cat: string, agent: string) =>
  JSON.stringify({ id, project_type: 'ios', category: cat, decided_by: agent, ts: Date.now() });

describe('pacely dual-write (iOS)', () => {
  it('markdown and scribe produce identical decisions.jsonl', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pacely-'));
    const rows = ['swiftui-nav', 'storekit-iap', 'healthkit-auth'].map((id, i) =>
      iosRow(id, ['swift-architecture', 'storekit-config', 'healthkit-entitlements'][i], 'ios-swift-architect'));
    const content = rows.join('\n') + '\n';
    writeFileSync(join(dir, 'decisions-md.jsonl'), content);
    writeFileSync(join(dir, 'decisions-scribe.jsonl'), content);
    assert.strictEqual(readFileSync(join(dir, 'decisions-md.jsonl'), 'utf-8'),
                       readFileSync(join(dir, 'decisions-scribe.jsonl'), 'utf-8'));
  });

  it('iOS-specific decision fields preserved', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pacely-'));
    const rows = [iosRow('arch-1', 'swift-architecture', 'ios-swift-architect'),
                  iosRow('store-1', 'storekit-config', 'ios-storekit-specialist')];
    writeFileSync(join(dir, 'decisions.jsonl'), rows.join('\n') + '\n');
    readFileSync(join(dir, 'decisions.jsonl'), 'utf-8').trim().split('\n').forEach(line => {
      const d = JSON.parse(line);
      assert.strictEqual(d.project_type, 'ios');
      assert.ok(d.decided_by.startsWith('ios-'), `unexpected agent: ${d.decided_by}`);
      assert.ok(['swift-architecture', 'storekit-config'].includes(d.category));
    });
  });

  it('ios_features state not affected by dual-write', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pacely-'));
    const state = { schema_version: 1, ios_features: ['swiftui', 'storekit2', 'healthkit'] };
    const snapshot = JSON.stringify(state);
    writeFileSync(join(dir, '.build-state.json'), snapshot);
    writeFileSync(join(dir, 'decisions.jsonl'), iosRow('x', 'swift-architecture', 'ios-swift-architect') + '\n');
    assert.strictEqual(readFileSync(join(dir, '.build-state.json'), 'utf-8'), snapshot);
  });
});
