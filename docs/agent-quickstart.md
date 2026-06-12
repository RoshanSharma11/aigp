# Agent Quickstart

Discover and invoke business capabilities on any app running the Agent Layer runtime.

## Prerequisites

- The target app has `@agent-layer/sdk` integrated via `AgentLayerModule.forRoot()`
- Approved capabilities are published to `.agent-layer/capabilities.json`
- The app is running (default fixture: `http://localhost:3000`)

## 1. Discover capabilities

```bash
curl -s http://localhost:3000/.well-known/agent.json | jq .
```

The response includes a `capabilitiesEndpoint` URL and a summary of each approved capability.

List capabilities directly:

```bash
curl -s http://localhost:3000/agent/capabilities | jq .
```

Inspect a single capability:

```bash
curl -s http://localhost:3000/agent/capabilities/product_catalog | jq .
```

## 2. Execute a public capability

Search products (no auth required):

```bash
curl -s -X POST http://localhost:3000/agent/capabilities/product_catalog \
  -H 'Content-Type: application/json' \
  -d '{
    "operation": "search_products",
    "input": { "query": "shoes" }
  }' | jq .
```

Successful responses use a structured envelope:

```json
{
  "capabilityId": "product_catalog",
  "operation": "search_products",
  "success": true,
  "data": [ ... ],
  "metadata": {
    "executedAt": "...",
    "httpMethod": "GET",
    "httpPath": "/api/products/search",
    "httpStatus": 200
  }
}
```

## 3. Execute an auth-gated capability

Log in first to obtain a session token:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/agent/capabilities/account_access \
  -H 'Content-Type: application/json' \
  -d '{
    "operation": "login",
    "input": {
      "email": "agent@example.com",
      "password": "password123"
    }
  }' | jq -r '.data.accessToken')
```

Then call an auth-gated capability with the token:

```bash
curl -s -X POST http://localhost:3000/agent/capabilities/cart_management \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "operation": "get_cart",
    "input": {}
  }' | jq .
```

The runtime forwards the `Authorization` header to the underlying backend route.

## Request body

| Field | Required | Description |
|---|---|---|
| `operation` | No | Operation id; defaults to the capability's `defaultOperation` |
| `input` | No | JSON payload validated against the operation's input schema |

## Error responses

| HTTP status | Meaning |
|---|---|
| `404` | Capability not found or not approved |
| `403` | Capability is pending human review |
| `200` with `"success": false` | Input validation, route execution, or output validation failed (see `error` field) |

Draft, disabled, and pending-review capabilities are never exposed at runtime.
