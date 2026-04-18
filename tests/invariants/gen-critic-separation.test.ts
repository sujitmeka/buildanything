import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

const GENERATOR_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];
const CRITIC_TOOLS = ['Read', 'Bash', 'Grep', 'Glob'];
const WRITE_OPS = ['Write', 'Edit'];

function validateToolSeparation(criticTools: string[]) {
  const overlap = criticTools.filter(t => WRITE_OPS.includes(t));
  if (overlap.length) throw new Error(`Critic must not have write tools: ${overlap}`);
}

describe('generator / critic tool separation', () => {
  it('generator has Write and Edit tools', () => {
    assert.ok(GENERATOR_TOOLS.includes('Write'));
    assert.ok(GENERATOR_TOOLS.includes('Edit'));
  });

  it('critic does NOT have Write or Edit tools', () => {
    assert.ok(!CRITIC_TOOLS.includes('Write'));
    assert.ok(!CRITIC_TOOLS.includes('Edit'));
  });

  it('tool sets are disjoint on write operations', () => {
    const overlap = GENERATOR_TOOLS.filter(t => WRITE_OPS.includes(t) && CRITIC_TOOLS.includes(t));
    assert.equal(overlap.length, 0);
  });

  it('validateToolSeparation throws if critic has Write', () => {
    assert.throws(() => validateToolSeparation(['Read', 'Write']), /Critic must not have write tools/);
  });
});
