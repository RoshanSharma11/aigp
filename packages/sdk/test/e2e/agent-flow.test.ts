import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Capability } from "@agent-layer/core";

import { Module, RequestMethod, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { describe, expect, it } from "vitest";

import { runFullAnalysis } from "../../src/analyze/pipeline.js";
import { AGENT_JSON_SPEC_VERSION } from "../../src/generators/agent-json.js";
import { AgentLayerModule } from "../../src/runtime/nestjs/module.js";

import { AuthModule } from "../../../../fixtures/nestjs-ecommerce/src/auth/auth.module.js";
import { CartModule } from "../../../../fixtures/nestjs-ecommerce/src/cart/cart.module.js";
import { ProductsModule } from "../../../../fixtures/nestjs-ecommerce/src/products/products.module.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../fixtures/nestjs-ecommerce",
);

const approveCapabilities = (capabilities: readonly Capability[]): Capability[] =>
  capabilities.map((capability) => ({
    ...capability,
    status: "approved" as const,
    needsHumanReview: false,
  }));

const createE2eModule = (capabilities: readonly Capability[], baseUrl: string) => {
  @Module({
    imports: [
      ProductsModule,
      CartModule,
      AuthModule,
      AgentLayerModule.forRoot({
        baseUrl,
        agentName: "Fixture Ecommerce Agent",
        capabilities,
      }),
    ],
  })
  class E2eAgentFlowModule {}

  return E2eAgentFlowModule;
};

describe("agent flow e2e", () => {
  it(
    "should discover capabilities and execute product search and auth-gated cart access",
    async () => {
      const analysis = await runFullAnalysis(fixtureRoot, { writeArtifacts: false });
      const capabilities = approveCapabilities(analysis.capabilities);

      const app = await NestFactory.create(createE2eModule(capabilities, "http://127.0.0.1:3000"));
      app.setGlobalPrefix("api", {
        exclude: [
          { path: ".well-known/(.*)", method: RequestMethod.ALL },
          { path: "agent/(.*)", method: RequestMethod.ALL },
        ],
      });
      await app.init();
      await app.listen(0);

      const baseUrl = await app.getUrl();

      const discoveryResponse = await fetch(`${baseUrl}/.well-known/agent.json`);
      const discovery = (await discoveryResponse.json()) as {
        readonly specVersion: string;
        readonly capabilities: readonly { readonly id: string }[];
        readonly capabilitiesEndpoint: string;
      };

      expect(discoveryResponse.status).toBe(200);
      expect(discovery.specVersion).toBe(AGENT_JSON_SPEC_VERSION);
      expect(discovery.capabilities.length).toBeGreaterThan(0);
      expect(discovery.capabilitiesEndpoint).toMatch(/\/agent\/capabilities$/);

      const listResponse = await fetch(`${baseUrl}/agent/capabilities`);
      const capabilitySummaries = (await listResponse.json()) as readonly {
        readonly id: string;
      }[];

      expect(listResponse.status).toBe(200);
      expect(capabilitySummaries.some((capability) => capability.id === "product_catalog")).toBe(
        true,
      );

      const searchResponse = await fetch(`${baseUrl}/agent/capabilities/product_catalog`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "search_products",
          input: { query: "shoes" },
        }),
      });
      const searchResult = (await searchResponse.json()) as {
        readonly success: boolean;
        readonly capabilityId: string;
        readonly operation: string;
        readonly data?: readonly { readonly name: string }[];
      };

      expect(searchResponse.status).toBe(200);
      expect(searchResult.success).toBe(true);
      expect(searchResult.capabilityId).toBe("product_catalog");
      expect(searchResult.operation).toBe("search_products");
      expect(searchResult.data?.some((product) => product.name.includes("Shoes"))).toBe(true);

      const loginResponse = await fetch(`${baseUrl}/agent/capabilities/account_access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "login",
          input: {
            email: "agent@example.com",
            password: "password123",
          },
        }),
      });
      const loginResult = (await loginResponse.json()) as {
        readonly success: boolean;
        readonly data?: { readonly accessToken: string };
      };

      expect(loginResponse.status).toBe(200);
      expect(loginResult.success).toBe(true);
      expect(loginResult.data?.accessToken).toBe("fixture-access-token");

      const cartResponse = await fetch(`${baseUrl}/agent/capabilities/cart_management`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${loginResult.data?.accessToken ?? ""}`,
        },
        body: JSON.stringify({
          operation: "get_cart",
          input: {},
        }),
      });
      const cartResult = (await cartResponse.json()) as {
        readonly success: boolean;
        readonly capabilityId: string;
      };

      expect(cartResponse.status).toBe(200);
      expect(cartResult.success).toBe(true);
      expect(cartResult.capabilityId).toBe("cart_management");

      await app.close();
    },
    60_000,
  );
});
