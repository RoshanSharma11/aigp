import type { Capability } from "@agent-layer/core";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { CapabilityRegistryService } from "./capability-registry.service.js";
import { ExecutorService } from "./executor.service.js";
import { StaticInternalRouteProxy } from "./internal-route-proxy.js";
import {
  AGENT_LAYER_MODULE_OPTIONS,
  INTERNAL_ROUTE_PROXY,
  type AgentLayerModuleOptions,
} from "./tokens.js";

const sampleCapability = (): Capability => ({
  id: "product_catalog",
  name: "Product Catalog",
  description: "Browse and search products",
  category: "catalog",
  operations: [
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
      outputSchema: { type: "array" },
      sideEffects: "read",
    },
  ],
  defaultOperation: "search_products",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.93,
  needsHumanReview: false,
  sourceRoutes: ["GET /api/products/search"],
  status: "approved",
});

const moduleOptions: AgentLayerModuleOptions = {
  baseUrl: "https://shop.example.com",
  capabilities: [sampleCapability()],
};

describe("ExecutorService", () => {
  it("should execute an approved capability through the internal route proxy", async () => {
    const capturedPaths: string[] = [];
    const routeProxy = new StaticInternalRouteProxy(async (request) => {
      capturedPaths.push(request.path);

      return {
        status: 200,
        body: [{ id: 1, name: "shoes" }],
      };
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CapabilityRegistryService,
        ExecutorService,
        {
          provide: AGENT_LAYER_MODULE_OPTIONS,
          useValue: moduleOptions,
        },
        {
          provide: INTERNAL_ROUTE_PROXY,
          useValue: routeProxy,
        },
      ],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    const executor = moduleRef.get(ExecutorService);
    const result = await executor.execute(
      "product_catalog",
      {
        operation: "search_products",
        input: { query: "shoes" },
      },
      "Bearer test-token",
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1, name: "shoes" }]);
    expect(capturedPaths[0]).toBe("/api/products/search?query=shoes");
  });

  it("should return a structured error when the capability is unavailable", async () => {
    const routeProxy = new StaticInternalRouteProxy(async () => ({
      status: 200,
      body: {},
    }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        CapabilityRegistryService,
        ExecutorService,
        {
          provide: AGENT_LAYER_MODULE_OPTIONS,
          useValue: moduleOptions,
        },
        {
          provide: INTERNAL_ROUTE_PROXY,
          useValue: routeProxy,
        },
      ],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    const executor = moduleRef.get(ExecutorService);
    const result = await executor.execute("missing_capability", {
      input: {},
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("CAPABILITY_NOT_FOUND");
  });
});
