import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseCapabilitiesArtifact } from "@agent-layer/core";
import type { Capability } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import { generateDiscoveryArtifacts } from "./index.js";
import { AGENT_JSON_SPEC_VERSION } from "./agent-json.js";
import { AGENT_CARD_SPEC_VERSION } from "./agent-card.js";
import { MCP_TOOLS_ARTIFACT_VERSION } from "./mcp.js";
import { OPENAPI_SPEC_VERSION } from "./openapi.js";
import { publishCapabilities } from "../store/publish.js";
import {
  AGENT_CARD_FILE,
  AGENT_JSON_FILE,
  CAPABILITIES_FILE,
  CAPABILITIES_DRAFT_FILE,
  MCP_TOOLS_FILE,
  OPENAPI_FILE,
  serializeCapabilitiesDraft,
} from "../store/writer.js";

const sampleCapability = (status: Capability["status"] = "approved"): Capability => ({
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
    {
      id: "search_products",
      description: "Search products",
      httpMethod: "GET",
      httpPath: "/api/products/search",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
      },
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
  sourceRoutes: ["GET /api/products", "GET /api/products/search"],
  status,
});

const generatorContext = {
  baseUrl: "https://shop.example.com",
  generatedAt: "2026-06-12T16:00:00.000Z",
  agentName: "Shop Agent Layer",
};

describe("discovery artifact generators", () => {
  it("should generate AWP, A2A, OpenAPI, and MCP discovery documents", () => {
    const artifacts = generateDiscoveryArtifacts(
      [sampleCapability()],
      generatorContext,
    );

    expect(artifacts.agentJson.specVersion).toBe(AGENT_JSON_SPEC_VERSION);
    expect(artifacts.agentJson.capabilities).toHaveLength(1);
    expect(artifacts.agentJson.capabilitiesEndpoint).toBe(
      "https://shop.example.com/agent/capabilities",
    );

    expect(artifacts.agentCard.version).toBe(AGENT_CARD_SPEC_VERSION);
    expect(artifacts.agentCard.skills[0]?.id).toBe("product_catalog");

    expect(artifacts.openApi.openapi).toBe(OPENAPI_SPEC_VERSION);
    expect(artifacts.openApi.paths["/agent/capabilities/product_catalog"]?.post).toBeDefined();

    expect(artifacts.mcpTools.version).toBe(MCP_TOOLS_ARTIFACT_VERSION);
    expect(artifacts.mcpTools.tools[0]?.name).toBe("product_catalog");
    const inputSchema = artifacts.mcpTools.tools[0]?.inputSchema;

    expect(inputSchema).toMatchObject({ type: "object" });

    if (
      typeof inputSchema === "object" &&
      inputSchema !== null &&
      "properties" in inputSchema &&
      typeof inputSchema.properties === "object" &&
      inputSchema.properties !== null
    ) {
      const properties = inputSchema.properties as Record<string, unknown>;

      expect(properties.operation).toMatchObject({
        enum: ["list_products", "search_products"],
      });
    }
  });

  it("should publish approved capabilities and write discovery artifacts", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "aigp-generators-"));
    const generatedAt = "2026-06-12T16:00:00.000Z";

    const agentLayerDirectory = path.join(projectRoot, ".agent-layer");
    await mkdir(agentLayerDirectory, { recursive: true });
    await writeFile(
      path.join(agentLayerDirectory, CAPABILITIES_DRAFT_FILE),
      `${JSON.stringify(
        serializeCapabilitiesDraft([sampleCapability("draft")], generatedAt),
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeFile(
      path.join(agentLayerDirectory, "overrides.json"),
      `${JSON.stringify(
        {
          version: "1.0.0",
          updatedAt: generatedAt,
          capabilities: [
            {
              id: "product_catalog",
              status: "approved",
            },
          ],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = await publishCapabilities({
      rootPath: projectRoot,
      generatedAt,
      config: {
        llm: { provider: "mock", model: "mock-model-v1" },
        confidenceThreshold: 0.85,
        excludeRoutes: [],
        baseUrl: "https://shop.example.com",
      },
      agentName: "Shop Agent Layer",
    });

    expect(result.approvedCount).toBe(1);
    expect(path.basename(result.capabilitiesPath)).toBe(CAPABILITIES_FILE);

    const published = parseCapabilitiesArtifact(
      JSON.parse(await readFile(result.capabilitiesPath, "utf8")),
    );
    expect(published.capabilities).toHaveLength(1);
    expect(published.capabilities[0]?.status).toBe("approved");

    expect(path.basename(result.discoveryPaths.agentJsonPath)).toBe(AGENT_JSON_FILE);
    expect(path.basename(result.discoveryPaths.agentCardPath)).toBe(AGENT_CARD_FILE);
    expect(path.basename(result.discoveryPaths.openApiPath)).toBe(OPENAPI_FILE);
    expect(path.basename(result.discoveryPaths.mcpToolsPath)).toBe(MCP_TOOLS_FILE);

    const agentJson = JSON.parse(
      await readFile(result.discoveryPaths.agentJsonPath, "utf8"),
    ) as { readonly capabilities: readonly unknown[] };
    expect(agentJson.capabilities).toHaveLength(1);

    await rm(projectRoot, { recursive: true, force: true });
  });
});
