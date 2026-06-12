import type { Capability } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import {
  capabilityIsAffectedByRoutes,
  findChangedRouteFiles,
  hashFileContents,
  mergeIncrementalCapabilities,
} from "./incremental.js";

const sampleRouteGraph = [
  {
    route: {
      id: "ProductsController.list GET /api/products",
      framework: "nestjs" as const,
      method: "GET" as const,
      path: "/api/products",
      controllerName: "ProductsController",
      handlerName: "list",
      sourceLocation: {
        filePath: "src/products/products.controller.ts",
        line: 1,
        column: 1,
      },
      middleware: [],
    },
    requestSchema: { type: "object" },
    responseSchema: { type: "object" },
    middleware: [],
    callChain: [],
    databaseEntities: [],
    sourceCode: "",
  },
  {
    route: {
      id: "CartController.getCart GET /api/cart",
      framework: "nestjs" as const,
      method: "GET" as const,
      path: "/api/cart",
      controllerName: "CartController",
      handlerName: "getCart",
      sourceLocation: {
        filePath: "src/cart/cart.controller.ts",
        line: 1,
        column: 1,
      },
      middleware: [],
    },
    requestSchema: { type: "object" },
    responseSchema: { type: "object" },
    middleware: [],
    callChain: [],
    databaseEntities: [],
    sourceCode: "",
  },
];

const sampleCapability = (id: string, sourceRoutes: readonly string[]): Capability => ({
  id,
  name: id,
  description: id,
  category: "commerce",
  operations: [
    {
      id: "read",
      description: "Read",
      httpMethod: "GET",
      httpPath: "/api/example",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      sideEffects: "read",
    },
  ],
  defaultOperation: "read",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.9,
  needsHumanReview: false,
  sourceRoutes,
  status: "approved",
});

describe("incremental analysis helpers", () => {
  it("should detect changed route files by hash", () => {
    const previous = {
      "src/products/products.controller.ts": hashFileContents("old"),
      "src/cart/cart.controller.ts": hashFileContents("same"),
    };
    const current = {
      "src/products/products.controller.ts": hashFileContents("new"),
      "src/cart/cart.controller.ts": hashFileContents("same"),
    };

    expect(findChangedRouteFiles(current, previous)).toEqual([
      "src/products/products.controller.ts",
    ]);
  });

  it("should mark capabilities affected by changed routes", () => {
    const changedRouteIds = new Set(["ProductsController.list GET /api/products"]);
    const capability = sampleCapability("product_catalog", ["GET /api/products"]);

    expect(
      capabilityIsAffectedByRoutes(capability, changedRouteIds, sampleRouteGraph),
    ).toBe(true);
  });

  it("should merge preserved and regenerated capabilities by id", () => {
    const preserved = [sampleCapability("product_catalog", ["GET /api/products"])];
    const regenerated = [sampleCapability("cart_management", ["GET /api/cart"])];

    const merged = mergeIncrementalCapabilities(preserved, regenerated);

    expect(merged.map((capability) => capability.id)).toEqual([
      "cart_management",
      "product_catalog",
    ]);
  });
});
