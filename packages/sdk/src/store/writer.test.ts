import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCapabilitiesArtifact } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import { runFullAnalysis } from "../analyze/pipeline.js";
import { createEcommerceFixtureMockProvider } from "../analyze/ecommerce-fixture-mock.js";
import {
  ANALYSIS_META_FILE,
  CAPABILITIES_DRAFT_FILE,
  PENDING_REVIEW_FILE,
  ROUTE_GRAPH_FILE,
  serializeAnalysisMetaArtifact,
  serializeCapabilitiesDraft,
  writeAnalysisArtifacts,
} from "./writer.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("analysis artifact writer", () => {
  it("should write draft capabilities, pending review, and analysis meta artifacts", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "aigp-store-writer-"));

    const generatedAt = "2026-06-12T15:00:00.000Z";
    const paths = await writeAnalysisArtifacts(projectRoot, {
      capabilities: serializeCapabilitiesDraft(
        [
          {
            id: "product_catalog",
            name: "Product Catalog",
            description: "Browse products",
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
            status: "draft",
          },
        ],
        generatedAt,
      ),
      pendingReview: {
        version: "1.0.0",
        generatedAt,
        entries: [],
      },
      analysisMeta: serializeAnalysisMetaArtifact(
        {
          generatedAt,
          framework: "nestjs",
          routeCount: 7,
          capabilityCount: 1,
          warningCount: 0,
          llmCostUsd: 0,
        },
        {
          provider: "mock",
          model: "mock-model-v1",
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          costUsd: 0,
          callCount: 1,
        },
      ),
    });

    await expect(access(paths.capabilitiesDraftPath)).resolves.toBeUndefined();
    await expect(access(paths.pendingReviewPath)).resolves.toBeUndefined();
    await expect(access(paths.analysisMetaPath)).resolves.toBeUndefined();

    const capabilities = parseCapabilitiesArtifact(
      JSON.parse(await readFile(paths.capabilitiesDraftPath, "utf8")),
    );
    expect(capabilities.capabilities).toHaveLength(1);
    expect(path.basename(paths.capabilitiesDraftPath)).toBe(CAPABILITIES_DRAFT_FILE);
    expect(path.basename(paths.pendingReviewPath)).toBe(PENDING_REVIEW_FILE);
    expect(path.basename(paths.analysisMetaPath)).toBe(ANALYSIS_META_FILE);

    await rm(projectRoot, { recursive: true, force: true });
  });
});

describe("runFullAnalysis artifact integration", () => {
  it(
    "should write all draft artifacts for the ecommerce fixture",
    async () => {
      const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
      await rm(artifactDirectory, { recursive: true, force: true });

      const result = await runFullAnalysis(fixtureRoot, {
        llmProvider: createEcommerceFixtureMockProvider(),
        generatedAt: "2026-06-12T15:00:00.000Z",
      });

      expect(result.capabilities).toHaveLength(3);
      expect(result.artifactPaths).toBeDefined();

      const capabilitiesPath = path.join(artifactDirectory, CAPABILITIES_DRAFT_FILE);
      const pendingReviewPath = path.join(artifactDirectory, PENDING_REVIEW_FILE);
      const analysisMetaPath = path.join(artifactDirectory, ANALYSIS_META_FILE);
      const routeGraphPath = path.join(artifactDirectory, ROUTE_GRAPH_FILE);

      await expect(access(capabilitiesPath)).resolves.toBeUndefined();
      await expect(access(pendingReviewPath)).resolves.toBeUndefined();
      await expect(access(analysisMetaPath)).resolves.toBeUndefined();
      await expect(access(routeGraphPath)).resolves.toBeUndefined();

      const capabilities = parseCapabilitiesArtifact(
        JSON.parse(await readFile(capabilitiesPath, "utf8")),
      );
      expect(capabilities.capabilities.map((capability) => capability.id)).toEqual([
        "account_access",
        "cart_management",
        "product_catalog",
      ]);

      await rm(artifactDirectory, { recursive: true, force: true });
    },
    30_000,
  );
});
