# buildanything

**One command to build an entire product.**

buildanything is a Claude Code plugin that orchestrates 44 specialist AI agents into a full engineering pipeline — from idea to shipped, tested, reviewed code. You describe what you want to build. buildanything handles research, design, architecture, implementation, behavioral testing, and hardening.

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

Takes an idea and builds it through 8 phases with quality gates, metric-driven iteration loops, and behavioral verification:

0. **Context & Pre-Flight** — Scans for existing work, checks prerequisites, initializes state.
1. **Brainstorm & Research** — Interactive brainstorming + 4 parallel research agents (market, tech, user, business). Writes CLAUDE.md as the product brain.
2. **Architecture & Planning** — 4 parallel architecture agents + sprint planning with user journeys, NFRs, and behavioral acceptance criteria per task.
3. **Design & Visual Identity** — Competitive research via Playwright, living style guide with every component rendered and interactive, visual QA scoring at 80/100.
4. **Foundation** — Scaffolding, design system from style guide, acceptance test stubs.
5. **Build** — Per-task: implement → cleanup → metric loop → behavioral smoke test → 7-check verification. Each task verified before the next starts.
6. **Harden** — 5 parallel audits (API, performance, accessibility, security, UX) → eval harness → E2E tests → autonomous dogfooding → Reality Checker with fix-and-retest loops.
7. **Ship** — Requirements coverage report, documentation, learnings capture.

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
| `/ux-review` | "The dashboard feels cramped" — UX audit against the living style guide |
| `/add-feature` | "Add a pause button" — mini build cycle using existing design system |
| `/dogfood` | "Test everything" — autonomous exploratory testing of the running app |
| `/verify` | "Does it all pass?" — 7-check health check |
| `/refactor` | "Change the auth to OAuth" — architect plans, then incremental execution |

## How It Works

### SDK-Based Orchestration

All agent dispatch runs through the Claude Agent SDK. Parallel agents operate with exclusive write leases — preventing file collisions when multiple implementers work the same phase simultaneously. State is persisted atomically so builds survive interruption and can be resumed.

### Behavioral Verification (agent-browser)

Every UI task is smoke tested after implementation. [agent-browser](https://github.com/vercel-labs/agent-browser) opens the app, clicks buttons, fills forms, and collects evidence: snapshot diffs, network inspection, console errors, annotated screenshots. If a button doesn't work, the smoke test catches it immediately.

### Living Style Guide

Phase 3 builds a rendered, interactive style guide at `/design-system` with every component in every state. Implementation agents reference it; the UX audit compares every page against it.

### Feedback Loops

- Smoke test fails → fix agent + re-test (max 2 cycles)
- Dogfood finds issues → classify + fix + re-dogfood (max 3 cycles)
- Reality Checker says NEEDS WORK → fix + re-verify + re-check (max 2 cycles)

Nothing gets logged and ignored.

## The 44 Agents

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

### Product & Marketing (2)
App Store Optimizer · Feedback Synthesizer

## License

MIT
