#!/usr/bin/env tsx
/*
 * buildanything: SubagentStart hook handler (tasks 3.1.1 + 3.1.3 + 6.2.1).
 *
 * Stage 3 + Stage 6. Reads the Claude Code SubagentStart stdin payload plus
 * docs/plans/.build-state.json from process.cwd() and does three things:
 *
 *   1) Stages the subset of state fields the CONTEXT header needs to
 *        .buildanything/subagent-start-cache/<id>.json
 *      (task 3.1.1 — keyed by parent_tool_use_id or session_id).
 *   2) Renders the CONTEXT header via src/orchestrator/hooks/context-header
 *      and emits it on stdout as
 *        {"additional_context": "<rendered header>"}
 *      which Claude Code injects into the spawned subagent's prompt
 *      (task 3.1.3 — same envelope shape as session-start).
 *   3) When state.current_phase === 4 (Phase 4 — implementation sprint),
 *      additionally renders the sprint-scoped shared-context block via
 *      src/orchestrator/phase4-shared-context and APPENDS it to the
 *      additional_context string (task 6.2.1). This hoists the per-sprint
 *      refs/architecture/quality-targets block into the subagent prompt
 *      once per dispatch, so Phase 4 implementer/reviewer/critic prompts
 *      in commands/build.md can drop the inline refs block (cost lever).
 *
 * Render is best-effort on BOTH renderers: if a generator module fails to
 * load (SDK off, module moved) or the inputs aren't sufficient (missing
 * project_type, non-numeric phase, state absent), we skip that envelope
 * and log to stderr rather than crash the subagent spawn. A sprint-context
 * failure does not suppress a successful header — we emit header alone.
 *
 * Rollback flags (per MIGRATION-PLAN-FINAL.md §Stage 6):
 *   BUILDANYTHING_SDK_SPRINT_CONTEXT=off|false|0 — disables sprint-context
 *     injection entirely (restore 3.1.3 behavior: header only).
 *   BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS=off|false|0 — for iOS project_type,
 *     suppresses the iOS-features sub-section within sprint context while
 *     keeping the rest. Web projects are unaffected by this flag.
 * Default (no env var set) = both ON. Case-insensitive.
 *
 * Output protocol: SubagentStart hooks default exit 0 = allow. This handler
 * exits 0 on every path; rendering failures never block the subagent.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const CACHE_DIR_REL = ".buildanything/subagent-start-cache";
const STATE_PATH_REL = "docs/plans/.build-state.json";
const VISUAL_DNA_PATH_REL = "docs/plans/visual-dna.md";
const REFS_PATH_REL = "docs/plans/refs.json";
const ARCHITECTURE_PATH_REL = "docs/plans/architecture.md";
const SPRINT_CONTEXT_MARKER = "\n\n--- SPRINT CONTEXT ---\n\n";

// Minimal structural type for the renderer's return value. Kept local so
// this hook file does not statically depend on src/ (hooks/ is not in the
// tsconfig include set). The generator is loaded via dynamic import() at
// runtime under tsx.
interface RenderedHeaderLike {
  content: string;
  hash: string;
}

// Same-shape structural type for phase4-shared-context's return. Local
// duplication keeps the hook off the src/ type graph; the runtime import
// returns the real object.
interface SprintContextBlockLike {
  content: string;
  hash: string;
}

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
  // Some state writes use `current_phase` alongside/instead of `phase` —
  // matches hooks/pre-tool-use.ts's `state.current_phase ?? state.phase`
  // tolerance. Read both; prefer current_phase when present.
  current_phase?: number | string;
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

function coercePhase(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickIosFeatures(v: unknown): Record<string, boolean> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, boolean> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (typeof raw === "boolean") out[k] = raw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

async function renderHeader(
  projectDir: string,
  state: BuildState,
): Promise<RenderedHeaderLike | null> {
  const projectType = pickString(state.project_type);
  if (projectType !== "web" && projectType !== "ios") return null;

  const phase = coercePhase(state.phase);
  if (phase === null) return null;

  let mod: typeof import("../src/orchestrator/hooks/context-header.js");
  try {
    mod = await import("../src/orchestrator/hooks/context-header.js");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-start could not load context-header renderer (${msg}); skipping injection\n`,
    );
    return null;
  }

  try {
    return mod.renderContextHeader({
      projectType,
      phase,
      iosFeatures: pickIosFeatures(state.ios_features),
      visualDnaPath: resolve(projectDir, VISUAL_DNA_PATH_REL),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-start context-header render failed (${msg}); skipping injection\n`,
    );
    return null;
  }
}

function isFlagDisabled(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "off" || normalized === "false" || normalized === "0";
}

function readJsonFile(path: string): Record<string, unknown> | null {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function readTextFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function extractQualityTargets(state: BuildState): Record<string, unknown> {
  // Quality targets live under phase_artifacts.quality_targets by convention
  // (docs/plans/quality-targets.json or similar). If absent, pass an empty
  // object — the generator handles it (JSON.stringify({}) is "{}"). Best
  // effort only; no cross-read of non-canonical paths.
  const artifacts = pickPhaseArtifacts(state.phase_artifacts);
  if (!artifacts) return {};
  const qt = artifacts["quality_targets"];
  if (qt && typeof qt === "object" && !Array.isArray(qt)) {
    return qt as Record<string, unknown>;
  }
  return {};
}

function extractIosFeatureNames(v: unknown): string[] {
  // state.ios_features is Record<string, boolean> (16 flags). The
  // sprint-context generator expects the enabled feature NAMES as string[].
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const out: string[] = [];
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (raw === true) out.push(k);
  }
  return out;
}

async function renderSprintContextBlock(
  projectDir: string,
  state: BuildState,
): Promise<SprintContextBlockLike | null> {
  if (isFlagDisabled(process.env.BUILDANYTHING_SDK_SPRINT_CONTEXT)) {
    return null;
  }

  const projectType = pickString(state.project_type);
  const iosFlagDisabled = isFlagDisabled(
    process.env.BUILDANYTHING_SDK_SPRINT_CONTEXT_IOS,
  );

  let mod: typeof import("../src/orchestrator/phase4-shared-context.js");
  try {
    mod = await import("../src/orchestrator/phase4-shared-context.js");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-start could not load phase4-shared-context (${msg}); skipping sprint context\n`,
    );
    return null;
  }

  const refs = readJsonFile(resolve(projectDir, REFS_PATH_REL)) ?? {};
  const architecture =
    readTextFile(resolve(projectDir, ARCHITECTURE_PATH_REL)) ?? "";
  const qualityTargets = extractQualityTargets(state);

  // iOS features: only pass when project is iOS AND the iOS parity flag is
  // not off. Web project_type never receives the iosFeatures param regardless
  // of the iOS flag. Unknown project_type defers to the generator default
  // (no iOS section).
  let iosFeatures: string[] | undefined;
  if (projectType === "ios" && !iosFlagDisabled) {
    const names = extractIosFeatureNames(state.ios_features);
    if (names.length > 0) iosFeatures = names;
  }

  try {
    return mod.renderSprintContext({
      buildState: state as Record<string, unknown>,
      refs,
      architecture,
      qualityTargets,
      iosFeatures,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-start sprint-context render failed (${msg}); skipping sprint context\n`,
    );
    return null;
  }
}

function emitAdditionalContext(content: string): void {
  process.stdout.write(`${JSON.stringify({ additional_context: content })}\n`);
}

async function main(): Promise<number> {
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
    // No state (build not started) or unparseable — nothing to stage and
    // no header to inject. Subagent spawns with its normal prompt.
    return 0;
  }

  const staged = buildStagedContext(key, payload, state);

  try {
    writeStaged(process.cwd(), staged);
  } catch (err) {
    // Staging is best-effort. Log once and continue — we never block subagent
    // spawn on a cache write failure, and header injection is independent.
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `buildanything: subagent-start could not write cache (${msg}); skipping\n`,
    );
  }

  const rendered = await renderHeader(process.cwd(), state);
  if (rendered) {
    // Phase 4 sprint-context hoist (task 6.2.1). Mirrors pre-tool-use.ts's
    // `current_phase ?? phase` precedence, since state writers on the
    // upgrade path may populate either field.
    const effectivePhase = coercePhase(state.current_phase ?? state.phase);
    let combined = rendered.content;
    if (effectivePhase === 4) {
      const sprint = await renderSprintContextBlock(process.cwd(), state);
      if (sprint) {
        combined = `${rendered.content}${SPRINT_CONTEXT_MARKER}${sprint.content}`;
      }
    }
    emitAdditionalContext(combined);
  }

  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // Last-resort guard: render path uses try/catch internally, but if
    // anything slips through, log and exit 0 so the subagent still spawns.
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`buildanything: subagent-start crashed (${msg})\n`);
    process.exit(0);
  },
);
