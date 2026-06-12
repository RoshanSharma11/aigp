import type { Capability, CapabilityOverride } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import {
  filterApprovedCapabilities,
  mergeCapabilityOverride,
  mergeCapabilityOverrides,
} from "./merger.js";

const sampleCapability: Capability = {
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
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      sideEffects: "write",
    },
  ],
  defaultOperation: "add_item_to_cart",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "write",
  requiresAuth: true,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.91,
  needsHumanReview: false,
  sourceRoutes: ["POST /api/cart/items"],
  status: "draft",
};

describe("capability override merger", () => {
  it("should merge override fields onto a base capability", () => {
    const override: CapabilityOverride = {
      id: "cart_management",
      name: "Cart operations",
      confidence: 0.95,
      status: "approved",
    };

    const merged = mergeCapabilityOverride(sampleCapability, override);

    expect(merged.name).toBe("Cart operations");
    expect(merged.confidence).toBe(0.95);
    expect(merged.status).toBe("approved");
    expect(merged.operations).toEqual(sampleCapability.operations);
  });

  it("should merge overrides by id across a capability list", () => {
    const overrides: CapabilityOverride[] = [
      {
        id: "cart_management",
        status: "approved",
      },
    ];

    const merged = mergeCapabilityOverrides([sampleCapability], overrides);

    expect(merged[0]?.status).toBe("approved");
  });

  it("should filter only approved capabilities for runtime serving", () => {
    const capabilities: Capability[] = [
      sampleCapability,
      {
        ...sampleCapability,
        id: "product_catalog",
        status: "approved",
      },
      {
        ...sampleCapability,
        id: "account_access",
        status: "disabled",
      },
    ];

    const approved = filterApprovedCapabilities(capabilities);

    expect(approved.map((capability) => capability.id)).toEqual(["product_catalog"]);
  });
});
