/**
 * Generator/Critic separation helper.
 * Enforces AUTHOR-BIAS ELIMINATION by ensuring generator and critic
 * have disjoint tool sets — generator can Write|Edit, critic cannot.
 */

export interface QueryOptions {
  prompt: string;
  allowedTools: string[];
  maxTurns?: number;
}

export interface GenCritResult {
  generatorOutput: unknown;
  criticOutput: unknown;
}

/** Tools the generator is allowed to use */
export const GENERATOR_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'] as const;

/** Tools the critic is allowed to use — NO Write|Edit */
export const CRITIC_TOOLS = ['Read', 'Bash', 'Grep', 'Glob'] as const;

/**
 * Validates that generator and critic tool sets are disjoint on write operations.
 * Throws if critic has any write tools.
 */
export function validateToolSeparation(generatorTools: readonly string[], criticTools: readonly string[]): void {
  const writeTools = ['Write', 'Edit'];
  const criticWriteTools = criticTools.filter(t => writeTools.includes(t));
  if (criticWriteTools.length > 0) {
    throw new Error(`AUTHOR-BIAS VIOLATION: critic has write tools: ${criticWriteTools.join(', ')}`);
  }
}

/**
 * Run generator then critic with disjoint tool sets.
 * The critic receives ONLY the generator's output summary — not its full context.
 *
 * @param query - Function that executes an SDK query() call
 * @param generatorPrompt - Prompt for the generator (gets Write|Edit)
 * @param criticPrompt - Prompt for the critic (read-only, scores the output)
 */
export async function runGenCrit(
  query: (opts: QueryOptions) => Promise<unknown>,
  generatorPrompt: string,
  criticPrompt: string,
): Promise<GenCritResult> {
  validateToolSeparation(GENERATOR_TOOLS, CRITIC_TOOLS);

  const generatorOutput = await query({
    prompt: generatorPrompt,
    allowedTools: [...GENERATOR_TOOLS],
  });

  const criticOutput = await query({
    prompt: criticPrompt,
    allowedTools: [...CRITIC_TOOLS],
  });

  return { generatorOutput, criticOutput };
}
