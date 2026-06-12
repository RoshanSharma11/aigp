# Glossary — AIGP

> **Canonical vocabulary.** All context docs use these definitions. Do not redefine terms elsewhere.

---

## Doc Index

| Read for… | File |
|---|---|
| Product vision, scope, markets | `context/project-overview.md` |
| Technical design, components, endpoints | `context/architecture.md` |
| What to build, in what order | `context/build-plan.md` |
| What is done / in progress / next | `context/progress-tracker.md` |
| Coding conventions | `context/code-standards.md` |
| Term definitions | `context/glossary.md` (this file) |
| Original brainstorm | `context/idea_description.md` |

---

## Core Concepts

| Term | Definition |
|---|---|
| **AIGP** | Agent Interface Generation Platform. Working title for the product. |
| **Agent Layer** | Missing web layer for machine consumers: capabilities, actions, permissions, structured responses. AIGP creates it. |
| **Human Layer** | Existing web layer: HTML, CSS, JS, mobile apps. Built for humans, not agents. |
| **Capability** | Business-level, agent-callable action (e.g. `search_products`, `cart_management`). **Not** a raw HTTP route. One capability may map to multiple routes/operations. |
| **Capability Layer** | Full agent interface: capability registry + schemas + discovery endpoints + execution API. |
| **Route** | Single HTTP endpoint (e.g. `POST /cart/items`). Analysis input only; never exposed 1:1 as an agent tool. |
| **Operation** | Sub-action within a capability (e.g. `add_item_to_cart` inside `cart_management`). Maps to one HTTP route. |
| **Capability registry** | Published list of approved capabilities agents can discover and invoke. |

---

## Analysis Pipeline

| Term | Definition |
|---|---|
| **Build-time (Analyze)** | Dev/CI mode. SDK reads source code, runs pipeline, writes `.agent-layer/` artifacts. |
| **Runtime (Serve)** | Production mode. SDK module serves discovery + execution endpoints on public domain. |
| **Project Scanner** | Detects framework, selects adapter, builds file dependency graph. |
| **Framework Adapter** | Pluggable module that extracts routes/types/middleware for a specific framework (NestJS, FastAPI, etc.). |
| **Static Analyzer** | No-LLM, no-runtime pipeline: syntax extraction → type extraction → call graph → RouteGraph. |
| **RouteGraph** | Internal artifact: enriched route nodes with handlers, schemas, middleware, call chains, DB entities. |
| **Semantic Reasoner** | 4-stage LLM pipeline: domain classification → intent labeling → capability grouping → self-refine. |
| **Capability Builder** | Merges RouteGraph + semantic labels into formal `Capability` objects with confidence scores. |
| **Capability Store** | Reads/writes `.agent-layer/` artifacts; merges overrides; supports incremental re-analysis. |
| **Output Generator** | Transforms published `capabilities.json` into `agent.json`, `openapi.json`, `mcp-tools.json`, etc. |

---

## Artifacts

| Term | Definition |
|---|---|
| **`.agent-layer/`** | Directory at app root containing all SDK-generated and developer-edited artifacts. |
| **`capabilities.json`** | Published, approved capability registry. Runtime serves only this. |
| **`capabilities.draft.json`** | Pre-review output from latest analyze run. Gitignored. |
| **`overrides.json`** | Developer manual edits; takes precedence over generated values. |
| **`pending-review.json`** | Capabilities flagged for human approval (confidence < 0.85 or refine-flagged). |
| **`config.json`** | SDK settings: LLM provider, confidence thresholds, route excludes, `baseUrl`. |
| **`analysis-meta.json`** | Run metadata: timestamp, framework detected, route/capability counts, LLM cost. |

---

## Runtime

| Term | Definition |
|---|---|
| **AgentLayerModule** | NestJS module that mounts discovery + capability execution endpoints in production. |
| **Discovery endpoint** | Well-known URI listing what an app can do. Primary: `GET /.well-known/agent.json`. |
| **Capability execution API** | `POST /agent/capabilities/:id` — agent invokes a capability; SDK proxies to real backend route. |
| **ExecutorService** | Runtime component mapping capability operation → HTTP route, validating I/O, proxying request. |
| **Auth passthrough** | MVP auth model: forward agent's `Authorization` header to backend unchanged. No agent identity layer. |
| **CapabilityGuard** | Blocks draft, disabled, or pending-review capabilities at runtime. |

---

## Quality & Safety

| Term | Definition |
|---|---|
| **Tool explosion** | Anti-pattern: every route becomes one MCP tool. Degrades agent tool-selection accuracy beyond ~30–50 tools. |
| **Precision vs recall** | Optimize precision (generated capabilities are correct) over recall (finding every capability). False capabilities are worse than missing ones. |
| **Human review loop** | Developer approves/edits low-confidence capabilities before publish. Product feature, not failure mode. |
| **Confidence score** | 0.0–1.0 weighted score per capability. `< 0.85` → `needsHumanReview: true`, excluded from runtime until approved. |
| **Risk level** | `low` / `medium` / `high`. High-risk capabilities (checkout, payments) excluded from MVP auto-generation. |

---

## Protocols & Standards

| Term | Definition |
|---|---|
| **AWP** | Agent Web Protocol. Community spec for `/.well-known/agent.json`. Primary discovery format. |
| **A2A** | Agent-to-Agent Protocol (Google → Linux Foundation). Uses `/.well-known/agent-card.json`. |
| **IETF AI Discovery** | Draft spec for `/.well-known/ai`. Deferred to post-MVP. |
| **MCP** | Model Context Protocol. Agent tool-calling standard. AIGP generates MCP tools from capabilities (not routes). |
| **OpenAPI** | REST API description standard. AIGP generates capability-level OpenAPI, not raw route dump. |
| **`agent.json`** | AIGP's target discovery document format. Long-term ambition: de facto standard like `robots.txt`. |

---

## Deployment

| Term | Definition |
|---|---|
| **Topology A (monolith)** | Frontend + API + AIGP runtime on same NestJS server, same domain. MVP default. |
| **Topology B (API subdomain)** | Frontend on `shop.example.com`; AIGP + API on `api.shop.example.com`. |
| **Topology C (reverse proxy)** | Nginx routes `/.well-known/` and `/agent/` to backend. Phase 2. |
| **Topology D (dev MCP)** | Local `serve-mcp` stdio server for Cursor/Claude Desktop testing. Not production. |

---

## Markets & Positioning

| Term | Definition |
|---|---|
| **Adjacent tools** | Code→OpenAPI generators (OOPS, api2spec), OpenAPI→MCP (FastMCP), browser automation (Browserbase). AIGP fills the semantic capability gap they miss. |
| **Initial markets** | Ecommerce, SaaS, marketplaces — clear actions, typed backends, measurable ROI. |
| **Out-of-market** | Visual/canvas apps (Figma, CAD, gaming) — not reliably abstractable into capabilities. |

---

## Acronyms

| Acronym | Expansion |
|---|---|
| AIGP | Agent Interface Generation Platform |
| AWP | Agent Web Protocol |
| A2A | Agent-to-Agent (Protocol) |
| MCP | Model Context Protocol |
| OAS | OpenAPI Specification |
| DTO | Data Transfer Object |
| AST | Abstract Syntax Tree |
