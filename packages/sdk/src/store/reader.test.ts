import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseCapabilitiesArtifact } from "@agent-layer/core";
import type { Capability } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import {
  loadApprovedCapabilitiesFromDraft,
  loadOverridesArtifact,
  loadPublishedCapabilities,
} from "./reader.js";
import {
  AGENT_LAYER_DIRECTORY,
  CAPABILITIES_DRAFT_FILE,
  CAPABILITIES_FILE,
  OVERRIDES_FILE,
  serializeCapabilitiesDraft,
} from "./writer.js";

const sampleCapability = (
  id: string,
  status: Capability["status"],
): Capability => ({
  id,
  name: `${id} name`,
  description: `${id} description`,
  category: "commerce",
  operations: [
    {
      id: `${id}_operation`,
      description: "Execute operation",
      httpMethod: "GET",
      httpPath: `/api/${id}`,
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      sideEffects: "read",
    },
  ],
  defaultOperation: `${id}_operation`,
  inputSchema: { type: "object" },
  outputSchema: { type: "object" },
  sideEffects: "read",
  requiresAuth: false,
  reversible: true,
  confirmationRequired: false,
  riskLevel: "low",
  confidence: 0.92,
  needsHumanReview: false,
  sourceRoutes: [`GET /api/${id}`],
  status,
});

const writeArtifact = async (
  rootPath: string,
  fileName: string,
  payload: unknown,
): Promise<void> => {
  const directory = path.join(rootPath, AGENT_LAYER_DIRECTORY);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, fileName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

describe("capability store reader", () => {
  it("should return empty overrides when overrides.json is missing", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "aigp-store-reader-"));

    const overrides = await loadOverridesArtifact(projectRoot);

    expect(overrides.capabilities).toEqual([]);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("should merge overrides and return only approved capabilities from draft", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "aigp-store-reader-"));
    const generatedAt = "2026-06-12T16:00:00.000Z";

    await writeArtifact(
      projectRoot,
      CAPABILITIES_DRAFT_FILE,
      serializeCapabilitiesDraft(
        [
          sampleCapability("cart_management", "draft"),
          sampleCapability("product_catalog", "draft"),
        ],
        generatedAt,
      ),
    );
    await writeArtifact(projectRoot, OVERRIDES_FILE, {
      version: "1.0.0",
      updatedAt: generatedAt,
      capabilities: [
        {
          id: "cart_management",
          status: "approved",
        },
        {
          id: "product_catalog",
          status: "disabled",
        },
      ],
    });

    const loaded = await loadApprovedCapabilitiesFromDraft(projectRoot);

    expect(loaded.mergedCapabilities.map((capability) => capability.status)).toEqual([
      "approved",
      "disabled",
    ]);
    expect(loaded.approvedCapabilities.map((capability) => capability.id)).toEqual([
      "cart_management",
    ]);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it("should load published capabilities and filter approved after overrides merge", async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), "aigp-store-reader-"));
    const generatedAt = "2026-06-12T16:00:00.000Z";

    await writeArtifact(
      projectRoot,
      CAPABILITIES_FILE,
      serializeCapabilitiesDraft(
        [
          sampleCapability("cart_management", "approved"),
          sampleCapability("product_catalog", "draft"),
        ],
        generatedAt,
      ),
    );
    await writeArtifact(projectRoot, OVERRIDES_FILE, {
      version: "1.0.0",
      updatedAt: generatedAt,
      capabilities: [
        {
          id: "product_catalog",
          status: "approved",
          name: "Product catalog override",
        },
      ],
    });

    const loaded = await loadPublishedCapabilities(projectRoot);

    expect(loaded.approvedCapabilities.map((capability) => capability.id)).toEqual([
      "cart_management",
      "product_catalog",
    ]);
    expect(loaded.approvedCapabilities.find((capability) => capability.id === "product_catalog")?.name).toBe(
      "Product catalog override",
    );

    await rm(projectRoot, { recursive: true, force: true });
  });
});
