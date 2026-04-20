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
 * Hash only the inputs that affect rendered output (excludes buildState).
 * Cheaper than a full renderSprintContext — no section joins or content hashing.
 * Callers should store this hash and pass it to shouldInvalidate.
 */
export function inputHash(input: SprintContextInput): string {
  return createHash('sha256')
    .update(JSON.stringify({
      architecture: input.architecture,
      qualityTargets: input.qualityTargets,
      refs: input.refs,
      iosFeatures: input.iosFeatures ?? null,
    }))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Check if the sprint context needs re-rendering (hash invalidation).
 * Compares input hashes directly — avoids a full render just to get a hash.
 */
export function shouldInvalidate(currentInputHash: string, newInput: SprintContextInput): boolean {
  return inputHash(newInput) !== currentInputHash;
}
