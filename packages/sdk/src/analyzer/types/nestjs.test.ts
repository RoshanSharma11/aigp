import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scanProject } from "../../scanner/scanner.js";
import { nestJsFrameworkAdapter } from "../../scanner/adapters/nestjs.adapter.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../../fixtures/nestjs-ecommerce",
);

describe("NestJS type extraction", () => {
  it("should extract request and response schemas for POST /api/cart/items", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const cartAddItemRoute = routes.find(
      (route) => route.method === "POST" && route.path === "/api/cart/items",
    );

    expect(cartAddItemRoute).toBeDefined();

    const typeInfo = nestJsFrameworkAdapter.extractTypes(
      context,
      cartAddItemRoute!,
    );

    expect(typeInfo.request?.typeName).toBe("AddCartItemDto");
    expect(typeInfo.request?.schema).toEqual({
      type: "object",
      properties: {
        productId: { type: "string" },
        quantity: { type: "integer", minimum: 1 },
      },
      required: ["productId", "quantity"],
    });

    expect(typeInfo.response?.typeName).toBe("CartEntity");
    expect(typeInfo.response?.isArray).toBe(false);
    expect(typeInfo.response?.schema).toEqual({
      type: "object",
      properties: {
        id: { type: "string" },
        userId: { type: "string" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: "string" },
              quantity: { type: "number" },
            },
            required: ["productId", "quantity"],
          },
        },
      },
      required: ["id", "userId", "items"],
    });
    expect(typeInfo.databaseEntities).toEqual(["CartEntity"]);
  });

  it("should extract query DTO schema for GET /api/products/search", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const searchRoute = routes.find(
      (route) => route.method === "GET" && route.path === "/api/products/search",
    );

    expect(searchRoute).toBeDefined();

    const typeInfo = nestJsFrameworkAdapter.extractTypes(context, searchRoute!);

    expect(typeInfo.request?.typeName).toBe("SearchProductsQueryDto");
    expect(typeInfo.request?.schema).toEqual({
      type: "object",
      properties: {
        query: { type: "string", minLength: 2 },
      },
    });
    expect(typeInfo.response?.typeName).toBe("ProductEntity");
    expect(typeInfo.response?.isArray).toBe(true);
    expect(typeInfo.databaseEntities).toEqual(["ProductEntity"]);
  });

  it("should extract login DTO schema for POST /api/auth/login", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const loginRoute = routes.find(
      (route) => route.method === "POST" && route.path === "/api/auth/login",
    );

    expect(loginRoute).toBeDefined();

    const typeInfo = nestJsFrameworkAdapter.extractTypes(context, loginRoute!);

    expect(typeInfo.request?.typeName).toBe("LoginDto");
    expect(typeInfo.request?.schema).toEqual({
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        password: { type: "string", minLength: 8 },
      },
      required: ["email", "password"],
    });
    expect(typeInfo.response?.typeName).toBe("SessionEntity");
    expect(typeInfo.databaseEntities).toEqual(["SessionEntity"]);
  });
});
