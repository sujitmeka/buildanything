import { createHash } from 'node:crypto';

export interface SprintContextInput {
  buildState: Record<string, unknown>;
  refs: Record<string, unknown>;
  architecture: string;
  qualityTargets: Record<string, unknown>;
  iosFeatures?: string[];
}

export interface SprintContextBlock {
  content: string;
  hash: string;
}

/**
 * Render the sprint-scoped shared-context block for Phase 4 dispatches.
 * Injected once per sprint via SubagentStart hook; hash-cached for reuse.
 */
export function renderSprintContext(input: SprintContextInput): SprintContextBlock {
  const sections = [
    `## Architecture Snapshot\n${input.architecture}`,
    `## Quality Targets\n${JSON.stringify(input.qualityTargets, null, 2)}`,
    `## Refs Index\n${JSON.stringify(input.refs, null, 2)}`,
  ];
  if (input.iosFeatures?.length) {
    sections.push(`## iOS Features\n${input.iosFeatures.join(', ')}`);
  }
  const content = sections.join('\n\n');
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  return { content, hash };
}

/**
 * Check if the sprint context needs re-rendering (hash invalidation).
 * Returns true if refs have changed since last render.
 */
export function shouldInvalidate(currentHash: string, newInput: SprintContextInput): boolean {
  const newBlock = renderSprintContext(newInput);
  return newBlock.hash !== currentHash;
}
