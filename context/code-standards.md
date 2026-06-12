# Code Standards — AIGP

> **Coding conventions for `@agent-layer/sdk`.** All agents and contributors follow this file. Terms → `glossary.md`. Structure → `architecture.md`.

---

## Metadata

| Field | Value |
|---|---|
| **Language** | TypeScript 5.x (strict) |
| **Runtime** | Node.js 20 LTS+ |
| **Package manager** | pnpm (workspaces) |
| **Test runner** | Vitest |
| **Linter** | ESLint + `@typescript-eslint` |
| **Formatter** | Prettier |

---

## Paradigm & Design Philosophy

| Principle | Rule |
|---|---|
| **Pipeline over framework** | Build-time code is a linear pipeline (scan → analyze → reason → build → store). Stages are independent modules with typed inputs/outputs. |
| **Adapter over inheritance** | Framework support via `FrameworkAdapter` interface. Never branch on framework inside core logic. |
| **Types as contracts** | TypeScript types + JSON Schema are the source of truth for artifacts. Code must match schemas. |
| **Pure where possible** | Static analyzer and builders are pure functions (input → output). Side effects only in CLI, store I/O, runtime. |
| **Precision over coverage** | Prefer dropping uncertain results over guessing. Aligns with product thesis. |
| **Thin runtime** | ExecutorService proxies to existing routes. Never reimplement business logic. |
| **No premature abstraction** | One implementation per concern until a second use case exists. |

---

## Repository Layout

```
/
├── packages/
│   ├── core/              # Types, schemas, config — zero runtime deps on analyzer
│   └── sdk/               # CLI, scanner, analyzer, reasoner, builder, store, generators, runtime
├── fixtures/
│   └── nestjs-ecommerce/  # Reference app + ground-truth.json
├── context/               # Project docs (not published)
├── package.json           # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── vitest.config.ts
```

**Rules:**
- `packages/core` must not import from `packages/sdk`.
- `packages/sdk` imports from `packages/core` via `@agent-layer/core`.
- Fixture apps are standalone; they depend on SDK only as devDependency for integration tests.
- Generated `.agent-layer/` artifacts are never hand-edited in fixtures (except `overrides.json` in tests).

---

## TypeScript Conventions

### Strictness

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "exactOptionalPropertyTypes": true
}
```

### Naming

| Entity | Convention | Example |
|---|---|---|
| Files (modules) | `kebab-case.ts` | `route-graph.ts` |
| Files (types only) | `kebab-case.ts` or co-located in module | `analysis.ts` |
| Interfaces / types | `PascalCase` | `RouteGraphNode` |
| Classes | `PascalCase` | `ExecutorService` |
| Functions | `camelCase` | `buildRouteGraph` |
| Constants | `SCREAMING_SNAKE_CASE` | `CONFIDENCE_THRESHOLD` |
| Enums | `PascalCase` members | `SideEffects.Write` |
| Capability IDs | `snake_case` | `cart_management` |
| Operation IDs | `snake_case` | `add_item_to_cart` |
| JSON artifact keys | `camelCase` | `needsHumanReview` |

### Types vs interfaces

- Use `interface` for object shapes that may be extended (capabilities, config).
- Use `type` for unions, mapped types, and function signatures.
- Never use `any`. Use `unknown` + narrowing.
- Prefer `readonly` on arrays/objects that should not mutate after creation.

### Exports

- One public entry per package: `packages/core/src/index.ts`, `packages/sdk/src/index.ts`.
- Internal modules use subpath imports within the package; avoid deep imports from consumers.
- Export types with `export type` when re-exporting.

---

## Module Boundaries

```
cli/          → orchestrates pipeline; parses argv; writes stdout/stderr
scanner/      → FrameworkAdapter, ScanContext only
analyzer/     → RawRoute, RouteGraph only; no LLM imports
reasoner/     → LLM calls only; receives RouteGraph, returns labels
builder/      → Capability[]; no file I/O
store/        → file read/write for .agent-layer/
generators/   → read Capability[]; write format-specific docs
runtime/      → NestJS module; depends on store reader + executor
```

**Forbidden imports:**
- `analyzer/` must not import `reasoner/` or `runtime/`.
- `reasoner/` must not import `runtime/`.
- `core/` must not import anything from `sdk/`.

---

## Error Handling

| Context | Pattern |
|---|---|
| **CLI user errors** | Exit code `1`; clear message to stderr; suggest fix. |
| **Config/schema validation** | Throw `ConfigError` with field path. |
| **Analysis warnings** | Collect in `AnalysisResult.warnings[]`; do not throw. |
| **Unresolvable routes** | Skip route; add warning; continue pipeline. |
| **LLM failures** | Retry 2× with backoff; then fail with stage name in error. |
| **Runtime execution** | Return `{ success: false, error: { code, message } }`; don't throw to agent. |

Custom error classes extend `Error` with `readonly code: string` and optional `context`.

```typescript
class AnalysisWarning {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly route?: string;
}
```

---

## Logging

- Use a thin `Logger` interface (`debug`, `info`, `warn`, `error`).
- CLI defaults to `info`; `--verbose` enables `debug`.
- Never log secrets, tokens, or full LLM responses in production mode.
- Analysis runs log: route count, capability count, warnings count, LLM cost.

---

## LLM & Prompts

| Rule | Detail |
|---|---|
| **Versioned prompts** | Files named `domain.v1.ts`, `intent.v1.ts`. Bump version on prompt changes. |
| **Structured output** | All LLM calls request JSON; validate response against Zod schema. |
| **No prompt in hot path files** | Prompts live in `reasoner/prompts/` only. |
| **Deterministic tests** | Mock LLM provider in unit tests; never call real API in CI. |
| **Batch size** | Stage 2: 5–10 routes per call (configurable, not magic number in code — use constant). |

---

## JSON & Artifacts

- All `.agent-layer/` files are JSON with 2-space indent.
- Schema validation on **write** (analyze) and **read** (runtime load).
- `capabilities.draft.json` is gitignored; `capabilities.json` is committed.
- Breaking schema changes require version bump in `capabilities.json` top-level `version` field.

---

## Testing Standards

| Layer | What to test | Location |
|---|---|---|
| **Unit** | Pure functions: grouping rules, confidence scoring, schema mapping | `*.test.ts` co-located |
| **Integration** | NestJS adapter on fixture app; RouteGraph vs ground truth | `packages/sdk/test/integration/` |
| **E2E** | Full analyze → publish → runtime execute flow | `packages/sdk/test/e2e/` |
| **Eval** | Precision/recall vs `ground-truth.json` | `packages/sdk/test/eval/` |

**Rules:**
- Every feature in `build-plan.md` has at least one test before marked done.
- Fixture app `fixtures/nestjs-ecommerce/ground-truth.json` is the accuracy benchmark.
- Tests use deterministic fixtures; no network in unit/integration (mock LLM).
- Name tests: `describe('<module>')` → `it('should <behavior> when <condition>')`.

---

## CLI Conventions

```
agent-layer <command> [options] [path]

Commands: analyze, validate, diff, serve-mcp, doctor, review
Global flags: --verbose, --config <path>, --help
```

| Rule | Detail |
|---|---|
| **Default path** | Current working directory if path omitted. |
| **Exit codes** | `0` success, `1` user/runtime error, `2` usage error. |
| **Output** | Progress to stderr; JSON results to stdout only when `--json`. |
| **Flags** | kebab-case (`--static-only`, `--dry-run`). |

---

## NestJS Runtime Conventions

- Runtime lives in `packages/sdk/src/runtime/nestjs/`.
- Controllers are thin; logic in services (`ExecutorService`, `CapabilityRegistryService`).
- Use NestJS guards for `CapabilityGuard` (status check).
- Module config via `forRoot()` / `forRootAsync()` pattern.
- Route prefixes configurable; defaults: `/.well-known/`, `/agent/`.

---

## Dependencies

| Category | Allowed | Avoid |
|---|---|---|
| **Parsing** | tree-sitter, ts-morph | Executing user code |
| **Validation** | zod, ajv | class-validator in SDK (that's for analyzing user apps) |
| **HTTP** | native `fetch` (Node 20+) | axios unless needed |
| **CLI** | commander or citty | Heavy CLI frameworks |
| **LLM** | Provider SDK behind abstraction | Direct coupling in analyzer |

Pin major versions. Document why in PR/commit if adding a new dependency.

---

## Git & PR Conventions

| Item | Convention |
|---|---|
| **Branch** | `feat/<feature-id>-<short-name>` (e.g. `feat/1.3-nestjs-routes`) |
| **Commits** | Conventional: `feat(scanner): add NestJS route extraction` |
| **PR scope** | One feature from `build-plan.md` per PR when possible |
| **Required** | Tests pass; types pass; update `progress-tracker.md` |

---

## Comments & Documentation

- Code should be self-explanatory; minimal comments.
- Comment **why**, not **what**, for non-obvious business rules (e.g. grouping heuristics).
- JSDoc on public API exports only (`@param`, `@returns`, `@example`).
- No commented-out code in main branch.

---

## Security

- Never execute user application code during analysis.
- Sanitize file paths; stay within project root (prevent path traversal).
- Runtime: validate all agent input against JSON Schema before proxy.
- Do not log `Authorization` header values.
- LLM prompts include route metadata, not full source files unless necessary (batch snippets only).

---

## Agent Instructions

When writing code for this project:

1. Match module boundaries in `architecture.md`.
2. Follow naming tables above.
3. Add tests for every feature before marking done in `progress-tracker.md`.
4. Update `progress-tracker.md` after completing each feature.
5. Do not introduce patterns not listed here without updating this file.

---

## Context Doc Index

| File | Owns |
|---|---|
| `context/code-standards.md` | This file — coding conventions |
| `context/build-plan.md` | What to build |
| `context/progress-tracker.md` | What is done / next |
| `context/architecture.md` | Technical design |
