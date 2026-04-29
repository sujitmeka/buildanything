import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractProductSpec } from '../../src/graph/parser/product-spec.js';
import {
  graphPath,
  loadGraph,
  queryAcceptance,
  queryFeature,
  queryScreen,
  saveGraph,
} from '../../src/graph/storage/index.js';
import type { GraphFragment } from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const tmpDirs: string[] = [];

function newTmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'graph-test-'));
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

function parseMarketplace(): GraphFragment {
  const p = join(FIXTURES, 'marketplace-product-spec.md');
  const md = readFileSync(p, 'utf-8');
  const result = extractProductSpec({ mdPath: p, mdContent: md });
  assert.equal(result.ok, true);
  assert.ok(result.fragment);
  return result.fragment;
}

describe('integration: parse → save → load → query', () => {
  it('parses the marketplace fixture from disk', () => {
    const fragment = parseMarketplace();
    assert.equal(fragment.schema, 'buildanything-slice-1');
    assert.equal(fragment.version, 1);
    assert.ok(fragment.nodes.length > 0);
    assert.ok(fragment.edges.length > 0);
  });

  it('saves and reloads a parsed fragment without losing structure', () => {
    const fragment = parseMarketplace();
    const dir = newTmp();
    saveGraph(dir, fragment);
    const reloaded = loadGraph(dir);
    assert.ok(reloaded);
    assert.equal(reloaded.source_sha, fragment.source_sha);
    assert.equal(reloaded.nodes.length, fragment.nodes.length);
    assert.equal(reloaded.edges.length, fragment.edges.length);
    assert.equal(reloaded.schema, 'buildanything-slice-1');
  });

  it('queryFeature on a reloaded fragment surfaces multi-persona constraints', () => {
    const fragment = parseMarketplace();
    const dir = newTmp();
    saveGraph(dir, fragment);
    const reloaded = loadGraph(dir);
    assert.ok(reloaded);

    const result = queryFeature(reloaded, 'feature__order-placement');
    assert.ok(result);
    assert.equal(result.feature.label, 'Order Placement');
    const personaIds = new Set(result.persona_constraints.map((c) => c.applies_to_persona));
    assert.ok(personaIds.has('persona__buyer'));
  });

  it('queryScreen on a reloaded fragment returns the expected screen', () => {
    const fragment = parseMarketplace();
    const dir = newTmp();
    saveGraph(dir, fragment);
    const reloaded = loadGraph(dir);
    assert.ok(reloaded);

    const result = queryScreen(reloaded, 'screen__catalog');
    assert.ok(result);
    assert.equal(result.screen.label, 'Catalog');
    assert.ok(result.owning_features.includes('feature__product-discovery'));
  });

  it('queryAcceptance on a reloaded fragment returns the 8 criteria for Order Placement', () => {
    const fragment = parseMarketplace();
    const dir = newTmp();
    saveGraph(dir, fragment);
    const reloaded = loadGraph(dir);
    assert.ok(reloaded);

    const result = queryAcceptance(reloaded, 'feature__order-placement');
    assert.ok(result);
    assert.equal(result.acceptance_criteria.length, 8);
  });

  it('graphPath resolves to .buildanything/graph/slice-1.json under the project dir', () => {
    const p = graphPath('/foo');
    assert.ok(p.endsWith('.buildanything/graph/slice-1.json'));
  });

  it('save → load → re-save preserves byte-equivalence (modulo produced_at)', () => {
    const fragment = parseMarketplace();
    const dirA = newTmp();
    saveGraph(dirA, fragment);
    const reloaded = loadGraph(dirA);
    assert.ok(reloaded);

    const dirB = newTmp();
    saveGraph(dirB, reloaded);
    const reloaded2 = loadGraph(dirB);
    assert.ok(reloaded2);

    const { produced_at: _x, ...a } = reloaded;
    const { produced_at: _y, ...b } = reloaded2;
    assert.deepStrictEqual(a, b);
  });
});
