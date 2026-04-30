import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractProductSpec } from '../../src/graph/parser/product-spec.js';
import { extractDesignMd } from '../../src/graph/parser/design-md.js';
import { extractComponentManifest } from '../../src/graph/parser/component-manifest.js';
import {
  loadAllGraphs,
  queryDna,
  queryFeature,
  queryManifest,
  saveGraph,
} from '../../src/graph/storage/index.js';
import type { GraphFragment } from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const tmpDirs: string[] = [];

function newTmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'graph-slice2-'));
  tmpDirs.push(d);
  return d;
}

after(() => {
  for (const d of tmpDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
});

function parseProductSpec(name: string): GraphFragment {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  const result = extractProductSpec({ mdPath: p, mdContent: md });
  if (!result.ok || !result.fragment) throw new Error(`fixture ${name} failed to parse`);
  return result.fragment;
}

function parseDesignMd(name: string): GraphFragment {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  const result = extractDesignMd({ mdPath: p, mdContent: md });
  if (!result.ok || !result.fragment) throw new Error(`fixture ${name} failed to parse`);
  return result.fragment;
}

function parseManifest(name: string): GraphFragment {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  const result = extractComponentManifest({ mdPath: p, mdContent: md });
  if (!result.ok || !result.fragment) throw new Error(`fixture ${name} failed to parse`);
  return result.fragment;
}

describe('queryDna', () => {
  it('Slice 1-only fragment (no design_doc_root) returns null', () => {
    const fragment = parseProductSpec('marketplace-product-spec.md');
    const result = queryDna(fragment);
    assert.equal(result, null);
  });

  it('marketplace DESIGN.md fragment returns DnaQueryResult with axes in canonical order', () => {
    const fragment = parseDesignMd('design-md-pass1-marketplace.md');
    const result = queryDna(fragment);
    assert.ok(result);
    assert.equal(result.axes.length, 7);
    assert.equal(result.axes[0].name, 'scope');
    assert.equal(result.axes[6].name, 'copy');
    const names = result.axes.map((a) => a.name);
    assert.deepStrictEqual(names, ['scope', 'density', 'character', 'material', 'motion', 'type', 'copy']);
  });

  it('lint_status is null when lint-status.json does not exist', () => {
    const fragment = parseDesignMd('design-md-pass1-marketplace.md');
    const tmp = newTmp();
    const result = queryDna(fragment, tmp);
    assert.ok(result);
    assert.equal(result.lint_status, null);
  });

  it('lint_status reflects the file value when lint-status.json exists', () => {
    const tmp = newTmp();
    const lintDir = join(tmp, '.buildanything', 'graph');
    mkdirSync(lintDir, { recursive: true });
    writeFileSync(join(lintDir, 'lint-status.json'), JSON.stringify({ status: 'warn', at: '2026-04-28T00:00:00Z', source: 'lint' }));

    const fragment = parseDesignMd('design-md-pass1-marketplace.md');
    const result = queryDna(fragment, tmp);
    assert.ok(result);
    assert.equal(result.lint_status, 'warn');
  });

  it('lint_status is null when lint-status.json is malformed JSON', () => {
    const tmp = newTmp();
    const lintDir = join(tmp, '.buildanything', 'graph');
    mkdirSync(lintDir, { recursive: true });
    writeFileSync(join(lintDir, 'lint-status.json'), '{not json');

    const fragment = parseDesignMd('design-md-pass1-marketplace.md');
    const result = queryDna(fragment, tmp);
    assert.ok(result);
    assert.equal(result.lint_status, null);
  });
});

describe('queryManifest', () => {
  it('no-manifest fragment returns null', () => {
    const fragment = parseDesignMd('design-md-pass1-marketplace.md');
    const result = queryManifest(fragment);
    assert.equal(result, null);
  });

  it('manifest fragment, no slot arg → all entries returned, sorted by slot, with by_slot map', () => {
    const fragment = parseManifest('component-manifest-marketplace.md');
    const result = queryManifest(fragment);
    assert.ok(result);
    assert.ok(result.entries.length > 0);

    // Verify sorted by slot ascending
    for (let i = 0; i < result.entries.length - 1; i++) {
      assert.ok(
        result.entries[i].slot <= result.entries[i + 1].slot,
        `entries not sorted: "${result.entries[i].slot}" > "${result.entries[i + 1].slot}"`,
      );
    }

    // Verify by_slot contains every entry's slot
    for (const e of result.entries) {
      assert.ok(e.slot in result.by_slot, `by_slot missing key "${e.slot}"`);
    }
  });

  it('queryManifest with slot="hero" returns single-entry result', () => {
    const fragment = parseManifest('component-manifest-marketplace.md');
    const result = queryManifest(fragment, 'hero');
    assert.ok(result);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].slot, 'hero');
  });

  it('queryManifest with slot="nonexistent" returns empty-shape (NOT null)', () => {
    const fragment = parseManifest('component-manifest-marketplace.md');
    const result = queryManifest(fragment, 'definitely-not-a-slot');
    assert.ok(result !== null, 'expected non-null result for unknown slot when entries exist');
    assert.equal(result.entries.length, 0);
    assert.equal(Object.keys(result.by_slot).length, 0);
  });
});

describe('loadAllGraphs', () => {
  it('empty .buildanything/graph/ directory returns null', () => {
    const tmp = newTmp();
    mkdirSync(join(tmp, '.buildanything', 'graph'), { recursive: true });
    assert.equal(loadAllGraphs(tmp), null);
  });

  it('with only slice-1.json present, loads as schema buildanything-slice-1', () => {
    const tmp = newTmp();
    const fragment = parseProductSpec('marketplace-product-spec.md');
    saveGraph(tmp, fragment);
    const loaded = loadAllGraphs(tmp);
    assert.ok(loaded);
    assert.equal(loaded.schema, 'buildanything-slice-1');
    assert.equal(loaded.source_file, '<merged>');
  });

  it('with both slice-1.json and slice-2-dna.json, schema escalates to buildanything-slice-2 and nodes merge', () => {
    const tmp = newTmp();
    const slice1 = parseProductSpec('marketplace-product-spec.md');
    const slice2 = parseDesignMd('design-md-pass1-marketplace.md');
    saveGraph(tmp, slice1, 'slice-1.json');
    saveGraph(tmp, slice2, 'slice-2-dna.json');

    const loaded = loadAllGraphs(tmp);
    assert.ok(loaded);
    assert.equal(loaded.schema, 'buildanything-slice-2');
    assert.equal(loaded.nodes.length, slice1.nodes.length + slice2.nodes.length);
    assert.equal(loaded.source_file, '<merged>');
  });

  it('duplicate node id across files: last-write-wins, no throw', () => {
    const tmp = newTmp();
    const frag1: GraphFragment = {
      version: 1, schema: 'buildanything-slice-1',
      source_file: 'a.md', source_sha: '0'.repeat(64),
      produced_at: '2026-04-28T00:00:00.000Z',
      nodes: [{
        id: 'persona__alice', label: 'Alice-v1', entity_type: 'persona',
        source_file: 'a.md', confidence: 'EXTRACTED',
        description: 'v1', role: 'user', is_primary: true, primary_jtbd: 'do thing',
      }],
      edges: [],
    };
    const frag2: GraphFragment = {
      version: 1, schema: 'buildanything-slice-1',
      source_file: 'b.md', source_sha: '1'.repeat(64),
      produced_at: '2026-04-28T00:00:01.000Z',
      nodes: [{
        id: 'persona__alice', label: 'Alice-v2', entity_type: 'persona',
        source_file: 'b.md', confidence: 'EXTRACTED',
        description: 'v2', role: 'user', is_primary: true, primary_jtbd: 'do thing',
      }],
      edges: [],
    };
    saveGraph(tmp, frag1, 'slice-1.json');
    saveGraph(tmp, frag2, 'slice-x.json');

    const loaded = loadAllGraphs(tmp);
    assert.ok(loaded);
    const aliceNodes = loaded.nodes.filter((n) => n.id === 'persona__alice');
    assert.equal(aliceNodes.length, 1, 'duplicate id should appear once');
    // slice-x.json sorts after slice-1.json, so v2 wins
    assert.equal(aliceNodes[0].label, 'Alice-v2');
  });
});

describe('saveGraph extension', () => {
  it('saveGraph(projectDir, fragment, "slice-2-dna.json") writes target file; existing slice-1.json untouched; round-trip works', () => {
    const tmp = newTmp();
    const slice1 = parseProductSpec('marketplace-product-spec.md');
    const slice2 = parseDesignMd('design-md-pass1-marketplace.md');

    saveGraph(tmp, slice1);
    saveGraph(tmp, slice2, 'slice-2-dna.json');

    const graphDir = join(tmp, '.buildanything', 'graph');
    assert.ok(existsSync(join(graphDir, 'slice-1.json')));
    assert.ok(existsSync(join(graphDir, 'slice-2-dna.json')));

    // Verify slice-1.json is untouched
    const rawSlice1 = JSON.parse(readFileSync(join(graphDir, 'slice-1.json'), 'utf-8')) as GraphFragment;
    assert.equal(rawSlice1.source_file, slice1.source_file);

    // Round-trip via loadAllGraphs
    const merged = loadAllGraphs(tmp);
    assert.ok(merged);
    assert.ok(merged.nodes.length >= slice1.nodes.length + slice2.nodes.length);
  });
});

describe('Slice 1 + Slice 2 unified view (logical scenarios)', () => {
  it('parse product-spec → save slice-1 → parse DESIGN.md → save slice-2-dna → loadAllGraphs lets BO query both queryFeature AND queryDna', () => {
    const tmp = newTmp();
    const slice1 = parseProductSpec('marketplace-product-spec.md');
    saveGraph(tmp, slice1, 'slice-1.json');
    const slice2 = parseDesignMd('design-md-pass1-marketplace.md');
    saveGraph(tmp, slice2, 'slice-2-dna.json');

    const merged = loadAllGraphs(tmp);
    assert.ok(merged);

    const featureResult = queryFeature(merged, 'feature__order-placement');
    assert.ok(featureResult, 'queryFeature should return non-null for order-placement');

    const dnaResult = queryDna(merged, tmp);
    assert.ok(dnaResult, 'queryDna should return non-null');
    assert.equal(dnaResult.axes.length, 7);
  });

  it('re-indexing DESIGN.md (Pass 2 added) overwrites slice-2-dna.json without touching slice-1.json', () => {
    const tmp = newTmp();
    const slice1 = parseProductSpec('marketplace-product-spec.md');
    saveGraph(tmp, slice1, 'slice-1.json');

    const graphDir = join(tmp, '.buildanything', 'graph');
    const slice1Snapshot = readFileSync(join(graphDir, 'slice-1.json'), 'utf-8');

    // First slice-2 write
    const slice2a = parseDesignMd('design-md-pass1-marketplace.md');
    saveGraph(tmp, slice2a, 'slice-2-dna.json');

    // Second slice-2 write (simulating re-index with saas fixture as a different fragment)
    const slice2b = parseDesignMd('design-md-pass1-saas.md');
    saveGraph(tmp, slice2b, 'slice-2-dna.json');

    // slice-1.json must be untouched
    const slice1After = readFileSync(join(graphDir, 'slice-1.json'), 'utf-8');
    assert.equal(slice1After, slice1Snapshot, 'slice-1.json should be byte-identical after slice-2 overwrite');

    // loadAllGraphs should reflect the second write
    const merged = loadAllGraphs(tmp);
    assert.ok(merged);
    // The second write used saas fixture (Ledgerlight), so the design_doc_root name should be Ledgerlight
    const root = merged.nodes.find((n) => n.entity_type === 'design_doc_root');
    assert.ok(root);
    assert.equal((root as { name: string }).name, 'Ledgerlight');
  });
});
