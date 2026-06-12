import type { Capability } from "@agent-layer/core";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { CapabilityRegistryService } from "./capability-registry.service.js";
import { AGENT_LAYER_MODULE_OPTIONS, type AgentLayerModuleOptions } from "./tokens.js";

const sampleCapability = (id: string, status: Capability["status"]): Capability => ({
  id,
  name: id,
  description: `${id} capability`,
  category: "catalog",
  operations: [
    {
      id: "read",
      description: "Read",
      httpMethod: "GET",
      httpPath: "/api/example",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      sideEffects: "read",
    },
  ],
  defaultOperation: "read",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.9,
  needsHumanReview: false,
  sourceRoutes: ["GET /api/example"],
  status,
});

describe("CapabilityRegistryService", () => {
  it("should filter injected capabilities to approved status only", async () => {
    const options: AgentLayerModuleOptions = {
      baseUrl: "https://shop.example.com",
      capabilities: [
        sampleCapability("approved_capability", "approved"),
        sampleCapability("draft_capability", "draft"),
        sampleCapability("disabled_capability", "disabled"),
      ],
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CapabilityRegistryService,
        {
          provide: AGENT_LAYER_MODULE_OPTIONS,
          useValue: options,
        },
      ],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    expect(registry.getApprovedCapabilities()).toHaveLength(1);
    expect(registry.getApprovedCapabilities()[0]?.id).toBe("approved_capability");
    expect(registry.getCapability("draft_capability")).toBeUndefined();
  });
});
