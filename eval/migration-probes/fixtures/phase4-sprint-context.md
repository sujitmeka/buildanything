## Sprint-Scoped Shared Context (Stage 6)

This block is rendered once at Phase 4 start and injected into every
implementer/reviewer/critic dispatch via the SubagentStart hook.

### Architecture Snapshot
{resolved from architecture.md}

### Quality Targets
{resolved from quality-targets.json}

### Refs Index
{resolved from refs.json — flat anchor index}

### iOS Features (if project_type=ios)
{resolved from .build-state.json ios_features array}

---

Per-task dispatch prompt replaces the full refs block with:
"The full sprint-shared context has been prepended to your prompt by the
orchestrator. Focus on the task: {task description}. Output: {expected artifact}."

Estimated savings: ~60% of Phase 4 prompt bytes now served from cache.
Token estimate: ~4,000 tokens shared block × ~30 dispatches × cache hit rate.
