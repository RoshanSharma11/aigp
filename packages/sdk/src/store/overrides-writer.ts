import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseOverridesArtifact,
  type CapabilityOverride,
  type OverridesArtifact,
} from "@agent-layer/core";

import { ensureAgentLayerDirectory, OVERRIDES_FILE } from "./writer.js";

export const OVERRIDES_ARTIFACT_VERSION = "1.0.0";

const serializeJsonArtifact = (artifact: unknown): string =>
  `${JSON.stringify(artifact, null, 2)}\n`;

export const mergeOverrideEntries = (
  existing: readonly CapabilityOverride[],
  updates: readonly CapabilityOverride[],
): CapabilityOverride[] => {
  const overrideById = new Map(existing.map((entry) => [entry.id, { ...entry }] as const));

  for (const update of updates) {
    const current = overrideById.get(update.id);
    overrideById.set(update.id, current === undefined ? { ...update } : { ...current, ...update });
  }

  return [...overrideById.values()].sort((left, right) => left.id.localeCompare(right.id));
};

export const buildOverridesArtifact = (
  capabilities: readonly CapabilityOverride[],
  updatedAt: string = new Date().toISOString(),
): OverridesArtifact => ({
  version: OVERRIDES_ARTIFACT_VERSION,
  updatedAt,
  capabilities: [...capabilities],
});

export const writeOverridesArtifact = async (
  rootPath: string,
  artifact: OverridesArtifact,
): Promise<string> => {
  const validated = parseOverridesArtifact(artifact);
  const agentLayerDirectory = await ensureAgentLayerDirectory(rootPath);
  const artifactPath = path.join(agentLayerDirectory, OVERRIDES_FILE);

  await writeFile(artifactPath, serializeJsonArtifact(validated), "utf8");

  return artifactPath;
};

export const upsertCapabilityOverrides = async (
  rootPath: string,
  existing: OverridesArtifact,
  updates: readonly CapabilityOverride[],
  updatedAt: string = new Date().toISOString(),
): Promise<{ readonly artifactPath: string; readonly artifact: OverridesArtifact }> => {
  const artifact = buildOverridesArtifact(
    mergeOverrideEntries(existing.capabilities, updates),
    updatedAt,
  );
  const artifactPath = await writeOverridesArtifact(rootPath, artifact);

  return { artifactPath, artifact };
};
