import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  parseCapabilitiesArtifact,
  type AnalysisMeta,
  type CapabilitiesArtifact,
  type Capability,
} from "@agent-layer/core";

import type { RouteGraphArtifact } from "../analyzer/route-graph.js";
import type { PendingReviewArtifact } from "../reasoner/prompts/refine.v1.js";
import type { LlmUsageStats } from "../reasoner/llm/types.js";

export const AGENT_LAYER_DIRECTORY = ".agent-layer";
export const CAPABILITIES_DRAFT_FILE = "capabilities.draft.json";
export const PENDING_REVIEW_FILE = "pending-review.json";
export const ANALYSIS_META_FILE = "analysis-meta.json";
export const ROUTE_GRAPH_FILE = "route-graph.json";

export const CAPABILITIES_ARTIFACT_VERSION = "1.0.0";
export const ANALYSIS_META_ARTIFACT_VERSION = "1.0.0";

export interface AnalysisMetaArtifact extends AnalysisMeta {
  readonly version: typeof ANALYSIS_META_ARTIFACT_VERSION;
  readonly llm?: LlmUsageStats | undefined;
}

export interface AnalysisArtifacts {
  readonly capabilities: CapabilitiesArtifact;
  readonly pendingReview: PendingReviewArtifact;
  readonly analysisMeta: AnalysisMetaArtifact;
  readonly routeGraph?: RouteGraphArtifact | undefined;
}

export interface WriteAnalysisArtifactsResult {
  readonly agentLayerDirectory: string;
  readonly capabilitiesDraftPath: string;
  readonly pendingReviewPath: string;
  readonly analysisMetaPath: string;
  readonly routeGraphPath?: string | undefined;
}

const serializeJsonArtifact = (artifact: unknown): string =>
  `${JSON.stringify(artifact, null, 2)}\n`;

export const resolveAgentLayerDirectory = (rootPath: string): string =>
  path.join(rootPath, AGENT_LAYER_DIRECTORY);

export const ensureAgentLayerDirectory = async (rootPath: string): Promise<string> => {
  const agentLayerDirectory = resolveAgentLayerDirectory(rootPath);
  await mkdir(agentLayerDirectory, { recursive: true });
  return agentLayerDirectory;
};

export const serializeCapabilitiesDraft = (
  capabilities: readonly Capability[],
  generatedAt: string,
): CapabilitiesArtifact => ({
  version: CAPABILITIES_ARTIFACT_VERSION,
  generatedAt,
  capabilities: [...capabilities],
});

export const serializeAnalysisMetaArtifact = (
  meta: AnalysisMeta,
  llmUsage?: LlmUsageStats,
): AnalysisMetaArtifact => ({
  version: ANALYSIS_META_ARTIFACT_VERSION,
  generatedAt: meta.generatedAt,
  framework: meta.framework,
  routeCount: meta.routeCount,
  capabilityCount: meta.capabilityCount,
  warningCount: meta.warningCount,
  llmCostUsd: meta.llmCostUsd,
  ...(llmUsage !== undefined ? { llm: llmUsage } : {}),
});

export const writeCapabilitiesDraft = async (
  rootPath: string,
  capabilities: readonly Capability[],
  generatedAt: string,
): Promise<string> => {
  const agentLayerDirectory = await ensureAgentLayerDirectory(rootPath);
  const artifact = serializeCapabilitiesDraft(capabilities, generatedAt);
  parseCapabilitiesArtifact(artifact);

  const artifactPath = path.join(agentLayerDirectory, CAPABILITIES_DRAFT_FILE);
  await writeFile(artifactPath, serializeJsonArtifact(artifact), "utf8");

  return artifactPath;
};

export const writePendingReviewArtifact = async (
  rootPath: string,
  pendingReview: PendingReviewArtifact,
): Promise<string> => {
  const agentLayerDirectory = await ensureAgentLayerDirectory(rootPath);
  const artifactPath = path.join(agentLayerDirectory, PENDING_REVIEW_FILE);

  await writeFile(artifactPath, serializeJsonArtifact(pendingReview), "utf8");

  return artifactPath;
};

export const writeAnalysisMetaArtifact = async (
  rootPath: string,
  meta: AnalysisMeta,
  llmUsage?: LlmUsageStats,
): Promise<string> => {
  const agentLayerDirectory = await ensureAgentLayerDirectory(rootPath);
  const artifact = serializeAnalysisMetaArtifact(meta, llmUsage);
  const artifactPath = path.join(agentLayerDirectory, ANALYSIS_META_FILE);

  await writeFile(artifactPath, serializeJsonArtifact(artifact), "utf8");

  return artifactPath;
};

export const writeAnalysisArtifacts = async (
  rootPath: string,
  artifacts: AnalysisArtifacts,
): Promise<WriteAnalysisArtifactsResult> => {
  const agentLayerDirectory = await ensureAgentLayerDirectory(rootPath);

  parseCapabilitiesArtifact(artifacts.capabilities);

  const capabilitiesDraftPath = path.join(agentLayerDirectory, CAPABILITIES_DRAFT_FILE);
  const pendingReviewPath = path.join(agentLayerDirectory, PENDING_REVIEW_FILE);
  const analysisMetaPath = path.join(agentLayerDirectory, ANALYSIS_META_FILE);

  await writeFile(
    capabilitiesDraftPath,
    serializeJsonArtifact(artifacts.capabilities),
    "utf8",
  );
  await writeFile(
    pendingReviewPath,
    serializeJsonArtifact(artifacts.pendingReview),
    "utf8",
  );
  await writeFile(
    analysisMetaPath,
    serializeJsonArtifact(artifacts.analysisMeta),
    "utf8",
  );

  let routeGraphPath: string | undefined;

  if (artifacts.routeGraph !== undefined) {
    routeGraphPath = path.join(agentLayerDirectory, ROUTE_GRAPH_FILE);
    await writeFile(
      routeGraphPath,
      serializeJsonArtifact(artifacts.routeGraph),
      "utf8",
    );
  }

  return {
    agentLayerDirectory,
    capabilitiesDraftPath,
    pendingReviewPath,
    analysisMetaPath,
    ...(routeGraphPath !== undefined ? { routeGraphPath } : {}),
  };
};
