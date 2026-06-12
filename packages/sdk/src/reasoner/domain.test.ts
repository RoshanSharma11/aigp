import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nestJsFrameworkAdapter } from "../scanner/adapters/nestjs.adapter.js";
import { scanProject } from "../scanner/scanner.js";
import { buildRouteGraph } from "../analyzer/route-graph.js";
import {
  buildDomainClassificationInput,
  classifyDomain,
  classifyDomainFromRouteGraph,
  extractEntityNames,
  extractRoutePrefixes,
} from "./domain.js";
import { createLlmClientFromProvider } from "./llm/factory.js";
import { MockLlmProvider } from "./llm/mock-provider.js";
import {
  buildDomainClassificationSystemPrompt,
  buildDomainClassificationUserPrompt,
  domainClassificationSchema,
} from "./prompts/domain.v1.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

const ecommerceClassification = {
  domain: "ecommerce",
  confidence: 0.95,
  primaryEntities: ["ProductEntity", "CartEntity", "SessionEntity"],
  suggestedCategories: ["catalog", "cart", "auth"],
};

describe("domain classification input builders", () => {
  it("should extract unique two-segment route prefixes", () => {
    expect(
      extractRoutePrefixes([
        "/api/products",
        "/api/products/search",
        "/api/products/:productId",
        "/api/cart/items",
        "/api/auth/login",
      ]),
    ).toEqual(["/api/auth", "/api/cart", "/api/products"]);
  });

  it("should collect unique entity names from the route graph", () => {
    expect(
      extractEntityNames([
        { databaseEntities: ["ProductEntity", "CartEntity"] },
        { databaseEntities: ["CartEntity", "SessionEntity"] },
      ] as Parameters<typeof extractEntityNames>[0]),
    ).toEqual(["CartEntity", "ProductEntity", "SessionEntity"]);
  });
});

describe("domain classification prompts", () => {
  it("should include package name, entities, and route prefixes in the user prompt", () => {
    const input = {
      packageName: "@agent-layer/fixture-nestjs-ecommerce",
      entityNames: ["CartEntity", "ProductEntity", "SessionEntity"],
      routePrefixes: ["/api/auth", "/api/cart", "/api/products"],
    };

    expect(buildDomainClassificationSystemPrompt()).toContain("JSON only");
    expect(buildDomainClassificationUserPrompt(input)).toBe(
      [
        "package_name: @agent-layer/fixture-nestjs-ecommerce",
        "entity_names: CartEntity, ProductEntity, SessionEntity",
        "route_prefixes: /api/auth, /api/cart, /api/products",
      ].join("\n"),
    );
  });

  it("should validate the domain classification schema", () => {
    expect(domainClassificationSchema.parse(ecommerceClassification)).toEqual(
      ecommerceClassification,
    );
  });
});

describe("classifyDomain", () => {
  it("should call the LLM once and return a validated domain classification", async () => {
    const provider = new MockLlmProvider([
      JSON.stringify(ecommerceClassification),
    ]);
    const client = createLlmClientFromProvider(provider, {
      model: "mock-model-v1",
      stage: "domain-classification",
    });

    const input = {
      packageName: "@agent-layer/fixture-nestjs-ecommerce",
      entityNames: ["CartEntity", "ProductEntity", "SessionEntity"],
      routePrefixes: ["/api/auth", "/api/cart", "/api/products"],
    };

    const result = await classifyDomain(input, client);

    expect(result).toEqual(ecommerceClassification);
    expect(provider.getCallCount()).toBe(1);
    expect(client.getUsage().callCount).toBe(1);
  });

  it(
    "should classify the ecommerce fixture as ecommerce with confidence >= 0.90",
    async () => {
    const context = await scanProject(fixtureRoot);
    const { routeGraph } = buildRouteGraph(context, nestJsFrameworkAdapter);
    const input = buildDomainClassificationInput(
      routeGraph,
      "@agent-layer/fixture-nestjs-ecommerce",
    );

    expect(input.entityNames).toEqual([
      "CartEntity",
      "ProductEntity",
      "SessionEntity",
    ]);
    expect(input.routePrefixes).toEqual([
      "/api/auth",
      "/api/cart",
      "/api/products",
    ]);

    const provider = new MockLlmProvider((request) => {
      expect(request.user).toContain("CartEntity");
      expect(request.user).toContain("/api/products");
      return JSON.stringify(ecommerceClassification);
    });
    const client = createLlmClientFromProvider(provider, {
      model: "mock-model-v1",
      stage: "domain-classification",
    });

    const result = await classifyDomainFromRouteGraph(
      routeGraph,
      "@agent-layer/fixture-nestjs-ecommerce",
      client,
    );

    expect(result.domain).toBe("ecommerce");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.primaryEntities.length).toBeGreaterThan(0);
    expect(result.suggestedCategories.length).toBeGreaterThan(0);
    expect(provider.getCallCount()).toBe(1);
    },
    30_000,
  );
});
