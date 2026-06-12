import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nestJsFrameworkAdapter } from "../../scanner/adapters/nestjs.adapter.js";
import { scanProject } from "../../scanner/scanner.js";
import { extractNestJsCallGraph } from "./nestjs.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../../fixtures/nestjs-ecommerce",
);

describe("NestJS call graph extraction", () => {
  it("should trace cart routes through CartService and detect CartEntity", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const cartRoutes = routes.filter((route) => route.path.startsWith("/api/cart"));

    expect(cartRoutes.length).toBe(3);

    for (const route of cartRoutes) {
      const callGraph = extractNestJsCallGraph(context, route);

      expect(callGraph.sourceCode).toContain(route.handlerName);
      expect(callGraph.callChain[0]).toEqual({
        name: route.handlerName,
        filePath: route.sourceLocation.filePath,
        kind: "handler",
      });
      expect(callGraph.callChain).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringMatching(/^CartService\./u),
            filePath: "src/cart/cart.service.ts",
            kind: "service",
          }),
        ]),
      );
      expect(callGraph.databaseEntities).toContain("CartEntity");
      expect(callGraph.callChain.length).toBeLessThanOrEqual(4);
    }
  });

  it("should trace POST /api/cart/items to CartService.addCartItem", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const addItemRoute = routes.find(
      (route) => route.method === "POST" && route.path === "/api/cart/items",
    );

    expect(addItemRoute).toBeDefined();

    const callGraph = extractNestJsCallGraph(context, addItemRoute!);

    expect(callGraph.callChain).toEqual([
      {
        name: "addCartItem",
        filePath: "src/cart/cart.controller.ts",
        kind: "handler",
      },
      {
        name: "CartService.addCartItem",
        filePath: "src/cart/cart.service.ts",
        kind: "service",
      },
    ]);
    expect(callGraph.sourceCode).toContain("this.cartService.addCartItem");
    expect(callGraph.databaseEntities).toContain("CartEntity");
  });

  it("should trace product routes through ProductsService", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const listRoute = routes.find(
      (route) => route.method === "GET" && route.path === "/api/products",
    );

    expect(listRoute).toBeDefined();

    const callGraph = extractNestJsCallGraph(context, listRoute!);

    expect(callGraph.callChain).toEqual([
      {
        name: "listProducts",
        filePath: "src/products/products.controller.ts",
        kind: "handler",
      },
      {
        name: "ProductsService.listProducts",
        filePath: "src/products/products.service.ts",
        kind: "service",
      },
    ]);
    expect(callGraph.databaseEntities).toContain("ProductEntity");
  });

  it("should trace auth login through AuthService", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const loginRoute = routes.find(
      (route) => route.method === "POST" && route.path === "/api/auth/login",
    );

    expect(loginRoute).toBeDefined();

    const callGraph = extractNestJsCallGraph(context, loginRoute!);

    expect(callGraph.callChain).toEqual([
      {
        name: "login",
        filePath: "src/auth/auth.controller.ts",
        kind: "handler",
      },
      {
        name: "AuthService.login",
        filePath: "src/auth/auth.service.ts",
        kind: "service",
      },
    ]);
    expect(callGraph.databaseEntities).toContain("SessionEntity");
  });
});
