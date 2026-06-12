import type { Capability } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import {
  buildInternalRouteRequest,
  executeCapability,
  resolveCapabilityOperation,
} from "./executor.js";
import { RuntimeError } from "./errors.js";
import type { InternalRouteProxy, InternalRouteRequest } from "./types.js";

const sampleCapability = (): Capability => ({
  id: "product_catalog",
  name: "Product Catalog",
  description: "Browse and search products",
  category: "catalog",
  operations: [
    {
      id: "list_products",
      description: "List products",
      httpMethod: "GET",
      httpPath: "/api/products",
      inputSchema: { type: "object" },
      outputSchema: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      },
      sideEffects: "read",
    },
    {
      id: "search_products",
      description: "Search products",
      httpMethod: "GET",
      httpPath: "/api/products/search",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
        },
      },
      outputSchema: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "number" },
            name: { type: "string" },
          },
        },
      },
      sideEffects: "read",
    },
  ],
  defaultOperation: "list_products",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.93,
  needsHumanReview: false,
  sourceRoutes: ["GET /api/products", "GET /api/products/search"],
  status: "approved",
});

describe("executor", () => {
  it("should resolve the default operation when none is provided", () => {
    const operation = resolveCapabilityOperation(sampleCapability());

    expect(operation.id).toBe("list_products");
  });

  it("should throw when an operation id is unknown", () => {
    expect(() =>
      resolveCapabilityOperation(sampleCapability(), "missing_operation"),
    ).toThrow(RuntimeError);
  });

  it("should map GET operations to query parameters and pass authorization", () => {
    const request = buildInternalRouteRequest(
      sampleCapability().operations[1]!,
      { query: "shoes" },
      "Bearer test-token",
    );

    expect(request.method).toBe("GET");
    expect(request.path).toBe("/api/products/search");
    expect(request.query).toEqual({ query: "shoes" });
    expect(request.headers?.authorization).toBe("Bearer test-token");
  });

  it("should proxy a valid request and return a structured success envelope", async () => {
    const capturedRequests: InternalRouteRequest[] = [];
    const proxy: InternalRouteProxy = {
      execute: async (request) => {
        capturedRequests.push(request);

        return {
          status: 200,
          body: [{ id: 1, name: "shoes" }],
        };
      },
    };

    const result = await executeCapability(
      sampleCapability(),
      {
        operation: "search_products",
        input: { query: "shoes" },
      },
      proxy,
      "Bearer test-token",
    );

    expect(result.success).toBe(true);
    expect(result.capabilityId).toBe("product_catalog");
    expect(result.operation).toBe("search_products");
    expect(result.data).toEqual([{ id: 1, name: "shoes" }]);
    expect(result.metadata.httpMethod).toBe("GET");
    expect(result.metadata.httpPath).toBe("/api/products/search");
    expect(result.metadata.httpStatus).toBe(200);
    expect(capturedRequests[0]?.path).toBe("/api/products/search?query=shoes");
    expect(capturedRequests[0]?.headers?.authorization).toBe("Bearer test-token");
  });

  it("should return input validation errors without throwing", async () => {
    const proxy: InternalRouteProxy = {
      execute: async () => ({
        status: 200,
        body: [],
      }),
    };

    const result = await executeCapability(
      sampleCapability(),
      {
        operation: "search_products",
        input: { query: 42 },
      },
      proxy,
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("INPUT_VALIDATION_FAILED");
  });

  it("should return route execution failures from non-2xx responses", async () => {
    const proxy: InternalRouteProxy = {
      execute: async () => ({
        status: 404,
        body: { message: "Not found" },
      }),
    };

    const result = await executeCapability(
      sampleCapability(),
      {
        operation: "list_products",
        input: {},
      },
      proxy,
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ROUTE_EXECUTION_FAILED");
    expect(result.metadata.httpStatus).toBe(404);
  });
});
