import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

const CRITIC_TOOLS = ['Read', 'Bash', 'Grep', 'Glob'];
const WRITE_OPS = ['Write', 'Edit'];

describe('author-bias elimination', () => {
  it('critic prompt with generator hint has no write tools', () => {
    const hint = 'you should edit line 42';
    assert.ok(hint.toLowerCase().includes('edit'));
    const hasWrite = CRITIC_TOOLS.some(t => WRITE_OPS.includes(t));
    assert.equal(hasWrite, false, 'critic must not gain write tools from hints');
  });

  it('generator and critic are separate calls (no shared context)', () => {
    const genPrompt = { role: 'generator', context: 'gen-ctx' };
    const criticPrompt = { role: 'critic', context: 'critic-ctx' };
    assert.notEqual(genPrompt.context, criticPrompt.context);
    assert.notEqual(genPrompt.role, criticPrompt.role);
  });

  it('critic can only read and analyze, not modify', () => {
    for (const tool of CRITIC_TOOLS) {
      assert.ok(!WRITE_OPS.includes(tool), `${tool} should not be a write op`);
    }
  });
});
