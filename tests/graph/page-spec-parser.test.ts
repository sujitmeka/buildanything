import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPageSpec } from '../../src/graph/parser/page-spec.js';
import type {
  GraphFragment,
  KeyCopyNode,
  PageSpecNode,
  ScreenComponentUseNode,
  ScreenStateSlotNode,
  WireframeSectionNode,
} from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function parsePageSpec(name: string) {
  const p = join(FIXTURES, 'page-specs', name);
  const md = readFileSync(p, 'utf-8');
  return extractPageSpec({ mdPath: p, mdContent: md });
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

describe('page-spec parser — login.md', () => {
  it('parses ok=true with correct node counts', () => {
    const result = parsePageSpec('login.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const f = result.fragment;
    assert.equal(nodesOfType<PageSpecNode>(f, 'page_spec').length, 1);
    assert.equal(nodesOfType<WireframeSectionNode>(f, 'wireframe_section').length, 6);
    assert.equal(nodesOfType<ScreenStateSlotNode>(f, 'screen_state_slot').length, 4);
    assert.equal(nodesOfType<KeyCopyNode>(f, 'key_copy').length, 4);
    assert.equal(nodesOfType<ScreenComponentUseNode>(f, 'screen_component_use').length, 6);
    const ps = nodesOfType<PageSpecNode>(f, 'page_spec')[0];
    assert.equal(ps.route, '/login');
  });

  it('produces stable ID page_spec__login', () => {
    const result = parsePageSpec('login.md');
    assert.ok(result.fragment);
    const ids = new Set(result.fragment.nodes.map((n) => n.id));
    assert.ok(ids.has('page_spec__login'));
  });

  it('produces screen_state_slot__login__loading', () => {
    const result = parsePageSpec('login.md');
    assert.ok(result.fragment);
    const ids = new Set(result.fragment.nodes.map((n) => n.id));
    assert.ok(ids.has('screen_state_slot__login__loading'));
  });

  it('edge counts match node counts by relation', () => {
    const result = parsePageSpec('login.md');
    assert.ok(result.fragment);
    const edges = result.fragment.edges;
    assert.equal(edges.filter((e) => e.relation === 'has_section').length, 6);
    assert.equal(edges.filter((e) => e.relation === 'has_screen_state').length, 4);
    assert.equal(edges.filter((e) => e.relation === 'key_copy_on_screen').length, 4);
    assert.equal(edges.filter((e) => e.relation === 'slot_used_on_screen').length, 6);
  });

  it('screen_state_slot loading has kebab state label as state_id', () => {
    const result = parsePageSpec('login.md');
    assert.ok(result.fragment);
    const slot = nodesOfType<ScreenStateSlotNode>(result.fragment, 'screen_state_slot')
      .find((n) => n.id === 'screen_state_slot__login__loading');
    assert.ok(slot);
    assert.equal(slot.state_id, 'loading');
  });

  it('key_copy text is clean (no quotes, no leading dash, no placement: prefix)', () => {
    const result = parsePageSpec('login.md');
    assert.ok(result.fragment);
    const copies = nodesOfType<KeyCopyNode>(result.fragment, 'key_copy');
    const signIn = copies.find((c) => c.text === 'Sign in to Stockyard');
    assert.ok(signIn, 'expected key_copy with text "Sign in to Stockyard"');
    assert.equal(signIn.text, 'Sign in to Stockyard');
    assert.ok(!signIn.placement.startsWith('placement:'), 'placement should not start with "placement:"');
  });
});

describe('page-spec parser — cart-review.md', () => {
  it('parses ok=true with 8 component picks', () => {
    const result = parsePageSpec('cart-review.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    assert.equal(nodesOfType<ScreenComponentUseNode>(result.fragment, 'screen_component_use').length, 8);
  });

  it('orphan slot cart-row-compact is emitted with correct position_in_wireframe', () => {
    const result = parsePageSpec('cart-review.md');
    assert.ok(result.fragment);
    const uses = nodesOfType<ScreenComponentUseNode>(result.fragment, 'screen_component_use');
    const orphan = uses.find((u) => u.slot === 'cart-row-compact');
    assert.ok(orphan, 'expected screen_component_use with slot cart-row-compact');
    assert.equal(orphan.position_in_wireframe, 'Cart Items List');
  });
});

describe('page-spec parser — dashboard.md', () => {
  it('parses ok=true with content_hierarchy length >= 6', () => {
    const result = parsePageSpec('dashboard.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const ps = nodesOfType<PageSpecNode>(result.fragment, 'page_spec')[0];
    assert.ok(ps.content_hierarchy.length >= 6, `expected >= 6, got ${ps.content_hierarchy.length}`);
  });

  it('has a key_copy node with text "Dashboard"', () => {
    const result = parsePageSpec('dashboard.md');
    assert.ok(result.fragment);
    const copies = nodesOfType<KeyCopyNode>(result.fragment, 'key_copy');
    const dash = copies.find((c) => c.text === 'Dashboard');
    assert.ok(dash, 'expected key_copy with text "Dashboard"');
  });
});

describe('page-spec parser — malformed', () => {
  it('malformed-no-wireframe.md returns ok=false with ASCII Wireframe error', () => {
    const result = parsePageSpec('malformed-no-wireframe.md');
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
    const hasWireframeError = result.errors.some((e) => e.message.includes('ASCII Wireframe'));
    assert.ok(hasWireframeError, 'expected error mentioning ASCII Wireframe');
  });
});

describe('page-spec parser — determinism', () => {
  it('parsing login.md twice produces identical fragments (modulo produced_at)', () => {
    const a = parsePageSpec('login.md');
    const b = parsePageSpec('login.md');
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _a, ...aRest } = a.fragment;
    const { produced_at: _b, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });
});

describe('page-spec parser — bullet-form states (Issue #11)', () => {
  const md = `# Page: TestBullet

## ASCII Wireframe

\`\`\`
[Header]
[Footer]
\`\`\`

## Content Hierarchy

- Header
- Footer

## States

- **idle**: empty form, focus in email field
- **error** — bad credentials shown

## Key Copy

- "Welcome" — placement: page heading

`;

  it('bullet state with colon separator has clean appearance_text', () => {
    const result = extractPageSpec({ mdPath: 'test-bullet.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const slots = nodesOfType<ScreenStateSlotNode>(result.fragment, 'screen_state_slot');
    const idle = slots.find((s) => s.id.includes('idle'));
    assert.ok(idle);
    assert.equal(idle.appearance_text, 'empty form, focus in email field');
  });

  it('bullet state with dash separator has clean appearance_text', () => {
    const result = extractPageSpec({ mdPath: 'test-bullet.md', mdContent: md });
    assert.ok(result.fragment);
    const slots = nodesOfType<ScreenStateSlotNode>(result.fragment, 'screen_state_slot');
    const error = slots.find((s) => s.id.includes('error'));
    assert.ok(error);
    assert.equal(error.appearance_text, 'bad credentials shown');
  });
});

describe('page-spec parser — prop_overrides column (Issue #10)', () => {
  const md = `# Page: TestProps

## ASCII Wireframe

\`\`\`
[Hero]
\`\`\`

## Content Hierarchy

- Hero

## Key Copy

- "Sign up" — placement: primary button label

## Component Picks

| Section | Manifest Slot | Prop Overrides |
|---------|---------------|----------------|
| Hero    | primary-button | label="Sign up", variant=cta |

`;

  it('captures prop_overrides from table column', () => {
    const result = extractPageSpec({ mdPath: 'test-props.md', mdContent: md });
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const uses = nodesOfType<ScreenComponentUseNode>(result.fragment, 'screen_component_use');
    assert.equal(uses.length, 1);
    assert.equal(uses[0].prop_overrides, 'label="Sign up", variant=cta');
  });

  it('existing fixtures have empty prop_overrides (backward compat)', () => {
    const p = join(FIXTURES, 'page-specs', 'login.md');
    const loginMd = readFileSync(p, 'utf-8');
    const result = extractPageSpec({ mdPath: p, mdContent: loginMd });
    assert.ok(result.fragment);
    const uses = nodesOfType<ScreenComponentUseNode>(result.fragment, 'screen_component_use');
    assert.ok(uses.length > 0);
    for (const u of uses) {
      assert.equal(u.prop_overrides, '', `expected empty prop_overrides for slot ${u.slot}`);
    }
  });
});
