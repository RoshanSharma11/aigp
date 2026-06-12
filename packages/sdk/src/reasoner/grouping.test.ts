import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RouteGraphNode } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import { buildRouteGraph } from "../analyzer/route-graph.js";
import { nestJsFrameworkAdapter } from "../scanner/adapters/nestjs.adapter.js";
import { scanProject } from "../scanner/scanner.js";
import {
  annotateLowConfidenceGroups,
  buildCapabilityGroupingInput,
  buildGroupingRouteInput,
  buildPreClusters,
  groupCapabilitiesWithLlm,
  groupRouteCapabilities,
  inferSuggestedCategory,
  isUtilityRoute,
  normalizeEntityKey,
  partitionUtilityRoutes,
} from "./grouping.js";
import { createLlmClientFromProvider } from "./llm/factory.js";
import { MockLlmProvider } from "./llm/mock-provider.js";
import {
  annotateLowConfidenceLabels,
  labelRouteIntents,
} from "./intent.js";
import {
  buildCapabilityGroupingSystemPrompt,
  buildCapabilityGroupingUserPrompt,
  GROUPING_LOW_CONFIDENCE_THRESHOLD,
  groupingResponseSchema,
  type CapabilityGroupingInput,
  type GroupingRouteInput,
} from "./prompts/grouping.v1.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

const ecommerceDomain = {
  domain: "ecommerce",
  confidence: 0.95,
  primaryEntities: ["ProductEntity", "CartEntity", "SessionEntity"],
  suggestedCategories: ["catalog", "cart", "auth"],
};

const buildMockGroupingRoutes = (): GroupingRouteInput[] => [
  {
    routeId: "products_list",
    method: "GET",
    path: "/api/products",
    intent: "list_products",
    description: "List all products in the catalog",
    databaseEntities: ["ProductEntity"],
    requiresAuth: false,
    riskLevel: "low",
    confidence: 0.95,
  },
  {
    routeId: "products_search",
    method: "GET",
    path: "/api/products/search",
    intent: "search_products",
    description: "Search products by query filters",
    databaseEntities: ["ProductEntity"],
    requiresAuth: false,
    riskLevel: "low",
    confidence: 0.94,
  },
  {
    routeId: "products_get_by_id",
    method: "GET",
    path: "/api/products/:productId",
    intent: "get_product",
    description: "Get a single product by ID",
    databaseEntities: ["ProductEntity"],
    requiresAuth: false,
    riskLevel: "low",
    confidence: 0.93,
  },
  {
    routeId: "cart_get",
    method: "GET",
    path: "/api/cart",
    intent: "get_cart",
    description: "Get the current user's shopping cart",
    databaseEntities: ["CartEntity"],
    requiresAuth: true,
    riskLevel: "low",
    confidence: 0.92,
  },
  {
    routeId: "cart_add_item",
    method: "POST",
    path: "/api/cart/items",
    intent: "add_cart_item",
    description: "Add an item to the shopping cart",
    databaseEntities: ["CartEntity"],
    requiresAuth: true,
    riskLevel: "medium",
    confidence: 0.91,
  },
  {
    routeId: "cart_update_item",
    method: "PATCH",
    path: "/api/cart/items/:productId",
    intent: "update_cart_item",
    description: "Update quantity for a cart line item",
    databaseEntities: ["CartEntity"],
    requiresAuth: true,
    riskLevel: "medium",
    confidence: 0.9,
  },
  {
    routeId: "auth_login",
    method: "POST",
    path: "/api/auth/login",
    intent: "login",
    description: "Authenticate a user and create a session",
    databaseEntities: ["SessionEntity"],
    requiresAuth: false,
    riskLevel: "medium",
    confidence: 0.96,
  },
];

const buildMockGroupingResponse = (input: CapabilityGroupingInput): string =>
  JSON.stringify({
    groups: [
      {
        id: "product_catalog",
        name: "Product Catalog",
        description: "Browse and search products in the store catalog",
        category: "catalog",
        routeIds: input.routes
          .filter((route) => route.path.startsWith("/api/products"))
          .map((route) => route.routeId),
        requiresAuth: false,
        confidence: 0.93,
      },
      {
        id: "cart_management",
        name: "Cart Management",
        description: "View and modify the shopping cart",
        category: "cart",
        routeIds: input.routes
          .filter((route) => route.path.startsWith("/api/cart"))
          .map((route) => route.routeId),
        prerequisites: ["account_access"],
        requiresAuth: true,
        confidence: 0.92,
      },
      {
        id: "account_access",
        name: "Account Access",
        description: "Authenticate users and establish sessions",
        category: "auth",
        routeIds: input.routes
          .filter((route) => route.path.startsWith("/api/auth"))
          .map((route) => route.routeId),
        requiresAuth: false,
        confidence: 0.95,
      },
    ],
  });

describe("grouping helpers", () => {
  it("should detect utility routes by path and handler name", () => {
    expect(isUtilityRoute("/health", "checkHealth")).toBe(true);
    expect(isUtilityRoute("/api/products", "listProducts")).toBe(false);
    expect(isUtilityRoute("/metrics", "getMetrics")).toBe(true);
  });

  it("should normalize entity names to snake_case keys", () => {
    expect(normalizeEntityKey("ProductEntity")).toBe("product");
    expect(normalizeEntityKey("CartEntity")).toBe("cart");
  });

  it("should build entity-centric pre-clusters", () => {
    const routes = buildMockGroupingRoutes();
    const clusters = buildPreClusters(routes, ecommerceDomain.suggestedCategories);

    expect(clusters).toHaveLength(3);
    expect(clusters.find((cluster) => cluster.entityKey === "product")?.routeIds).toEqual(
      expect.arrayContaining([
        "products_list",
        "products_search",
        "products_get_by_id",
      ]),
    );
    expect(clusters.find((cluster) => cluster.entityKey === "cart")?.routeIds).toEqual(
      expect.arrayContaining([
        "cart_get",
        "cart_add_item",
        "cart_update_item",
      ]),
    );
  });

  it("should infer auth and catalog categories from route metadata", () => {
    expect(
      inferSuggestedCategory("session", "/api/auth/login", ["catalog", "cart", "auth"]),
    ).toBe("auth");
    expect(
      inferSuggestedCategory("product", "/api/products", ["catalog", "cart", "auth"]),
    ).toBe("catalog");
  });

  it("should flag groups below the grouping confidence threshold", () => {
    const result = annotateLowConfidenceGroups([
      {
        id: "product_catalog",
        name: "Product Catalog",
        description: "Browse products",
        category: "catalog",
        routeIds: ["products_list"],
        requiresAuth: false,
        confidence: 0.9,
      },
      {
        id: "unknown_group",
        name: "Unknown",
        description: "Unclear grouping",
        category: "general",
        routeIds: ["route_x"],
        requiresAuth: false,
        confidence: 0.7,
      },
    ]);

    expect(result.lowConfidenceGroupIds).toEqual(["unknown_group"]);
    expect(result.groups[0]?.lowConfidence).toBe(false);
    expect(result.groups[1]?.lowConfidence).toBe(true);
    expect(GROUPING_LOW_CONFIDENCE_THRESHOLD).toBe(0.85);
  });
});

describe("grouping prompts", () => {
  it("should serialize pre-clusters and routes in the user prompt", () => {
    const routes = buildMockGroupingRoutes();
    const input = buildCapabilityGroupingInput(routes, ecommerceDomain);

    expect(buildCapabilityGroupingSystemPrompt()).toContain("JSON only");
    expect(buildCapabilityGroupingUserPrompt(input)).toContain('"pre_clusters"');
    expect(buildCapabilityGroupingUserPrompt(input)).toContain('"products_list"');
    expect(
      groupingResponseSchema.parse(JSON.parse(buildMockGroupingResponse(input))),
    ).toBeDefined();
  });
});

describe("groupCapabilitiesWithLlm", () => {
  it("should return grouped capabilities with full route coverage", async () => {
    const routes = buildMockGroupingRoutes();
    const input = buildCapabilityGroupingInput(routes, ecommerceDomain);
    const provider = new MockLlmProvider([buildMockGroupingResponse(input)]);
    const client = createLlmClientFromProvider(provider, {
      model: "mock-model-v1",
      stage: "capability-grouping",
    });

    const groups = await groupCapabilitiesWithLlm(input, client);

    expect(groups).toHaveLength(3);
    expect(groups.flatMap((group) => group.routeIds)).toHaveLength(7);
    expect(provider.getCallCount()).toBe(1);
  });
});

describe("groupRouteCapabilities", () => {
  it(
    "should group fixture routes into fewer capabilities than routes",
    async () => {
      const context = await scanProject(fixtureRoot);
      const { routeGraph } = buildRouteGraph(context, nestJsFrameworkAdapter);

      const intentProvider = new MockLlmProvider((request) => {
        const parsed = JSON.parse(request.user) as { routes: GroupingRouteInput[] };
        return JSON.stringify({
          labels: parsed.routes.map((route) => {
            const mockRoute = buildMockGroupingRoutes().find(
              (candidate) => candidate.path === route.path,
            );

            return {
              routeId: route.routeId,
              intent: mockRoute?.intent ?? "unknown_route",
              description: mockRoute?.description ?? "Unknown route",
              sideEffects: "read",
              requiresAuth: mockRoute?.requiresAuth ?? false,
              riskLevel: mockRoute?.riskLevel ?? "low",
              confidence: mockRoute?.confidence ?? 0.9,
            };
          }),
        });
      });
      const intentClient = createLlmClientFromProvider(intentProvider, {
        model: "mock-model-v1",
        stage: "intent-labeling",
      });
      const intentResult = await labelRouteIntents(
        routeGraph,
        ecommerceDomain.domain,
        intentClient,
      );

      const groupingProvider = new MockLlmProvider((request) => {
        const parsed = JSON.parse(request.user) as CapabilityGroupingInput;
        return buildMockGroupingResponse(parsed);
      });
      const groupingClient = createLlmClientFromProvider(groupingProvider, {
        model: "mock-model-v1",
        stage: "capability-grouping",
      });

      const result = await groupRouteCapabilities(
        routeGraph,
        intentResult.labels,
        ecommerceDomain,
        groupingClient,
      );

      expect(result.groups.length).toBeLessThan(routeGraph.length);
      expect(result.groups.length).toBeGreaterThanOrEqual(2);
      expect(result.excludedRouteIds).toEqual([]);
      expect(result.lowConfidenceGroupIds).toEqual([]);

      const assignedRouteIds = result.groups.flatMap((group) => group.routeIds);
      expect(assignedRouteIds).toHaveLength(routeGraph.length);

      const cartGroup = result.groups.find((group) => group.id === "cart_management");
      expect(cartGroup?.prerequisites).toContain("account_access");

      const { activeRoutes } = partitionUtilityRoutes(routeGraph);
      for (const node of activeRoutes) {
        const label = intentResult.labels.find(
          (candidate) => candidate.routeId === node.route.id,
        );
        expect(label).toBeDefined();

        const groupingRoute = buildGroupingRouteInput(node, label!);
        expect(groupingRoute.intent.length).toBeGreaterThan(0);
      }
    },
    30_000,
  );

  it("should exclude utility routes before grouping", () => {
    const mockRouteGraphNode = (
      route: GroupingRouteInput,
      handlerName: string = route.intent,
    ): RouteGraphNode =>
      ({
        route: {
          id: route.routeId,
          method: route.method,
          path: route.path,
          handlerName,
          controllerName: "Controller",
          framework: "nestjs",
          sourceLocation: {
            filePath: "src/controller.ts",
            line: 1,
            column: 1,
          },
          middleware: [],
        },
        databaseEntities: [...route.databaseEntities],
        middleware: [],
        callChain: [],
      }) as unknown as RouteGraphNode;

    const utilityNode = mockRouteGraphNode(
      {
        routeId: "health_check",
        method: "GET",
        path: "/health",
        intent: "health_check",
        description: "Health check",
        databaseEntities: [],
        requiresAuth: false,
        riskLevel: "low",
        confidence: 1,
      },
      "healthCheck",
    );

    const { activeRoutes, excludedRouteIds } = partitionUtilityRoutes([
      utilityNode,
      ...buildMockGroupingRoutes().map((route) => mockRouteGraphNode(route)),
    ]);

    expect(excludedRouteIds).toEqual(["health_check"]);
    expect(activeRoutes).toHaveLength(7);
  });
});
