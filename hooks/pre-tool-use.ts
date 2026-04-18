#!/usr/bin/env tsx
/*
 * buildanything: PreToolUse writer-owner hook handler (task 2.1.1).
 *
 * Reads a Claude Code tool-call JSON from stdin, consults the writer-owner
 * table in docs/migration/phase-graph.yaml, and denies Write|Edit|MultiEdit
 * when the current phase (from docs/plans/.build-state.json) does not match
 * the owning phase for file_path.
 *
 * Exit codes per Claude Code PreToolUse protocol:
 *   0 — allow
 *   2 — deny (stderr shown to Claude)
 *
 * Rollback: BUILDANYTHING_ENFORCE_WRITER_OWNER=false downgrades denies to
 * stdout warnings and exits 0.
 *
 * This is the v1 skeleton. Deliberately does NOT:
 *   - Default-deny unknown paths (that is task 2.1.3).
 *   - Cache the parsed table across invocations (task 2.1.2).
 *   - Consult active_write_leases (task 2.4.1).
 */

import { readFileSync, realpathSync } from "node:fs";
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
}

interface PhaseGraph {
  artifacts?: ArtifactEntry[];
}

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
  // and `**` → `.*`. Anchored on both sides.
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
    if (!a.path.includes("*") && !a.path.includes("[")) continue;
    // Treat `[task-id]` placeholder in path-with-id entries as `*` for matching.
    const normalized = a.path.replace(/\[[^\]]+\]/g, "*");
    if (globToRegex(normalized).test(filePath)) return a;
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

function loadArtifacts(pluginDir: string): ArtifactEntry[] {
  const path = resolve(pluginDir, "docs/migration/phase-graph.yaml");
  const text = readFileSync(path, "utf8");
  const doc = parseYaml(text) as PhaseGraph;
  return Array.isArray(doc?.artifacts) ? doc.artifacts : [];
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

  let artifacts: ArtifactEntry[];
  try {
    artifacts = loadArtifacts(plugin);
  } catch {
    // phase-graph.yaml unreadable — fail open. Task 2.1.2 will add caching.
    return 0;
  }

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

  // TODO(task-2.1.3): Default-deny when hit === null. For v1, allow unknown.
  if (!hit) return 0;

  const currentPhase = loadBuildStatePhase(project);
  // Boot-time race: no state file yet. Fail open — task 2.1.3 keeps this open
  // for the unknown-path case too; here we only defer enforcement until state
  // exists.
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
