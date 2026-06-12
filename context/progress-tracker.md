# Progress Tracker — AIGP

> **Living build status.** Any agent reading this knows what is done, in progress, and next. **Update this file after every completed feature.**

---

## Update Protocol (Required)

When you **complete a feature** from `build-plan.md`:

1. Set feature status to `done` and add `completed: YYYY-MM-DD`.
2. Update `## Current Focus` and `## Next Up`.
3. Add a row to `## Decision Log` if any implementation choice was made.
4. Add to `## Notes` if there's blocker context, debt, or follow-up.
5. Update `Last updated` timestamp at bottom.

When you **start a feature**:

1. Set status to `in_progress`.
2. Update `## Current Focus`.

When **blocked**:

1. Set status to `blocked`.
2. Add blocker detail in `## Notes` and `## Blockers`.

**Status values:** `not_started` | `in_progress` | `done` | `blocked` | `skipped`

---

## Snapshot

| Field | Value |
|---|---|
| **Current phase** | Phase 2 — Capability Generation |
| **Current feature** | None started |
| **MVP progress** | 64% (14/22 MVP features: Phases 0–3 + 4.1) |
| **Last milestone** | Feature 2.3 complete — Reasoner Stage 2: Intent labeling |
| **Next milestone** | Feature 2.4 complete — Reasoner Stage 3: Capability grouping |

---

## Current Focus

**Nothing in progress.** Feature 2.3 complete. Ready to begin **Feature 2.4 — Reasoner Stage 3: Capability grouping**.

---

## Next Up

1. **Feature 2.4** — Reasoner Stage 3: Capability grouping
2. **Feature 2.5** — Reasoner Stage 4: Self-refine
3. **Feature 2.6** — Capability builder

---

## Pre-Build (Planning)

| Item | Status | Completed |
|---|---|---|
| Idea description | done | 2026-06-12 |
| Project overview | done | 2026-06-12 |
| Architecture doc | done | 2026-06-12 |
| Build plan | done | 2026-06-12 |
| Glossary | done | 2026-06-12 |
| Code standards | done | 2026-06-12 |
| Progress tracker | done | 2026-06-12 |

---

## Phase 0 — Foundation

**Goal:** Runnable monorepo with types, schemas, config, test harness.  
**Gate:** `npm run build` succeeds; fixture app compiles.

| Feature | Name | Status | Completed | Notes |
|---|---|---|---|---|
| 0.1 | Package scaffolding | done | 2026-06-12 | pnpm workspace, shared TS config, package skeletons, and CLI help stub implemented |
| 0.2 | Core types | done | 2026-06-12 | Shared analysis, capability, config, override, and result contracts exported from `@agent-layer/core` |
| 0.3 | JSON schemas | done | 2026-06-12 | JSON Schema files and Zod validators added for `capabilities.json`, `config.json`, and `overrides.json` |
| 0.4 | Config system | done | 2026-06-12 | Default `.agent-layer/config.json` generator and typed loader added to `@agent-layer/core` with validation errors |
| 0.5 | Test harness | done | 2026-06-12 | Fixture NestJS ecommerce app, route ground truth, and workspace test/build coverage added |

---

## Phase 1 — Static Analysis

**Goal:** `analyze --static-only` → RouteGraph from NestJS. No LLM.  
**Gate G1:** RouteGraph ≥98% recall vs ground truth.

| Feature | Name | Status | Completed | Notes |
|---|---|---|---|---|
| 1.1 | Framework adapter interface | done | 2026-06-12 | `FrameworkAdapter` interface, registry, NestJS detection via `@nestjs/core` in package.json |
| 1.2 | Project scanner | done | 2026-06-12 | Walks source tree, classifies controllers/DTOs/entities, builds import graph, resolves tsconfig |
| 1.3 | NestJS route extraction (Layer A) | done | 2026-06-12 | ts-morph decorator AST for routes/middleware; global prefix from `main.ts`; 7/7 fixture routes at 100% recall |
| 1.4 | Type extraction (Layer B) | done | 2026-06-12 | ts-morph resolves `@Body`/`@Query`/`@Param`; class-validator → JSON Schema; entity response schemas |
| 1.5 | Call graph (Layer C) | done | 2026-06-12 | Traces `this.*Service.*()` ≤3 hops; detects entity touches; includes handler `sourceCode` snippet |
| 1.6 | RouteGraph builder | done | 2026-06-12 | Merges Layers A+B+C; writes `.agent-layer/route-graph.json`; `analyze --static-only` CLI; 100% fixture recall (G1) |

---

## Phase 2 — Capability Generation

**Goal:** Full `analyze` → `capabilities.draft.json`.  
**Gate G2:** ≥90% precision; capability count ≤30% of route count.

| Feature | Name | Status | Completed | Notes |
|---|---|---|---|---|
| 2.1 | LLM client abstraction | done | 2026-06-12 | `LlmClient` + mock/OpenAI/Anthropic providers; Zod JSON validation; retry/timeout; usage/cost tracking |
| 2.2 | Reasoner Stage 1: Domain classification | done | 2026-06-12 | Versioned `domain.v1` prompt; `classifyDomain` + RouteGraph input builders; fixture classified as `ecommerce` |
| 2.3 | Reasoner Stage 2: Intent labeling | done | 2026-06-12 | Versioned `intent.v1` prompt; batched labeling (8 routes/call); low-confidence flagging at 0.80 |
| 2.4 | Reasoner Stage 3: Capability grouping | not_started | — | Hardest feature |
| 2.5 | Reasoner Stage 4: Self-refine | not_started | — | |
| 2.6 | Capability builder | not_started | — | |
| 2.7 | Capability store (write path) | not_started | — | |
| 2.8 | Accuracy evaluation | not_started | — | |

---

## Phase 3 — Runtime & Agent Access

**Goal:** Live discovery + execution on public domain. **MVP core.**  
**Gate G3:** E2E agent flow passes on fixture.

| Feature | Name | Status | Completed | Notes |
|---|---|---|---|---|
| 3.1 | Capability store (read path) | not_started | — | |
| 3.2 | Output generators | not_started | — | |
| 3.3 | ExecutorService | not_started | — | |
| 3.4 | DiscoveryController | not_started | — | |
| 3.5 | CapabilityController | not_started | — | |
| 3.6 | AgentLayerModule | not_started | — | |
| 3.7 | End-to-end agent test | not_started | — | |

---

## Phase 4 — Developer Experience

**Goal:** Review workflow, MCP dev server, incremental sync.  
**Gate G4:** Unapproved capabilities never leak to runtime.

| Feature | Name | Status | Completed | Notes |
|---|---|---|---|---|
| 4.1 | Human review workflow | not_started | — | |
| 4.2 | CLI utilities (validate, diff, doctor) | not_started | — | |
| 4.3 | MCP dev server (`serve-mcp`) | not_started | — | |
| 4.4 | Incremental re-analysis | not_started | — | |

---

## Phase 5 — Scale & Protocols (Post-MVP)

| Feature | Name | Status | Completed | Notes |
|---|---|---|---|---|
| 5.1 | Framework adapters (Express, FastAPI, etc.) | not_started | — | |
| 5.2 | CI integration (`analyze --check`) | not_started | — | |
| 5.3 | RAG tool serving | not_started | — | |
| 5.4 | MCP over HTTP/SSE | not_started | — | |
| 5.5 | IETF + extended protocols | not_started | — | |

---

## Phase 6 — Platform (Post-MVP)

| Feature | Name | Status | Completed | Notes |
|---|---|---|---|---|
| 6.1 | Authentication layer | not_started | — | |
| 6.2 | Permission controls & governance | not_started | — | |
| 6.3 | Agent analytics | not_started | — | |
| 6.4 | Frontend analysis | not_started | — | |

---

## MVP Definition of Done

- [ ] `analyze` on fixture → `capabilities.json` with ≥90% precision
- [ ] Capability count curated (10–30), not 1:1 with routes
- [ ] `/.well-known/agent.json` live on public origin
- [ ] `POST /agent/capabilities/:id` executes correctly
- [ ] Low-confidence capabilities flagged; overrides work
- [ ] Draft/pending blocked at runtime
- [ ] `serve-mcp` works with Cursor/Claude Desktop
- [ ] E2E agent flow test passes

---

## Decision Log

> Implementation choices that future agents must respect. Newest first.

| Date | Feature | Decision | Rationale |
|---|---|---|---|
| 2026-06-12 | 2.3 | Default batch size 8 routes per intent LLM call (`DEFAULT_INTENT_BATCH_SIZE`) | Within 5–10 range from build plan; fixture fits in one call |
| 2026-06-12 | 2.3 | Low-confidence threshold 0.80 for route intent labels | Matches architecture Stage 2 gate; separate from capability 0.85 threshold |
| 2026-06-12 | 2.3 | Post-LLM batch coverage check ensures every input `routeId` has a label | Triggers retry via `LlmError`; prevents partial batch responses |
| 2026-06-12 | 2.2 | Route prefixes = first two URL path segments (e.g. `/api/products`) | Stable grouping signal without overfitting to individual route paths |
| 2026-06-12 | 2.2 | Domain types live in `reasoner/prompts/domain.v1.ts` co-located with prompt | Keeps versioned prompt + Zod schema together per code-standards |
| 2026-06-12 | 2.1 | Use native `fetch` for OpenAI/Anthropic (no provider SDK deps) | Matches code-standards; keeps SDK thin; injectable `fetchImpl` for tests |
| 2026-06-12 | 2.1 | Default API key env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`; override via `config.llm.apiKeyEnvVar` | Real providers configurable via env without code changes |
| 2026-06-12 | 2.1 | `LlmUsageTracker` accumulates per-run tokens/cost; consumed later by `analysis-meta.json` writer (2.7) | Separates tracking from artifact I/O |
| 2026-06-12 | 1.6 | Write debug artifact as versioned `.agent-layer/route-graph.json` wrapper | Keeps RouteGraph serializable without committing a schema file yet |
| 2026-06-12 | 1.5 | Add `RouteCallGraphInfo` and `extractCallGraph` on `FrameworkAdapter` | Keeps call graph separate from type extraction; RouteGraph builder (1.6) merges all layers |
| 2026-06-12 | 1.5 | Load all `fileGraph.nodes` into ts-morph project for call tracing | Service/repository files are not in `routeFiles`; import graph provides analysis scope |
| 2026-06-12 | 1.3 | Use ts-morph decorator AST for Layer A route extraction instead of tree-sitter | tree-sitter native builds blocked in CI; ts-morph gives equivalent decorator access for TypeScript |
| 2026-06-12 | 1.4 | Extend `extractTypes` to return `RouteTypeInfo` with separate request/response schemas | Single `TypeInfo` insufficient for RouteGraph; backward-compatible adapter change (only NestJS stub existed) |
| 2026-06-12 | 1.2 | Use regex-based import/export extraction for file graph in Phase 1 | Sufficient for dependency graph now; ts-morph reserved for Feature 1.4 type extraction |
| 2026-06-12 | 1.2 | Store ScanContext file paths relative to project root with POSIX separators | Keeps artifacts serializable and portable across platforms |
| 2026-06-12 | 1.1 | Detect framework by checking `dependencies`, `devDependencies`, and `peerDependencies` for `@nestjs/core` | Matches NestJS app layouts without executing user code |
| 2026-06-12 | 0.4 | Keep config loading limited to path resolution, JSON parsing, schema validation, and default generation | Delivers the shared contract now without pulling CLI/runtime concerns forward |
| 2026-06-12 | 0.3 | Use Zod validators alongside checked-in JSON Schema files | Keeps runtime validation ergonomic while preserving explicit artifact contracts |
| 2026-06-12 | 0.1 | Keep package namespace as `@agent-layer/core` and `@agent-layer/sdk` | Matches current architecture docs and avoids early naming churn |
| 2026-06-12 | Pre-build | Backend analysis, public website exposure | Business logic in API; agents use `/.well-known/` on same domain |
| 2026-06-12 | Pre-build | NestJS first framework | Highest accuracy from decorators + TS types |
| 2026-06-12 | Pre-build | pnpm monorepo (`packages/core`, `packages/sdk`) | Shared types isolated from SDK implementation |
| 2026-06-12 | Pre-build | Vitest for tests | Fast, ESM-native, TS-friendly |
| 2026-06-12 | Pre-build | Precision over recall | False capabilities worse than missing ones |
| 2026-06-12 | Pre-build | `capabilities.json` committed; draft gitignored | Review-before-publish workflow |
| 2026-06-12 | Pre-build | Auth passthrough for MVP | Reuse backend auth; agent identity deferred to Phase 6 |
| 2026-06-12 | Pre-build | AWP `agent.json` primary discovery format | Aligns with long-term standard ambition |

---

## Blockers

| Feature | Blocker | Owner | Since |
|---|---|---|---|
| — | None | — | — |

---

## Notes

- **Intent labeling is in place.** `labelRouteIntents()` batches RouteGraph nodes (8/call), calls versioned `intent.v1` prompt, validates per-route labels, and flags routes with confidence < 0.80.
- **Domain classification is in place.** `classifyDomainFromRouteGraph()` builds input from entity names + route prefixes + package name, calls versioned `domain.v1` prompt via `LlmClient`, and validates structured output.
- **LLM client abstraction is in place.** `createLlmClient(config)` returns a provider-backed client with structured JSON validation, 2× retry + exponential backoff, 60s timeout, and cumulative usage/cost tracking via `getUsage()`.
- **Call graph extraction is in place.** Cart routes trace `handler → CartService.*` with `CartEntity` in `databaseEntities`; handler `sourceCode` captured for LLM context.
- **Route and type extraction are in place.** `nestJsFrameworkAdapter.extractRoutes()` returns all 7 fixture routes with correct method/path/middleware; `extractTypes()` produces JSON Schema for DTOs and entities (validated on `POST /api/cart/items`).
- **Project scanner is in place.** `scanProject()` returns a typed `ScanContext` with controller/DTO/entity file lists and an import dependency graph for the fixture app.
- **Phase 0 foundation is now in place.** Root build/test tooling passes, and the shared type/schema layer is ready for subsequent features.
- **Fixture baseline is established.** `fixtures/nestjs-ecommerce` now provides products, cart, and auth routes plus `ground-truth.json` for upcoming static-analysis accuracy checks.
- **Critical path:** 0.2 → 1.3 → 1.6 → 2.4 → 2.7 → 3.3 → 3.6 → 3.7
- **Hardest feature:** 2.4 Capability grouping — entity-centric clustering + LLM merge.
- **Accuracy benchmark:** `fixtures/nestjs-ecommerce/ground-truth.json`.
- **Open question:** Package name `@agent-layer/sdk` vs `@aigp/sdk` — using `@agent-layer/sdk` until decided.

---

## Context Doc Index

| File | Owns |
|---|---|
| `context/progress-tracker.md` | This file — live build status |
| `context/build-plan.md` | Feature specs and exit criteria |
| `context/code-standards.md` | Coding conventions |
| `context/architecture.md` | Technical design |

---

**Last updated:** 2026-06-12 — Feature 2.3 completed. Reasoner Stage 2 intent labeling with batched prompts, per-route metadata, and low-confidence flagging.
