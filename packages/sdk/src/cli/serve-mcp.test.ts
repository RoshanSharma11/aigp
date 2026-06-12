import type { Capability } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import { createMcpServer, executeMcpToolCall } from "./serve-mcp.js";

const sampleCapability = (): Capability => ({
  id: "product_catalog",
  name: "Product catalog",
  description: "Search products",
  category: "commerce",
  operations: [
    {
      id: "search_products",
      description: "Search products",
      httpMethod: "GET",
      httpPath: "/api/products",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
      },
      outputSchema: { type: "array" },
      sideEffects: "read",
    },
  ],
  defaultOperation: "search_products",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
  },
  outputSchema: { type: "array" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.95,
  needsHumanReview: false,
  sourceRoutes: ["GET /api/products"],
  status: "approved",
});

describe("serve-mcp", () => {
  it("should create an MCP server with one tool per capability", () => {
    const server = createMcpServer([sampleCapability()], "http://127.0.0.1:3000", fetch);

    expect(server).toBeDefined();
  });

  it("should execute capabilities through the configured base URL", async () => {
    const requests: Array<{ readonly url: string; readonly body: string }> = [];
    const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
      requests.push({
        url: String(input),
        body: String(init?.body ?? ""),
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: [{ name: "Shoes" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const result = await executeMcpToolCall(
      [sampleCapability()],
      "http://127.0.0.1:3000",
      "product_catalog",
      {
        operation: "search_products",
        input: { query: "shoes" },
      },
      fetchImpl,
    );

    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.text).toContain("Shoes");
    expect(requests[0]?.url).toBe("http://127.0.0.1:3000/agent/capabilities/product_catalog");
  });
});
