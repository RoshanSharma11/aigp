import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildRouteGraph } from "../analyzer/route-graph.js";
import { nestJsFrameworkAdapter } from "../scanner/adapters/nestjs.adapter.js";
import { scanProject } from "../scanner/scanner.js";
import {
  annotateLowConfidenceLabels,
  batchRoutesForIntentLabeling,
  buildIntentLabelingRouteInput,
  labelIntentBatch,
  labelRouteIntents,
  truncateSourceCodeSnippet,
} from "./intent.js";
import { createLlmClientFromProvider } from "./llm/factory.js";
import { MockLlmProvider } from "./llm/mock-provider.js";
import {
  buildIntentLabelingSystemPrompt,
  buildIntentLabelingUserPrompt,
  DEFAULT_INTENT_BATCH_SIZE,
  INTENT_LOW_CONFIDENCE_THRESHOLD,
  intentBatchResponseSchema,
  type IntentLabelingBatchInput,
  type IntentLabelingRouteInput,
} from "./prompts/intent.v1.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

const buildMockLabel = (
  route: IntentLabelingRouteInput,
  overrides: Partial<{
    intent: string;
    confidence: number;
    requiresAuth: boolean;
    sideEffects: "read" | "write" | "delete";
    riskLevel: "low" | "medium" | "high";
  }> = {},
) => {
  const defaultsByPath: Record<
    string,
    {
      intent: string;
      description: string;
      sideEffects: "read" | "write" | "delete";
      requiresAuth: boolean;
      riskLevel: "low" | "medium" | "high";
      confidence: number;
    }
  > = {
    "/api/products": {
      intent: "list_products",
      description: "List all products in the catalog",
      sideEffects: "read",
      requiresAuth: false,
      riskLevel: "low",
      confidence: 0.95,
    },
    "/api/products/search": {
      intent: "search_products",
      description: "Search products by query filters",
      sideEffects: "read",
      requiresAuth: false,
      riskLevel: "low",
      confidence: 0.94,
    },
    "/api/products/:productId": {
      intent: "get_product",
      description: "Get a single product by ID",
      sideEffects: "read",
      requiresAuth: false,
      riskLevel: "low",
      confidence: 0.93,
    },
    "/api/cart": {
      intent: "get_cart",
      description: "Get the current user's shopping cart",
      sideEffects: "read",
      requiresAuth: true,
      riskLevel: "low",
      confidence: 0.92,
    },
    "/api/cart/items": {
      intent: "add_cart_item",
      description: "Add an item to the shopping cart",
      sideEffects: "write",
      requiresAuth: true,
      riskLevel: "medium",
      confidence: 0.91,
    },
    "/api/cart/items/:productId": {
      intent: "update_cart_item",
      description: "Update quantity for a cart line item",
      sideEffects: "write",
      requiresAuth: true,
      riskLevel: "medium",
      confidence: 0.9,
    },
    "/api/auth/login": {
      intent: "login",
      description: "Authenticate a user and create a session",
      sideEffects: "write",
      requiresAuth: false,
      riskLevel: "medium",
      confidence: 0.96,
    },
  };

  const defaults = defaultsByPath[route.path];

  return {
    routeId: route.routeId,
    intent: overrides.intent ?? defaults?.intent ?? "unknown_route",
    description: defaults?.description ?? "Unknown route behavior",
    sideEffects: overrides.sideEffects ?? defaults?.sideEffects ?? "read",
    requiresAuth: overrides.requiresAuth ?? defaults?.requiresAuth ?? false,
    riskLevel: overrides.riskLevel ?? defaults?.riskLevel ?? "low",
    confidence: overrides.confidence ?? defaults?.confidence ?? 0.85,
  };
};

const buildMockBatchResponse = (input: IntentLabelingBatchInput): string =>
  JSON.stringify({
    labels: input.routes.map((route) => buildMockLabel(route)),
  });

describe("intent labeling helpers", () => {
  it("should batch routes using the default batch size", () => {
    const routes = Array.from({ length: 12 }, (_, index) => `route-${index}`);

    expect(batchRoutesForIntentLabeling(routes)).toEqual([
      routes.slice(0, DEFAULT_INTENT_BATCH_SIZE),
      routes.slice(DEFAULT_INTENT_BATCH_SIZE),
    ]);
  });

  it("should truncate long source code snippets", () => {
    const sourceCode = "x".repeat(600);

    expect(truncateSourceCodeSnippet(sourceCode)).toHaveLength(503);
    expect(truncateSourceCodeSnippet(undefined)).toBeUndefined();
  });

  it("should flag labels below the confidence threshold", () => {
    const result = annotateLowConfidenceLabels([
      {
        routeId: "route_a",
        intent: "list_products",
        description: "List products",
        sideEffects: "read",
        requiresAuth: false,
        riskLevel: "low",
        confidence: 0.95,
      },
      {
        routeId: "route_b",
        intent: "unknown_action",
        description: "Unclear route",
        sideEffects: "read",
        requiresAuth: false,
        riskLevel: "low",
        confidence: 0.65,
      },
    ]);

    expect(result.lowConfidenceRouteIds).toEqual(["route_b"]);
    expect(result.labels[0]?.lowConfidence).toBe(false);
    expect(result.labels[1]?.lowConfidence).toBe(true);
    expect(INTENT_LOW_CONFIDENCE_THRESHOLD).toBe(0.8);
  });
});

describe("intent labeling prompts", () => {
  it("should serialize route metadata as JSON in the user prompt", () => {
    const input: IntentLabelingBatchInput = {
      domain: "ecommerce",
      routes: [
        {
          routeId: "cart_get",
          method: "GET",
          path: "/api/cart",
          handlerName: "getCart",
          controllerName: "CartController",
          databaseEntities: ["CartEntity"],
          middleware: ["AuthGuard"],
          sourceCodeSnippet: "return this.cartService.getCart();",
        },
      ],
    };

    expect(buildIntentLabelingSystemPrompt()).toContain("JSON only");
    expect(buildIntentLabelingUserPrompt(input)).toContain('"domain": "ecommerce"');
    expect(buildIntentLabelingUserPrompt(input)).toContain('"routeId": "cart_get"');
    expect(buildIntentLabelingUserPrompt(input)).toContain("AuthGuard");
  });

  it("should validate the intent batch response schema", () => {
    expect(
      intentBatchResponseSchema.parse({
        labels: [
          {
            routeId: "products_list",
            intent: "list_products",
            description: "List products",
            sideEffects: "read",
            requiresAuth: false,
            riskLevel: "low",
            confidence: 0.95,
          },
        ],
      }),
    ).toBeDefined();
  });
});

describe("labelIntentBatch", () => {
  it("should return one validated label per route in the batch", async () => {
    const input: IntentLabelingBatchInput = {
      domain: "ecommerce",
      routes: [
        {
          routeId: "products_list",
          method: "GET",
          path: "/api/products",
          handlerName: "listProducts",
          controllerName: "ProductsController",
          databaseEntities: ["ProductEntity"],
          middleware: [],
        },
        {
          routeId: "cart_add_item",
          method: "POST",
          path: "/api/cart/items",
          handlerName: "addCartItem",
          controllerName: "CartController",
          databaseEntities: ["CartEntity"],
          middleware: ["AuthGuard"],
        },
      ],
    };

    const provider = new MockLlmProvider([
      buildMockBatchResponse(input),
    ]);
    const client = createLlmClientFromProvider(provider, {
      model: "mock-model-v1",
      stage: "intent-labeling",
    });

    const labels = await labelIntentBatch(input, client);

    expect(labels).toHaveLength(2);
    expect(labels[0]?.intent).toBe("list_products");
    expect(labels[1]?.intent).toBe("add_cart_item");
    expect(provider.getCallCount()).toBe(1);
  });
});

describe("labelRouteIntents", () => {
  it(
    "should label every fixture route with a plausible intent",
    async () => {
      const context = await scanProject(fixtureRoot);
      const { routeGraph } = buildRouteGraph(context, nestJsFrameworkAdapter);

      const provider = new MockLlmProvider((request) => {
        const parsed = JSON.parse(request.user) as IntentLabelingBatchInput;
        return buildMockBatchResponse(parsed);
      });
      const client = createLlmClientFromProvider(provider, {
        model: "mock-model-v1",
        stage: "intent-labeling",
      });

      const result = await labelRouteIntents(routeGraph, "ecommerce", client);

      expect(result.labels).toHaveLength(7);
      expect(result.lowConfidenceRouteIds).toEqual([]);
      expect(provider.getCallCount()).toBe(1);

      for (const node of routeGraph) {
        const label = result.labels.find(
          (candidate) => candidate.routeId === node.route.id,
        );

        expect(label).toBeDefined();
        expect(label?.intent.length).toBeGreaterThan(0);
        expect(label?.description.length).toBeGreaterThan(0);
        expect(label?.confidence).toBeGreaterThanOrEqual(
          INTENT_LOW_CONFIDENCE_THRESHOLD,
        );
      }

      const cartRouteInput = buildIntentLabelingRouteInput(
        routeGraph.find((node) => node.route.path === "/api/cart")!,
      );
      expect(cartRouteInput.middleware).toContain("AuthGuard");

      const intents = result.labels.map((label) => label.intent);
      expect(intents).toEqual(
        expect.arrayContaining([
          "list_products",
          "search_products",
          "get_product",
          "get_cart",
          "add_cart_item",
          "update_cart_item",
          "login",
        ]),
      );
    },
    30_000,
  );

  it(
    "should flag low-confidence route labels",
    async () => {
      const context = await scanProject(fixtureRoot);
      const { routeGraph } = buildRouteGraph(context, nestJsFrameworkAdapter);

      const provider = new MockLlmProvider((request) => {
        const parsed = JSON.parse(request.user) as IntentLabelingBatchInput;
        return JSON.stringify({
          labels: parsed.routes.map((route) =>
            buildMockLabel(route, {
              confidence: route.path === "/api/products/search" ? 0.65 : 0.9,
            }),
          ),
        });
      });
      const client = createLlmClientFromProvider(provider, {
        model: "mock-model-v1",
        stage: "intent-labeling",
      });

      const result = await labelRouteIntents(routeGraph, "ecommerce", client);
      const searchLabel = result.labels.find((label) =>
        label.intent === "search_products",
      );

      expect(searchLabel?.lowConfidence).toBe(true);
      expect(result.lowConfidenceRouteIds).toHaveLength(1);
      expect(result.lowConfidenceRouteIds[0]).toBe(searchLabel?.routeId);
    },
    30_000,
  );
});
