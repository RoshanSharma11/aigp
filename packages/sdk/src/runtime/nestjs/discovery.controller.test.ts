import type { Capability } from "@agent-layer/core";

import { Module, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AGENT_JSON_SPEC_VERSION } from "../../generators/agent-json.js";
import { AGENT_CARD_SPEC_VERSION } from "../../generators/agent-card.js";
import { OPENAPI_SPEC_VERSION } from "../../generators/openapi.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";
import { DiscoveryController } from "./discovery.controller.js";
import {
  AGENT_LAYER_MODULE_OPTIONS,
  type AgentLayerModuleOptions,
} from "./tokens.js";

const sampleCapability = (): Capability => ({
  id: "product_catalog",
  name: "Product Catalog",
  description: "Browse and search products",
  category: "catalog",
  operations: [
    {
      id: "list_products",
      description: "List products",
      httpMethod: "GET",
      httpPath: "/api/products",
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      sideEffects: "read",
    },
  ],
  defaultOperation: "list_products",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.93,
  needsHumanReview: false,
  sourceRoutes: ["GET /api/products"],
  status: "approved",
});

const moduleOptions: AgentLayerModuleOptions = {
  baseUrl: "https://shop.example.com",
  agentName: "Shop Agent Layer",
  capabilities: [sampleCapability()],
};

@Module({
  controllers: [DiscoveryController],
  providers: [
    CapabilityRegistryService,
    {
      provide: AGENT_LAYER_MODULE_OPTIONS,
      useValue: moduleOptions,
    },
  ],
})
class DiscoveryTestModule {}

describe("DiscoveryController", () => {
  it("should dynamically generate discovery documents from approved capabilities", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryTestModule],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    const controller = moduleRef.get(DiscoveryController);

    const agentJson = controller.getAgentJson();
    const agentCard = controller.getAgentCard();
    const openApi = controller.getOpenApi();

    expect(agentJson.specVersion).toBe(AGENT_JSON_SPEC_VERSION);
    expect(agentJson.capabilities).toHaveLength(1);
    expect(agentJson.capabilitiesEndpoint).toBe(
      "https://shop.example.com/agent/capabilities",
    );

    expect(agentCard.version).toBe(AGENT_CARD_SPEC_VERSION);
    expect(agentCard.skills[0]?.id).toBe("product_catalog");

    expect(openApi.openapi).toBe(OPENAPI_SPEC_VERSION);
    expect(openApi.paths["/agent/capabilities/product_catalog"]?.post).toBeDefined();
  });

  it("should serve discovery endpoints over HTTP on a running NestJS app", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryTestModule],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const baseUrl = await app.getUrl();
    const response = await fetch(`${baseUrl}/.well-known/agent.json`);
    const payload = (await response.json()) as {
      readonly specVersion: string;
      readonly capabilities: readonly unknown[];
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(payload.specVersion).toBe(AGENT_JSON_SPEC_VERSION);
    expect(payload.capabilities).toHaveLength(1);

    await app.close();
  });
});
