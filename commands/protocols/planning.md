# Planning Protocol

You are the orchestrator converting a validated Design Document and Architecture Document into an ordered, developer-ready task list.

## Input

You need two documents before running this protocol:
- **Design Document** (`docs/plans/YYYY-MM-DD-[topic]-design.md`) — scope, user flows, data model, tech stack
- **Architecture Document** (`docs/plans/architecture.md`) — services, API contracts, database schema, component tree

## Step 0: User Journeys & NFRs (orchestrator-authored)

Before breaking into tasks, YOU (the orchestrator) define two things from documents you already have:

**User Journeys (3-7):** End-to-end flows derived from the Design Document's user flows and Architecture's page routes. Each journey is a numbered sequence of user actions covering one core workflow.

```
### Journey 1: [name]
1. User [action] on [page]
2. User [action] → sees [result]
3. User [action] → system [response]
...
```

Every journey step must map to at least one sprint task. If a step has no task, you have a planning gap — add the task. These journeys become the spec for Phase 6 E2E tests.

**Non-Functional Requirements (NFRs):** Extract from the architecture and research docs. Keep to what's measurable:

```
## NFRs
- **Performance:** [e.g., API response < 200ms, page load < 3s, streaming data latency < 1s]
- **Accessibility:** [e.g., WCAG AA, keyboard navigable, screen reader compatible]
- **Security:** [e.g., auth required for all /api routes, data encrypted at rest, no secrets in client bundle]
- **Reliability:** [e.g., graceful degradation on API failure, retry logic for network errors]
```

Only include NFRs the project actually needs — don't add generic ones. These feed into Phase 6 hardening audit thresholds.

Save both to the top of `docs/plans/sprint-tasks.md`, before the task list.

## Step 1: Break Down

Decompose the architecture into ordered, atomic tasks. Each task must be:

- **Implementable independently** — a developer agent can build it without needing unfinished work from other tasks
- **Testable** — there are concrete acceptance criteria that can be verified
- **Scoped to MVP** — if the design doc says a feature is deferred, do not create tasks for it

For each task:

```
### Task [N]: [name]
**Type:** frontend / backend / integration / infrastructure
**Description:** [what to build, 2-3 sentences]
**Acceptance Criteria:**
- [ ] [specific, verifiable criterion]
- [ ] [specific, verifiable criterion]
**Dependencies:** [task numbers that must complete first, or "none"]
**Size:** S (< 1 hour) / M (1-3 hours) / L (3+ hours)
**Behavioral Test:** [For UI tasks: "Navigate to [page], [action], verify [expected outcome]". For API tasks: "curl -X POST /api/[endpoint] with [payload] → expect [response]". For non-interactive tasks: "N/A"]
```

## Step 2: Order

Order tasks by dependency chain, then by priority within each dependency level:

1. Infrastructure/scaffolding first (project setup, database schema, base config)
2. Core data model and API endpoints
3. Primary user flow (the main thing the user does)
4. Supporting features
5. Polish, error handling, edge cases

Flag any circular dependencies — these indicate an architecture problem that needs resolution before building.

## Step 3: Validate

Check the task list against the design doc:

- Every feature in MVP scope has at least one task
- No task exceeds the MVP boundary
- No task is too large (L tasks should be split if possible)
- Dependency chains are no deeper than 3 levels
- Acceptance criteria are specific enough that a developer agent can verify them without ambiguity

## Step 4: Save

Save to `docs/plans/sprint-tasks.md`.
