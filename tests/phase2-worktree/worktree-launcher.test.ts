import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorktreeCommand,
  buildMergeCommands,
} from '../../src/orchestrator/worktree-launcher.js';

describe('worktree-launcher', () => {
  describe('buildWorktreeCommand', () => {
    it('uses correct model and worktree name', () => {
      const cmd = buildWorktreeCommand({
        worktreeName: 'phase-2-arch',
        model: 'haiku',
        prompt: 'do the thing',
      });
      assert.ok(cmd.includes('--model haiku'));
      assert.ok(cmd.includes('--worktree phase-2-arch'));
    });

    it('includes --dangerously-skip-permissions', () => {
      const cmd = buildWorktreeCommand({
        worktreeName: 'phase-2-arch',
        model: 'haiku',
        prompt: 'test',
      });
      assert.ok(cmd.includes('--dangerously-skip-permissions'));
    });

    it('includes timeout wrapper with default 1800', () => {
      const cmd = buildWorktreeCommand({
        worktreeName: 'phase-2-arch',
        model: 'haiku',
        prompt: 'test',
      });
      assert.ok(cmd.startsWith('timeout 1800'));
    });

    it('uses custom timeout when provided', () => {
      const cmd = buildWorktreeCommand({
        worktreeName: 'phase-2-synth',
        model: 'sonnet',
        prompt: 'test',
        timeoutSeconds: 3600,
      });
      assert.ok(cmd.startsWith('timeout 3600'));
    });

    it('escapes double quotes in prompt', () => {
      const cmd = buildWorktreeCommand({
        worktreeName: 'phase-2-arch',
        model: 'haiku',
        prompt: 'say "hello"',
      });
      assert.ok(cmd.includes('\\"hello\\"'));
    });

    it('includes -p flag for headless mode', () => {
      const cmd = buildWorktreeCommand({
        worktreeName: 'phase-2-arch',
        model: 'haiku',
        prompt: 'test',
      });
      assert.ok(cmd.includes('claude -p'));
    });
  });

  describe('buildMergeCommands', () => {
    it('returns 3 commands: merge, worktree remove, branch delete', () => {
      const cmds = buildMergeCommands('phase-2-arch');
      assert.strictEqual(cmds.length, 3);
    });

    it('merge command uses worktree-<name> branch convention', () => {
      const cmds = buildMergeCommands('phase-2-arch');
      assert.strictEqual(cmds[0], 'git merge worktree-phase-2-arch --no-edit');
    });

    it('worktree remove uses .claude/worktrees/<name> path', () => {
      const cmds = buildMergeCommands('phase-2-arch');
      assert.ok(cmds[1].includes('.claude/worktrees/phase-2-arch'));
    });

    it('branch delete uses worktree-<name> branch name', () => {
      const cmds = buildMergeCommands('phase-2-arch');
      assert.ok(cmds[2].includes('git branch -D worktree-phase-2-arch'));
    });

    it('is idempotent (no state mutation)', () => {
      const a = buildMergeCommands('phase-2-arch');
      const b = buildMergeCommands('phase-2-arch');
      assert.deepStrictEqual(a, b);
    });
  });
});
