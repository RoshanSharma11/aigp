import type { Capability } from "@agent-layer/core";

import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AGENT_JSON_SPEC_VERSION } from "../../generators/agent-json.js";
import { AgentLayerModule } from "./module.js";

const approvedCapability = (): Capability => ({
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

describe("AgentLayerModule", () => {
  it("should register discovery and capability controllers via forRoot()", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AgentLayerModule.forRoot({
          baseUrl: "https://shop.example.com",
          agentName: "Shop Agent Layer",
          capabilities: [approvedCapability()],
        }),
      ],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const baseUrl = await app.getUrl();

    const discoveryResponse = await fetch(`${baseUrl}/.well-known/agent.json`);
    const discovery = (await discoveryResponse.json()) as {
      readonly specVersion: string;
      readonly capabilities: readonly unknown[];
    };

    expect(discoveryResponse.status).toBe(200);
    expect(discovery.specVersion).toBe(AGENT_JSON_SPEC_VERSION);
    expect(discovery.capabilities).toHaveLength(1);

    const listResponse = await fetch(`${baseUrl}/agent/capabilities`);
    const capabilities = (await listResponse.json()) as readonly { readonly id: string }[];

    expect(listResponse.status).toBe(200);
    expect(capabilities[0]?.id).toBe("product_catalog");

    await app.close();
  });
});
