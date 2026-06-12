import { describe, expect, it } from "vitest";

import { parseAgentLayerConfig } from "./config.js";
import { parseCapabilitiesArtifact } from "./capabilities.js";
import { parseOverridesArtifact } from "./overrides.js";

describe("Phase 0 schemas", () => {
  it("should validate a representative capabilities artifact", () => {
    const artifact = parseCapabilitiesArtifact({
      version: "1.0.0",
      generatedAt: "2026-06-12T10:00:00.000Z",
      capabilities: [
        {
          id: "cart_management",
          name: "Cart management",
          description: "Manage a customer cart.",
          category: "commerce",
          operations: [
            {
              id: "add_item_to_cart",
              description: "Add an item to the cart.",
              httpMethod: "POST",
              httpPath: "/api/cart/items",
              inputSchema: {
                type: "object",
                properties: {
                  productId: { type: "string" },
                  quantity: { type: "number" },
                },
              },
              outputSchema: {
                type: "object",
                properties: {
                  success: { type: "boolean" },
                },
              },
              sideEffects: "write",
            },
          ],
          defaultOperation: "add_item_to_cart",
          inputSchema: {
            type: "object",
            properties: {
              productId: { type: "string" },
            },
          },
          outputSchema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
            },
          },
          sideEffects: "write",
          requiresAuth: true,
          reversible: true,
          confirmationRequired: false,
          riskLevel: "low",
          confidence: 0.91,
          needsHumanReview: false,
          sourceRoutes: ["POST /api/cart/items"],
          status: "draft",
        },
      ],
    });

    expect(artifact.capabilities).toHaveLength(1);
    expect(artifact.capabilities[0]?.id).toBe("cart_management");
  });

  it("should validate a representative config artifact", () => {
    const config = parseAgentLayerConfig({
      llm: {
        provider: "mock",
        model: "mock-v1",
      },
      confidenceThreshold: 0.85,
      excludeRoutes: ["/health"],
      baseUrl: "https://shop.example.com",
    });

    expect(config.confidenceThreshold).toBe(0.85);
  });

  it("should validate a representative overrides artifact", () => {
    const overrides = parseOverridesArtifact({
      version: "1.0.0",
      updatedAt: "2026-06-12T10:00:00.000Z",
      capabilities: [
        {
          id: "cart_management",
          name: "Cart operations",
          confidence: 0.95,
          status: "approved",
        },
      ],
    });

    expect(overrides.capabilities[0]?.status).toBe("approved");
  });
});
