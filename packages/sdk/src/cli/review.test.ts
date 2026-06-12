import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createEcommerceFixtureMockProvider } from "../analyze/ecommerce-fixture-mock.js";
import { runAnalyzeCommand } from "./analyze.js";
import { runReviewCommand } from "./review.js";
import { mergeOverrideEntries } from "../store/overrides-writer.js";
import {
  approveCapabilities,
  listReviewItems,
  rejectCapabilities,
  verifyApprovedOnlyForRuntime,
} from "../store/review.js";
import { loadOverridesArtifact } from "../store/reader.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

const prepareDraftArtifacts = async (): Promise<void> => {
  const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
  await rm(artifactDirectory, { recursive: true, force: true });

  const result = await runAnalyzeCommand([fixtureRoot], fixtureRoot, {
    llmProvider: createEcommerceFixtureMockProvider(),
  });

  expect(result.exitCode).toBe(0);
};

describe("overrides writer", () => {
  it("should merge override entries by capability id", () => {
    const merged = mergeOverrideEntries(
      [{ id: "cart_management", status: "draft" }],
      [{ id: "cart_management", status: "approved", needsHumanReview: false }],
    );

    expect(merged).toEqual([
      {
        id: "cart_management",
        status: "approved",
        needsHumanReview: false,
      },
    ]);
  });
});

describe("review workflow", () => {
  it("should list draft capabilities with review status", async () => {
    await prepareDraftArtifacts();

    const result = await listReviewItems(fixtureRoot);

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.pendingCount + result.draftCount).toBeGreaterThan(0);

    await rm(path.join(fixtureRoot, ".agent-layer"), { recursive: true, force: true });
  }, 30_000);

  it("should approve capabilities via overrides without modifying draft", async () => {
    await prepareDraftArtifacts();

    const draftBefore = await listReviewItems(fixtureRoot);
    const capabilityId = draftBefore.items[0]?.id;

    expect(capabilityId).toBeDefined();

    await approveCapabilities(fixtureRoot, [capabilityId!]);

    const overrides = await loadOverridesArtifact(fixtureRoot);
    const runtime = await verifyApprovedOnlyForRuntime(fixtureRoot);

    expect(overrides.capabilities.some((entry) => entry.id === capabilityId)).toBe(true);
    expect(runtime.approvedIds).toContain(capabilityId);
    expect(runtime.blockedIds).not.toContain(capabilityId);

    await rm(path.join(fixtureRoot, ".agent-layer"), { recursive: true, force: true });
  }, 30_000);

  it("should reject capabilities and keep them out of runtime approved set", async () => {
    await prepareDraftArtifacts();

    const draft = await listReviewItems(fixtureRoot);
    const capabilityId = draft.items[0]?.id;

    expect(capabilityId).toBeDefined();

    await rejectCapabilities(fixtureRoot, [capabilityId!]);

    const runtime = await verifyApprovedOnlyForRuntime(fixtureRoot);

    expect(runtime.approvedIds).not.toContain(capabilityId);
    expect(runtime.blockedIds).toContain(capabilityId);

    await rm(path.join(fixtureRoot, ".agent-layer"), { recursive: true, force: true });
  }, 30_000);

  it("should expose review list through the CLI", async () => {
    await prepareDraftArtifacts();

    const result = await runReviewCommand(["list", fixtureRoot], fixtureRoot);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Review queue");

    await rm(path.join(fixtureRoot, ".agent-layer"), { recursive: true, force: true });
  }, 30_000);

  it("should approve capabilities through the CLI", async () => {
    await prepareDraftArtifacts();

    const listed = await listReviewItems(fixtureRoot);
    const capabilityId = listed.items[0]?.id;

    expect(capabilityId).toBeDefined();

    const result = await runReviewCommand(
      ["approve", capabilityId!, fixtureRoot],
      fixtureRoot,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Approved 1 capabilities");

    await rm(path.join(fixtureRoot, ".agent-layer"), { recursive: true, force: true });
  }, 30_000);
});
