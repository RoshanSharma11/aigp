import { Controller, Get, Module, Query } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { executeCapability } from "../executor.js";
import type { Capability } from "@agent-layer/core";

import { ExpressInternalRouteProxy } from "./internal-route-proxy.js";

@Controller("api/products")
class ProductsController {
  @Get("search")
  searchProducts(@Query("query") query: string) {
    return [{ id: 1, name: query }];
  }
}

@Module({
  controllers: [ProductsController],
})
class ProductsTestModule {}

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

describe("ExpressInternalRouteProxy", () => {
  it("should proxy in-process to an internal NestJS route", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProductsTestModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const httpAdapterHost = app.get(HttpAdapterHost);
    const proxy = new ExpressInternalRouteProxy(httpAdapterHost);

    const result = await executeCapability(
      sampleCapability(),
      {
        operation: "search_products",
        input: { query: "shoes" },
      },
      proxy,
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual([{ id: 1, name: "shoes" }]);
    expect(result.metadata.httpPath).toBe("/api/products/search");
    expect(result.metadata.httpStatus).toBe(200);

    await app.close();
  });
});
