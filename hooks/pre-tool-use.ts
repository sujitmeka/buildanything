#!/usr/bin/env tsx
/*
 * buildanything: PreToolUse writer-owner hook handler (tasks 2.1.1–2.1.3).
 *
 * Reads a Claude Code tool-call JSON from stdin, consults the writer-owner
 * table in docs/migration/phase-graph.yaml, and denies Write|Edit|MultiEdit
 * when the current phase (from docs/plans/.build-state.json) does not match
 * the owning phase for file_path.
 *
 * Task 2.1.3 adds default-deny for paths NOT in the writer-owner table when
 * they fall under PROTECTED_PREFIXES (docs/plans/, docs/migration/, commands/,
 * agents/, protocols/, hooks/, src/orchestrator/, .claude-plugin/, CLAUDE.md).
 * Phase-scratch globs (phase_internal_scratch.path_glob from phase-graph.yaml,
 * surfaced as cache.scratch_globs) are exempt from default-deny. Source code
 * under the user's project (outside the protected prefix set) is allowed.
 *
 * Exit codes per Claude Code PreToolUse protocol:
 *   0 — allow
 *   2 — deny (stderr shown to Claude)
 *
 * Rollback: BUILDANYTHING_ENFORCE_WRITER_OWNER=false downgrades denies (both
 * phase-mismatch AND default-deny) to stdout warnings and exits 0.
 *
 * Task 2.1.2: boot-compiled cache at .buildanything/writer-owner.json is the
 * fast path. Cache misses (missing / corrupt / stale-mtime) fall back to live
 * YAML parse with a single stderr warning.
 *
 * Still deliberately does NOT:
 *   - Consult active_write_leases (task 2.4.1).
 */

import { readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

const WATCHED_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const ENFORCE_ENV = "BUILDANYTHING_ENFORCE_WRITER_OWNER";

// Claude Code PreToolUse stdin shape (only the fields we consume).
interface ToolInput {
  file_path?: string;
}
interface ToolCall {
  tool_name?: string;
  tool_input?: ToolInput;
}

interface ArtifactEntry {
  path: string;
  writer?: string;
  writers?: string[];
  // Populated when the entry comes from the boot-compiled cache.
  regex?: string;
  is_glob?: boolean;
}

interface PhaseScratch {
  path_glob?: string;
}

interface PhaseGraph {
  artifacts?: ArtifactEntry[];
  phase_internal_scratch?: PhaseScratch;
}

interface CachedArtifact {
  path: string;
  writers: string[];
  is_glob: boolean;
  regex?: string;
}

interface CachedScratchGlob {
  glob: string;
  regex: string;
}

interface WriterOwnerCache {
  version: number;
  source_sha: string;
  source_mtime: number;
  compiled_at: string;
  artifacts: CachedArtifact[];
  // Task 2.1.3 additive field. Older caches may omit it.
  scratch_globs?: CachedScratchGlob[];
}

// Paths under these prefixes are subject to default-deny when absent from the
// writer-owner table and not a scratch glob. Everything outside this set is
// assumed to be user-project source code and allowed through.
const PROTECTED_PREFIXES = [
  "docs/plans/",
  "docs/migration/",
  ".claude-plugin/",
  "commands/",
  "agents/",
  "protocols/",
  "hooks/",
  "src/orchestrator/",
];
const PROTECTED_FILES = new Set(["CLAUDE.md"]);

const CACHE_VERSION = 1;
const CACHE_REL_PATH = ".buildanything/writer-owner.json";

interface BuildState {
  current_phase?: string | number;
  phase?: string | number;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function pluginRoot(): string {
  // Prefer env injected by Claude Code; fall back to walking up from __dirname.
  const fromEnv = process.env.CLAUDE_PLUGIN_ROOT;
  if (fromEnv) return fromEnv;
  return resolve(__dirname, "..");
}

function projectRoot(): string {
  // User's project cwd — where docs/plans/.build-state.json lives. The plugin
  // repo itself also contains a phase-graph.yaml, but not a build-state.
  return process.cwd();
}

function globToRegex(pattern: string): RegExp {
  // Simple glob: escape regex metachars except `*`, translate `*` → `[^/]*`,
  // `**` → `.*`, `{a,b}` → `(?:a|b)`. Anchored on both sides.
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        out += ".*";
        i += 1;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "{") {
      const close = pattern.indexOf("}", i);
      if (close === -1) {
        out += "\\{";
        continue;
      }
      const parts = pattern.slice(i + 1, close).split(",").map((p) =>
        p.replace(/[.+?^${}()|[\]\\]/g, (m) => `\\${m}`),
      );
      out += `(?:${parts.join("|")})`;
      i = close;
    } else if (/[.+?^${}()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return new RegExp(`^${out}$`);
}

function findArtifact(filePath: string, artifacts: ArtifactEntry[]): ArtifactEntry | null {
  // Exact match first, then glob match. Exact wins if both are present.
  const exact = artifacts.find((a) => a.path === filePath);
  if (exact) return exact;
  for (const a of artifacts) {
    const isGlob = a.is_glob ?? (a.path.includes("*") || a.path.includes("["));
    if (!isGlob) continue;
    let re: RegExp;
    if (a.regex) {
      re = new RegExp(a.regex);
    } else {
      // Treat `[task-id]` placeholder in path-with-id entries as `*` for matching.
      const normalized = a.path.replace(/\[[^\]]+\]/g, "*");
      re = globToRegex(normalized);
    }
    if (re.test(filePath)) return a;
  }
  return null;
}

function normalizePhase(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Accept "phase-2", "2", "P2". Normalize to "phase-N".
  const m = s.match(/(?:phase-?|P)?(-?\d+)/i);
  if (!m) return null;
  return `phase-${m[1]}`;
}

function ownerPhases(entry: ArtifactEntry): string[] {
  const raw: string[] = [];
  if (entry.writer) raw.push(entry.writer);
  if (entry.writers) raw.push(...entry.writers);
  return raw.map((w) => String(w).trim()).filter(Boolean);
}

function loadBuildStatePhase(projectDir: string): string | null {
  const path = resolve(projectDir, "docs/plans/.build-state.json");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const state = JSON.parse(text) as BuildState;
    return normalizePhase(state.current_phase ?? state.phase);
  } catch {
    return null;
  }
}

function phaseGraphPath(pluginDir: string): string {
  return resolve(pluginDir, "docs/migration/phase-graph.yaml");
}

function cachePath(projectDir: string): string {
  return resolve(projectDir, CACHE_REL_PATH);
}

interface LoadedTable {
  artifacts: ArtifactEntry[];
  scratchRegexes: RegExp[];
}

function cachedToEntry(c: CachedArtifact): ArtifactEntry {
  return { path: c.path, writers: c.writers, is_glob: c.is_glob, regex: c.regex };
}

function loadFromCache(pluginDir: string, projectDir: string): LoadedTable | null {
  // Cache hit requires: file exists, parses, version matches, and the source
  // YAML's current mtime matches cache.source_mtime. Any mismatch is a miss.
  const cPath = cachePath(projectDir);
  let text: string;
  try {
    text = readFileSync(cPath, "utf8");
  } catch {
    return null;
  }
  let cache: WriterOwnerCache;
  try {
    cache = JSON.parse(text) as WriterOwnerCache;
  } catch {
    process.stderr.write(
      "buildanything: writer-owner cache malformed; parsing YAML live\n",
    );
    return null;
  }
  if (cache.version !== CACHE_VERSION || !Array.isArray(cache.artifacts)) {
    process.stderr.write(
      "buildanything: writer-owner cache schema mismatch; parsing YAML live\n",
    );
    return null;
  }
  try {
    const srcMtime = Math.floor(statSync(phaseGraphPath(pluginDir)).mtimeMs);
    if (srcMtime !== cache.source_mtime) {
      process.stderr.write(
        "buildanything: writer-owner cache stale; parsing YAML live\n",
      );
      return null;
    }
  } catch {
    // Source YAML missing — fall through to live parse (which will also fail
    // gracefully and treat the table as empty).
    return null;
  }
  const scratchRegexes: RegExp[] = (cache.scratch_globs ?? []).map((g) => {
    try {
      return new RegExp(g.regex);
    } catch {
      return globToRegex(g.glob);
    }
  });
  return {
    artifacts: cache.artifacts.map(cachedToEntry),
    scratchRegexes,
  };
}

function loadFromYaml(pluginDir: string): LoadedTable {
  const text = readFileSync(phaseGraphPath(pluginDir), "utf8");
  const doc = parseYaml(text) as PhaseGraph;
  const artifacts = Array.isArray(doc?.artifacts) ? doc.artifacts : [];
  const scratchRegexes: RegExp[] = [];
  const scratchGlob = doc?.phase_internal_scratch?.path_glob;
  if (typeof scratchGlob === "string" && scratchGlob.trim()) {
    scratchRegexes.push(globToRegex(scratchGlob));
  }
  return { artifacts, scratchRegexes };
}

function loadArtifacts(pluginDir: string, projectDir: string): LoadedTable {
  const cached = loadFromCache(pluginDir, projectDir);
  if (cached) return cached;
  // Live parse fallback. Do NOT rewrite the cache — that is session-start's job.
  return loadFromYaml(pluginDir);
}

function isProtectedPath(relPath: string): boolean {
  if (PROTECTED_FILES.has(relPath)) return true;
  return PROTECTED_PREFIXES.some((p) => relPath.startsWith(p));
}

function matchesScratch(relPath: string, scratchRegexes: RegExp[]): boolean {
  return scratchRegexes.some((re) => re.test(relPath));
}

function enforceMode(): "deny" | "warn" {
  return process.env[ENFORCE_ENV] === "false" ? "warn" : "deny";
}

function main(): number {
  const raw = readStdin();
  if (!raw.trim()) return 0;

  let call: ToolCall;
  try {
    call = JSON.parse(raw) as ToolCall;
  } catch {
    // Malformed stdin is not this hook's problem — fail open.
    return 0;
  }

  const toolName = call.tool_name ?? "";
  if (!WATCHED_TOOLS.has(toolName)) return 0;

  const filePath = call.tool_input?.file_path;
  if (!filePath) return 0;

  const plugin = pluginRoot();
  const project = projectRoot();

  let table: LoadedTable;
  try {
    table = loadArtifacts(plugin, project);
  } catch {
    // Cache missing AND phase-graph.yaml unreadable — fail open rather than
    // brick every write. A compiler/YAML failure is a buildanything bug, not
    // a reason to block the user's work.
    return 0;
  }
  const { artifacts, scratchRegexes } = table;

  // Match file_path against the path being written. The writer-owner table
  // lists paths relative to project root; stdin paths may be absolute. Build
  // a candidate set: raw, relative-to-cwd, relative-to-realpath(cwd). Also
  // probe the filePath's realpath when possible so /tmp vs /private/tmp on
  // macOS resolves consistently.
  const relCandidates = new Set<string>([filePath]);
  if (isAbsolute(filePath)) {
    const projectCandidates = new Set<string>([project]);
    try { projectCandidates.add(realpathSync(project)); } catch { /* ignore */ }
    const absCandidates = new Set<string>([filePath]);
    try {
      // filePath may not exist yet (pre-write); realpath the parent dir.
      const parent = resolve(filePath, "..");
      absCandidates.add(resolve(realpathSync(parent), filePath.slice(parent.length + 1)));
    } catch { /* ignore */ }
    for (const p of projectCandidates) {
      for (const f of absCandidates) {
        relCandidates.add(relative(p, f));
      }
    }
  }

  let hit: ArtifactEntry | null = null;
  let hitPath = filePath;
  for (const candidate of relCandidates) {
    hit = findArtifact(candidate, artifacts);
    if (hit) {
      hitPath = candidate;
      break;
    }
  }

  if (!hit) {
    // Task 2.1.3: default-deny for unknown paths under PROTECTED_PREFIXES.
    // Exemptions: scratch globs (phase_internal_scratch) and any path outside
    // the protected prefix set (user-project source code).
    const scratchMatched = [...relCandidates].some((c) =>
      matchesScratch(c, scratchRegexes),
    );
    if (scratchMatched) return 0;

    const underProtected = [...relCandidates].some((c) => isProtectedPath(c));
    if (!underProtected) return 0;

    const denyPath = [...relCandidates].find((c) => isProtectedPath(c)) ?? filePath;
    const msg = `buildanything: writer-owner hook denied ${toolName} on ${denyPath} — path not in writer-owner table. Please add an entry to docs/migration/phase-graph.yaml or route the write through the scribe_decision MCP.`;

    if (enforceMode() === "warn") {
      process.stdout.write(`WARNING: ${msg}\n`);
      return 0;
    }
    process.stderr.write(`${msg}\n`);
    return 2;
  }

  const currentPhase = loadBuildStatePhase(project);
  // Boot-time race: no state file yet. Fail open on phase-mismatch check so
  // Phase 1's first write isn't blocked before .build-state.json exists.
  if (!currentPhase) return 0;

  const owners = ownerPhases(hit).map((w) => normalizePhase(w) ?? w);
  if (owners.length === 0) return 0;

  // Non-phase owners (e.g. "orchestrator", "orchestrator-scribe",
  // "every-phase", "auto-rendered-view") are out of scope for this phase-vs-
  // phase check. Leave them to task 2.2.x / 2.4.x.
  const phaseOwners = owners.filter((o) => /^phase--?\d+$/.test(o));
  if (phaseOwners.length === 0) return 0;

  if (phaseOwners.includes(currentPhase)) return 0;

  const ownerStr = phaseOwners.join(" | ");
  const msg = `buildanything: writer-owner hook denied ${toolName} on ${hitPath} — current phase ${currentPhase}, path owned by ${ownerStr}`;

  if (enforceMode() === "warn") {
    process.stdout.write(`WARNING: ${msg}\n`);
    return 0;
  }

  process.stderr.write(`${msg}\n`);
  return 2;
}

process.exit(main());
