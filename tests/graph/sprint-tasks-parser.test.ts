import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractSprintTasks } from '../../src/graph/parser/sprint-tasks.js';
import type { GraphFragment, TaskNode } from '../../src/graph/types.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function parseFixture(name: string) {
  const p = join(FIXTURES, name);
  const md = readFileSync(p, 'utf-8');
  return extractSprintTasks({ mdPath: p, mdContent: md });
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

describe('sprint-tasks parser -- marketplace fixture', () => {
  it('parses ok:true with exactly 14 task nodes', () => {
    const result = parseFixture('sprint-tasks-marketplace.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const tasks = nodesOfType<TaskNode>(result.fragment, 'task');
    assert.equal(tasks.length, 14);
  });

  it('T-2 has exactly one task_depends_on edge to task__t-1', () => {
    const result = parseFixture('sprint-tasks-marketplace.md');
    assert.ok(result.fragment);
    const deps = result.fragment.edges.filter(
      (e) => e.relation === 'task_depends_on' && e.source === 'task__t-2',
    );
    assert.equal(deps.length, 1);
    assert.equal(deps[0].target, 'task__t-1');
  });

  it('T-7 has exactly two task_depends_on edges to task__t-3 and task__t-5', () => {
    const result = parseFixture('sprint-tasks-marketplace.md');
    assert.ok(result.fragment);
    const deps = result.fragment.edges.filter(
      (e) => e.relation === 'task_depends_on' && e.source === 'task__t-7',
    );
    assert.equal(deps.length, 2);
    const targets = deps.map((e) => e.target).sort();
    assert.deepStrictEqual(targets, ['task__t-3', 'task__t-5']);
  });

  it('T-1 has zero task_depends_on edges', () => {
    const result = parseFixture('sprint-tasks-marketplace.md');
    assert.ok(result.fragment);
    const deps = result.fragment.edges.filter(
      (e) => e.relation === 'task_depends_on' && e.source === 'task__t-1',
    );
    assert.equal(deps.length, 0);
  });

  it('T-10 owns_files has two entries', () => {
    const result = parseFixture('sprint-tasks-marketplace.md');
    assert.ok(result.fragment);
    const t10 = nodesOfType<TaskNode>(result.fragment, 'task').find((t) => t.task_id === 'T-10');
    assert.ok(t10);
    assert.deepStrictEqual(
      [...t10.owns_files].sort(),
      ['src/api/seller/orders/ship.ts', 'src/pages/order-fulfillment.tsx'],
    );
  });

  it('T-7 has task_implements_feature edge to feature__order-placement', () => {
    const result = parseFixture('sprint-tasks-marketplace.md');
    assert.ok(result.fragment);
    const edge = result.fragment.edges.find(
      (e) =>
        e.relation === 'task_implements_feature' &&
        e.source === 'task__t-7' &&
        e.target === 'feature__order-placement',
    );
    assert.ok(edge, 'expected task__t-7 -> feature__order-placement task_implements_feature edge');
  });

  it('T-3 has task_touches_screen edge to screen__catalog', () => {
    const result = parseFixture('sprint-tasks-marketplace.md');
    assert.ok(result.fragment);
    const edge = result.fragment.edges.find(
      (e) =>
        e.relation === 'task_touches_screen' &&
        e.source === 'task__t-3' &&
        e.target === 'screen__catalog',
    );
    assert.ok(edge, 'expected task__t-3 -> screen__catalog task_touches_screen edge');
  });

  it('determinism: parsing twice produces byte-identical output (modulo produced_at)', () => {
    const a = parseFixture('sprint-tasks-marketplace.md');
    const b = parseFixture('sprint-tasks-marketplace.md');
    assert.ok(a.fragment && b.fragment);
    const { produced_at: _ax, ...aRest } = a.fragment;
    const { produced_at: _bx, ...bRest } = b.fragment;
    assert.equal(stableStringify(aRest), stableStringify(bRest));
  });
});

describe('sprint-tasks parser -- saas fixture', () => {
  it('parses ok:true with exactly 9 task nodes', () => {
    const result = parseFixture('sprint-tasks-saas.md');
    assert.equal(result.ok, true);
    assert.ok(result.fragment);
    const tasks = nodesOfType<TaskNode>(result.fragment, 'task');
    assert.equal(tasks.length, 9);
  });
});

describe('sprint-tasks parser -- inline fixtures', () => {
  it('empty Task ID returns ok:false with Anonymous task error', () => {
    const md = [
      '| Task ID | Title | Size | Dependencies | Behavioral Test | Owns Files | Implementing Phase |',
      '|---|---|---|---|---|---|---|',
      '|  | Some title | M | — | test | — | phase-4 |',
    ].join('\n');
    const result = extractSprintTasks({ mdPath: '<inline>', mdContent: md });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.message.includes('Anonymous task')));
  });

  it('invalid Size XL returns ok:false with Invalid Size error', () => {
    const md = [
      '| Task ID | Title | Size | Dependencies | Behavioral Test | Owns Files | Implementing Phase |',
      '|---|---|---|---|---|---|---|',
      '| T-1 | Valid task | XL | — | test | — | phase-4 |',
    ].join('\n');
    const result = extractSprintTasks({ mdPath: '<inline>', mdContent: md });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.message.includes('Invalid Size')));
  });
});
