import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseCapabilitiesArtifact,
  parseOverridesArtifact,
  type CapabilitiesArtifact,
  type Capability,
  type OverridesArtifact,
} from "@agent-layer/core";

import {
  filterApprovedCapabilities,
  mergeCapabilityOverrides,
} from "../builder/merger.js";
import { StoreError } from "./errors.js";
import {
  AGENT_LAYER_DIRECTORY,
  CAPABILITIES_DRAFT_FILE,
  CAPABILITIES_FILE,
  OVERRIDES_FILE,
} from "./writer.js";

export const EMPTY_OVERRIDES_ARTIFACT: OverridesArtifact = {
  version: "1.0.0",
  updatedAt: "1970-01-01T00:00:00.000Z",
  capabilities: [],
};

export interface LoadPublishedCapabilitiesResult {
  readonly artifact: CapabilitiesArtifact;
  readonly capabilities: readonly Capability[];
  readonly mergedCapabilities: readonly Capability[];
  readonly approvedCapabilities: readonly Capability[];
  readonly overrides: OverridesArtifact;
}

const readJsonFile = async (filePath: string): Promise<unknown> => {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
};

export const resolveCapabilitiesPath = (rootPath: string): string =>
  path.join(rootPath, AGENT_LAYER_DIRECTORY, CAPABILITIES_FILE);

export const resolveCapabilitiesDraftPath = (rootPath: string): string =>
  path.join(rootPath, AGENT_LAYER_DIRECTORY, CAPABILITIES_DRAFT_FILE);

export const resolveOverridesPath = (rootPath: string): string =>
  path.join(rootPath, AGENT_LAYER_DIRECTORY, OVERRIDES_FILE);

export const loadCapabilitiesArtifact = async (
  rootPath: string,
): Promise<CapabilitiesArtifact> => {
  const artifactPath = resolveCapabilitiesPath(rootPath);

  try {
    const artifact = parseCapabilitiesArtifact(await readJsonFile(artifactPath));
    return artifact as CapabilitiesArtifact;
  } catch (error) {
    throw new StoreError(`Published capabilities not found at ${artifactPath}`, {
      code: "CAPABILITIES_NOT_FOUND",
      context: { artifactPath },
      cause: error,
    });
  }
};

export const loadCapabilitiesDraftArtifact = async (
  rootPath: string,
): Promise<CapabilitiesArtifact> => {
  const artifactPath = resolveCapabilitiesDraftPath(rootPath);

  try {
    const artifact = parseCapabilitiesArtifact(await readJsonFile(artifactPath));
    return artifact as CapabilitiesArtifact;
  } catch (error) {
    throw new StoreError(`Draft capabilities not found at ${artifactPath}`, {
      code: "CAPABILITIES_DRAFT_NOT_FOUND",
      context: { artifactPath },
      cause: error,
    });
  }
};

export const loadOverridesArtifact = async (
  rootPath: string,
): Promise<OverridesArtifact> => {
  const artifactPath = resolveOverridesPath(rootPath);

  try {
    const artifact = parseOverridesArtifact(await readJsonFile(artifactPath));
    return artifact as OverridesArtifact;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return EMPTY_OVERRIDES_ARTIFACT;
    }

    throw new StoreError(`Failed to read overrides at ${artifactPath}`, {
      code: "OVERRIDES_READ_FAILED",
      context: { artifactPath },
      cause: error,
    });
  }
};

export const loadPublishedCapabilities = async (
  rootPath: string,
): Promise<LoadPublishedCapabilitiesResult> => {
  const artifact = await loadCapabilitiesArtifact(rootPath);
  const overrides = await loadOverridesArtifact(rootPath);
  const mergedCapabilities = mergeCapabilityOverrides(
    artifact.capabilities,
    overrides.capabilities,
  );
  const approvedCapabilities = filterApprovedCapabilities(mergedCapabilities);

  return {
    artifact,
    capabilities: artifact.capabilities,
    mergedCapabilities,
    approvedCapabilities,
    overrides,
  };
};

export const loadApprovedCapabilitiesFromDraft = async (
  rootPath: string,
): Promise<LoadPublishedCapabilitiesResult> => {
  const artifact = await loadCapabilitiesDraftArtifact(rootPath);
  const overrides = await loadOverridesArtifact(rootPath);
  const mergedCapabilities = mergeCapabilityOverrides(
    artifact.capabilities,
    overrides.capabilities,
  );
  const approvedCapabilities = filterApprovedCapabilities(mergedCapabilities);

  return {
    artifact,
    capabilities: artifact.capabilities,
    mergedCapabilities,
    approvedCapabilities,
    overrides,
  };
};
