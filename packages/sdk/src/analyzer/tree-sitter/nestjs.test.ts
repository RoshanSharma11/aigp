import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scanProject } from "../../scanner/scanner.js";
import { nestJsFrameworkAdapter } from "../../scanner/adapters/nestjs.adapter.js";

interface GroundTruthRoute {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly controller: string;
  readonly handler: string;
  readonly requiresAuth: boolean;
}

interface GroundTruthDocument {
  readonly routes: readonly GroundTruthRoute[];
}

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../../fixtures/nestjs-ecommerce",
);

const loadGroundTruth = async (): Promise<GroundTruthDocument> => {
  const documentPath = path.join(fixtureRoot, "ground-truth.json");
  return JSON.parse(await readFile(documentPath, "utf8")) as GroundTruthDocument;
};

describe("NestJS route extraction", () => {
  it("should extract all fixture routes with correct HTTP method and path", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const groundTruth = await loadGroundTruth();

    expect(routes).toHaveLength(groundTruth.routes.length);

    for (const expectedRoute of groundTruth.routes) {
      const actualRoute = routes.find(
        (route) =>
          route.method === expectedRoute.method &&
          route.path === expectedRoute.path,
      );

      expect(actualRoute, `missing route ${expectedRoute.method} ${expectedRoute.path}`).toBeDefined();
      expect(actualRoute?.controllerName).toBe(expectedRoute.controller);
      expect(actualRoute?.handlerName).toBe(expectedRoute.handler);
      expect(actualRoute?.framework).toBe("nestjs");
      expect(actualRoute?.sourceLocation.filePath).toContain(".controller.ts");
    }
  });

  it("should attach AuthGuard middleware to cart routes", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const cartRoutes = routes.filter((route) => route.path.startsWith("/api/cart"));

    expect(cartRoutes.length).toBeGreaterThan(0);

    for (const route of cartRoutes) {
      expect(route.middleware).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "AuthGuard",
            source: "controller",
          }),
        ]),
      );
      expect(nestJsFrameworkAdapter.extractMiddleware(context, route)).toEqual(
        route.middleware,
      );
    }
  });

  it("should not attach AuthGuard middleware to public product routes", async () => {
    const context = await scanProject(fixtureRoot);
    const routes = nestJsFrameworkAdapter.extractRoutes(context);
    const productRoutes = routes.filter((route) =>
      route.path.startsWith("/api/products"),
    );

    for (const route of productRoutes) {
      expect(route.middleware).toEqual([]);
    }
  });
});
