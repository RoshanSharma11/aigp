import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Capability, CapabilityOverride } from "@agent-layer/core";

import { mergeCapabilityOverride } from "../builder/merger.js";
import type { PendingReviewEntry } from "../reasoner/prompts/refine.v1.js";
import { StoreError } from "./errors.js";
import {
  loadApprovedCapabilitiesFromDraft,
  loadCapabilitiesDraftArtifact,
  loadOverridesArtifact,
} from "./reader.js";
import { PENDING_REVIEW_FILE, resolveAgentLayerDirectory } from "./writer.js";
import { upsertCapabilityOverrides } from "./overrides-writer.js";

export type ReviewItemStatus = "approved" | "draft" | "disabled" | "pending_review";

export interface ReviewItem {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly confidence: number;
  readonly needsHumanReview: boolean;
  readonly status: ReviewItemStatus;
  readonly pendingReasons: readonly string[];
  readonly hasOverride: boolean;
}

export interface ReviewListResult {
  readonly items: readonly ReviewItem[];
  readonly approvedCount: number;
  readonly pendingCount: number;
  readonly draftCount: number;
  readonly disabledCount: number;
}

const readPendingReviewArtifact = async (
  rootPath: string,
): Promise<{ readonly entries: readonly PendingReviewEntry[] }> => {
  const artifactPath = path.join(resolveAgentLayerDirectory(rootPath), PENDING_REVIEW_FILE);

  try {
    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
      readonly entries?: readonly PendingReviewEntry[];
    };

    return { entries: artifact.entries ?? [] };
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return { entries: [] };
    }

    throw error;
  }
};

const resolveReviewStatus = (
  capability: Capability,
  pendingEntry: PendingReviewEntry | undefined,
): ReviewItemStatus => {
  if (capability.status === "approved") {
    return "approved";
  }

  if (capability.status === "disabled") {
    return "disabled";
  }

  if (capability.needsHumanReview || pendingEntry !== undefined) {
    return "pending_review";
  }

  return "draft";
};

export const listReviewItems = async (rootPath: string): Promise<ReviewListResult> => {
  const draft = await loadCapabilitiesDraftArtifact(rootPath);
  const overrides = await loadOverridesArtifact(rootPath);
  const pendingReview = await readPendingReviewArtifact(rootPath);
  const pendingById = new Map(
    pendingReview.entries.map((entry) => [entry.capabilityId, entry] as const),
  );
  const overrideIds = new Set(overrides.capabilities.map((override) => override.id));

  const items = draft.capabilities.map((capability) => {
    const override = overrides.capabilities.find((entry) => entry.id === capability.id);
    const merged = override === undefined ? capability : mergeCapabilityOverride(capability, override);
    const pendingEntry = pendingById.get(capability.id);

    return {
      id: merged.id,
      name: merged.name,
      category: merged.category,
      confidence: merged.confidence,
      needsHumanReview: merged.needsHumanReview,
      status: resolveReviewStatus(merged, pendingEntry),
      pendingReasons: pendingEntry?.reasons ?? [],
      hasOverride: overrideIds.has(capability.id),
    };
  });

  return {
    items,
    approvedCount: items.filter((item) => item.status === "approved").length,
    pendingCount: items.filter((item) => item.status === "pending_review").length,
    draftCount: items.filter((item) => item.status === "draft").length,
    disabledCount: items.filter((item) => item.status === "disabled").length,
  };
};

const assertCapabilityExists = (capabilities: readonly Capability[], id: string): void => {
  if (!capabilities.some((capability) => capability.id === id)) {
    throw new StoreError(`Capability "${id}" not found in draft capabilities`, {
      code: "CAPABILITY_NOT_FOUND",
      context: { capabilityId: id },
    });
  }
};

export const approveCapabilities = async (
  rootPath: string,
  capabilityIds: readonly string[],
): Promise<{ readonly artifactPath: string; readonly approvedIds: readonly string[] }> => {
  const draft = await loadCapabilitiesDraftArtifact(rootPath);
  const overrides = await loadOverridesArtifact(rootPath);

  for (const id of capabilityIds) {
    assertCapabilityExists(draft.capabilities, id);
  }

  const updates: CapabilityOverride[] = capabilityIds.map((id) => ({
    id,
    status: "approved",
    needsHumanReview: false,
  }));

  const { artifactPath } = await upsertCapabilityOverrides(rootPath, overrides, updates);

  return { artifactPath, approvedIds: capabilityIds };
};

export const rejectCapabilities = async (
  rootPath: string,
  capabilityIds: readonly string[],
): Promise<{ readonly artifactPath: string; readonly rejectedIds: readonly string[] }> => {
  const draft = await loadCapabilitiesDraftArtifact(rootPath);
  const overrides = await loadOverridesArtifact(rootPath);

  for (const id of capabilityIds) {
    assertCapabilityExists(draft.capabilities, id);
  }

  const updates: CapabilityOverride[] = capabilityIds.map((id) => ({
    id,
    status: "disabled",
  }));

  const { artifactPath } = await upsertCapabilityOverrides(rootPath, overrides, updates);

  return { artifactPath, rejectedIds: capabilityIds };
};

export const editCapabilityReview = async (
  rootPath: string,
  capabilityId: string,
  fields: CapabilityOverride,
): Promise<{ readonly artifactPath: string; readonly override: CapabilityOverride }> => {
  const draft = await loadCapabilitiesDraftArtifact(rootPath);
  const overrides = await loadOverridesArtifact(rootPath);

  assertCapabilityExists(draft.capabilities, capabilityId);

  if (fields.id !== capabilityId) {
    throw new StoreError("Override id must match the capability id being edited", {
      code: "CAPABILITY_ID_MISMATCH",
      context: { capabilityId, overrideId: fields.id },
    });
  }

  const { artifactPath } = await upsertCapabilityOverrides(rootPath, overrides, [fields]);

  return { artifactPath, override: fields };
};

export const verifyApprovedOnlyForRuntime = async (
  rootPath: string,
): Promise<{ readonly approvedIds: readonly string[]; readonly blockedIds: readonly string[] }> => {
  const loaded = await loadApprovedCapabilitiesFromDraft(rootPath);
  const approvedIds = loaded.approvedCapabilities.map((capability) => capability.id);
  const blockedIds = loaded.mergedCapabilities
    .filter((capability) => capability.status !== "approved")
    .map((capability) => capability.id);

  return { approvedIds, blockedIds };
};
