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
import {
  graphPath,
  loadAllGraphs,
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

function buildMinimalFragment(): GraphFragment {
  const fragment: GraphFragment = {
    version: 1,
    schema: 'buildanything-slice-1',
    source_file: 'fake.md',
    source_sha: '0'.repeat(64),
    produced_at: '2026-04-26T00:00:00.000Z',
    nodes: [
      {
        id: 'persona__alice',
        label: 'Alice',
        entity_type: 'persona',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        description: 'Primary user',
        role: 'end user',
        is_primary: true,
        primary_jtbd: 'do thing fast',
      },
      {
        id: 'persona__bob',
        label: 'Bob',
        entity_type: 'persona',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        description: 'Secondary user',
        role: 'reviewer',
        is_primary: false,
        primary_jtbd: 'review thing',
      },
      {
        id: 'feature__widget',
        label: 'Widget',
        entity_type: 'feature',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        name: 'Widget',
        kebab_anchor: 'widget',
      },
      {
        id: 'screen__home',
        label: 'Home',
        entity_type: 'screen',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        description: 'Landing screen',
        feature_ids: ['feature__widget'],
      },
      {
        id: 'screen__settings',
        label: 'Settings',
        entity_type: 'screen',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        description: 'Settings screen',
        feature_ids: ['feature__widget'],
      },
      {
        id: 'state__widget__idle',
        label: 'idle',
        entity_type: 'state',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        feature_id: 'feature__widget',
        is_initial: true,
        meta_state: false,
      },
      {
        id: 'state__widget__loading',
        label: 'loading',
        entity_type: 'state',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        feature_id: 'feature__widget',
        is_initial: false,
        meta_state: true,
      },
      {
        id: 'state__widget__loaded',
        label: 'loaded',
        entity_type: 'state',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        feature_id: 'feature__widget',
        is_initial: false,
        meta_state: false,
      },
      {
        id: 'transition__widget__idle__loading',
        label: 'idle → loading',
        entity_type: 'transition',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        from_state_id: 'state__widget__idle',
        to_state_id: 'state__widget__loading',
        trigger: 'mount',
        preconditions: '',
        side_effects: 'fetch',
      },
      {
        id: 'rule__widget__cafebabe',
        label: 'page size = 24',
        entity_type: 'business_rule',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        feature_id: 'feature__widget',
        text: 'page size = 24',
        value: '24',
        decision_needed: false,
      },
      {
        id: 'accept__widget__deadbeef',
        label: 'verify thing',
        entity_type: 'acceptance_criterion',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        feature_id: 'feature__widget',
        text: 'verify thing',
        verified: false,
      },
      {
        id: 'pconstraint__widget__aaaaaaaa',
        label: 'fast on 4G',
        entity_type: 'persona_constraint',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        feature_id: 'feature__widget',
        persona_id: 'persona__alice',
        constraint_text: 'fast on 4G',
        cited_source: 'ux-research.md',
      },
      {
        id: 'pconstraint__widget__bbbbbbbb',
        label: 'reviewable in one tap',
        entity_type: 'persona_constraint',
        source_file: 'fake.md',
        confidence: 'EXTRACTED',
        feature_id: 'feature__widget',
        persona_id: 'persona__bob',
        constraint_text: 'reviewable in one tap',
        cited_source: 'ux-research.md',
      },
    ],
    edges: [
      {
        source: 'feature__widget',
        target: 'screen__home',
        relation: 'has_screen',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'feature__widget',
        target: 'screen__settings',
        relation: 'has_screen',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'feature__widget',
        target: 'state__widget__idle',
        relation: 'has_state',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'feature__widget',
        target: 'state__widget__loading',
        relation: 'has_state',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'feature__widget',
        target: 'state__widget__loaded',
        relation: 'has_state',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'feature__widget',
        target: 'state__widget__idle',
        relation: 'has_initial_state',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'state__widget__idle',
        target: 'state__widget__loading',
        relation: 'transitions_to',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'feature__widget',
        target: 'rule__widget__cafebabe',
        relation: 'has_rule',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'feature__widget',
        target: 'accept__widget__deadbeef',
        relation: 'has_acceptance',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'pconstraint__widget__aaaaaaaa',
        target: 'feature__widget',
        relation: 'constrains',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'pconstraint__widget__aaaaaaaa',
        target: 'persona__alice',
        relation: 'applies_to_persona',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'pconstraint__widget__bbbbbbbb',
        target: 'feature__widget',
        relation: 'constrains',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
      {
        source: 'pconstraint__widget__bbbbbbbb',
        target: 'persona__bob',
        relation: 'applies_to_persona',
        confidence: 'EXTRACTED',
        source_file: 'fake.md',
      },
    ],
  };
  return fragment;
}

function parseMarketplace(): GraphFragment {
  const p = join(FIXTURES, 'marketplace-product-spec.md');
  const md = readFileSync(p, 'utf-8');
  const result = extractProductSpec({ mdPath: p, mdContent: md });
  if (!result.ok || !result.fragment) {
    throw new Error('marketplace fixture failed to parse');
  }
  return result.fragment;
}

describe('storage round-trip', () => {
  it('save then load returns deeply equal fragment', () => {
    const dir = newTmp();
    const fragment = buildMinimalFragment();
    saveGraph(dir, fragment);
    const loaded = loadGraph(dir);
    assert.ok(loaded);
    assert.deepStrictEqual(loaded, fragment);
  });

  it('saveGraph leaves no .tmp file behind on success', () => {
    const dir = newTmp();
    const fragment = buildMinimalFragment();
    saveGraph(dir, fragment);
    assert.equal(existsSync(graphPath(dir) + '.tmp'), false);
    assert.equal(existsSync(graphPath(dir)), true);
  });
});

describe('storage failures and guards', () => {
  it('loadGraph returns null when the file is missing', () => {
    const dir = newTmp();
    assert.equal(loadGraph(dir), null);
  });

  it('loadGraph returns null on version mismatch', () => {
    const dir = newTmp();
    const target = graphPath(dir);
    mkdirSync(dirname(target), { recursive: true });
    const wrong = { ...buildMinimalFragment(), version: 0 };
    writeFileSync(target, JSON.stringify(wrong, null, 2), 'utf-8');
    assert.equal(loadGraph(dir), null);
  });

  it('loadGraph returns null on schema mismatch', () => {
    const dir = newTmp();
    const target = graphPath(dir);
    mkdirSync(dirname(target), { recursive: true });
    const wrong = { ...buildMinimalFragment(), schema: 'wrong-schema' };
    writeFileSync(target, JSON.stringify(wrong, null, 2), 'utf-8');
    assert.equal(loadGraph(dir), null);
  });

  it('loadGraph accepts all 5 slice schemas', () => {
    const slices = [
      'buildanything-slice-1',
      'buildanything-slice-2',
      'buildanything-slice-3',
      'buildanything-slice-4',
      'buildanything-slice-5',
    ] as const;
    for (const schema of slices) {
      const dir = newTmp();
      const target = graphPath(dir);
      mkdirSync(dirname(target), { recursive: true });
      const frag = { ...buildMinimalFragment(), schema };
      writeFileSync(target, JSON.stringify(frag, null, 2), 'utf-8');
      const loaded = loadGraph(dir);
      assert.ok(loaded, `loadGraph rejected schema ${schema}`);
      assert.equal(loaded.schema, schema);
    }
  });
});

describe('storage query layer (against parsed marketplace fixture)', () => {
  it('queryFeature returns rich data for Order Placement', () => {
    const fragment = parseMarketplace();
    const result = queryFeature(fragment, 'feature__order-placement');
    assert.ok(result, 'expected non-null result');
    assert.equal(result.feature.label, 'Order Placement');
    assert.equal(result.feature.kebab_anchor, 'order-placement');

    assert.ok(result.transitions.length > 0, 'expected non-empty transitions');
    for (const t of result.transitions) {
      assert.ok(Object.prototype.hasOwnProperty.call(t, 'from'));
      assert.ok(Object.prototype.hasOwnProperty.call(t, 'to'));
      assert.ok(!Object.prototype.hasOwnProperty.call(t, 'from_state_id'));
      assert.ok(!Object.prototype.hasOwnProperty.call(t, 'to_state_id'));
    }

    assert.ok(result.persona_constraints.length > 0);
    const personaIds = new Set(result.persona_constraints.map((c) => c.applies_to_persona));
    assert.ok(personaIds.has('persona__buyer'));
    assert.ok(personaIds.has('persona__seller'));

    assert.ok(Array.isArray(result.depends_on));
  });

  it('queryFeature returns null for an unknown feature id', () => {
    const fragment = parseMarketplace();
    assert.equal(queryFeature(fragment, 'feature__nonexistent'), null);
  });

  it('queryScreen returns label and owning_features for a known screen', () => {
    const fragment = parseMarketplace();
    const result = queryScreen(fragment, 'screen__catalog');
    assert.ok(result);
    assert.equal(result.screen.label, 'Catalog');
    assert.ok(result.owning_features.length > 0);
    assert.ok(result.owning_features.includes('feature__product-discovery'));
  });

  it('queryAcceptance returns the 8 criteria for Order Placement', () => {
    const fragment = parseMarketplace();
    const result = queryAcceptance(fragment, 'feature__order-placement');
    assert.ok(result);
    assert.equal(result.acceptance_criteria.length, 8);
    for (const a of result.acceptance_criteria) {
      assert.ok(typeof a.text === 'string' && a.text.length > 0);
      assert.equal(a.verified, false);
    }
  });
});

describe('loadAllGraphs duplicate-id handling', () => {
  it('warns to stderr naming both fragments and keeps last-write-wins', () => {
    const dir = newTmp();
    const fragA: GraphFragment = {
      ...buildMinimalFragment(),
      source_file: 'fragA.md',
      nodes: [
        {
          id: 'feature__shared',
          label: 'A-version',
          entity_type: 'feature',
          source_file: 'fragA.md',
          confidence: 'EXTRACTED',
          name: 'A-version',
          kebab_anchor: 'a-version',
        },
      ],
      edges: [],
    };
    const fragB: GraphFragment = {
      ...buildMinimalFragment(),
      source_file: 'fragB.md',
      nodes: [
        {
          id: 'feature__shared',
          label: 'B-version',
          entity_type: 'feature',
          source_file: 'fragB.md',
          confidence: 'EXTRACTED',
          name: 'B-version',
          kebab_anchor: 'b-version',
        },
      ],
      edges: [],
    };
    saveGraph(dir, fragA, 'a-slice-1.json');
    saveGraph(dir, fragB, 'b-slice-1.json');

    const captured: string[] = [];
    const origErr = console.error;
    console.error = (...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(' '));
    };
    try {
      const merged = loadAllGraphs(dir);
      assert.ok(merged);
      // Files load alphabetically: a-slice-1 first, b-slice-1 second → B wins.
      const winning = merged.nodes.find((n) => n.id === 'feature__shared');
      assert.ok(winning);
      assert.equal((winning as { label: string }).label, 'B-version');
    } finally {
      console.error = origErr;
    }
    const dupWarnings = captured.filter((m) => m.includes('duplicate node id') && m.includes('feature__shared'));
    assert.ok(dupWarnings.length >= 1, `expected duplicate-id warning, got: ${captured.join(' | ')}`);
    const w = dupWarnings[0];
    assert.ok(w.includes('fragA.md'), `warning should name fragA.md, got: ${w}`);
    assert.ok(w.includes('fragB.md'), `warning should name fragB.md, got: ${w}`);
  });
});
