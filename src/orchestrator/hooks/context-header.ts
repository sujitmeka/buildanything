import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

export interface ContextHeaderInput {
  projectType: 'web' | 'ios';
  phase: number;
  iosFeatures?: Record<string, boolean>;
  visualDnaPath?: string;  // path to DESIGN.md (repo root) — DNA lives in `## Overview > ### Brand DNA` block
}

export interface RenderedHeader {
  content: string;
  hash: string;
}

/** Cache: rendered header keyed by buildId + phase + input hash for automatic invalidation */
let cachedHeader: RenderedHeader | null = null;
let cachedBuildId: string | null = null;
let cachedPhase: number | null = null;
let cachedInputHash: string | null = null;

/**
 * Compute a hash of the variable inputs that affect the rendered header.
 * Used to detect mid-phase mutations (e.g., ios_features changing within a phase).
 */
/**
 * Extract the 7 DNA axis values from DESIGN.md `## Overview > ### Brand DNA` block.
 * The block is a bullet list of 7 axes; we capture the bullets (one per axis)
 * and join them with newlines. Falls back to first 5 non-frontmatter lines if
 * the block is missing (legacy/partial files).
 */
function extractBrandDnaBlock(content: string): string {
  const dnaMatch = content.match(/###\s+Brand DNA\s*\n([\s\S]*?)(?=\n###\s|\n##\s|$)/);
  if (dnaMatch) return dnaMatch[1].trim().split('\n').slice(0, 7).join('\n');
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  return stripped.split('\n').slice(0, 5).join('\n').trim();
}

function inputHash(input: ContextHeaderInput): string {
  const key = JSON.stringify({
    projectType: input.projectType,
    phase: input.phase,
    iosFeatures: input.iosFeatures ?? null,
    visualDnaPath: input.visualDnaPath ?? null,
  });
  return createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * Render the CONTEXT header for a phase.
 * Called once at phase boundary; result reused for all dispatches in that phase.
 * Automatically invalidates if inputs change within the same phase
 * (e.g., ios_features mutating mid-build per spec pass criteria).
 */
export function renderContextHeader(input: ContextHeaderInput, buildId: string): RenderedHeader {
  const currentInputHash = inputHash(input);
  // Return cached if same build, same phase, AND same inputs
  if (
    cachedBuildId === buildId &&
    cachedPhase === input.phase &&
    cachedInputHash === currentInputHash &&
    cachedHeader
  ) return cachedHeader;

  const lines: string[] = ['CONTEXT:'];
  lines.push(`  project_type: ${input.projectType}`);
  lines.push(`  phase: ${input.phase}`);

  // DNA: only for web, phase >= 4. Extract the 7 axis values from
  // DESIGN.md `## Overview > ### Brand DNA` h3 block — NOT the full file.
  // Falls back to first 5 lines if the block is absent (legacy/partial files).
  if (input.projectType === 'web' && input.phase >= 4 && input.visualDnaPath) {
    if (existsSync(input.visualDnaPath)) {
      const content = readFileSync(input.visualDnaPath, 'utf-8');
      const summary = extractBrandDnaBlock(content);
      lines.push(`  dna: ${summary}`);
    }
  }

  // iOS features: only for ios
  if (input.projectType === 'ios' && input.iosFeatures) {
    const enabled = Object.entries(input.iosFeatures)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (enabled.length > 0) {
      lines.push(`  ios_features: [${enabled.join(', ')}]`);
    }
  }

  lines.push('');
  lines.push('TASK:');

  const content = lines.join('\n');
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);

  cachedBuildId = buildId;
  cachedHeader = { content, hash };
  cachedPhase = input.phase;
  cachedInputHash = currentInputHash;
  return cachedHeader;
}

/**
 * Invalidate the cache (call on phase boundary or state mutation).
 */
export function invalidateCache(): void {
  cachedHeader = null;
  cachedBuildId = null;
  cachedPhase = null;
  cachedInputHash = null;
}

/**
 * Check if the cache is valid for a given build + phase.
 */
export function isCacheValid(phase: number, buildId?: string): boolean {
  if (buildId !== undefined && cachedBuildId !== buildId) return false;
  return cachedPhase === phase && cachedHeader !== null;
}
