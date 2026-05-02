# Agent Prompt Authoring Standard

You are producing text that will become another agent's prompt. Task briefs, finding reports, routing rows, fix specs, critic verdicts — when your output is read by a downstream agent and shapes its behavior, the quality of your text is the quality of that next dispatch's input.

This protocol defines how to write that text well.

## Who this applies to

- `briefing-officer` — writes per-task briefs read by implementers
- `product-feedback-synthesizer` — writes routing rows read by Phase 5.5 fix dispatches
- `product-reality-auditor` — writes findings.json read by the synthesizer
- `design-critic` — writes findings that drive metric-loop fix prompts
- `product-owner` — writes feature-delegation plans read by briefing officers
- `code-architect` — writes implementation blueprints read by sprint planner + implementers
- LRR chapter judges — write verdicts read by the aggregator for backward routing

If your output is consumed by a human, this protocol does not apply — write for humans normally.

## The single rule

The receiving agent has not seen this conversation. It cannot ask follow-up questions. It will read your output and act. If a smart colleague reading the same text would be confused, the receiving agent will be too.

## Standards

### 1. Ground in quotes, not paraphrase

When your output references a source artifact (product-spec, page-spec, decisions.jsonl, findings.json, architecture.md), quote the source verbatim and carry the source location as a trailing reference. Paraphrase reintroduces the drift the graph layer was built to prevent.

- Weak: `User has 3 attempts to enter a code per the spec`
- Good: `User has 3 verification attempts before lockout (from product-spec.md L142)`

If the graph returns the field directly, copy it character-for-character. ID-to-label resolution and list-filtering are the only allowed transformations.

When the source field is negative by design (DNA `Don'ts`, banned phrases, system invariants), quote it verbatim — do not rewrite to positive framing. Standard 1 (verbatim) wins over Standard 2 (positive) when the source itself is intentionally negative.

### 2. Tell the receiver what to do, not what not to do

Positive prescriptions are unambiguous. Negative prescriptions force the receiver to enumerate the negative space and pick something from it — that's where drift happens.

- Weak: `Don't use generic colors`
- Good: `Use locked DNA palette: primary #0F172A, accent #F59E0B`

- Weak: `Don't skip error handling`
- Good: `On 4xx response, render the error toast component with the API body's message field`

Negative framing is justified for actual invariants the receiver would otherwise rationalize around — see Standard 5 for when to escalate.

### 3. Add the why for non-obvious constraints

Without motivation, the receiver cannot judge edge cases. A stated reason lets it reason about whether the rule applies in a borderline situation.

- Weak: `Use the manifest entry`
- Good: `Use the manifest entry — this slot is HARD-GATE; rebuilding it from scratch will fail Phase 5 brand audit`

- Weak: `Cap retries at 3`
- Good: `Cap retries at 3 — backend rate-limits at 5 req/sec per user (from architecture.md L88)`

### 4. Wrap structured inputs in XML tags

When you slot a complex artifact into your output (wireframe, acceptance criteria, persona constraints, API contract), wrap it. The receiver parses the boundary unambiguously.

```
<wireframe>
[verbatim ASCII from page-specs/checkout.md L20-45]
</wireframe>

<acceptance_criteria>
- Form renders all required fields per layout
- Submitting valid input calls POST /api/checkout once
</acceptance_criteria>
```

This matters most when your output contains long-form quoted content (>10 lines). Short inline values do not need tags.

### 5. Reserve HARD-GATE language for actual invariants

`MUST`, `STOP`, `do NOT` lose force when overused. Reserve them for rules where violation breaks the pipeline. Soft preferences dressed up as hard gates dilute the genuine ones.

Use HARD-GATE language for:
- Pipeline-breaking failures (graph-call failure → STOP, no silent fallback)
- Race-condition triggers (writer-owner violations corrupt files)
- Audit-blocking decisions (manifest `hard_gate: true` slots)
- Drift-introducing transformations on graph fields (verbatim slotting)

Use normal prescriptive language for everything else: "Use", "Include", "Quote", "Reference". A rule stated once with rationale is stronger than the same rule stated three times in escalating caps.

If you find yourself repeating a rule, the rule is fragile — fix it once at the source instead.

## Worked example — task brief block

### Weak brief

```
### Task 4.1: Build checkout
- Agent: engineering-frontend-developer
- Context:
  - Build the checkout flow per the spec
  - Make sure errors are handled
  - Use good design
- Acceptance: works
```

Violations: pointer-not-content (Standard 1), vague verb "handled" (Standard 2), uninstantiated "good design" (Standard 2), no testable criteria.

### Improved brief

```
### Task 4.1: Build checkout payment-method form
- Agent: engineering-frontend-developer
- Skills: react-best-practices, shadcn-composition
- Context:
  <wireframe>
  [verbatim ASCII from page-specs/checkout.md L20-45]
  </wireframe>
  - Components: shadcn Form.field, shadcn Input.text, shadcn Button.primary
  - Tokens: colors.primary, spacing.lg
  - API: POST /api/checkout, body {payment_method_id: string, amount_cents: number}, returns 200 {order_id} or 4xx {error: string}
  - Error states:
    - 402 → toast "Payment declined. Try a different card." (from product-spec.md L142)
    - 422 → inline field error "Invalid card number" (from product-spec.md L145)
  - Business rules: amount_cents minimum 50 (from product-spec.md L156)
  - Persona: [Buyer] complete checkout in 3 fields max (from product-spec.md L167)
- Acceptance:
  - Form renders all fields specified in wireframe
  - Submitting valid payment_method_id calls POST /api/checkout once
  - 402 response shows toast within 200ms
  - 422 response shows inline error tied to the offending field
```

Why this works: wireframe quoted verbatim, components carry library + variant, every constraint has a source ref, acceptance criteria are testable.

## Worked example — synthesizer routing row

### Weak finding

```json
{
  "finding_id": "f-042",
  "description": "Checkout has issues with persona requirements",
  "target_phase": 1
}
```

### Improved finding

```json
{
  "finding_id": "f-042",
  "source": "product-reality",
  "feature_id": "checkout",
  "target_phase": 1,
  "target_task_or_step": "1.6",
  "description": "Buyer persona constraint at product-spec.md L167 requires 3-field checkout, but spec also requires billing_address (5 fields) and shipping_address (5 fields). Constraint and required fields are mutually exclusive — spec needs disambiguation before Phase 4 can proceed.",
  "evidence_path": "evidence/product-reality/checkout/findings.json#f-042"
}
```

Why this works: contradiction stated concretely with line refs, evidence pointer is reachable, routing decision (`target_phase: 1`) is justified by the description text rather than asserted.

## When you are tempted to break these rules

- **"It's faster to summarize than to quote"** — the time you save now is paid with interest by the implementer who has to re-read the source to recover what you summarized away.
- **"The receiver will figure it out"** — the receiver has no conversation history. It will guess, and the guess will be plausible-looking but wrong.
- **"Adding the source ref is noisy"** — Phase 5 auditors and reviewers use source refs to spot-check. Without them, every claim is unverifiable.
- **"This rule is critical, I should repeat it for emphasis"** — repetition signals fragility. State it once with the why; if the rule actually breaks the pipeline, escalate to HARD-GATE language at the rule's source instead of restating in every dispatch.
