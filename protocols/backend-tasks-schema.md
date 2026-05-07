# Backend Tasks Schema

Schema for `docs/plans/backend-tasks.md` — the pipe-delimited markdown table produced by the architect agents (Step 2.3.2) and parsed by `src/graph/parser/backend-tasks.ts`.

**IMPORTANT:** This file contains ONLY backend/infrastructure tasks (migrations, RLS policies, RPCs, auth infra, rate limits, cron jobs, API routes without UI). All UI work is driven by `page-specs/*.md` directly — there are NO UI tasks in this file.

## Columns (required, in order)

| # | Column | Format | Rules |
|---|--------|--------|-------|
| 1 | Task ID | `T-{N}` (e.g. `T-1`, `T-2`) | Must not be empty. No duplicates (case-insensitive). |
| 2 | Title | Free text | Human-readable task description. |
| 3 | Size | `S`, `M`, or `L` | Case-insensitive; parser normalizes to uppercase. |
| 4 | Dependencies | Comma-separated Task IDs | e.g. `T-1, T-3`. Use `—` for none. Phase 4 uses this to batch independent tasks in parallel. |
| 5 | Behavioral Test | Concrete testable assertion | DB: SQL assertion. API: curl-based. Auth: session assertion. Must be verifiable without a browser. |
| 6 | Owns Files | Comma-separated file paths | Files this task creates or modifies. |
| 7 | Feature | Exact feature name from `product-spec.md` | Must match a `## Feature: X` heading. Use `infra` for cross-cutting infrastructure. |

## What belongs here

- Database migrations (schema, RLS, SECURITY DEFINER functions, seed data)
- Auth infrastructure (session management, OAuth setup, middleware)
- API route handlers (the server-side logic, NOT the page that calls them)
- Rate limiting, cron jobs, background workers
- Storage policies, CDN configuration
- CI/CD pipelines, deployment config

## What does NOT belong here

- Any page or screen implementation → goes in `page-specs/*.md`
- Any component implementation → driven by page-specs
- Any visual/UX decision → driven by page-specs + DESIGN.md
- Font loading, asset creation → driven by page-specs

## Validation Rules

1. Table must have **exactly 7 columns**.
2. All 7 column headers must be present.
3. **Task ID** must not be empty or duplicated.
4. **Size** must be one of `S`, `M`, `L`.
5. **No task may reference a screen or UI component in its title or behavioral test.** If it does, it belongs in page-specs instead.

## Graph Edges Emitted Per Row

| Relation | Source | Target |
|----------|--------|--------|
| `task_implements_feature` | `task__{task-id}` | `feature__{kebab-name}` |
| `task_depends_on` | `task__{task-id}` | `task__{dep-id}` |

## Phase 4 Build Order

Backend tasks run as **Wave 1** (before any UI work begins). The Product Owner sequences them by dependency DAG. Once all backend tasks pass their behavioral tests, UI implementation begins from page-specs.

## References

- **Parser:** `src/graph/parser/backend-tasks.ts`
- **Architect prompt:** `commands/build.md` Step 2.3, dispatch #2
- **Graph index command:** `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/backend-tasks.md`
