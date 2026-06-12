import type { RouteGraphNode } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import {
  CAPABILITY_CONFIDENCE_WEIGHTS,
  CAPABILITY_HUMAN_REVIEW_THRESHOLD,
  computeCapabilityConfidence,
  computeRouteConfidenceScores,
  scoreRouteAnalysis,
  scoreRouteSchema,
  shouldNeedHumanReview,
} from "./confidence.js";

const buildRouteNode = (
  overrides: Partial<RouteGraphNode> = {},
): RouteGraphNode => ({
  route: {
    id: "products_list_products_get_products",
    framework: "nestjs",
    method: "GET",
    path: "/api/products",
    controllerName: "ProductsController",
    handlerName: "listProducts",
    sourceLocation: {
      filePath: "src/products/products.controller.ts",
      line: 1,
      column: 1,
    },
    middleware: [],
  },
  middleware: [],
  callChain: [],
  databaseEntities: [],
  ...overrides,
});

describe("route confidence scoring", () => {
  it("should score static analysis completeness for routes", () => {
    expect(scoreRouteAnalysis(buildRouteNode())).toBe(0.5);
    expect(
      scoreRouteAnalysis(
        buildRouteNode({
          callChain: [{ name: "listProducts", filePath: "src/products/products.controller.ts", kind: "handler" }],
          databaseEntities: ["ProductEntity"],
          sourceCode: "@Get() listProducts() {}",
        }),
      ),
    ).toBe(1);
  });

  it("should score schema extraction coverage for routes", () => {
    expect(scoreRouteSchema(buildRouteNode())).toBe(0.35);
    expect(
      scoreRouteSchema(
        buildRouteNode({
          requestSchema: { type: "object" },
        }),
      ),
    ).toBe(0.65);
    expect(
      scoreRouteSchema(
        buildRouteNode({
          requestSchema: { type: "object" },
          responseSchema: { type: "array" },
        }),
      ),
    ).toBe(1);
  });

  it("should combine route, schema, and intent scores per route", () => {
    const scores = computeRouteConfidenceScores(
      buildRouteNode({
        requestSchema: { type: "object" },
        responseSchema: { type: "array" },
        callChain: [{ name: "listProducts", filePath: "src/products/products.controller.ts", kind: "handler" }],
        databaseEntities: ["ProductEntity"],
        sourceCode: "@Get() listProducts() {}",
      }),
      {
        routeId: "products_list_products_get_products",
        intent: "list_products",
        description: "List products",
        sideEffects: "read",
        requiresAuth: false,
        riskLevel: "low",
        confidence: 0.95,
        lowConfidence: false,
      },
    );

    expect(scores.route).toBe(1);
    expect(scores.schema).toBe(1);
    expect(scores.intent).toBe(0.95);
  });
});

describe("capability confidence scoring", () => {
  it("should compute a weighted average across route, schema, intent, and grouping scores", () => {
    const confidence = computeCapabilityConfidence(
      [
        { route: 1, schema: 1, intent: 0.95 },
        { route: 0.85, schema: 0.65, intent: 0.9 },
      ],
      0.92,
    );

    const expected =
      CAPABILITY_CONFIDENCE_WEIGHTS.route * ((1 + 0.85) / 2) +
      CAPABILITY_CONFIDENCE_WEIGHTS.schema * ((1 + 0.65) / 2) +
      CAPABILITY_CONFIDENCE_WEIGHTS.intent * ((0.95 + 0.9) / 2) +
      CAPABILITY_CONFIDENCE_WEIGHTS.grouping * 0.92;

    expect(confidence).toBe(Math.round(expected * 1000) / 1000);
  });

  it("should fall back to grouping confidence when no routes are present", () => {
    expect(computeCapabilityConfidence([], 0.88)).toBe(0.88);
  });
});

describe("human review threshold", () => {
  it("should flag low confidence, high risk, and pending-review capabilities", () => {
    expect(CAPABILITY_HUMAN_REVIEW_THRESHOLD).toBe(0.85);
    expect(shouldNeedHumanReview(0.84, "low", false)).toBe(true);
    expect(shouldNeedHumanReview(0.95, "high", false)).toBe(true);
    expect(shouldNeedHumanReview(0.95, "low", true)).toBe(true);
    expect(shouldNeedHumanReview(0.95, "low", false)).toBe(false);
  });
});
