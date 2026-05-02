# buildanything

**One command to build an entire product.**

buildanything is a Claude Code plugin that orchestrates 48 specialist AI agents into a full engineering pipeline — from idea to shipped, tested, reviewed code. You describe what you want to build. buildanything handles research, design, architecture, implementation, behavioral testing, and hardening.

Works for both **web apps** and **iOS/Swift apps**.

## Install

```
npx buildanything
```

This installs the plugin and companion tools (agent-browser for behavioral testing, Playwright for E2E).

For iOS builds, run the iOS setup instead:
```
npx buildanything --ios
```

This additionally installs XcodeBuildMCP, apple-docs-mcp, and Maestro.

## Commands

### `/build` — Full Product Pipeline

Takes an idea and builds it through 8 phases (0–7) with quality gates, three-tier dispatch, per-feature behavioral verification, and a final launch review. iOS builds add a bootstrap phase (-1) for Xcode project + Maestro scaffold.

0. **Discover** — Scans for existing work, detects project type (web vs iOS), checks prerequisites, replays prior-build learnings.
1. **Plan** — Interactive brainstorming + 4 parallel research agents (market, tech, user, business) → PRD + product spec (canonical feature inventory: states, transitions, business rules, persona constraints, acceptance criteria) + per-project CLAUDE.md.
2. **Architect** — 6-architect team (backend, frontend, data, security, accessibility, performance) cross-checking each other → architecture doc + sprint task DAG.
3. **Design** — Competitive research, brand DNA card, component manifest, per-screen wireframes, living `/design-system` route, design critic loop targeting 195/240 across 7 DNA axes + 5 craft dimensions.
4. **Build** — Three-tier dispatch: Product Owner sequences features → Briefing Officer per feature decomposes into structured task briefs → implementers query the graph for spec slices and execute. Per-task verify gate after each.
5. **Audit** — Three orthogonal layers run in parallel:
   - **Track A (engineering reality)** — 5 parallel auditors: API contract, performance, accessibility, security, brand drift.
   - **Track B (product reality)** — one auditor per feature, runs 7 check classes (screen reachability, state coverage, transition firing, business-rule enforcement, happy path, persona walkthrough, manifest wiring) against the live app.
   - **Cross-cutting** — Playwright E2E for multi-feature journeys, autonomous dogfooding for emergent issues, fake-data detector for hardcoded mocks.

   All findings consolidate at the feedback synthesizer, then route to a fix loop.
6. **Launch Review** — 5 chapter judges (engineering quality, security, SRE, accessibility, brand) + aggregator that can route back to earlier phases on BLOCK.
7. **Ship** — Documentation, deployment, learnings capture.

```
/build a prediction market maker for Polymarket
/build docs/plans/my-design.md --autonomous
```

For iOS builds, the pipeline automatically routes to a Swift-native flow (SwiftUI, Swift 6.2, SwiftData, iOS 26 SDK).

### `/idea-sweep` — Parallel Research Sweep

5 research agents evaluate an idea in parallel. Outputs a decision brief: GO / PIVOT / INVESTIGATE / KILL.

```
/idea-sweep AI-powered building code compliance checker
```

### Post-Build Commands

| Command | Use case |
|---|---|
| `/fix` | "The submit button doesn't work" — scoped bug fixing with behavioral verification |
| `/ux-review` | "The dashboard feels cramped" — UX audit against the design system |
| `/add-feature` | "Add a pause button" — mini build cycle reusing the locked design system |
| `/dogfood` | "Test everything" — autonomous exploratory testing of the running app |
| `/verify` | "Does it all pass?" — 7-check health check |
| `/refactor` | "Change auth to OAuth" — architect plans, then incremental execution |

## How It Works

### Single Source of Truth via Graph

Phase 1 produces a canonical product spec (states, transitions, business rules, persona constraints, acceptance criteria). The plugin indexes it into a per-build graph. Phase 2-5 agents query the graph for typed slices instead of paraphrasing source markdown — closing the gap where product context gets lost between phases.

### Behavioral Verification

Every UI task is smoke tested after implementation. [agent-browser](https://github.com/vercel-labs/agent-browser) opens the app, clicks buttons, fills forms, and collects evidence: snapshot diffs, network inspection, console errors, annotated screenshots. Track B (Phase 5) extends this to a full per-feature reality check.

### Per-Project Brain

Phase 1 generates a `CLAUDE.md` file in your project root (<200 lines). This becomes auto-loaded context for every agent in subsequent phases — keeping product decisions, persona constraints, and architectural notes accessible without re-reading raw research.

### Living Design System

Phase 3 builds `DESIGN.md` (brand DNA + tokens + component prose) and a rendered `/design-system` route. Implementation agents reference both; the brand guardian audits the built output against the locked DNA card.

### Feedback Loops

- Per-task smoke test fails → fix + re-test (max 2 cycles)
- Phase 5 findings → synthesizer classifies → fix loop → re-verify (max 2 cycles)
- LRR Aggregator says BLOCK → routes back to the originating phase for re-work

Nothing gets logged and ignored.

## The 48 Agents

### Design (7)
Brand Guardian · Design Critic · Inclusive Visuals Specialist · UI Designer · UX Architect · UX Researcher · Visual Research

### Engineering (11)
AI Engineer · Backend Architect · Data Engineer · DevOps Automator · Frontend Developer · Mobile App Builder · Rapid Prototyper · Security Engineer · Senior Developer · SRE · Technical Writer

### iOS (8)
App Review Guardian · Foundation Models Specialist · StoreKit Specialist · Swift Architect · Swift Search · Swift UI Design · Swift Build Resolver · Swift Reviewer

### Code Quality (7)
A11y Architect · Code Architect · Code Reviewer · Code Simplifier · Refactor Cleaner · Security Reviewer · Silent Failure Hunter

### Testing (5)
API Tester · Evidence Collector · Performance Benchmarker · PR Test Analyzer · Reality Checker

### Planning & Research (4)
Business Model · Feature Intel · Planner · Tech Feasibility

### Product Pipeline (4)
Product Spec Writer · Product Owner · Briefing Officer · Product Reality Auditor

### Product & Marketing (2)
App Store Optimizer · Feedback Synthesizer

## License

MIT
