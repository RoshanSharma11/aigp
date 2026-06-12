import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseCapabilitiesArtifact,
  type AgentLayerConfig,
  type CapabilitiesArtifact,
  type Capability,
} from "@agent-layer/core";

import { generateAndWriteDiscoveryArtifacts } from "../generators/index.js";
import type { DiscoveryGeneratorContext } from "../generators/types.js";
import { StoreError } from "./errors.js";
import { loadApprovedCapabilitiesFromDraft } from "./reader.js";
import {
  CAPABILITIES_ARTIFACT_VERSION,
  CAPABILITIES_FILE,
  ensureAgentLayerDirectory,
  resolveAgentLayerDirectory,
} from "./writer.js";

export interface PublishCapabilitiesOptions {
  readonly rootPath: string;
  readonly generatedAt?: string | undefined;
  readonly config?: AgentLayerConfig | undefined;
  readonly agentName?: string | undefined;
  readonly agentDescription?: string | undefined;
}

export interface PublishCapabilitiesResult {
  readonly capabilitiesPath: string;
  readonly approvedCount: number;
  readonly skippedCount: number;
  readonly discoveryPaths: Awaited<
    ReturnType<typeof generateAndWriteDiscoveryArtifacts>
  >;
}

const serializeJsonArtifact = (artifact: unknown): string =>
  `${JSON.stringify(artifact, null, 2)}\n`;

export const serializePublishedCapabilities = (
  capabilities: readonly Capability[],
  generatedAt: string,
): CapabilitiesArtifact => ({
  version: CAPABILITIES_ARTIFACT_VERSION,
  generatedAt,
  capabilities: [...capabilities],
});

export const writePublishedCapabilities = async (
  rootPath: string,
  capabilities: readonly Capability[],
  generatedAt: string,
): Promise<string> => {
  const agentLayerDirectory = await ensureAgentLayerDirectory(rootPath);
  const artifact = serializePublishedCapabilities(capabilities, generatedAt);
  parseCapabilitiesArtifact(artifact);

  const artifactPath = path.join(agentLayerDirectory, CAPABILITIES_FILE);
  await writeFile(artifactPath, serializeJsonArtifact(artifact), "utf8");

  return artifactPath;
};

const buildDiscoveryContext = (
  options: PublishCapabilitiesOptions,
  generatedAt: string,
): DiscoveryGeneratorContext => ({
  baseUrl: options.config?.baseUrl ?? "https://example.com",
  generatedAt,
  ...(options.agentName !== undefined ? { agentName: options.agentName } : {}),
  ...(options.agentDescription !== undefined
    ? { agentDescription: options.agentDescription }
    : {}),
});

export const publishCapabilities = async (
  options: PublishCapabilitiesOptions,
): Promise<PublishCapabilitiesResult> => {
  const loaded = await loadApprovedCapabilitiesFromDraft(options.rootPath);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const approvedCapabilities = [...loaded.approvedCapabilities];

  if (approvedCapabilities.length === 0) {
    throw new StoreError(
      "No approved capabilities to publish. Set status to approved in overrides.json or draft capabilities.",
      {
        code: "NO_APPROVED_CAPABILITIES",
        context: {
          agentLayerDirectory: resolveAgentLayerDirectory(options.rootPath),
        },
      },
    );
  }

  const capabilitiesPath = await writePublishedCapabilities(
    options.rootPath,
    approvedCapabilities,
    generatedAt,
  );

  const discoveryPaths = await generateAndWriteDiscoveryArtifacts(
    options.rootPath,
    approvedCapabilities,
    buildDiscoveryContext(options, generatedAt),
  );

  return {
    capabilitiesPath,
    approvedCount: approvedCapabilities.length,
    skippedCount: loaded.mergedCapabilities.length - approvedCapabilities.length,
    discoveryPaths,
  };
};
