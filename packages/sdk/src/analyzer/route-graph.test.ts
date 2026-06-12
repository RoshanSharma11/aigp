import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nestJsFrameworkAdapter } from "../scanner/adapters/nestjs.adapter.js";
import { scanProject } from "../scanner/scanner.js";
import {
  buildRouteGraph,
  computeRouteRecall,
  runStaticAnalysis,
  serializeRouteGraphArtifact,
  writeRouteGraphArtifact,
} from "./route-graph.js";

interface GroundTruthDocument {
  readonly routes: readonly {
    readonly method: string;
    readonly path: string;
    readonly handler: string;
    readonly controller: string;
  }[];
}

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

const loadGroundTruth = async (): Promise<GroundTruthDocument> => {
  const documentPath = path.join(fixtureRoot, "ground-truth.json");
  return JSON.parse(await readFile(documentPath, "utf8")) as GroundTruthDocument;
};

describe("route graph builder", () => {
  it("should merge route, type, and call graph layers into RouteGraphNode objects", async () => {
    const context = await scanProject(fixtureRoot);
    const { routeGraph, warnings } = buildRouteGraph(
      context,
      nestJsFrameworkAdapter,
    );

    expect(warnings).toEqual([]);
    expect(routeGraph).toHaveLength(7);

    const cartAddItem = routeGraph.find(
      (node) =>
        node.route.method === "POST" && node.route.path === "/api/cart/items",
    );

    expect(cartAddItem).toBeDefined();
    expect(cartAddItem?.requestSchema).toEqual({
      type: "object",
      properties: {
        productId: { type: "string" },
        quantity: { type: "integer", minimum: 1 },
      },
      required: ["productId", "quantity"],
    });
    expect(cartAddItem?.responseSchema).toEqual({
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
    expect(cartAddItem?.callChain).toEqual([
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
    expect(cartAddItem?.databaseEntities).toContain("CartEntity");
    expect(cartAddItem?.sourceCode).toContain("this.cartService.addCartItem");
    expect(cartAddItem?.middleware).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "AuthGuard", source: "controller" }),
      ]),
    );
  }, 15_000);

  it("should meet the G1 recall gate against fixture ground truth", async () => {
    const context = await scanProject(fixtureRoot);
    const groundTruth = await loadGroundTruth();
    const { routeGraph } = buildRouteGraph(context, nestJsFrameworkAdapter);

    const recall = computeRouteRecall(routeGraph, groundTruth.routes);

    expect(recall).toBeGreaterThanOrEqual(0.98);

    for (const expectedRoute of groundTruth.routes) {
      const node = routeGraph.find(
        (candidate) =>
          candidate.route.method === expectedRoute.method &&
          candidate.route.path === expectedRoute.path,
      );

      expect(node, `missing ${expectedRoute.method} ${expectedRoute.path}`).toBeDefined();
      expect(node?.route.controllerName).toBe(expectedRoute.controller);
      expect(node?.route.handlerName).toBe(expectedRoute.handler);
    }
  }, 15_000);

  it("should drop routes with unresolvable handlers and emit warnings", async () => {
    const context = await scanProject(fixtureRoot);
    const { routeGraph, warnings } = buildRouteGraph(
      context,
      {
        ...nestJsFrameworkAdapter,
        extractRoutes: () => [
          ...nestJsFrameworkAdapter.extractRoutes(context),
          {
            id: "ghost_route",
            framework: "nestjs" as const,
            method: "GET" as const,
            path: "/api/ghost",
            controllerName: "GhostController",
            handlerName: "missingHandler",
            sourceLocation: {
              filePath: "src/ghost/ghost.controller.ts",
              line: 1,
              column: 0,
            },
            middleware: [],
          },
        ],
        extractCallGraph: (ctx, route) => {
          if (route.controllerName === "GhostController") {
            return {
              callChain: [],
              databaseEntities: [],
              sourceCode: "",
            };
          }

          return nestJsFrameworkAdapter.extractCallGraph(ctx, route);
        },
        extractTypes: nestJsFrameworkAdapter.extractTypes,
        extractMiddleware: nestJsFrameworkAdapter.extractMiddleware,
        detect: nestJsFrameworkAdapter.detect,
      },
    );

    expect(routeGraph).toHaveLength(7);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: "UNRESOLVABLE_HANDLER",
        route: "GET /api/ghost",
      }),
    ]);
  }, 15_000);

  it("should serialize and write route-graph.json under .agent-layer", async () => {
    const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
    const artifactPath = path.join(artifactDirectory, "route-graph.json");

    await rm(artifactDirectory, { recursive: true, force: true });

    const analysisResult = await runStaticAnalysis(fixtureRoot);
    const writtenPath = await writeRouteGraphArtifact(
      fixtureRoot,
      analysisResult.routeGraph,
      analysisResult.meta.generatedAt,
    );

    expect(writtenPath).toBe(artifactPath);
    await expect(access(artifactPath)).resolves.toBeUndefined();

    const artifact = JSON.parse(
      await readFile(artifactPath, "utf8"),
    ) as ReturnType<typeof serializeRouteGraphArtifact>;

    expect(artifact.version).toBe("1.0.0");
    expect(artifact.routes).toHaveLength(7);
    expect(artifact.generatedAt).toBe(analysisResult.meta.generatedAt);

    await rm(artifactDirectory, { recursive: true, force: true });
  }, 15_000);
});
