import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read?: number;
  cache_create?: number;
}

export interface AccountingEntry {
  timestamp: string;
  phase: number;
  step: string;
  task?: string;
  subagent_type?: string;
  usage: TokenUsage;
  cost_usd: number;
  cumulative_usd: number;
}

/** Running cumulative cost across the build */
let cumulativeCost = 0;

/** Pricing per million tokens (sonnet defaults) */
const PRICING = {
  input: 3.0,
  output: 15.0,
  cache_read: 0.30,
  cache_create: 3.75,
};

/**
 * Calculate cost from token usage.
 */
export function calculateCost(usage: TokenUsage): number {
  const inputCost = (usage.input_tokens / 1_000_000) * PRICING.input;
  const outputCost = (usage.output_tokens / 1_000_000) * PRICING.output;
  const cacheReadCost = ((usage.cache_read ?? 0) / 1_000_000) * PRICING.cache_read;
  const cacheCreateCost = ((usage.cache_create ?? 0) / 1_000_000) * PRICING.cache_create;
  return Math.round((inputCost + outputCost + cacheReadCost + cacheCreateCost) * 10000) / 10000;
}

/**
 * Record a token usage entry and append to build-log.md.
 */
export function recordUsage(
  buildLogPath: string,
  entry: Omit<AccountingEntry, 'cost_usd' | 'cumulative_usd' | 'timestamp'>,
): AccountingEntry {
  const cost = calculateCost(entry.usage);
  cumulativeCost += cost;

  const record: AccountingEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
    cost_usd: cost,
    cumulative_usd: Math.round(cumulativeCost * 10000) / 10000,
  };

  const line = formatLogLine(record);
  const dir = dirname(buildLogPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(buildLogPath, line + '\n', { flag: 'a' });

  return record;
}

/**
 * Format an accounting entry as a build-log line.
 */
export function formatLogLine(entry: AccountingEntry): string {
  const meta = [`phase=${entry.phase}`, `step=${entry.step}`];
  if (entry.task) meta.push(`task=${entry.task}`);
  if (entry.subagent_type) meta.push(`subagent_type=${entry.subagent_type}`);

  const tokens = [
    `input_tokens=${entry.usage.input_tokens}`,
    `output_tokens=${entry.usage.output_tokens}`,
  ];
  if (entry.usage.cache_read) tokens.push(`cache_read=${entry.usage.cache_read}`);
  if (entry.usage.cache_create) tokens.push(`cache_create=${entry.usage.cache_create}`);
  tokens.push(`cost_usd=${entry.cost_usd}`);
  tokens.push(`cumulative_usd=${entry.cumulative_usd}`);

  return `[${entry.timestamp}] ${meta.join(' ')}\n${tokens.join(' ')}`;
}

/**
 * Get current cumulative cost.
 */
export function getCumulativeCost(): number {
  return cumulativeCost;
}

/**
 * Reset cumulative cost (for testing).
 */
export function reset(): void {
  cumulativeCost = 0;
}
