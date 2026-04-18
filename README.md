# buildanything

**One command to build an entire product.**

buildanything is a Claude Code plugin that orchestrates 44 specialist AI agents into a full engineering pipeline — from idea to shipped, tested, reviewed code. You describe what you want to build. buildanything handles research, design, architecture, implementation, behavioral testing, and hardening.

No agent expertise required. No manual coordination. Just `/build`.

## Install

```
npx buildanything
```

This installs the plugin, companion plugins, and [agent-browser](https://github.com/vercel-labs/agent-browser) for behavioral testing.

**Or manually in Claude Code:**
```
/plugin marketplace add sujitmeka/buildanything
/plugin install buildanything@buildanything-marketplace
```

## Commands

### `/build` — Full Product Pipeline

Takes an idea and builds it through 8 phases with quality gates, metric-driven iteration loops, and behavioral verification:

0. **Context & Pre-Flight** — Scans for existing work, checks prerequisites, initializes state.
1. **Brainstorm & Research** — Interactive brainstorming + 5 parallel research agents (market, tech, user, business, risk). Writes CLAUDE.md as the product brain.
2. **Architecture & Planning** — 4 parallel architecture agents + sprint planning with user journeys, NFRs, and behavioral acceptance criteria per task.
3. **Design & Visual Identity** — Competitive research via Playwright, living style guide with every component rendered and interactive, visual QA scoring at 80/100. Anti-AI-template detection.
4. **Foundation** — Scaffolding, design system from style guide, acceptance test stubs (TDD-style — tests fail until features are built).
5. **Build** — Per-task: implement → cleanup → metric loop → behavioral smoke test (agent-browser) → 7-check verification. Each task verified before the next starts.
6. **Harden** — 5 parallel audits (API, performance, accessibility, security, UX quality) → eval harness → metric loop → E2E tests from user journeys → autonomous dogfooding → fake data detector → Reality Checker with fix-and-retest loops.
7. **Ship** — Requirements coverage report, documentation, learnings capture.

```
/build a prediction market maker for Polymarket
/build docs/plans/my-design.md --autonomous
```

### `/idea-sweep` — Parallel Research Sweep

5 research agents evaluate an idea in parallel. Outputs a decision brief: GO / PIVOT / INVESTIGATE / KILL.

```
/idea-sweep AI-powered building code compliance checker
```

### Post-Build Commands

| Command | Use case |
|---|---|
| `/fix` | "The submit button doesn't work" — scoped bug fixing with agent-browser verification |
| `/ux-review` | "The dashboard feels cramped" — UX audit against the living style guide, mobile checks |
| `/add-feature` | "Add a pause button" — mini build cycle using existing design system and architecture |
| `/dogfood` | "Test everything" — autonomous exploratory testing of the running app |
| `/verify` | "Does it all pass?" — quick 7-check health check |
| `/refactor` | "Change the auth to OAuth" — architect plans the change, then incremental execution |

All commands are argument-driven — they scope themselves to what you describe.

## How It Works

### Behavioral Verification (agent-browser)

Every UI task is smoke tested after implementation. [agent-browser](https://github.com/vercel-labs/agent-browser) opens the app, clicks buttons, fills forms, and collects evidence:

- **Snapshot diffs** — verifies DOM actually changes when you click something
- **Network inspection** — catches failed API calls and missing endpoints
- **Console errors** — catches uncaught JS exceptions
- **Annotated screenshots** — labeled visual evidence (Claude is multimodal)
- **HAR capture** — full network traffic for fake data analysis

If a button doesn't work, the smoke test catches it immediately — not in Phase 6.

### Living Style Guide

Phase 3 builds a rendered, interactive style guide at `/design-system` with every component in every state. This ships with the product and is referenced at every stage:

- Phase 4: Design system tokens match the style guide
- Phase 5: Implementation agents reference it for UI tasks
- Phase 6: UX audit compares every page against it

### Feedback Loops

Every testing step feeds back into development:

- Smoke test fails → fix agent + re-test (max 2 cycles)
- Dogfood finds issues → classify + fix + re-dogfood (max 3 cycles)
- Fake data detected → fix agent replaces with real API calls (max 2 cycles)
- Reality Checker says NEEDS WORK → classify issues + fix + re-verify + re-check (max 2 cycles)

Nothing gets logged and ignored.

## The 61 Agents

### Design (8)
Brand Guardian · Image Prompt Engineer · Inclusive Visuals Specialist · UI Designer · UX Architect · UX Researcher · Visual Storyteller · Whimsy Injector

### Engineering (9)
AI Engineer · Autonomous Optimization Architect · Backend Architect · Data Engineer · DevOps Automator · Frontend Developer · Mobile App Builder · Rapid Prototyper · Security Engineer · Senior Developer · Technical Writer

### Marketing (8)
App Store Optimizer · Instagram Curator · Reddit Community Builder · Social Media Strategist · TikTok Strategist · Twitter Engager · WeChat Official Account Manager · Xiaohongshu Specialist · Zhihu Strategist

### Product (2)
Behavioral Nudge Engine · Feedback Synthesizer

### Project Management (1)
Experiment Tracker

### Specialized (4)
Agentic Identity & Trust Architect · Cultural Intelligence Strategist · Developer Advocate · Data Consolidation Agent · Report Distribution Agent · Sales Data Extraction Agent

### Support (5)
Analytics Reporter · Executive Summary Generator · Finance Tracker · Legal Compliance Checker · Support Responder

### Testing (7)
Accessibility Auditor · API Tester · Evidence Collector · Performance Benchmarker · Reality Checker · Test Results Analyzer · Tool Evaluator · Workflow Optimizer

### Research (5)
market-intel · tech-feasibility · user-research · business-model · risk-analysis

## License

MIT
