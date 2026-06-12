import type { Capability } from "@agent-layer/core";

import { Module, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { CapabilityController } from "./capability.controller.js";
import { CapabilityGuard } from "./capability.guard.js";
import { CapabilityRegistryService } from "./capability-registry.service.js";
import { ExecutorService } from "./executor.service.js";
import { StaticInternalRouteProxy } from "./internal-route-proxy.js";
import {
  AGENT_LAYER_MODULE_OPTIONS,
  INTERNAL_ROUTE_PROXY,
  type AgentLayerModuleOptions,
} from "./tokens.js";

const approvedCapability = (): Capability => ({
  id: "product_catalog",
  name: "Product Catalog",
  description: "Browse and search products",
  category: "catalog",
  operations: [
    {
      id: "search_products",
      description: "Search products",
      httpMethod: "GET",
      httpPath: "/api/products/search",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
        },
      },
      outputSchema: { type: "array" },
      sideEffects: "read",
    },
  ],
  defaultOperation: "search_products",
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.93,
  needsHumanReview: false,
  sourceRoutes: ["GET /api/products/search"],
  status: "approved",
});

const pendingReviewCapability = (): Capability => ({
  ...approvedCapability(),
  id: "pending_review_capability",
  status: "approved",
  needsHumanReview: true,
});

const moduleOptions = (capabilities: readonly Capability[]): AgentLayerModuleOptions => ({
  baseUrl: "https://shop.example.com",
  capabilities: [...capabilities],
});

const createTestModule = (capabilities: readonly Capability[]) => {
  const routeProxy = new StaticInternalRouteProxy(async () => ({
    status: 200,
    body: [{ id: "prod_1", name: "Trail Running Shoes" }],
  }));

  @Module({
    controllers: [CapabilityController],
    providers: [
      CapabilityRegistryService,
      ExecutorService,
      CapabilityGuard,
      {
        provide: AGENT_LAYER_MODULE_OPTIONS,
        useValue: moduleOptions(capabilities),
      },
      {
        provide: INTERNAL_ROUTE_PROXY,
        useValue: routeProxy,
      },
    ],
  })
  class CapabilityTestModule {}

  return CapabilityTestModule;
};

describe("CapabilityController", () => {
  it("should list approved capability summaries", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [createTestModule([approvedCapability()])],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    const controller = moduleRef.get(CapabilityController);
    const summaries = controller.listCapabilities();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.id).toBe("product_catalog");
    expect(summaries[0]?.endpoint).toBe(
      "https://shop.example.com/agent/capabilities/product_catalog",
    );
  });

  it("should exclude draft capabilities from the list endpoint", async () => {
    const draftCapability = (): Capability => ({
      ...approvedCapability(),
      id: "draft_capability",
      status: "draft",
    });

    const moduleRef = await Test.createTestingModule({
      imports: [createTestModule([approvedCapability(), draftCapability()])],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    const controller = moduleRef.get(CapabilityController);
    const summaries = controller.listCapabilities();

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.id).toBe("product_catalog");
  });

  it("should return a full capability definition for approved capabilities", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [createTestModule([approvedCapability()])],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    const controller = moduleRef.get(CapabilityController);
    const capability = controller.getCapability("product_catalog");

    expect(capability.id).toBe("product_catalog");
    expect(capability.operations).toHaveLength(1);
  });

  it("should execute a capability through ExecutorService", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [createTestModule([approvedCapability()])],
    }).compile();

    const registry = moduleRef.get(CapabilityRegistryService);
    await registry.onModuleInit();

    const controller = moduleRef.get(CapabilityController);
    const result = await controller.executeCapability(
      "product_catalog",
      {
        operation: "search_products",
        input: { query: "shoes" },
      },
      "Bearer test-token",
    );

    expect(result.success).toBe(true);
    expect(result.capabilityId).toBe("product_catalog");
    expect(result.operation).toBe("search_products");
  });

  it("should serve capability endpoints over HTTP on a running NestJS app", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [createTestModule([approvedCapability()])],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const baseUrl = await app.getUrl();

    const listResponse = await fetch(`${baseUrl}/agent/capabilities`);
    const listPayload = (await listResponse.json()) as readonly { readonly id: string }[];

    expect(listResponse.status).toBe(200);
    expect(listPayload).toHaveLength(1);
    expect(listPayload[0]?.id).toBe("product_catalog");

    const executeResponse = await fetch(`${baseUrl}/agent/capabilities/product_catalog`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-token",
      },
      body: JSON.stringify({
        operation: "search_products",
        input: { query: "shoes" },
      }),
    });
    const executePayload = (await executeResponse.json()) as {
      readonly success: boolean;
      readonly capabilityId: string;
    };

    expect(executeResponse.status).toBe(200);
    expect(executePayload.success).toBe(true);
    expect(executePayload.capabilityId).toBe("product_catalog");

    await app.close();
  });
});

describe("CapabilityGuard", () => {
  it("should block capabilities pending human review with HTTP 403", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [createTestModule([approvedCapability(), pendingReviewCapability()])],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const baseUrl = await app.getUrl();
    const response = await fetch(`${baseUrl}/agent/capabilities/pending_review_capability`);

    expect(response.status).toBe(403);

    await app.close();
  });

  it("should return HTTP 404 for unknown capabilities", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [createTestModule([approvedCapability()])],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const baseUrl = await app.getUrl();
    const response = await fetch(`${baseUrl}/agent/capabilities/missing_capability`);

    expect(response.status).toBe(404);

    await app.close();
  });
});
