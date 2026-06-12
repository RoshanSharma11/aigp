# Architecture — AIGP

> **Technical design.** Components, schemas, endpoints, flows. Terms → `glossary.md`. Scope → `project-overview.md`. Build order → `build-plan.md`.

---

## Metadata

| Field | Value |
|---|---|
| **Version** | 0.1 |
| **MVP framework** | NestJS + TypeScript |
| **Package** | `@agent-layer/sdk` (proposed) |

---

## Principle

**Analyze backend code. Expose on the public website.**

```
Human:  Browser → React → fetch("/api/cart") → NestJS
Agent:  GET /.well-known/agent.json → POST /agent/capabilities/cart_management → NestJS
```

Two modes share one artifact (`capabilities.json`):

| Mode | When | Output |
|---|---|---|
| **Build-time** | Dev / CI | Writes `.agent-layer/*` |
| **Runtime** | Production | Serves discovery + execution on public domain |

---

## System Diagram

```
BUILD-TIME                          RUNTIME
──────────                          ───────
sdk analyze                         AgentLayerModule
  → Scanner                           → loads capabilities.json
  → Static Analyzer                   → DiscoveryController
  → Semantic Reasoner                 → CapabilityController
  → Builder + Store                   → ExecutorService
  → .agent-layer/                     → /.well-known/* + /agent/*
         │                                    │
         └──────── commit ────────────────────►┘
                                              ▼
                                         AI Agent
```

---

## Package Layout

```
@agent-layer/sdk/
├── cli/           analyze, validate, diff, serve-mcp, doctor
├── core/          types, JSON schemas, config
├── scanner/       framework detection, file graph
├── analyzer/      tree-sitter, ts-morph, call-graph, route-graph
├── reasoner/      LLM stages 1–4, prompts
├── builder/       capability assembly, confidence, overrides merge
├── store/         read/write .agent-layer/, incremental diff
├── generators/    agent.json, agent-card.json, openapi.json, mcp-tools.json
└── runtime/       nestjs/ (module, controllers, executor, guard)
```

---

## Artifacts (`.agent-layer/`)

| File | Role |
|---|---|
| `config.json` | LLM provider, thresholds, excludes, baseUrl |
| `capabilities.json` | Published approved registry (runtime source) |
| `capabilities.draft.json` | Latest analyze output (gitignored) |
| `overrides.json` | Developer edits (committed) |
| `pending-review.json` | Low-confidence items |
| `agent.json` / `agent-card.json` / `openapi.json` / `mcp-tools.json` | Generated outputs |
| `analysis-meta.json` | Run stats |

**Publish flow:** `analyze` → draft → review → merge overrides → `capabilities.json`. Runtime serves approved only.

---

## Components

### 1. Project Scanner

**In:** app root → **Out:** `ScanContext` (framework, adapter, file graph, route files)

```typescript
interface FrameworkAdapter {
  name: string;
  detect(root: string): boolean;
  extractRoutes(ctx: ScanContext): RawRoute[];
  extractTypes(ctx: ScanContext, route: RawRoute): TypeInfo;
  extractMiddleware(ctx: ScanContext, route: RawRoute): MiddlewareInfo[];
}
```

MVP: NestJS only. Adapter interface enables Phase 5 multi-framework.

### 2. Static Analyzer (no LLM, no runtime)

| Layer | Method | Extracts |
|---|---|---|
| A | tree-sitter | Routes, handlers, middleware decorators |
| B | ts-morph | DTOs → JSON Schema, entities, validators |
| C | call graph (≤3 hops) | handler → service → repository → entities |

**Out:** `RouteGraphNode[]` — route, schemas, middleware, callChain, databaseEntities, sourceCode snippet.

### 3. Semantic Reasoner (LLM, 4 stages)

| Stage | Input | Output |
|---|---|---|
| 1 Domain | Entities, route prefixes | domain, categories |
| 2 Intent | RouteGraphNode batches (5–10) | intent, sideEffects, auth, risk, confidence per route |
| 3 Grouping | All intents | capability clusters (entity-centric CRUD merge) |
| 4 Refine | Clusters | deduped capabilities, adjusted scores, pendingReview |

**Grouping rules (priority):** entity-centric → CRUD merge → workflow prerequisites → exclude utilities.

**Target:** 200 routes → 10–30 capabilities.

### 4. Capability Builder

Merges RouteGraph + semantic labels → `Capability[]`.

```typescript
interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
  operations: CapabilityOperation[];
  defaultOperation: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  sideEffects: "read" | "write" | "delete" | "transactional";
  requiresAuth: boolean;
  prerequisites?: string[];
  followedBy?: string[];
  reversible: boolean;
  confirmationRequired: boolean;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  needsHumanReview: boolean;
  sourceRoutes: string[];
  status: "draft" | "approved" | "disabled";
}

interface CapabilityOperation {
  id: string;
  description: string;
  httpMethod: string;
  httpPath: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  sideEffects: "read" | "write" | "delete";
}
```

**Confidence:** weighted average of route, schema, intent, grouping scores. `< 0.85` or `riskLevel: high` → `needsHumanReview`.

### 5. Capability Store

- **Write:** analyze → draft + pending + meta
- **Read:** load published + merge overrides
- **Incremental:** hash route files; re-analyze changed only; preserve approved unchanged

### 6. Output Generators

One capability per MCP tool (with `operation` param). Not one per route.

| Generator | Output |
|---|---|
| `agent-json.ts` | AWP `/.well-known/agent.json` |
| `agent-card.ts` | A2A `agent-card.json` |
| `openapi.ts` | OpenAPI 3.1 |
| `mcp.ts` | `mcp-tools.json` |

---

## Runtime

### NestJS Integration

```typescript
AgentLayerModule.forRoot({
  capabilitiesPath: '.agent-layer/capabilities.json',
  overridesPath: '.agent-layer/overrides.json',
  baseUrl: 'https://shop.example.com',
  prefix: '/agent',
});
```

### Components

| Component | Role |
|---|---|
| `DiscoveryController` | `/.well-known/agent.json`, `agent-card.json`, `openapi.json` |
| `CapabilityController` | List, inspect, execute capabilities |
| `ExecutorService` | Validate input → proxy to real route → validate output |
| `CapabilityGuard` | Block draft/disabled/pending-review |
| Auth | Passthrough `Authorization` header to backend |

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/.well-known/agent.json` | Primary discovery (AWP) |
| GET | `/.well-known/agent-card.json` | A2A discovery |
| GET | `/.well-known/openapi.json` | OpenAPI spec |
| GET | `/agent/capabilities` | List approved (summary) |
| GET | `/agent/capabilities/:id` | Full capability definition |
| POST | `/agent/capabilities/:id` | Execute: `{ operation?, input }` |

### Execution flow

```
1. Load capability (approved only)
2. Resolve operation (explicit or defaultOperation)
3. Validate input against operation.inputSchema
4. Proxy to mapped HTTP route (in-process)
5. Forward Authorization header
6. Validate response against outputSchema
7. Return { capabilityId, operation, success, data, metadata }
```

### MCP (dev only, MVP)

```
npx @agent-layer/sdk serve-mcp    # stdio for Cursor/Claude Desktop
```

Production MCP over HTTP/SSE: Phase 5.

---

## Request Flows

### Agent (production)

```
Agent → GET /.well-known/agent.json
     → POST /agent/capabilities/search_products { input: { query: "shoes" } }
     → ExecutorService → GET /api/products (internal)
     → structured response
```

### Developer (build-time)

```
Developer → sdk analyze
         → static analysis (no LLM)
         → LLM stages 1–4
         → capabilities.draft.json + pending-review.json
         → review overrides.json
         → sdk analyze --publish → capabilities.json
```

---

## Deployment Topologies

| Topology | Layout | When |
|---|---|---|
| **A Monolith** | Same domain: frontend + API + AIGP | MVP default |
| **B API subdomain** | `api.shop.example.com` hosts AIGP | Separate API host |
| **C Reverse proxy** | Nginx routes `/.well-known/`, `/agent/` | Phase 2 |
| **D Dev MCP** | Local stdio only | Development |

---

## Security (MVP)

| Concern | Behavior |
|---|---|
| Unapproved capabilities | Not served (`status !== "approved"`) |
| Disabled capabilities | Blocked by CapabilityGuard |
| Auth | Header passthrough to backend |
| High-risk actions | Excluded from auto-generation |
| Input/output | JSON Schema validation at execution |
| Audit | stdout logging (dashboard: Phase 6) |

---

## Accuracy Checkpoints

| After | Action |
|---|---|
| Static analysis | Drop unresolvable handlers |
| Stage 2 (intent) | Flag routes < 0.80 confidence |
| Stage 3 (grouping) | Flag capabilities < 0.85 confidence |
| Stage 4 (refine) | Add to `pending-review.json` |
| Developer review | Merge overrides; set `approved` |
| Runtime | CapabilityGuard enforces status |

---

## Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Analysis target | Backend source | Business logic ground truth |
| Agent access | Public HTTP on website domain | No browser needed |
| MVP framework | NestJS | Highest structural signal |
| Abstraction | Business capabilities | Avoids tool explosion |
| LLM role | Semantic labeling only | Static analysis handles structure |
| Artifacts | `.agent-layer/` in repo | No hosted infra for MVP |
| Auth | Passthrough | Reuse existing backend auth |

---

## Extension Points

| Extension | Interface |
|---|---|
| New framework | `FrameworkAdapter` |
| Custom grouping | Stage 3 plugin |
| RAG serving | Semantic index over capabilities (Phase 5) |
| CI drift check | `analyze --check` (Phase 5) |
| Traffic analysis | Proxy enrichment (Phase 5) |
| Frontend forms | New analyzer layer (Phase 6) |

---

## Context Doc Index

| File | Owns |
|---|---|
| `context/architecture.md` | Technical design (this file) |
| `context/build-plan.md` | Implementation phases and tasks |
| `context/progress-tracker.md` | Live build status |
| `context/code-standards.md` | Coding conventions |
| `context/glossary.md` | Term definitions |
| `context/project-overview.md` | Product scope and risks |

---

## Agent Instructions

1. Build-time + runtime are both MVP deliverables.
2. ExecutorService proxies — never reimplement business logic.
3. Never expose draft/pending capabilities at runtime.
4. Implement grouping before output generators.
5. Follow `build-plan.md` phase order.
