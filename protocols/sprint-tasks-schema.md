# Sprint Tasks Schema

Schema for `docs/plans/sprint-tasks.md` — the pipe-delimited markdown table produced by the planner agent (Step 2.3.2) and parsed by `src/graph/parser/sprint-tasks.ts`.

## Columns (required, in order)

| # | Column | Format | Rules |
|---|--------|--------|-------|
| 1 | Task ID | `T-{N}` (e.g. `T-1`, `T-2`) | Must not be empty. No duplicates (case-insensitive). |
| 2 | Title | Free text | Human-readable task description. |
| 3 | Size | `S`, `M`, or `L` | Case-insensitive; parser normalizes to uppercase. |
| 4 | Dependencies | Comma-separated Task IDs | e.g. `T-1, T-3`. Use `—` for none. Phase 4 uses this to batch independent tasks in parallel. |
| 5 | Behavioral Test | Concrete testable interaction | UI: `Navigate to X, click Y, verify Z`. API: curl-based. Should reference a product-spec acceptance criterion. |
| 6 | Owns Files | Comma-separated file paths | Files this task creates or modifies. Use `—` for none. |
| 7 | Implementing Phase | Phase identifier | e.g. `phase-4-frontend`, `phase-4-backend`. |
| 8 | Feature | Exact feature name from `product-spec.md` | Must match a `## Feature: X` heading. Use `—` for infrastructure tasks. Parser generates graph ID via kebab-case: `Order Placement` → `feature__order-placement`. |
| 9 | Screens | Comma-separated screen names | From the product-spec Screen Inventory. Use `—` for backend-only tasks. Parser generates IDs via kebab-case: `Catalog` → `screen__catalog`. |

## Validation Rules

The parser enforces these rules and rejects the table on any violation:

1. Table must have **exactly 9 columns**.
2. All 9 column headers must be present (matched case-insensitively).
3. **Task ID** must not be empty.
4. **Task ID** must not be duplicated (case-insensitive comparison).
5. **Size** must be one of `S`, `M`, `L`.

The DAG validator (Step 2.3, dispatch #3) additionally checks:
- No circular dependencies.
- All Task IDs referenced in Dependencies exist.
- Every UI task has a Behavioral Test; every API task has a curl-based test.

## Graph Edges Emitted Per Row

| Relation | Condition | Source | Target |
|----------|-----------|--------|--------|
| `task_implements_feature` | Feature is not `—` | `task__{task-id}` | `feature__{kebab-name}` |
| `task_touches_screen` | Per screen when Screens is not `—` | `task__{task-id}` | `screen__{kebab-name}` |
| `task_depends_on` | Per dependency in Dependencies | `task__{task-id}` | `task__{dep-id}` |

## Example Row

```
| T-3 | Implement product catalog grid | M | T-1, T-2 | Navigate to /catalog, verify 12 product cards render with images and prices | src/components/CatalogGrid.tsx, src/api/products.ts | phase-4-frontend | Product Browsing | Catalog, Product Detail |
```

## References

- **Parser:** `src/graph/parser/sprint-tasks.ts`
- **Planner prompt:** `commands/build.md` Step 2.3, dispatch #2 ("Sprint breakdown")
- **DAG validator:** `commands/build.md` Step 2.3, dispatch #3 ("Task DAG validator")
- **Graph index command:** `node ${CLAUDE_PLUGIN_ROOT}/bin/graph-index.js docs/plans/sprint-tasks.md`
