#!/usr/bin/env tsx
/*
 * buildanything: SubagentStart staging hook handler (task 3.1.1).
 *
 * Stage 3 opener. Reads the Claude Code SubagentStart stdin payload plus
 * docs/plans/.build-state.json from process.cwd() and writes the subset of
 * fields the CONTEXT header will need to
 *
 *   .buildanything/subagent-start-cache/<id>.json
 *
 * Keyed by parent_tool_use_id (preferred) or session_id (fallback). The
 * cache file is purely a staging artifact — downstream:
 *
 *   TODO(task 3.1.2): CONTEXT header renderer + hash-cache consumes this
 *   file and produces the formatted header string.
 *   TODO(task 3.1.3): Injector wires the rendered header into the spawned
 *   subagent's prompt.
 *
 * This handler does NOT render, NOT inject, NOT hash-cache. It only stages.
 *
 * Output protocol: SubagentStart hooks default exit 0 = allow. This handler
 * is observational; any failure path exits 0 silently (best-effort).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const CACHE_DIR_REL = ".buildanything/subagent-start-cache";
const STATE_PATH_REL = "docs/plans/.build-state.json";

// Claude Code SubagentStart stdin shape — only the fields we consume. Anything
// else is ignored. We do a best-effort parse; malformed stdin exits 0.
interface SubagentStartPayload {
  session_id?: string;
  parent_tool_use_id?: string;
  subagent_type?: string;
  prompt?: string;
}

// The .build-state.json shape is defined authoritatively in
// protocols/state-schema.json. We read a narrow subset here — the fields the
// CONTEXT header is "likely to need." If the state schema grows new fields
// the header wants, add them here and in 3.1.2's renderer together.
interface BuildState {
  schema_version?: number;
  phase?: number | string;
  step?: string;
  project_type?: string;
  session_id?: string;
  build_request?: string;
  context_level?: string;
  git_branch?: string;
  autonomous?: boolean;
  mode?: string;
  phase_artifacts?: Record<string, unknown>;
  // "if present" per task 3.1.1 spec — not in the base schema yet but may
  // arrive via phase_artifacts or a future schema bump. Read defensively.
  current_phase_refs?: unknown;
  architecture_ref?: unknown;
  [k: string]: unknown;
}

interface StagedContext {
  // Correlation keys for 3.1.3 injection.
  cache_key: string;
  session_id: string | null;
  parent_tool_use_id: string | null;
  subagent_type: string | null;
  // Selected state fields — the CONTEXT header's input set.
  state: {
    schema_version: number | null;
    phase: number | string | null;
    step: string | null;
    project_type: string | null;
    build_request: string | null;
    context_level: string | null;
    git_branch: string | null;
    autonomous: boolean | null;
    mode: string | null;
    phase_artifacts: Record<string, unknown> | null;
    current_phase_refs: unknown;
    architecture_ref: unknown;
  };
  staged_at: string;
}

function readStdin(): string {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePayload(raw: string): SubagentStartPayload | null {
  const text = raw.trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed as SubagentStartPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function loadBuildState(projectDir: string): BuildState | null {
  const path = resolve(projectDir, STATE_PATH_REL);
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      return parsed as BuildState;
    }
    return null;
  } catch {
    process.stderr.write(
      "buildanything: subagent-start could not parse .build-state.json; skipping stage\n",
    );
    return null;
  }
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pickPhaseArtifacts(
  v: unknown,
): Record<string, unknown> | null {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

function selectCacheKey(payload: SubagentStartPayload): string | null {
  const parent = pickString(payload.parent_tool_use_id);
  if (parent) return parent;
  const session = pickString(payload.session_id);
  if (session) return session;
  return null;
}

function buildStagedContext(
  key: string,
  payload: SubagentStartPayload,
  state: BuildState,
): StagedContext {
  return {
    cache_key: key,
    session_id: pickString(payload.session_id),
    parent_tool_use_id: pickString(payload.parent_tool_use_id),
    subagent_type: pickString(payload.subagent_type),
    state: {
      schema_version:
        typeof state.schema_version === "number" ? state.schema_version : null,
      phase:
        typeof state.phase === "number" || typeof state.phase === "string"
          ? state.phase
          : null,
      step: pickString(state.step),
      project_type: pickString(state.project_type),
      build_request: pickString(state.build_request),
      context_level: pickString(state.context_level),
      git_branch: pickString(state.git_branch),
      autonomous:
        typeof state.autonomous === "boolean" ? state.autonomous : null,
      mode: pickString(state.mode),
      phase_artifacts: pickPhaseArtifacts(state.phase_artifacts),
      current_phase_refs: state.current_phase_refs ?? null,
      architecture_ref: state.architecture_ref ?? null,
    },
    staged_at: new Date().toISOString(),
  };
}

function writeStaged(projectDir: string, staged: StagedContext): void {
  const dir = resolve(projectDir, CACHE_DIR_REL);
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${staged.cache_key}.json`);
  // Overwrite-on-conflict is the documented behavior — most recent wins per
  // scenario (g). Atomic write-and-rename is task 3.2.2, out of scope here.
  writeFileSync(file, `${JSON.stringify(staged, null, 2)}\n`, "utf8");
}

function main(): number {
  const raw = readStdin();
  const payload = parsePayload(raw);
  if (!payload) {
    // Malformed stdin — observational hook, exit 0.
    return 0;
  }

  const key = selectCacheKey(payload);
  if (!key) {
    // No correlation id at all — cannot key the staging file. Exit 0.
    return 0;
  }

  const state = loadBuildState(process.cwd());
  if (!state) {
    // No state (build not started) or unparseable — nothing to stage.
    return 0;
  }

  const staged = buildStagedContext(key, payload, state);

  try {
    writeStaged(process.cwd(), staged);
  } catch (err) {
    // Staging is best-effort. Log once and exit 0 so we never block subagent
    // spawn on a cache write failure.
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-start could not write cache (${msg}); skipping\n`,
    );
  }

  return 0;
}

process.exit(main());
