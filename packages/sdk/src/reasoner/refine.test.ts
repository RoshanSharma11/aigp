import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildRouteGraph } from "../analyzer/route-graph.js";
import { nestJsFrameworkAdapter } from "../scanner/adapters/nestjs.adapter.js";
import { scanProject } from "../scanner/scanner.js";
import {
  annotateLowConfidenceGroups,
  buildCapabilityGroupingInput,
  groupRouteCapabilities,
} from "./grouping.js";
import { createLlmClientFromProvider } from "./llm/factory.js";
import { MockLlmProvider } from "./llm/mock-provider.js";
import { labelRouteIntents } from "./intent.js";
import type { CapabilityGroupingInput, GroupingRouteInput } from "./prompts/grouping.v1.js";
import {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  REFINE_LOW_CONFIDENCE_THRESHOLD,
  refineResponseSchema,
  type RefineGroupingInput,
  type RefinedCapabilityGroup,
} from "./prompts/refine.v1.js";
import {
  buildPendingReviewArtifact,
  findAuthConflicts,
  findDuplicateCapabilityIds,
  findOrphanRoutes,
  refineCapabilityGroups,
  runConsistencyChecks,
  toRefinedGroups,
} from "./refine.js";

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

const buildRefinedGroups = (): RefinedCapabilityGroup[] => [
  {
    id: "product_catalog",
    name: "Product Catalog",
    description: "Browse and search products in the store catalog",
    category: "catalog",
    routeIds: ["products_list", "products_search", "products_get_by_id"],
    requiresAuth: false,
    confidence: 0.93,
    adjustedConfidence: 0.93,
    refineFlags: [],
  },
  {
    id: "cart_management",
    name: "Cart Management",
    description: "View and modify the shopping cart",
    category: "cart",
    routeIds: ["cart_get", "cart_add_item", "cart_update_item"],
    prerequisites: ["account_access"],
    requiresAuth: true,
    confidence: 0.92,
    adjustedConfidence: 0.92,
    refineFlags: [],
  },
  {
    id: "account_access",
    name: "Account Access",
    description: "Authenticate users and establish sessions",
    category: "auth",
    routeIds: ["auth_login"],
    requiresAuth: false,
    confidence: 0.95,
    adjustedConfidence: 0.95,
    refineFlags: [],
  },
];

describe("refine consistency checks", () => {
  it("should detect duplicate capability IDs", () => {
    const groups = annotateLowConfidenceGroups([
      {
        id: "cart_management",
        name: "Cart Management",
        description: "Cart",
        category: "cart",
        routeIds: ["cart_get"],
        requiresAuth: true,
        confidence: 0.9,
      },
      {
        id: "cart_management",
        name: "Cart Duplicate",
        description: "Duplicate cart group",
        category: "cart",
        routeIds: ["cart_add_item"],
        requiresAuth: true,
        confidence: 0.9,
      },
    ]).groups;

    expect(findDuplicateCapabilityIds(groups)).toEqual([
      {
        code: "duplicate_capability_id",
        message: "Duplicate capability ID: cart_management",
        capabilityId: "cart_management",
      },
    ]);
  });

  it("should detect orphan routes", () => {
    const groups = annotateLowConfidenceGroups([
      {
        id: "product_catalog",
        name: "Product Catalog",
        description: "Catalog",
        category: "catalog",
        routeIds: ["products_list"],
        requiresAuth: false,
        confidence: 0.9,
      },
    ]).groups;

    expect(
      findOrphanRoutes(
        ["products_list", "products_search"],
        groups,
        [],
      ),
    ).toEqual([
      {
        code: "orphan_route",
        message: "Route is not assigned to any capability: products_search",
        routeId: "products_search",
      },
    ]);
  });

  it("should detect auth conflicts between groups and routes", () => {
    const groups = annotateLowConfidenceGroups([
      {
        id: "cart_management",
        name: "Cart Management",
        description: "Cart",
        category: "cart",
        routeIds: ["cart_get", "cart_add_item"],
        requiresAuth: false,
        confidence: 0.9,
      },
    ]).groups;
    const routeRequiresAuth = new Map<string, boolean>([
      ["cart_get", true],
      ["cart_add_item", true],
    ]);

    expect(findAuthConflicts(groups, routeRequiresAuth)).toEqual([
      {
        code: "auth_conflict",
        message:
          "Capability cart_management does not require auth but all routes do",
        capabilityId: "cart_management",
      },
    ]);
  });

  it("should lower adjusted confidence when consistency issues exist", () => {
    const groups = annotateLowConfidenceGroups([
      {
        id: "cart_management",
        name: "Cart Management",
        description: "Cart",
        category: "cart",
        routeIds: ["cart_get"],
        requiresAuth: true,
        confidence: 0.9,
      },
    ]).groups;
    const issues = [
      {
        code: "low_confidence" as const,
        message: "Low confidence",
        capabilityId: "cart_management",
      },
    ];

    expect(toRefinedGroups(groups, issues)[0]?.adjustedConfidence).toBe(0.8);
  });
});

describe("pending review artifact", () => {
  it("should include low-confidence and consistency-flagged capabilities", () => {
    const artifact = buildPendingReviewArtifact(
      [
        ...buildRefinedGroups(),
        {
          id: "risky_group",
          name: "Risky Group",
          description: "Needs review",
          category: "general",
          routeIds: ["products_search"],
          requiresAuth: false,
          confidence: 0.7,
          adjustedConfidence: 0.7,
          refineFlags: ["low_confidence"],
        },
      ],
      [
        {
          code: "low_confidence",
          message: "Low confidence grouping",
          capabilityId: "risky_group",
        },
      ],
      "2026-06-12T12:00:00.000Z",
    );

    expect(artifact.version).toBe("1.0.0");
    expect(artifact.generatedAt).toBe("2026-06-12T12:00:00.000Z");
    expect(artifact.entries).toHaveLength(1);
    expect(artifact.entries[0]?.capabilityId).toBe("risky_group");
    expect(artifact.entries[0]?.reasons[0]).toContain("0.70");
    expect(REFINE_LOW_CONFIDENCE_THRESHOLD).toBe(0.85);
  });
});

describe("refine prompts", () => {
  it("should serialize issues and groups in the user prompt", () => {
    const input: RefineGroupingInput = {
      domain: "ecommerce",
      routeIds: ["products_list", "products_search"],
      excludedRouteIds: [],
      issues: [
        {
          code: "orphan_route",
          message: "Route is not assigned to any capability: products_search",
          routeId: "products_search",
        },
      ],
      groups: toRefinedGroups(
        annotateLowConfidenceGroups([
          {
            id: "product_catalog",
            name: "Product Catalog",
            description: "Catalog",
            category: "catalog",
            routeIds: ["products_list"],
            requiresAuth: false,
            confidence: 0.9,
          },
        ]).groups,
        [],
      ),
    };

    expect(buildRefineSystemPrompt()).toContain("JSON only");
    expect(buildRefineUserPrompt(input)).toContain('"orphan_route"');
    expect(
      refineResponseSchema.parse({
        groups: buildRefinedGroups(),
        resolvedIssueCodes: ["orphan_route"],
      }),
    ).toBeDefined();
  });
});

describe("refineCapabilityGroups", () => {
  it(
    "should refine grouped fixture capabilities and build pending review without duplicate IDs",
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

      const issuesBeforeRefine = runConsistencyChecks(
        grouping,
        routeIds,
        routeRequiresAuth,
      );
      expect(issuesBeforeRefine.some((issue) => issue.code === "duplicate_capability_id")).toBe(
        false,
      );
      expect(issuesBeforeRefine.some((issue) => issue.code === "orphan_route")).toBe(false);

      const refineProvider = new MockLlmProvider((request) => {
        const parsed = JSON.parse(request.user) as RefineGroupingInput;
        return JSON.stringify({
          groups: parsed.groups.map((group) => ({
            ...group,
            adjustedConfidence: group.confidence,
            refineFlags: [],
          })),
          resolvedIssueCodes: parsed.issues.map((issue) => issue.code),
        });
      });
      const refineClient = createLlmClientFromProvider(refineProvider, {
        model: "mock-model-v1",
        stage: "capability-refine",
      });

      const result = await refineCapabilityGroups(
        grouping,
        routeIds,
        routeRequiresAuth,
        ecommerceDomain.domain,
        refineClient,
        { generatedAt: "2026-06-12T12:00:00.000Z" },
      );

      const capabilityIds = result.groups.map((group) => group.id);
      expect(new Set(capabilityIds).size).toBe(capabilityIds.length);
      expect(result.pendingReview.generatedAt).toBe("2026-06-12T12:00:00.000Z");
      expect(result.groups).toHaveLength(3);
    },
    30_000,
  );

  it("should skip the LLM when no consistency issues are found", async () => {
    const routes = buildMockGroupingRoutes();
    const input = buildCapabilityGroupingInput(routes, ecommerceDomain);
    const grouping = {
      ...annotateLowConfidenceGroups(
        JSON.parse(buildMockGroupingResponse(input)).groups,
      ),
      excludedRouteIds: [],
    };
    const provider = new MockLlmProvider([]);
    const client = createLlmClientFromProvider(provider, {
      model: "mock-model-v1",
      stage: "capability-refine",
    });

    const result = await refineCapabilityGroups(
      grouping,
      routes.map((route) => route.routeId),
      new Map(routes.map((route) => [route.routeId, route.requiresAuth])),
      ecommerceDomain.domain,
      client,
    );

    expect(provider.getCallCount()).toBe(0);
    expect(result.resolvedIssueCodes).toEqual([]);
    expect(result.pendingReview.entries).toEqual([]);
  });
});
