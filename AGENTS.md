---
description: Agent instructions for AIGP (Agent Interface Generation Platform)
globs: *
alwaysApply: true
---

# AIGP — Agent Instructions

SDK that auto-generates an agent capability layer from backend code and serves it on the public website (`/.well-known/agent.json`, `/agent/capabilities/*`).

---

## Read Before Anything Else

Read in this exact order:

1. `context/progress-tracker.md` — what is done, in progress, next
2. `context/project-overview.md` — scope, MVP boundaries, risks
3. `context/glossary.md` — canonical terms (do not redefine)
4. `context/architecture.md` — components, endpoints, data flows
5. `context/code-standards.md` — conventions, module boundaries
6. `context/build-plan.md` — phases, features, exit criteria

`context/idea_description.md` is the original brainstorm only — not canonical for implementation.

---

## Product Rules (Never Violate)

- **Capabilities ≠ routes.** Group at business level. Never 1:1 route-to-MCP-tool. ~15–30 capabilities per app, not 200 tools.
- **Analyze backend, expose on website.** SDK reads backend source; agents access public HTTP endpoints on the same domain.
- **Precision over recall.** Drop uncertain results. False capabilities are worse than missing ones. Flag low confidence; do not guess.
- **Thin runtime.** `ExecutorService` proxies to existing backend routes. Never reimplement business logic.
- **Build-time + runtime are both MVP.** `analyze` generates artifacts; `AgentLayerModule` serves discovery + execution in production.
- **Draft/pending capabilities never served.** Runtime exposes only `status: "approved"` capabilities.
- **No browser automation.** Opposite of product thesis. Never add scraping/click fallbacks.
- **Respect MVP scope.** No multi-framework, hosted SaaS, analytics, auth layer, or governance until post-MVP unless explicitly asked.

---

## Build Rules

- **Follow `build-plan.md` phase order.** Do not skip phases or gates (G1 static accuracy → G2 grouping → G3 runtime → G4 review).
- **One feature per task when possible.** Map work to a `Feature X.Y` ID from the build plan.
- **Tests before done.** Every completed feature needs tests per `code-standards.md` before marking `done` in progress tracker.
- **Update `progress-tracker.md` after every feature** — status, dates, decision log, notes, last-updated timestamp. Follow its update protocol exactly.
- **Log decisions.** Any implementation choice future agents must know goes in `progress-tracker.md` Decision Log.
- **Do not expand scope silently.** If a task needs something out of MVP scope, ask first.

---

## Code Rules

- **TypeScript strict.** No `any`. Follow naming and layout in `code-standards.md`.
- **Module boundaries.** `analyzer/` must not import `reasoner/` or `runtime/`. `core/` must not import `sdk/`.
- **Adapter pattern for frameworks.** NestJS only in MVP. No framework branching inside core pipeline logic.
- **Never execute user application code** during static analysis.
- **Version LLM prompts** (`domain.v1.ts`, etc.). Mock LLM in tests; no real API calls in CI.
- **Validate artifacts.** JSON Schema on write and read for all `.agent-layer/` files.
- **Minimize diff scope.** Only change code required for the current feature. Match existing conventions.

---

## When Stuck

- Same problem persists after one corrective attempt → stop and run `/recover`.
- Complex or ambiguous feature → run `/architect` before coding.
- Before demo or when output feels wrong → run `/review`.
- Multi-session work → `/remember save` at end; `/remember restore` at start.

---

## Available Skills

| Skill | When |
|---|---|
| `/architect` | Before any complex or ambiguous feature |
| `/review` | Before demo or when something feels off |
| `/recover` | When a fix fails twice — diagnose before retrying |
| `/remember save` | End of a multi-session feature |
| `/remember restore` | Resuming a multi-session feature |
| `/imprint` | After new UI components only (rare in this repo) |
