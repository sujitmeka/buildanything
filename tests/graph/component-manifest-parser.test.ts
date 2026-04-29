import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractComponentManifest } from '../../src/graph/parser/component-manifest.js';
import type {
  ComponentManifestEntryNode,
  ComponentSlotNode,
  GraphFragment,
} from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function parseFixture(name: string) {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  return extractComponentManifest({ mdPath: p, mdContent: md });
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function nodesOfType<T extends { entity_type: string }>(
  fragment: GraphFragment,
  type: T['entity_type'],
): T[] {
  return fragment.nodes.filter((n): n is T & typeof n => n.entity_type === type) as T[];
}

describe('component-manifest parser — valid fixtures', () => {
  it('marketplace web manifest: ≥15 entries, ≥4 hard_gate, ≥1 manifest-gap (tbd library, fallback_plan set, hard_gate=false)', () => {
    const result = parseFixture('component-manifest-marketplace.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);

    const entries = nodesOfType<ComponentManifestEntryNode>(result.fragment, 'component_manifest_entry');
    assert.ok(entries.length >= 15, `expected ≥15 entries, got ${entries.length}`);

    const hardGated = entries.filter((e) => e.hard_gate === true);
    assert.ok(hardGated.length >= 4, `expected ≥4 hard_gate entries, got ${hardGated.length}`);

    const tbd = entries.find((e) => e.library === 'tbd');
    assert.ok(tbd, 'expected at least one tbd library entry');
    assert.ok(tbd.fallback_plan !== undefined, 'tbd entry should have fallback_plan');
    assert.equal(tbd.hard_gate, false, 'tbd entry should have hard_gate=false');
  });

  it('iOS saas manifest: ≥10 entries, ≥3 hard_gate, all use SwiftUI-family libraries', () => {
    const result = parseFixture('component-manifest-ios-saas.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);

    const entries = nodesOfType<ComponentManifestEntryNode>(result.fragment, 'component_manifest_entry');
    assert.ok(entries.length >= 10, `expected ≥10 entries, got ${entries.length}`);

    const hardGated = entries.filter((e) => e.hard_gate === true);
    assert.ok(hardGated.length >= 3, `expected ≥3 hard_gate entries, got ${hardGated.length}`);

    const swiftuiFamily = new Set(['swiftui', 'swiftui-charts']);
    for (const e of entries) {
      assert.ok(swiftuiFamily.has(e.library), `expected SwiftUI-family library, got "${e.library}" for slot "${e.slot}"`);
    }
  });

  it('marketplace: slot__hero and manifest_entry__hero both present, with one slot_filled_by edge between them', () => {
    const result = parseFixture('component-manifest-marketplace.md');
    assert.ok(result.fragment);

    const nodeIds = new Set(result.fragment.nodes.map((n) => n.id));
    assert.ok(nodeIds.has('slot__hero'), 'expected slot__hero node');
    assert.ok(nodeIds.has('manifest_entry__hero'), 'expected manifest_entry__hero node');

    const filledByEdges = result.fragment.edges.filter(
      (e) => e.relation === 'slot_filled_by' && e.source === 'slot__hero' && e.target === 'manifest_entry__hero',
    );
    assert.equal(filledByEdges.length, 1);
  });
});

describe('component-manifest parser — edge cases', () => {
  it('two rows with slot "card" and "Card" (case-different) → ok:false, error cites duplicate slot', () => {
    const md = [
      '| Slot | Library | Variant | Source ref | Notes |',
      '|------|---------|---------|------------|-------|',
      '| card | shadcn | Card | — | basic |',
      '| Card | shadcn | Card.outline | — | outline |',
    ].join('\n');
    const result = extractComponentManifest({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, false);
    const mentionsDuplicate = result.errors.some((e) => /Duplicate slot/i.test(e.message));
    assert.ok(mentionsDuplicate, 'expected error citing duplicate slot');
  });

  it('HARD-GATE markers [HG], [hg], [HARD-GATE], (HG) all parse to hard_gate=true', () => {
    const md = [
      '| Slot | Library | Variant | Source ref | Notes |',
      '|------|---------|---------|------------|-------|',
      '| slot1 | shadcn | Card | — | [HG] note1 |',
      '| slot2 | shadcn | Card | — | [hg] note2 |',
      '| slot3 | shadcn | Card | — | [HARD-GATE] note3 |',
      '| slot4 | shadcn | Card | — | (HG) note4 |',
    ].join('\n');
    const result = extractComponentManifest({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const entries = nodesOfType<ComponentManifestEntryNode>(result.fragment, 'component_manifest_entry');
    assert.equal(entries.length, 4);
    for (const e of entries) {
      assert.equal(e.hard_gate, true, `expected hard_gate=true for ${e.slot}`);
    }
  });

  it('gap row (tbd | tbd) with [HG] in notes → hard_gate=false; [HG] text stripped from fallback_plan', () => {
    const md = [
      '| Slot | Library | Variant | Source ref | Notes |',
      '|------|---------|---------|------------|-------|',
      '| foo | tbd | tbd | — | [HG] some fallback plan |',
    ].join('\n');
    const result = extractComponentManifest({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const entries = nodesOfType<ComponentManifestEntryNode>(result.fragment, 'component_manifest_entry');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].hard_gate, false, 'tbd row should have hard_gate=false');
    assert.ok(entries[0].fallback_plan !== undefined, 'should have fallback_plan');
    assert.ok(!entries[0].fallback_plan!.includes('[HG]'), 'fallback_plan should not contain [HG]');
    assert.equal(entries[0].fallback_plan, 'some fallback plan');
  });

  it('empty manifest file (no tables) → ok:false', () => {
    const result = extractComponentManifest({ mdPath: 'inline.md', mdContent: '# Empty\n\nNo tables here.\n' });
    assert.equal(result.ok, false);
  });

  it('table with 4 columns instead of 5 → ok:false', () => {
    const md = [
      '| Slot | Library | Variant | Notes |',
      '|------|---------|---------|-------|',
      '| hero | shadcn | Card | basic |',
    ].join('\n');
    const result = extractComponentManifest({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, false);
  });

  it('multi-table file (Web + iOS sections) — both tables parsed, slot dedup is global', () => {
    const md = [
      '## Web slots',
      '',
      '| Slot | Library | Variant | Source ref | Notes |',
      '|------|---------|---------|------------|-------|',
      '| hero | shadcn | Card | — | web hero |',
      '| nav | shadcn | Nav | — | web nav |',
      '',
      '## iOS slots',
      '',
      '| Slot | Library | Variant | Source ref | Notes |',
      '|------|---------|---------|------------|-------|',
      '| tab-bar | swiftui | TabView | — | ios tab |',
      '| list-row | swiftui | List | — | ios list |',
    ].join('\n');
    const result = extractComponentManifest({ mdPath: 'inline.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);

    const entries = nodesOfType<ComponentManifestEntryNode>(result.fragment, 'component_manifest_entry');
    assert.equal(entries.length, 4, 'expected 4 total entries from both tables');

    const slots = nodesOfType<ComponentSlotNode>(result.fragment, 'component_slot');
    const slotNames = new Set(slots.map((s) => s.slot_name));
    assert.equal(slotNames.size, 4, 'expected 4 unique slots across both tables');
  });
});

describe('component-manifest parser — determinism', () => {
  it('parsing marketplace twice produces byte-identical fragment (modulo produced_at)', () => {
    const a = parseFixture('component-manifest-marketplace.md');
    const b = parseFixture('component-manifest-marketplace.md');
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _ax, ...aRest } = a.fragment;
    const { produced_at: _bx, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });
});
