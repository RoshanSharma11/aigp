# MCP Setup — Local Development

Use `agent-layer serve-mcp` to expose published capabilities to Cursor or Claude Desktop over stdio MCP.

## Prerequisites

1. Run analysis and publish approved capabilities:

```bash
cd fixtures/nestjs-ecommerce
pnpm exec agent-layer analyze
pnpm exec agent-layer review approve product_catalog account_access cart_management
pnpm exec agent-layer analyze --publish
```

2. Start the fixture NestJS app with `AgentLayerModule` so capability execution is available on the configured `baseUrl`.

## Cursor configuration

Add an MCP server entry to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "agent-layer-fixture": {
      "command": "pnpm",
      "args": [
        "--dir",
        "/absolute/path/to/idea-agent-interface-generation/fixtures/nestjs-ecommerce",
        "exec",
        "agent-layer",
        "serve-mcp",
        "--base-url",
        "http://127.0.0.1:3000"
      ]
    }
  }
}
```

Replace the project path and `--base-url` with your local app origin.

## Claude Desktop configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-layer-fixture": {
      "command": "npx",
      "args": [
        "@agent-layer/sdk",
        "serve-mcp",
        "/absolute/path/to/fixtures/nestjs-ecommerce",
        "--base-url",
        "http://127.0.0.1:3000"
      ]
    }
  }
}
```

## Tool shape

Each approved capability becomes one MCP tool named after its capability id (for example `product_catalog`).

Tool input schema:

```json
{
  "operation": "search_products",
  "input": {
    "query": "shoes"
  }
}
```

`operation` defaults to the capability's `defaultOperation` when omitted.

## Notes

- `serve-mcp` reads **published** `capabilities.json` and serves **approved** capabilities only.
- Draft, disabled, and pending-review capabilities are never exposed as MCP tools.
- Production MCP over HTTP/SSE is planned for Phase 5; stdio is for local development only.
