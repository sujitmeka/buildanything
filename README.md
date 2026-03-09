# OneShot

**One command to build an entire product.**

OneShot is a Claude Code plugin that orchestrates 73 specialist AI agents into a full engineering pipeline. You describe what you want to build. OneShot handles architecture, implementation, testing, code review, security audit, accessibility, and documentation — the same process that teams at Meta, Google, and Stripe run, compressed into one session.

No agent expertise required. No manual coordination. Just `/build`.

## Install

**One command:**
```
npx autobuilder
```

**Or manually in Claude Code:**
```
/plugin marketplace add sujitmeka/autobuilder
/plugin install oneshot@autobuilder-marketplace
```

## Commands

### `/build` — Full Product Pipeline

Takes a brainstormed idea and builds it. Runs 5 phases with quality gates between each:

1. **Architecture** — Backend Architect, UX Architect, Security Engineer, and code-architect design the system. Sprint Prioritizer and Senior Project Manager break it into ordered tasks with acceptance criteria.

2. **Foundation** — DevOps Automator and Frontend Developer scaffold the project. UX Architect lays down the design system.

3. **Build** — Each task goes through Dev→Test→Review loops. Frontend Developer, Backend Architect, or AI Engineer implement. Evidence Collector verifies. code-reviewer and silent-failure-hunter review. Failed tasks loop back with feedback, max 3 retries before escalating to you.

4. **Harden** — API Tester, Performance Benchmarker, Accessibility Auditor, and Security Engineer stress-test the full product. code-simplifier and type-design-analyzer clean up. Reality Checker gives the final verdict (defaults to NEEDS WORK).

5. **Ship** — Technical Writer documents everything. Clean commits. Completion report.

```
/build autonomous prediction market maker for Polymarket
/build docs/plans/2025-06-15-my-idea-design.md
```

### `/idea-sweep` — Parallel Research Sweep

Takes a raw idea and runs 5 research teams in parallel to decide if it's worth building:

- **market-intel** — TAM/SAM/SOM, competitive landscape, timing
- **tech-feasibility** — Architecture sketch, hard problems, build vs buy, MVP scope
- **user-research** — Persona, JTBD, current alternatives, behavioral barriers
- **business-model** — Revenue model, unit economics, growth loops, moat
- **risk-analysis** — Regulatory, security, dependencies, failure modes

Outputs a decision brief: GO / PIVOT / INVESTIGATE / KILL.

```
/idea-sweep AI-powered building code compliance checker
```

## The 73 Agents

OneShot includes agents from [agency-agents](https://github.com/msitarzewski/agency-agents) and custom research agents, organized into specialist divisions:

### Design (8)
Brand Guardian · Image Prompt Engineer · Inclusive Visuals Specialist · UI Designer · UX Architect · UX Researcher · Visual Storyteller · Whimsy Injector

### Engineering (11)
AI Engineer · Autonomous Optimization Architect · Backend Architect · Data Engineer · DevOps Automator · Frontend Developer · Mobile App Builder · Rapid Prototyper · Security Engineer · Senior Developer · Technical Writer

### Marketing (11)
App Store Optimizer · Content Creator · Growth Hacker · Instagram Curator · Reddit Community Builder · Social Media Strategist · TikTok Strategist · Twitter Engager · WeChat Official Account Manager · Xiaohongshu Specialist · Zhihu Strategist

### Product (4)
Behavioral Nudge Engine · Feedback Synthesizer · Sprint Prioritizer · Trend Researcher

### Project Management (5)
Experiment Tracker · Project Shepherd · Senior Project Manager · Studio Operations · Studio Producer

### Spatial Computing (6)
macOS Spatial/Metal Engineer · Terminal Integration Specialist · visionOS Spatial Engineer · XR Cockpit Interaction Specialist · XR Immersive Developer · XR Interface Architect

### Specialized (9)
Agentic Identity & Trust Architect · Agents Orchestrator · Cultural Intelligence Strategist · Data Analytics Reporter · Data Consolidation Agent · Developer Advocate · LSP/Index Engineer · Report Distribution Agent · Sales Data Extraction Agent

### Support (6)
Analytics Reporter · Executive Summary Generator · Finance Tracker · Infrastructure Maintainer · Legal Compliance Checker · Support Responder

### Testing (8)
Accessibility Auditor · API Tester · Evidence Collector · Performance Benchmarker · Reality Checker · Test Results Analyzer · Tool Evaluator · Workflow Optimizer

### Research (5)
market-intel · tech-feasibility · user-research · business-model · risk-analysis

## Works With

OneShot is designed to work alongside Claude Code's built-in plugins:

- **feature-dev** — OneShot's `/build` command invokes `code-architect`, `code-explorer`, and `code-reviewer` from this plugin
- **pr-review-toolkit** — `silent-failure-hunter`, `code-simplifier`, `type-design-analyzer`, `comment-analyzer` are used in hardening
- **code-review** — Used for final code review passes
- **commit-commands** — Used for clean git commits during the pipeline

Install these from the official Anthropic marketplace for the full experience:
```
/plugin install feature-dev@claude-plugin-directory
/plugin install pr-review-toolkit@claude-plugin-directory
/plugin install code-review@claude-plugin-directory
/plugin install commit-commands@claude-plugin-directory
```

## Credits

- Agent definitions from [agency-agents](https://github.com/msitarzewski/agency-agents) by Mike Sitarzewski
- Orchestration patterns inspired by the [NEXUS framework](https://github.com/msitarzewski/agency-agents/blob/main/strategy/QUICKSTART.md)
- Claude Code plugin architecture by [Anthropic](https://github.com/anthropics/claude-code)

## License

MIT
