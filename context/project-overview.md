# Project Overview — AIGP

> **Product context.** Scope, markets, risks. For terms → `glossary.md`. For technical design → `architecture.md`. For build order → `build-plan.md`.

---

## Metadata

| Field | Value |
|---|---|
| **Name** | Agent Interface Generation Platform (AIGP) |
| **Package** | `@agent-layer/sdk` (proposed) |
| **Stage** | Pre-build |
| **MVP** | Auto-generate capability layer + serve on live website |
| **Thesis** | Make websites agent-operable; don't make agents better at browsing |
| **Accuracy target** | 90–95% capability precision; human review for low-confidence items |

---

## Summary

**Problem:** Agents use brittle browser automation on human-designed websites.  
**Solution:** SDK analyzes backend code, generates curated capabilities, serves them on the public domain via `/.well-known/agent.json` and `/agent/capabilities/*`.

```
Today:   Agent → Browser → Website
Future:  Agent → Capability Layer → Website
```

**Principle:** Analyze backend. Expose on website. Frontend and agents are parallel consumers of the same API.

---

## Vision

Create the missing **Agent Layer** (capabilities, actions, permissions, structured responses) alongside the existing Human Layer.

**Long-term:** `/.well-known/agent.json` becomes the standard agent discovery mechanism — like `robots.txt` for crawlers.

---

## Problem & Positioning

| Approach | Limitation |
|---|---|
| Browser automation (Browserbase, Steel) | Slow, fragile, expensive |
| Scraping (Firecrawl, Crawl4AI) | Read only; no actions |
| Manual APIs / MCP | Engineering cost; no auto-sync |
| Code→OpenAPI tools (OOPS, api2spec) | Route-level; no semantic capabilities |
| OpenAPI→MCP (FastMCP) | Tool explosion (1 route = 1 tool) |

**AIGP fills the gap:** Code → **business capabilities** → discovery + execution. ~15–20 capabilities per app, not 200 tools.

---

## MVP Scope

> Full task breakdown: `context/build-plan.md` (Phases 0–4).

### In

- NestJS adapter; static analysis → RouteGraph
- LLM semantic pipeline → curated `capabilities.json`
- Human review for confidence < 0.85
- Runtime: `AgentLayerModule` serves discovery + execution on public domain
- Outputs: `agent.json`, `agent-card.json`, `openapi.json`, local MCP (`serve-mcp`)
- Read + safe writes only; no checkout/payments

### Out

- Multi-framework, frontend analysis, hosted SaaS, agent analytics
- Auth layer, governance, transactional actions, IETF `/.well-known/ai`
- Browser automation fallback (never)
- Visual apps: Figma, CAD, gaming (not inferable)

### Done when

- [ ] ≥90% precision on fixture NestJS app
- [ ] Capability count curated (10–30), not 1:1 with routes
- [ ] `/.well-known/agent.json` live; `POST /agent/capabilities/:id` works
- [ ] `serve-mcp` callable from Cursor; unapproved capabilities blocked at runtime

---

## Post-MVP (Phases 5–6)

Multi-framework adapters, CI sync, RAG tool serving, auth/governance, analytics, optional hosted platform. See `build-plan.md`.

---

## Markets

| Target | Why |
|---|---|
| Ecommerce | Clear actions, high volume, ROI |
| SaaS | Tickets, projects, user mgmt |
| Marketplaces | Search, booking, payments |

**Avoid:** Heavily visual/interactive products.

---

## Accuracy Targets

| Sub-problem | Target |
|---|---|
| Route discovery | ~98% |
| Schema extraction | ~95–97% |
| Auth mapping | ~90–93% |
| Intent labeling | ~88–93% |
| Capability grouping | ~85–90% |

Precision over recall. Enforcement checkpoints: `architecture.md`.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Inaccurate inference | Confidence scoring + human review |
| Complex apps | ~80% auto + manual overrides |
| Tool explosion | Capability grouping, not route dump |
| Standards fragmentation | Protocol-agnostic output (AWP + A2A + OpenAPI) |
| Browser automation improves | Compete on speed, cost, reliability |
| Low agent traffic now | Near-term wedge: auto MCP generation for developers |

---

## Open Questions

| # | Question | Lean |
|---|---|---|
| 1 | Package name `@agent-layer/sdk` vs `@aigp/sdk`? | `@agent-layer/sdk` |
| 2 | NestJS only for MVP? | Yes |
| 3 | SDK-only vs hosted dashboard? | SDK-only |
| 4 | Discovery standard priority? | AWP `agent.json` primary |

---

## Assumptions

- Backend API apps only (not static/frontend-only sites)
- NestJS first (~93–96% expected accuracy)
- Developers accept human review step
- `.agent-layer/` artifacts committed to repo
- LLM cost ~$0.41/project acceptable

---

## Context Doc Index

| File | Owns |
|---|---|
| `context/project-overview.md` | Product scope, markets, risks (this file) |
| `context/glossary.md` | Term definitions |
| `context/architecture.md` | Components, endpoints, data flows, schemas |
| `context/build-plan.md` | Phases, features, tasks, build order |
| `context/code-standards.md` | Coding conventions, paradigms |
| `context/progress-tracker.md` | Live build status, decisions, notes |
| `context/idea_description.md` | Original brainstorm |

---

## Agent Instructions

1. Read `progress-tracker.md` first for current status; then scope (`project-overview.md`), terms (`glossary.md`), design (`architecture.md`), standards (`code-standards.md`), plan (`build-plan.md`).
2. Update `progress-tracker.md` after every completed feature.
3. Capabilities ≠ routes. Never 1:1 route-to-tool.
4. Precision over recall. Flag uncertainty; don't guess.
5. Respect MVP boundaries. Ask before expanding scope.
