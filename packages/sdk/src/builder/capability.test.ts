import path from "node:path";
import { fileURLToPath } from "node:url";

import { capabilitySchema } from "@agent-layer/core";
import type { RouteGraphNode } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import { buildRouteGraph } from "../analyzer/route-graph.js";
import { nestJsFrameworkAdapter } from "../scanner/adapters/nestjs.adapter.js";
import { scanProject } from "../scanner/scanner.js";
import {
  annotateLowConfidenceGroups,
  buildCapabilityGroupingInput,
  groupRouteCapabilities,
} from "../reasoner/grouping.js";
import { createLlmClientFromProvider } from "../reasoner/llm/factory.js";
import { MockLlmProvider } from "../reasoner/llm/mock-provider.js";
import { labelRouteIntents } from "../reasoner/intent.js";
import type { CapabilityGroupingInput, GroupingRouteInput } from "../reasoner/prompts/grouping.v1.js";
import type { RefinedCapabilityGroup } from "../reasoner/prompts/refine.v1.js";
import { refineCapabilityGroups } from "../reasoner/refine.js";
import {
  aggregateCapabilitySideEffects,
  aggregateRiskLevel,
  buildCapabilities,
  buildCapabilityFromGroup,
  buildCapabilityOperation,
  formatSourceRoute,
  isCapabilityReversible,
  isConfirmationRequired,
  selectDefaultOperation,
} from "./capability.js";

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

const buildRouteNode = (
  routeId: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
): RouteGraphNode => ({
  route: {
    id: routeId,
    framework: "nestjs",
    method,
    path,
    controllerName: "TestController",
    handlerName: "handler",
    sourceLocation: {
      filePath: "src/test.controller.ts",
      line: 1,
      column: 1,
    },
    middleware: [],
  },
  ...(method === "GET" ? {} : { requestSchema: { type: "object" } }),
  responseSchema: { type: "object" },
  middleware: [],
  callChain: [{ name: "handler", filePath: "src/test.controller.ts", kind: "handler" }],
  databaseEntities: ["ProductEntity"],
  sourceCode: "@Get() handler() {}",
});

const buildLabel = (
  routeId: string,
  intent: string,
  sideEffects: "read" | "write" | "delete",
  riskLevel: "low" | "medium" | "high" = "low",
) => ({
  routeId,
  intent,
  description: `${intent} description`,
  sideEffects,
  requiresAuth: false,
  riskLevel,
  confidence: 0.95,
  lowConfidence: false,
});

describe("capability operation mapping", () => {
  it("should map route graph nodes and intent labels to capability operations", () => {
    const node = buildRouteNode("products_list", "GET", "/api/products");
    const label = buildLabel("products_list", "list_products", "read");

    expect(buildCapabilityOperation(node, label)).toEqual({
      id: "list_products",
      description: "list_products description",
      httpMethod: "GET",
      httpPath: "/api/products",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      sideEffects: "read",
    });
    expect(formatSourceRoute("GET", "/api/products")).toBe("GET /api/products");
  });
});

describe("capability aggregation helpers", () => {
  it("should aggregate side effects and risk across operations", () => {
    expect(aggregateCapabilitySideEffects(["read", "read"])).toBe("read");
    expect(aggregateCapabilitySideEffects(["read", "write"])).toBe("transactional");
    expect(aggregateRiskLevel(["low", "medium", "high"])).toBe("high");
  });

  it("should prefer read operations as the default operation", () => {
    expect(
      selectDefaultOperation([
        {
          id: "add_cart_item",
          description: "Add item",
          httpMethod: "POST",
          httpPath: "/api/cart/items",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          sideEffects: "write",
        },
        {
          id: "get_cart",
          description: "Get cart",
          httpMethod: "GET",
          httpPath: "/api/cart",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          sideEffects: "read",
        },
      ]),
    ).toBe("get_cart");
  });

  it("should derive reversible and confirmation flags from operations and risk", () => {
    const writeOperations = [
      {
        id: "add_cart_item",
        description: "Add item",
        httpMethod: "POST",
        httpPath: "/api/cart/items",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        sideEffects: "write" as const,
      },
    ];

    expect(isCapabilityReversible(writeOperations, "medium")).toBe(true);
    expect(isConfirmationRequired(writeOperations, "medium")).toBe(false);
    expect(isConfirmationRequired(writeOperations, "high")).toBe(true);
  });
});

describe("buildCapabilityFromGroup", () => {
  it("should build a schema-valid capability with draft status and workflow metadata", () => {
    const routeGraphById = new Map<string, RouteGraphNode>([
      ["products_list", buildRouteNode("products_list", "GET", "/api/products")],
      ["products_search", buildRouteNode("products_search", "GET", "/api/products/search")],
    ]);
    const intentLabelByRouteId = new Map([
      ["products_list", buildLabel("products_list", "list_products", "read")],
      ["products_search", buildLabel("products_search", "search_products", "read")],
    ]);
    const group: RefinedCapabilityGroup = {
      id: "product_catalog",
      name: "Product Catalog",
      description: "Browse and search products",
      category: "catalog",
      routeIds: ["products_list", "products_search"],
      requiresAuth: false,
      confidence: 0.93,
      adjustedConfidence: 0.93,
      refineFlags: [],
    };

    const capability = buildCapabilityFromGroup(
      group,
      routeGraphById,
      intentLabelByRouteId,
      new Map([["account_access", ["cart_management"]]]),
      false,
    );

    expect(capabilitySchema.parse(capability)).toEqual(capability);
    expect(capability.id).toBe("product_catalog");
    expect(capability.status).toBe("draft");
    expect(capability.defaultOperation).toBe("list_products");
    expect(capability.operations).toHaveLength(2);
    expect(capability.sideEffects).toBe("read");
    expect(capability.sourceRoutes).toEqual([
      "GET /api/products",
      "GET /api/products/search",
    ]);
    expect(capability.needsHumanReview).toBe(false);
  });
});

describe("buildCapabilities", () => {
  it(
    "should build schema-valid capabilities from the fixture pipeline",
    async () => {
      const context = await scanProject(fixtureRoot);
      const { routeGraph } = buildRouteGraph(context, nestJsFrameworkAdapter);
      const routeIds = routeGraph.map((node) => node.route.id);

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
              sideEffects:
                mockRoute?.method === "GET"
                  ? "read"
                  : mockRoute?.method === "PATCH"
                    ? "write"
                    : "write",
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
      const routeRequiresAuth = new Map(
        intentResult.labels.map((label) => [label.routeId, label.requiresAuth]),
      );

      const groupingProvider = new MockLlmProvider((request) => {
        const parsed = JSON.parse(request.user) as CapabilityGroupingInput;
        return buildMockGroupingResponse(parsed);
      });
      const groupingClient = createLlmClientFromProvider(groupingProvider, {
        model: "mock-model-v1",
        stage: "capability-grouping",
      });
      const grouping = await groupRouteCapabilities(
        routeGraph,
        intentResult.labels,
        ecommerceDomain,
        groupingClient,
      );

      const refineClient = createLlmClientFromProvider(new MockLlmProvider([]), {
        model: "mock-model-v1",
        stage: "capability-refine",
      });
      const refineResult = await refineCapabilityGroups(
        grouping,
        routeIds,
        routeRequiresAuth,
        ecommerceDomain.domain,
        refineClient,
      );

      const capabilities = buildCapabilities({
        routeGraph,
        intentLabels: intentResult.labels,
        groups: refineResult.groups,
        pendingReview: refineResult.pendingReview,
      });

      expect(capabilities).toHaveLength(3);
      expect(capabilities.map((capability) => capability.id)).toEqual([
        "account_access",
        "cart_management",
        "product_catalog",
      ]);

      const productCatalog = capabilities.find((capability) => capability.id === "product_catalog");
      const cartManagement = capabilities.find((capability) => capability.id === "cart_management");
      const accountAccess = capabilities.find((capability) => capability.id === "account_access");

      expect(productCatalog?.operations).toHaveLength(3);
      expect(productCatalog?.defaultOperation).toBe("get_product");
      expect(productCatalog?.sideEffects).toBe("read");
      expect(productCatalog?.status).toBe("draft");

      expect(cartManagement?.prerequisites).toEqual(["account_access"]);
      expect(cartManagement?.requiresAuth).toBe(true);
      expect(cartManagement?.sideEffects).toBe("transactional");
      expect(cartManagement?.defaultOperation).toBe("get_cart");

      expect(accountAccess?.followedBy).toEqual(["cart_management"]);
      expect(accountAccess?.operations[0]?.id).toBe("login");

      for (const capability of capabilities) {
        expect(capabilitySchema.parse(capability)).toEqual(capability);
        expect(capability.confidence).toBeGreaterThan(0);
        expect(capability.confidence).toBeLessThanOrEqual(1);
      }
    },
    30_000,
  );
});
