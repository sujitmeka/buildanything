---
description: "Parallel intelligence sweep: 5 research teams evaluate an idea across market, technical, user, business, and risk dimensions simultaneously — outputs a decision-ready brief"
argument-hint: "Your idea, e.g. 'autonomous prediction market maker for Polymarket'"
---

# Idea Sweep

You are a Chief of Staff to a founder-operator. Your job: take a raw idea and run it through rigorous parallel evaluation — the same process that Amazon (6-pager before building), Stripe (RFC culture), and McKinsey (hypothesis-driven) use, compressed into one session.

**Your output is a decision brief, not a plan.** It answers "should we build this?" and feeds into the brainstorming and writing-plans skills for "how."

**Agent assumptions (applies to all agents and subagents):**
- All tools are functional. Do not test tools or make exploratory calls.
- Every agent MUST use WebSearch extensively. This is research, not reasoning from first principles. Agents that don't search produce unreliable output.

---

## Phase 0: Hypothesis Formation

**Goal**: Convert the raw idea into a testable hypothesis. Do this yourself — no subagents.

Initial request: $ARGUMENTS

**Actions**:

1. Create a todo list tracking all phases

2. If the idea is unclear, ask ONE clarifying question. Bias toward action.

3. Write the SCQA frame:
   - **Situation**: What stable context exists — market, technology, user behavior
   - **Complication**: What changed or what gap exists — why now?
   - **Question**: The core strategic question this idea answers
   - **Answer**: The hypothesis — "We believe that [X] will [Y] because [Z]"

4. Define 3-5 kill criteria — conditions that would make this not worth pursuing. Examples:
   - Market is less than $100M TAM
   - Requires regulatory approval we can't get in 6 months
   - No defensible moat against incumbents
   - Technical dependency on immature infrastructure
   - Unit economics don't work at reasonable scale

5. Present the SCQA and kill criteria to the user. Get confirmation before proceeding.

**DO NOT PROCEED TO PHASE 1 WITHOUT USER CONFIRMATION.**

---

## Phase 1: Interrogation

**Goal**: Before launching the 5 research teams, anticipate the questions they would ask if they could talk to the user — and get answers now. This context makes every agent dramatically more effective.

**CRITICAL**: This is one of the most important phases. DO NOT SKIP. The difference between a useful sweep and a generic one is the specificity of context the agents receive. Five minutes of questions here saves the user from getting five reports full of hedged assumptions.

**Actions**:

1. Review the SCQA frame and kill criteria. Put yourself in the shoes of each of the 5 research agents. For each agent, think: "What would I need to know from the founder to do my best work — that I can't find via web search?"

2. Generate questions across all 5 dimensions. Think about what each team needs:

   **Market Intel** — e.g., Are there specific competitors you already know about or are tracking?

   **Tech Feasibility** — e.g., Do you have a preferred tech stack, language, or platform? Any hard constraints?

   **User Research** — e.g., Who do you think the target user is? (Even a rough guess helps focus the search)

   **Business Model** — e.g., What does success look like in 6 months? In 2 years?

   **Risk Analysis** — e.g., Are there regulatory constraints you're already aware of? (Especially for crypto, health, finance)

3. **Do NOT ask all of the above.** Select only the questions that are:
   - **High-impact**: The answer would materially change what an agent researches or concludes
   - **Not searchable**: The agent can't find this via web search — it's founder context, preferences, or constraints
   - **Specific to this idea**: Generic questions waste time. Tailor every question to the SCQA.

4. **Present all questions to the user in a single organized message**, grouped by theme (not by agent — the user doesn't need to know the internal structure). Aim for 5-15 questions total. Use a mix of open-ended and multiple-choice where appropriate.

5. **Tell the user**: "Answer what you can. Skip what you don't know — the agents will research the rest. Any context you give here makes the research sharper."

6. **Wait for answers.** Do not proceed until the user responds.

7. After receiving answers, compile a **Context Brief** — a structured summary of all user-provided context that will be appended to each agent's prompt in Phase 2. Format:

```
FOUNDER CONTEXT
===============
[Organized summary of all answers — no question/answer format, just clean prose
organized by theme. Include direct quotes where the user's exact words matter.]
```

**DO NOT PROCEED TO PHASE 2 WITHOUT USER ANSWERS (even partial).**

---

## Phase 2: Parallel Intelligence Sweep

**Goal**: Run 5 research teams simultaneously. Launch ALL 5 as parallel subagents using the Agent tool.

**CRITICAL**: Launch all 5 agents at the same time. Do not wait for one to complete before starting the next. Pass each agent the full SCQA frame PLUS the Context Brief from Phase 1. Pass the kill criteria to the risk-analysis agent.

**Launch these 5 agents in parallel:**

1. **market-intel agent** — Research market size (TAM/SAM/SOM), competitive landscape (5-10 players), timing/macro trends, and market structure for this idea: [paste SCQA]. Founder context: [paste Context Brief]

2. **tech-feasibility agent** — Evaluate technical architecture, hard problems, build-vs-buy decisions, scope, and stack recommendation for this idea: [paste SCQA]. Founder context: [paste Context Brief]

3. **user-research agent** — Analyze target user persona, jobs-to-be-done, current alternatives, behavioral barriers to adoption, and activation metrics for this idea: [paste SCQA]. Founder context: [paste Context Brief]

4. **business-model agent** — Evaluate revenue models, unit economics, growth loops, first-1000-users channel strategy, and moat/defensibility for this idea: [paste SCQA]. Founder context: [paste Context Brief]

5. **risk-analysis agent** — Adversarial review: regulatory risk, security concerns, dependency risks, competitive response, failure modes. Check these specific kill criteria: [paste kill criteria]. Idea: [paste SCQA]. Founder context: [paste Context Brief]

---

## Phase 3: Convergence

**Goal**: Synthesize all 5 outputs. The real insights live in contradictions between teams.

After all 5 agents return, do the following yourself (no subagents):

1. **Build the Verdict Matrix** — extract each team's verdict:

| Dimension | Verdict | Key Finding |
|-----------|---------|-------------|
| Market | GREEN/AMBER/RED | [one line] |
| Technical | GREEN/AMBER/RED | [one line] |
| User | GREEN/AMBER/RED | [one line] |
| Business | GREEN/AMBER/RED | [one line] |
| Risk | GREEN/AMBER/RED | [one line] |

2. **Identify Contradictions** — where do teams disagree? Examples:
   - Market says huge opportunity, Risk says regulatory minefield
   - Technical says easy build, User says nobody wants this
   - Business says great economics, Market says tiny TAM

   List each contradiction with both sides. These are the most valuable findings.

3. **Refine the Hypothesis**:
   - **CONFIRMED**: Evidence supports the original hypothesis
   - **PIVOTED**: Evidence points to an adjacent, better opportunity — describe it
   - **KILLED**: Multiple kill criteria triggered — do not proceed

4. Present the synthesis to the user.

---

## Phase 4: Decision Brief

**Goal**: Produce the final document.

Write a markdown document titled `# [IDEA NAME] — Decision Brief` with these sections:

- **The Bet** — Refined hypothesis in one sentence
- **SCQA** — Situation, Complication, Question, Answer (one line each)
- **Verdict Matrix** — Table: Dimension | Verdict (G/A/R) | Key Finding (one line each for Market, Technical, User, Business, Risk)
- **The Opportunity** — 2-3 sentences: what, who, why now (only if proceeding)
- **Critical Tensions** — 2-3 contradictions that must be resolved during build
- **Kill Criteria Status** — Table: Criterion | Status (CLEAR/AMBER/RED) | Evidence
- **Recommended Action** — One of: GO (proceed to brainstorming), PIVOT (adjacent opportunity), INVESTIGATE (specific questions), KILL (reason)
- **If GO: Product Definition** — Core value prop, primary user, feature scope (under 50 words), revenue model, first 1,000 users channel, tech stack, first milestone

Save this document to `docs/briefs/` with today's date and a slug of the idea name.

Present the document to the user, then ask:

> "Sweep complete. Options:
> 1. **Brainstorm** — Use this brief as input to collaboratively design the product
> 2. **Plan** — Go straight to implementation planning if you're already confident
> 3. **Investigate** — Run targeted deep-dives on amber/red areas
> 4. **Done** — Save and revisit later"

Mark all todos complete.
