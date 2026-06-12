# NestJS Ecommerce Fixture

Reference backend for static analysis, accuracy evaluation, and runtime agent-access testing.

## Agent layer setup

The fixture ships with `@agent-layer/sdk` wired via `AgentLayerModule.forRoot()`. Before starting the app, generate and publish approved capabilities:

```bash
# From the repository root
pnpm agent-layer analyze fixtures/nestjs-ecommerce --publish
```

Approve capabilities first by adding entries to `fixtures/nestjs-ecommerce/.agent-layer/overrides.json` with `"status": "approved"`, or by setting approved status directly in the draft before publishing.

The default mock LLM provider auto-detects this fixture (via `ground-truth.json`) and uses deterministic ecommerce responses — no API keys required.

## Run the fixture

```bash
pnpm --filter @agent-layer/fixture-nestjs-ecommerce build
node fixtures/nestjs-ecommerce/dist/main.js
```

Agent endpoints are served on the same origin as the API:

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/agent.json` | Primary agent discovery |
| `GET /agent/capabilities` | List approved capabilities |
| `GET /agent/capabilities/:id` | Full capability definition |
| `POST /agent/capabilities/:id` | Execute a capability |

Backend API routes remain under `/api/*`.

## Accuracy benchmark

`ground-truth.json` in this directory is the canonical benchmark for RouteGraph recall and capability precision evaluation (`agent-layer analyze --eval`).
