# Build Plan — AIGP

> **Implementation order.** Phases → features → tasks. Read `context/project-overview.md` for scope; `context/architecture.md` for technical design; `context/glossary.md` for terms.

---

## Metadata

| Field | Value |
|---|---|
| **MVP exit** | Phase 3 complete |
| **First framework** | NestJS + TypeScript |
| **Package** | `@agent-layer/sdk` (proposed) |
| **Accuracy gate** | ≥90% capability precision before Phase 3 runtime work |

---

## Phase Map

| Phase | Name | Goal | Depends on |
|---|---|---|---|
| **0** | Foundation | Repo, types, config, test harness | — |
| **1** | Static Analysis | Code → RouteGraph without LLM | Phase 0 |
| **2** | Capability Generation | RouteGraph → `capabilities.json` via LLM | Phase 1 |
| **3** | Runtime & Agent Access | Live discovery + execution on public domain | Phase 2 |
| **4** | Developer Experience | Review workflow, MCP dev server, incremental sync | Phase 3 |
| **5** | Scale & Protocols | Multi-framework, CI, RAG serving | Phase 4 |
| **6** | Platform | Auth, analytics, governance, hosted option | Phase 5 |

---

## Phase 0 — Foundation

**Goal:** Runnable monorepo with shared types, schemas, and config. No analysis yet.

### Feature 0.1 — Package scaffolding

| Task | Deliverable |
|---|---|
| Initialize monorepo (`packages/sdk`, `packages/core`) | `package.json`, tsconfig, build tooling |
| Define CLI entry point | `bin/agent-layer` → `cli/index.ts` |
| Add dev dependencies: tree-sitter, ts-morph, zod | Lock versions in root |

**Exit:** `npm run build` succeeds; empty CLI prints help.

### Feature 0.2 — Core types

| Task | Deliverable |
|---|---|
| Define `RawRoute`, `RouteGraphNode`, `ScanContext` | `core/types/analysis.ts` |
| Define `Capability`, `CapabilityOperation` | `core/types/capability.ts` |
| Define `AnalysisResult`, `AnalysisMeta` | `core/types/result.ts` |
| Export all from `core/index.ts` | Single import path |

**Exit:** Types compile; no implementation yet.

### Feature 0.3 — JSON schemas

| Task | Deliverable |
|---|---|
| `capabilities.json` JSON Schema | `core/schemas/capabilities.schema.json` |
| `config.json` JSON Schema | `core/schemas/config.schema.json` |
| `overrides.json` JSON Schema | `core/schemas/overrides.schema.json` |
| Zod validators mirroring schemas | `core/schemas/*.ts` |

**Exit:** Sample fixtures validate against schemas.

### Feature 0.4 — Config system

| Task | Deliverable |
|---|---|
| Default config generator | `.agent-layer/config.json` template |
| Config loader with schema validation | `core/config/loader.ts` |
| Config fields: `llm`, `confidenceThreshold`, `excludeRoutes`, `baseUrl` | Documented in config schema |

**Exit:** Invalid config rejected with clear error.

### Feature 0.5 — Test harness

| Task | Deliverable |
|---|---|
| Fixture NestJS sample app (cart, products, auth) | `fixtures/nestjs-ecommerce/` |
| Manual ground-truth capability list for fixture | `fixtures/nestjs-ecommerce/ground-truth.json` |
| Test runner setup (vitest/jest) | `npm test` runs |

**Exit:** Fixture app builds; ground truth documented.

---

## Phase 1 — Static Analysis

**Goal:** `analyze --static-only` produces accurate RouteGraph from NestJS app. No LLM.

### Feature 1.1 — Framework adapter interface

| Task | Deliverable |
|---|---|
| Define `FrameworkAdapter` interface | `scanner/adapters/types.ts` |
| Adapter registry | `scanner/adapters/registry.ts` |
| NestJS detection (`@nestjs/core` in deps) | `scanner/detector.ts` |

**Exit:** `detect()` returns `"nestjs"` for fixture app.

### Feature 1.2 — Project scanner

| Task | Deliverable |
|---|---|
| Walk project tree; find controllers, modules, DTOs, entities | `scanner/file-graph.ts` |
| Build import dependency graph | `ScanContext.fileGraph` |
| Resolve `tsconfig.json` paths | `scanner/tsconfig.ts` |
| Output `ScanContext` | Typed, serializable |

**Exit:** Scanner lists all controller files in fixture app.

### Feature 1.3 — NestJS route extraction (Layer A)

| Task | Deliverable |
|---|---|
| tree-sitter queries for `@Controller`, `@Get/@Post/...` | `analyzer/tree-sitter/nestjs.ts` |
| Extract method, path, handler name, file location | `RawRoute[]` |
| Resolve global prefix from module config | Path normalization |
| Extract `@UseGuards`, `@UseInterceptors` | `middleware[]` per route |

**Exit:** All fixture routes extracted with correct HTTP method + path.

### Feature 1.4 — Type extraction (Layer B)

| Task | Deliverable |
|---|---|
| ts-morph: resolve `@Body()`, `@Query()`, `@Param()` types | `analyzer/types/nestjs.ts` |
| DTO → JSON Schema (class-validator decorators) | `requestSchema`, `responseSchema` |
| Entity detection (`@Entity`) for DB mapping | `databaseEntities[]` |
| Handle generics, optional fields, enums | Schema edge cases |

**Exit:** `POST /cart/items` has correct input/output JSON Schema in fixture.

### Feature 1.5 — Call graph (Layer C)

| Task | Deliverable |
|---|---|
| Trace handler → service method calls (≤3 hops) | `analyzer/call-graph/nestjs.ts` |
| Identify repository/entity touches | `callChain[]`, `databaseEntities[]` |
| Include handler source snippet for LLM context | `sourceCode` field |

**Exit:** Cart routes trace to `CartService` → `CartRepository` → `Cart` entity.

### Feature 1.6 — RouteGraph builder

| Task | Deliverable |
|---|---|
| Merge Layers A+B+C into `RouteGraphNode[]` | `analyzer/route-graph.ts` |
| Drop routes with unresolvable handlers | Filter + warning log |
| Serialize RouteGraph to `.agent-layer/route-graph.json` | Debug artifact |
| CLI flag: `analyze --static-only` | Prints route count + warnings |

**Exit:** RouteGraph for fixture app matches ground-truth route list at ≥98% recall.

---

## Phase 2 — Capability Generation

**Goal:** Full `analyze` pipeline produces curated `capabilities.draft.json`. Requires LLM.

### Feature 2.1 — LLM client abstraction

| Task | Deliverable |
|---|---|
| Provider interface (OpenAI, Anthropic, configurable) | `reasoner/llm/client.ts` |
| Structured JSON output mode | Parse + validate LLM responses |
| Token/cost tracking per run | Written to `analysis-meta.json` |
| Retry + timeout handling | Resilient calls |

**Exit:** Mock LLM provider passes tests; real provider configurable via env.

### Feature 2.2 — Semantic Reasoner Stage 1: Domain classification

| Task | Deliverable |
|---|---|
| Prompt template (versioned) | `reasoner/prompts/domain.v1.ts` |
| Input: entity names, route prefixes, package name | |
| Output: domain, primaryEntities, suggestedCategories | Structured JSON |
| 1 LLM call per project | |

**Exit:** Fixture app classified as `ecommerce` with confidence ≥0.90.

### Feature 2.3 — Semantic Reasoner Stage 2: Intent labeling

| Task | Deliverable |
|---|---|
| Prompt template | `reasoner/prompts/intent.v1.ts` |
| Batch 5–10 routes per call | Context-efficient |
| Output per route: intent, description, sideEffects, requiresAuth, riskLevel, confidence | |
| Flag routes with confidence < 0.80 | |

**Exit:** Each fixture route has plausible intent label.

### Feature 2.4 — Semantic Reasoner Stage 3: Capability grouping

| Task | Deliverable |
|---|---|
| Entity-centric clustering rules | `reasoner/grouping.ts` |
| CRUD merge (same entity → one capability) | |
| Utility route exclusion (health, metrics, webhooks) | |
| Workflow prerequisite detection | `prerequisites[]` |
| Target: fixture ~20 routes → ~8–12 capabilities | |

**Exit:** Capability count << route count; no 1:1 mapping.

### Feature 2.5 — Semantic Reasoner Stage 4: Self-refine

| Task | Deliverable |
|---|---|
| Consistency checks (duplicates, orphan routes, auth conflicts) | `reasoner/refine.ts` |
| Adjust confidence scores | |
| Build `pending-review.json` | |
| Prompt template | `reasoner/prompts/refine.v1.ts` |

**Exit:** No duplicate capability IDs; orphans reported.

### Feature 2.6 — Capability builder

| Task | Deliverable |
|---|---|
| Merge RouteGraph + semantic labels → `Capability[]` | `builder/capability.ts` |
| Confidence scoring formula | `builder/confidence.ts` |
| Set `needsHumanReview`, `status: "draft"` | |
| Map operations to HTTP routes | `CapabilityOperation` per route |

**Exit:** Valid `Capability[]` matching core schema.

### Feature 2.7 — Capability store (write path)

| Task | Deliverable |
|---|---|
| Write `capabilities.draft.json` | `store/writer.ts` |
| Write `pending-review.json`, `analysis-meta.json` | |
| Create `.agent-layer/` if missing | |
| CLI: `analyze` (full pipeline) | End-to-end command |

**Exit:** `npx @agent-layer/sdk analyze` on fixture produces draft artifacts.

### Feature 2.8 — Accuracy evaluation

| Task | Deliverable |
|---|---|
| Compare output vs `ground-truth.json` | `eval/precision.ts` |
| Report: precision, recall, capability count ratio | CLI: `analyze --eval` |
| Gate: ≥90% precision on fixture before Phase 3 | Documented in CI |

**Exit:** Fixture meets ≥90% precision or blockers documented.

---

## Phase 3 — Runtime & Agent Access

**Goal:** Agents discover and invoke capabilities on live website. **MVP complete when this phase exits.**

### Feature 3.1 — Capability store (read path)

| Task | Deliverable |
|---|---|
| Load `capabilities.json` + merge `overrides.json` | `store/reader.ts` |
| Filter: only `status === "approved"` served at runtime | |
| Hot-reload on file change (dev mode) | Optional |

**Exit:** Reader returns only approved capabilities.

### Feature 3.2 — Output generators

| Task | Deliverable |
|---|---|
| `agent.json` (AWP format) | `generators/agent-json.ts` |
| `agent-card.json` (A2A format) | `generators/agent-card.ts` |
| `openapi.json` (capability-level) | `generators/openapi.ts` |
| `mcp-tools.json` (one tool per capability) | `generators/mcp.ts` |
| Run generators after `analyze --publish` | Integrated in CLI |

**Exit:** Generated discovery docs validate against target formats.

### Feature 3.3 — ExecutorService

| Task | Deliverable |
|---|---|
| Resolve capability + operation → HTTP route | `runtime/executor.service.ts` |
| JSON Schema input validation | |
| Proxy request to internal NestJS route (in-process) | |
| Auth header passthrough | |
| JSON Schema output validation | |
| Structured response envelope | |

**Exit:** Unit tests: valid input → correct route called → valid output.

### Feature 3.4 — DiscoveryController

| Task | Deliverable |
|---|---|
| `GET /.well-known/agent.json` | `runtime/nestjs/discovery.controller.ts` |
| `GET /.well-known/agent-card.json` | |
| `GET /.well-known/openapi.json` | |
| Dynamic generation from loaded capabilities (not static files) | |

**Exit:** Discovery endpoints return valid JSON on running fixture app.

### Feature 3.5 — CapabilityController

| Task | Deliverable |
|---|---|
| `GET /agent/capabilities` — list approved (summary) | `runtime/nestjs/capability.controller.ts` |
| `GET /agent/capabilities/:id` — full definition | |
| `POST /agent/capabilities/:id` — execute via ExecutorService | |
| CapabilityGuard: block draft/disabled/pending | `runtime/nestjs/capability.guard.ts` |

**Exit:** Agent can list, inspect, and execute capabilities via HTTP.

### Feature 3.6 — AgentLayerModule

| Task | Deliverable |
|---|---|
| `AgentLayerModule.forRoot(options)` | `runtime/nestjs/module.ts` |
| Options: paths, `baseUrl`, `prefix` | |
| Register controllers + providers | |
| Integration guide for fixture app | `fixtures/nestjs-ecommerce/README.md` |

**Exit:** Fixture app serves `/.well-known/agent.json` on `localhost`.

### Feature 3.7 — End-to-end agent test

| Task | Deliverable |
|---|---|
| Script: discover → execute `search_products` → validate response | `e2e/agent-flow.test.ts` |
| Script: execute auth-gated capability with Bearer token | |
| Document curl examples | `docs/agent-quickstart.md` |

**Exit:** Full agent flow passes without browser.

---

## Phase 4 — Developer Experience

**Goal:** Review workflow, local MCP testing, incremental sync. Polishes MVP for real adoption.

### Feature 4.1 — Human review workflow

| Task | Deliverable |
|---|---|
| `overrides.json` merge logic | `builder/merger.ts` |
| CLI: `analyze --publish` merges draft → `capabilities.json` (approved only) | |
| CLI: `review list` / `review approve <id>` | Interactive or JSON-based |
| Unapproved capabilities never served at runtime | Verified in tests |

**Exit:** Developer can approve/reject/edit capabilities before publish.

### Feature 4.2 — CLI utilities

| Task | Deliverable |
|---|---|
| `validate` — schema-check all artifacts | |
| `diff` — show capability changes since last publish | |
| `doctor` — check config, LLM connectivity, NestJS detection | |

**Exit:** All CLI commands documented in `--help`.

### Feature 4.3 — MCP dev server

| Task | Deliverable |
|---|---|
| `serve-mcp` — stdio MCP from `capabilities.json` | `cli/serve-mcp.ts` |
| One MCP tool per capability (with `operation` param) | |
| Cursor/Claude Desktop config example | `docs/mcp-setup.md` |

**Exit:** Cursor agent calls fixture capability via local MCP.

### Feature 4.4 — Incremental re-analysis

| Task | Deliverable |
|---|---|
| Hash route source files per analyze run | `store/diff.ts` |
| On re-run: re-analyze only changed files | |
| Preserve approved unchanged capabilities | |
| Merge partial results into existing registry | |

**Exit:** Edit one controller → only affected capabilities re-generated.

---

## Phase 5 — Scale & Protocols

**Goal:** Multi-framework, CI integration, production hardening. Post-MVP growth.

### Feature 5.1 — Framework adapters

| Adapter | Priority |
|---|---|
| Express / Fastify | P1 |
| Next.js App Router | P1 |
| FastAPI | P2 |
| Django REST | P2 |
| Rails | P3 |
| Go (Gin/Echo) | P3 |

Per adapter: implement `FrameworkAdapter`; add fixture app + ground truth; meet ≥85% precision before shipping.

### Feature 5.2 — CI integration

| Task | Deliverable |
|---|---|
| `analyze --check` — fail if capabilities drift from code | |
| GitHub Action template | `.github/workflows/agent-layer.yml` |
| Pre-commit hook option | `docs/ci-setup.md` |

### Feature 5.3 — RAG tool serving

| Task | Deliverable |
|---|---|
| Embed capability descriptions | Vector index |
| `GET /agent/capabilities/search?q=...` — top-k retrieval | |
| Runtime: serve only matched capabilities per agent query | |

### Feature 5.4 — MCP over HTTP/SSE

| Task | Deliverable |
|---|---|
| `GET/POST /agent/mcp` production transport | `runtime/mcp-transport/` |
| Streamable HTTP per MCP spec | |

### Feature 5.5 — IETF + extended protocols

| Task | Deliverable |
|---|---|
| `/.well-known/ai` endpoint | IETF draft format |
| Structured read interface for content endpoints | |

---

## Phase 6 — Platform

**Goal:** Auth, analytics, governance, optional hosted layer. Full product vision.

### Feature 6.1 — Authentication layer

| Task | Deliverable |
|---|---|
| Agent identity tokens | |
| OAuth delegated user access | |
| Scoped capability permissions | |

### Feature 6.2 — Permission controls & governance

| Task | Deliverable |
|---|---|
| Per-capability approve/deny/restrict | |
| Rate limits per agent/capability | |
| Audit log store | |
| Human approval for high-risk action execution | |

### Feature 6.3 — Agent analytics

| Task | Deliverable |
|---|---|
| Instrument ExecutorService | |
| Dashboard: traffic, usage, failures, agent types | |
| Hosted option (optional SaaS) | |

### Feature 6.4 — Frontend analysis (optional)

| Task | Deliverable |
|---|---|
| Form action → capability mapping for apps without typed APIs | |
| DOM analysis layer | Only where backend API absent |

---

## MVP Definition of Done

All must pass before MVP is declared complete (Phase 3 + Phase 4.1 minimum):

- [ ] `analyze` on fixture NestJS app → `capabilities.json` with ≥90% precision
- [ ] Capability count 10–30 for typical app (not 1:1 with routes)
- [ ] `/.well-known/agent.json` live on public origin
- [ ] `POST /agent/capabilities/:id` executes and returns structured response
- [ ] Low-confidence capabilities flagged; developer can override via `overrides.json`
- [ ] Draft/pending capabilities blocked at runtime
- [ ] `serve-mcp` works with Cursor/Claude Desktop
- [ ] End-to-end agent flow test passes

---

## Dependency Graph

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4
                                       │
                                       ▼
                              MVP COMPLETE
                                       │
                                       ▼
                              Phase 5 ──► Phase 6
```

**Critical path:** 0.2 → 1.3 → 1.6 → 2.4 → 2.7 → 3.3 → 3.6 → 3.7

**Parallelizable after Phase 1:**
- 2.1 (LLM client) alongside 1.4–1.6
- 3.2 (generators) alongside 3.3–3.5
- 4.2 (CLI utilities) alongside 4.1

---

## Risk Gates

| Gate | When | Criteria | If fail |
|---|---|---|---|
| **G1: Static accuracy** | End of Phase 1 | RouteGraph ≥98% recall vs ground truth | Fix adapter before LLM work |
| **G2: Grouping quality** | End of Phase 2 | Capability count ≤30% of route count; ≥90% precision | Tune grouping prompts/rules |
| **G3: Runtime correctness** | End of Phase 3 | E2E agent flow passes 100% on fixture | Fix executor before polish |
| **G4: Review workflow** | End of Phase 4 | Unapproved capabilities never leak to runtime | Block release |

---

## Related Files

| File | Purpose |
|---|---|
| `context/build-plan.md` | This file — implementation order |
| `context/progress-tracker.md` | Live status — update after each feature |
| `context/code-standards.md` | Coding conventions |
| `context/architecture.md` | Component design, endpoints, data flows |
| `context/project-overview.md` | Product scope, markets, risks |
| `context/glossary.md` | Canonical term definitions |
