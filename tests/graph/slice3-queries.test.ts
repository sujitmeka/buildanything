import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractPageSpec } from '../../src/graph/parser/page-spec.js';
import { extractDesignMdTokens } from '../../src/graph/parser/design-md-pass2.js';
import { extractDesignMd } from '../../src/graph/parser/design-md.js';
import { extractProductSpec } from '../../src/graph/parser/product-spec.js';
import { extractComponentManifest } from '../../src/graph/parser/component-manifest.js';
import {
  loadAllGraphs,
  queryDna,
  queryScreen,
  queryScreenFull,
  queryToken,
  saveGraph,
} from '../../src/graph/storage/index.js';
import type {
  GraphFragment,
  PageSpecNode,
  ScreenComponentUseNode,
  ScreenNode,
  ScreenStateSlotNode,
  StateNode,
  TokenNode,
} from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const tmpDirs: string[] = [];

function newTmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'graph-slice3-'));
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

function parseFixture(name: string, parser: (input: { mdPath: string; mdContent: string }) => { ok: boolean; fragment?: GraphFragment; errors: unknown[] }): GraphFragment {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  const result = parser({ mdPath: p, mdContent: md });
  if (!result.ok || !result.fragment) throw new Error(`fixture ${name} failed to parse`);
  return result.fragment;
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

describe('queryToken', () => {
  it('returns null when fragment has no tokens (slice 1 only)', () => {
    const frag = parseFixture('marketplace-product-spec.md', extractProductSpec);
    assert.equal(queryToken(frag, 'colors.primary'), null);
  });

  it('returns TokenQueryResult for colors.primary from pass2 marketplace', () => {
    const frag = parseFixture('design-md-pass2-marketplace.md', extractDesignMdTokens);
    const result = queryToken(frag, 'colors.primary');
    assert.ok(result);
    assert.equal(result.token.name, 'colors.primary');
    assert.equal(result.token.value, '#0F172A');
    assert.equal(result.derived_from_axis_id, 'dna_axis__character');
  });

  it('returns null for partial name "primary" (must be exact)', () => {
    const frag = parseFixture('design-md-pass2-marketplace.md', extractDesignMdTokens);
    assert.equal(queryToken(frag, 'primary'), null);
  });

  it('returns null derived_from_axis_id for component token with no axis_provenance', () => {
    const frag = parseFixture('design-md-pass2-marketplace.md', extractDesignMdTokens);
    const result = queryToken(frag, 'components.button-primary');
    assert.ok(result);
    assert.equal(result.token.axis_provenance, null);
    assert.equal(result.derived_from_axis_id, null);
  });
});

describe('queryScreenFull / queryScreen', () => {
  it('slice 1+2 fragment: queryScreenFull returns null page_spec and empty arrays for screen__catalog', () => {
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    const result = queryScreenFull(slice1, 'screen__catalog');
    assert.ok(result);
    assert.equal(result.page_spec, null);
    assert.deepStrictEqual(result.sections, []);
    assert.deepStrictEqual(result.screen_state_slots, []);
    assert.deepStrictEqual(result.component_uses, []);
    assert.deepStrictEqual(result.key_copy, []);
    assert.deepStrictEqual(result.tokens_used, []);
    assert.ok(result.screen.id === 'screen__catalog');
    assert.ok(result.owning_features.length > 0);
  });

  it('queryScreenFull returns null for screen__login (no ScreenNode exists)', () => {
    // page-spec parser creates PageSpecNode referencing screen__login but does NOT create a ScreenNode
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const loginPageSpec = parseFixture('page-specs/login.md', extractPageSpec);
    saveGraph(tmp, loginPageSpec, 'slice-3-pages-login.json');
    const merged = loadAllGraphs(tmp);
    assert.ok(merged);
    // screen__login ScreenNode does not exist in product-spec, so queryScreenFull returns null
    assert.equal(queryScreenFull(merged, 'screen__login'), null);
  });

  it('queryScreenFull returns non-null for screen__cart-review with bridge ScreenNode', () => {
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const manifest = parseFixture('component-manifest-marketplace.md', extractComponentManifest);
    saveGraph(tmp, manifest, 'slice-2-manifest.json');
    const cartPageSpec = parseFixture('page-specs/cart-review.md', extractPageSpec);
    saveGraph(tmp, cartPageSpec, 'slice-3-pages-cart.json');
    // Bridge: synthesize a ScreenNode for cart-review so queryScreenFull can find it
    const bridge: GraphFragment = {
      version: 1,
      schema: 'buildanything-slice-1',
      source_file: '<bridge>',
      source_sha: '0'.repeat(64),
      produced_at: new Date().toISOString(),
      nodes: [{
        id: 'screen__cart-review',
        label: 'Cart Review',
        entity_type: 'screen',
        source_file: '<bridge>',
        confidence: 'EXTRACTED',
        description: 'Cart review screen',
        feature_ids: ['feature__order-placement'],
      } as ScreenNode],
      edges: [],
    };
    saveGraph(tmp, bridge, 'slice-1-bridge.json');
    const merged = loadAllGraphs(tmp);
    assert.ok(merged);
    const result = queryScreenFull(merged, 'screen__cart-review');
    assert.ok(result);
    assert.equal(result.page_spec!.id, 'page_spec__cart-review');
    assert.equal(result.page_spec!.route, '/cart');
    // The wireframe has 13 unique [Marker] sections (Header, Search, Account, Cart Items List, Remove, Sold out, Discount Code, Order Summary, Apply, CTA Bar, Continue to Shipping, Empty State, Browse Catalog)
    assert.equal(result.sections.length, 13);
  });

  it('queryScreenFull returns null for nonexistent screen', () => {
    const frag = parseFixture('marketplace-product-spec.md', extractProductSpec);
    assert.equal(queryScreenFull(frag, 'screen__nonexistent'), null);
  });

  it('queryScreen without opts returns ScreenQueryResult (no page_spec key)', () => {
    const frag = parseFixture('marketplace-product-spec.md', extractProductSpec);
    const result = queryScreen(frag, 'screen__catalog');
    assert.ok(result);
    assert.equal(result.screen.id, 'screen__catalog');
    assert.ok(result.owning_features.length > 0);
    assert.ok('states_visible_here' in result);
    assert.equal('page_spec' in result, false);
  });

  it('queryScreen with { full: true } matches queryScreenFull', () => {
    const frag = parseFixture('marketplace-product-spec.md', extractProductSpec);
    const full = queryScreenFull(frag, 'screen__catalog');
    const overloaded = queryScreen(frag, 'screen__catalog', { full: true });
    assert.equal(stableStringify(full), stableStringify(overloaded));
  });

  it('manifest join: nav-top has manifest_entry.library === "tailwindui"', () => {
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const manifest = parseFixture('component-manifest-marketplace.md', extractComponentManifest);
    saveGraph(tmp, manifest, 'slice-2-manifest.json');
    const cartPageSpec = parseFixture('page-specs/cart-review.md', extractPageSpec);
    saveGraph(tmp, cartPageSpec, 'slice-3-pages-cart.json');
    const bridge: GraphFragment = {
      version: 1, schema: 'buildanything-slice-1',
      source_file: '<bridge>', source_sha: '0'.repeat(64),
      produced_at: new Date().toISOString(),
      nodes: [{
        id: 'screen__cart-review', label: 'Cart Review', entity_type: 'screen',
        source_file: '<bridge>', confidence: 'EXTRACTED',
        description: 'Cart review screen', feature_ids: ['feature__order-placement'],
      } as ScreenNode],
      edges: [],
    };
    saveGraph(tmp, bridge, 'slice-1-bridge.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryScreenFull(merged, 'screen__cart-review')!;
    const navTop = result.component_uses.find((c) => c.slot === 'nav-top');
    assert.ok(navTop, 'expected component_use for nav-top');
    assert.ok(navTop.manifest_entry, 'expected manifest_entry for nav-top');
    assert.equal(navTop.manifest_entry.library, 'tailwindui');
  });

  it('orphan slot cart-row-compact has no manifest_entry', () => {
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const manifest = parseFixture('component-manifest-marketplace.md', extractComponentManifest);
    saveGraph(tmp, manifest, 'slice-2-manifest.json');
    const cartPageSpec = parseFixture('page-specs/cart-review.md', extractPageSpec);
    saveGraph(tmp, cartPageSpec, 'slice-3-pages-cart.json');
    const bridge: GraphFragment = {
      version: 1, schema: 'buildanything-slice-1',
      source_file: '<bridge>', source_sha: '0'.repeat(64),
      produced_at: new Date().toISOString(),
      nodes: [{
        id: 'screen__cart-review', label: 'Cart Review', entity_type: 'screen',
        source_file: '<bridge>', confidence: 'EXTRACTED',
        description: 'Cart review screen', feature_ids: ['feature__order-placement'],
      } as ScreenNode],
      edges: [],
    };
    saveGraph(tmp, bridge, 'slice-1-bridge.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryScreenFull(merged, 'screen__cart-review')!;
    const orphan = result.component_uses.find((c) => c.slot === 'cart-row-compact');
    assert.ok(orphan, 'expected component_use for cart-row-compact');
    assert.equal('manifest_entry' in orphan, false);
  });

  it('tokens_used populated via crafted prop_overrides referencing {colors.primary}', () => {
    const tmp = newTmp();
    // Load pass2 tokens
    const tokenFrag = parseFixture('design-md-pass2-marketplace.md', extractDesignMdTokens);
    saveGraph(tmp, tokenFrag, 'slice-3-tokens.json');
    // Synthesize a screen + page_spec + component_use with prop_overrides referencing a token
    // queryScreenFull requires a PageSpecNode to exist (otherwise it early-returns with empty arrays)
    const screenId = 'screen__test-tokens';
    const synth: GraphFragment = {
      version: 1, schema: 'buildanything-slice-3',
      source_file: '<synth>', source_sha: '0'.repeat(64),
      produced_at: new Date().toISOString(),
      nodes: [
        {
          id: screenId, label: 'Test Tokens', entity_type: 'screen',
          source_file: '<synth>', confidence: 'EXTRACTED',
          description: 'Synthetic screen for token test', feature_ids: [],
        } as ScreenNode,
        {
          id: 'page_spec__test-tokens', label: 'Test Tokens', entity_type: 'page_spec',
          source_file: '<synth>', confidence: 'EXTRACTED',
          screen_id: screenId, wireframe_text: '', content_hierarchy: [], route: null,
        } as import('../../src/graph/types.js').PageSpecNode,
        {
          id: 'screen_component_use__test-tokens__btn__hero',
          label: 'btn @ hero', entity_type: 'screen_component_use',
          source_file: '<synth>', confidence: 'EXTRACTED',
          screen_id: screenId, slot: 'btn', position_in_wireframe: 'Hero',
          prop_overrides: 'background: {colors.primary}; padding: tokens.spacing.lg',
        } as ScreenComponentUseNode,
      ],
      edges: [],
    };
    saveGraph(tmp, synth, 'slice-3-synth.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryScreenFull(merged, screenId)!;
    assert.ok(result);
    const primary = result.tokens_used.find((t) => t.name === 'colors.primary');
    assert.ok(primary, 'expected colors.primary in tokens_used');
    assert.equal(primary.value, '#0F172A');
    assert.equal(primary.layer, 'color');
  });

  it('resolves kebab state label to real state ID at query time (Issue #4)', () => {
    const tmp = newTmp();
    const synth: GraphFragment = {
      version: 1, schema: 'buildanything-slice-1',
      source_file: '<synth>', source_sha: '0'.repeat(64),
      produced_at: new Date().toISOString(),
      nodes: [
        {
          id: 'screen__login', label: 'Login', entity_type: 'screen',
          source_file: '<synth>', confidence: 'EXTRACTED',
          description: 'Login screen', feature_ids: ['feature__authentication'],
        } as ScreenNode,
        {
          id: 'state__authentication__loading', label: 'loading', entity_type: 'state',
          source_file: '<synth>', confidence: 'EXTRACTED',
          feature_id: 'feature__authentication', is_initial: false, meta_state: true,
        } as StateNode,
        {
          id: 'page_spec__login', label: 'Login', entity_type: 'page_spec',
          source_file: '<synth>', confidence: 'EXTRACTED',
          screen_id: 'screen__login', wireframe_text: '', content_hierarchy: [], route: null,
        } as PageSpecNode,
        {
          id: 'screen_state_slot__login__loading', label: 'loading', entity_type: 'screen_state_slot',
          source_file: '<synth>', confidence: 'EXTRACTED',
          screen_id: 'screen__login', state_id: 'loading', appearance_text: 'spinner',
        } as ScreenStateSlotNode,
      ],
      edges: [],
    };
    saveGraph(tmp, synth, 'synth.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryScreenFull(merged, 'screen__login')!;
    assert.ok(result);
    assert.equal(result.screen_state_slots[0].state_id, 'state__authentication__loading');
  });

  it('keeps kebab label when no matching StateNode exists (Issue #4 negative)', () => {
    const tmp = newTmp();
    const synth: GraphFragment = {
      version: 1, schema: 'buildanything-slice-1',
      source_file: '<synth>', source_sha: '0'.repeat(64),
      produced_at: new Date().toISOString(),
      nodes: [
        {
          id: 'screen__login', label: 'Login', entity_type: 'screen',
          source_file: '<synth>', confidence: 'EXTRACTED',
          description: 'Login screen', feature_ids: ['feature__authentication'],
        } as ScreenNode,
        {
          id: 'page_spec__login', label: 'Login', entity_type: 'page_spec',
          source_file: '<synth>', confidence: 'EXTRACTED',
          screen_id: 'screen__login', wireframe_text: '', content_hierarchy: [], route: null,
        } as PageSpecNode,
        {
          id: 'screen_state_slot__login__loading', label: 'loading', entity_type: 'screen_state_slot',
          source_file: '<synth>', confidence: 'EXTRACTED',
          screen_id: 'screen__login', state_id: 'loading', appearance_text: 'spinner',
        } as ScreenStateSlotNode,
      ],
      edges: [],
    };
    saveGraph(tmp, synth, 'synth.json');
    const merged = loadAllGraphs(tmp)!;
    const result = queryScreenFull(merged, 'screen__login')!;
    assert.ok(result);
    assert.equal(result.screen_state_slots[0].state_id, 'loading');
  });
});

describe('end-to-end cross-slice scenarios', () => {
  it('page_spec screen_id matches a screen in product-spec (with bridge)', () => {
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const bridge: GraphFragment = {
      version: 1, schema: 'buildanything-slice-1',
      source_file: '<bridge>', source_sha: '0'.repeat(64),
      produced_at: new Date().toISOString(),
      nodes: [{
        id: 'screen__cart-review', label: 'Cart Review', entity_type: 'screen',
        source_file: '<bridge>', confidence: 'EXTRACTED',
        description: 'Cart review screen', feature_ids: ['feature__order-placement'],
      } as ScreenNode],
      edges: [],
    };
    saveGraph(tmp, bridge, 'slice-1-bridge.json');
    const cartPageSpec = parseFixture('page-specs/cart-review.md', extractPageSpec);
    saveGraph(tmp, cartPageSpec, 'slice-3-pages-cart.json');
    const merged = loadAllGraphs(tmp)!;
    const pageSpecNode = merged.nodes.find((n) => n.id === 'page_spec__cart-review');
    assert.ok(pageSpecNode);
    assert.equal((pageSpecNode as { screen_id: string }).screen_id, 'screen__cart-review');
    const screenNode = merged.nodes.find((n) => n.id === 'screen__cart-review');
    assert.ok(screenNode, 'bridge ScreenNode should exist in merged graph');
  });

  it('pass_complete.pass2 is false for pass1-only marketplace fixture', () => {
    // pass1-marketplace has null YAML values for colors/typography/etc and only placeholder comments in prose sections
    const frag = parseFixture('design-md-pass1-marketplace.md', extractDesignMd);
    const dna = queryDna(frag);
    assert.ok(dna);
    assert.equal(dna.design_doc.pass_complete.pass2, false);
  });

  it('multi-screen flow: checkout and cart-review are distinct, unlinked entities', () => {
    // Documents the current cross-slice consistency gap: no has_page_spec edge bridges screen → page_spec
    const tmp = newTmp();
    const slice1 = parseFixture('marketplace-product-spec.md', extractProductSpec);
    saveGraph(tmp, slice1, 'slice-1.json');
    const cartPageSpec = parseFixture('page-specs/cart-review.md', extractPageSpec);
    saveGraph(tmp, cartPageSpec, 'slice-3-pages-cart.json');
    const merged = loadAllGraphs(tmp)!;
    const checkout = merged.nodes.find((n) => n.id === 'screen__checkout');
    assert.ok(checkout, 'screen__checkout should exist from product-spec');
    const cartReviewPS = merged.nodes.find((n) => n.id === 'page_spec__cart-review');
    assert.ok(cartReviewPS, 'page_spec__cart-review should exist from page-spec');
    // No has_page_spec edge exists — the page-spec parser only emits page_spec → child edges
    const hasPageSpecEdges = merged.edges.filter((e) => e.relation === 'has_page_spec');
    assert.equal(hasPageSpecEdges.length, 0, 'no has_page_spec edges should exist (known gap)');
    // page_spec references screen__cart-review, NOT screen__checkout
    assert.equal((cartReviewPS as { screen_id: string }).screen_id, 'screen__cart-review');
    assert.notEqual((cartReviewPS as { screen_id: string }).screen_id, 'screen__checkout');
  });
});
