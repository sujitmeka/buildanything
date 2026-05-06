export interface WorktreeCommandOpts {
  worktreeName: string;
  model: string;
  prompt: string;
  timeoutSeconds?: number;
}

export function buildWorktreeCommand(opts: WorktreeCommandOpts): string {
  const timeout = opts.timeoutSeconds ?? 1800;
  const escaped = opts.prompt.replace(/"/g, '\\"');
  return `timeout ${timeout} claude -p --worktree ${opts.worktreeName} --model ${opts.model} --dangerously-skip-permissions "${escaped}"`;
}

export function buildMergeCommands(worktreeName: string): string[] {
  return [
    `git merge worktree-${worktreeName} --no-edit`,
    `git worktree remove .claude/worktrees/${worktreeName} --force 2>/dev/null || true`,
    `git branch -D worktree-${worktreeName} 2>/dev/null || true`,
  ];
}
