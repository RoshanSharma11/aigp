import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  ConfigError,
  createDefaultAgentLayerConfig,
  loadAgentLayerConfig,
  type AgentLayerConfig,
  type AnalysisMeta,
  type AnalysisResult,
  type Capability,
} from "@agent-layer/core";

import {
  buildRouteGraph,
  runStaticAnalysis,
  serializeRouteGraphArtifact,
} from "../analyzer/route-graph.js";
import { buildCapabilities } from "../builder/capability.js";
import { detectAdapter } from "../scanner/adapters/registry.js";
import { scanProject } from "../scanner/scanner.js";
import { classifyDomainFromRouteGraph } from "../reasoner/domain.js";
import { groupRouteCapabilities } from "../reasoner/grouping.js";
import { createLlmClientFromProvider } from "../reasoner/llm/factory.js";
import type { LlmProvider, LlmUsageStats } from "../reasoner/llm/types.js";
import { labelRouteIntents } from "../reasoner/intent.js";
import type { PendingReviewArtifact } from "../reasoner/prompts/refine.v1.js";
import { refineCapabilityGroups } from "../reasoner/refine.js";
import {
  serializeAnalysisMetaArtifact,
  serializeCapabilitiesDraft,
  writeAnalysisArtifacts,
  type WriteAnalysisArtifactsResult,
} from "../store/writer.js";
import { resolveAnalyzeLlmProvider } from "./resolve-llm-provider.js";

export interface FullAnalysisResult extends AnalysisResult {
  readonly pendingReview: PendingReviewArtifact;
  readonly artifactPaths?: WriteAnalysisArtifactsResult | undefined;
}

export interface RunFullAnalysisOptions {
  readonly config?: AgentLayerConfig | undefined;
  readonly llmProvider?: LlmProvider | undefined;
  readonly writeArtifacts?: boolean | undefined;
  readonly generatedAt?: string | undefined;
}

const readPackageName = async (rootPath: string): Promise<string> => {
  try {
    const packageJson = JSON.parse(
      await readFile(path.join(rootPath, "package.json"), "utf8"),
    ) as { readonly name?: string | undefined };

    return packageJson.name ?? "unknown";
  } catch {
    return "unknown";
  }
};

const resolveAnalysisConfig = async (
  rootPath: string,
  override?: AgentLayerConfig,
): Promise<AgentLayerConfig> => {
  if (override !== undefined) {
    return override;
  }

  try {
    return await loadAgentLayerConfig(rootPath);
  } catch (error) {
    if (error instanceof ConfigError && error.code === "CONFIG_NOT_FOUND") {
      return createDefaultAgentLayerConfig();
    }

    throw error;
  }
};

const sumLlmUsage = (usages: readonly LlmUsageStats[]): LlmUsageStats | undefined => {
  if (usages.length === 0) {
    return undefined;
  }

  const [first, ...rest] = usages;

  if (first === undefined) {
    return undefined;
  }

  return rest.reduce(
    (accumulator, usage) => ({
      provider: first.provider,
      model: first.model,
      promptTokens: accumulator.promptTokens + usage.promptTokens,
      completionTokens: accumulator.completionTokens + usage.completionTokens,
      totalTokens: accumulator.totalTokens + usage.totalTokens,
      costUsd: accumulator.costUsd + usage.costUsd,
      callCount: accumulator.callCount + usage.callCount,
    }),
    { ...first },
  );
};

const buildAnalysisMeta = (
  framework: AnalysisMeta["framework"],
  routeCount: number,
  capabilityCount: number,
  warningCount: number,
  llmCostUsd: number,
  generatedAt: string,
): AnalysisMeta => ({
  generatedAt,
  framework,
  routeCount,
  capabilityCount,
  warningCount,
  llmCostUsd,
});

export const runFullAnalysis = async (
  rootPath: string,
  options: RunFullAnalysisOptions = {},
): Promise<FullAnalysisResult> => {
  const resolvedRoot = path.resolve(rootPath);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const staticResult = await runStaticAnalysis(resolvedRoot);

  if (staticResult.routeGraph.length === 0) {
    return {
      ...staticResult,
      pendingReview: {
        version: "1.0.0",
        generatedAt,
        entries: [],
      },
    };
  }

  const config = await resolveAnalysisConfig(resolvedRoot, options.config);
  const resolvedProvider = await resolveAnalyzeLlmProvider(
    resolvedRoot,
    config,
    options.llmProvider,
  );
  const provider =
    resolvedProvider ??
    (await import("../reasoner/llm/factory.js")).createLlmProvider(config.llm);

  const createStageClient = (stage: string) =>
    createLlmClientFromProvider(provider, {
      model: config.llm.model,
      stage,
    });

  const domainClient = createStageClient("domain-classification");
  const intentClient = createStageClient("intent-labeling");
  const groupingClient = createStageClient("capability-grouping");
  const refineClient = createStageClient("capability-refine");

  const packageName = await readPackageName(resolvedRoot);
  const domain = await classifyDomainFromRouteGraph(
    staticResult.routeGraph,
    packageName,
    domainClient,
  );
  const intentResult = await labelRouteIntents(
    staticResult.routeGraph,
    domain.domain,
    intentClient,
  );
  const routeRequiresAuth = new Map(
    intentResult.labels.map((label) => [label.routeId, label.requiresAuth]),
  );
  const routeIds = staticResult.routeGraph.map((node) => node.route.id);

  const grouping = await groupRouteCapabilities(
    staticResult.routeGraph,
    intentResult.labels,
    domain,
    groupingClient,
  );
  const refineResult = await refineCapabilityGroups(
    grouping,
    routeIds,
    routeRequiresAuth,
    domain.domain,
    refineClient,
    { generatedAt },
  );
  const capabilities = buildCapabilities({
    routeGraph: staticResult.routeGraph,
    intentLabels: intentResult.labels,
    groups: refineResult.groups,
    pendingReview: refineResult.pendingReview,
  });

  const llmUsage = sumLlmUsage([
    domainClient.getUsage(),
    intentClient.getUsage(),
    groupingClient.getUsage(),
    refineClient.getUsage(),
  ]);

  const ctx = await scanProject(resolvedRoot);
  const adapter = await detectAdapter(resolvedRoot);
  const framework =
    adapter === null || ctx.framework === "unknown" ? "unknown" : ctx.framework;

  const meta = buildAnalysisMeta(
    framework,
    staticResult.routeGraph.length,
    capabilities.length,
    staticResult.warnings.length,
    llmUsage?.costUsd ?? 0,
    generatedAt,
  );

  let artifactPaths: WriteAnalysisArtifactsResult | undefined;

  if (options.writeArtifacts !== false) {
    artifactPaths = await writeAnalysisArtifacts(resolvedRoot, {
      capabilities: serializeCapabilitiesDraft(capabilities, generatedAt),
      pendingReview: refineResult.pendingReview,
      analysisMeta: serializeAnalysisMetaArtifact(meta, llmUsage),
      routeGraph: serializeRouteGraphArtifact(staticResult.routeGraph, generatedAt),
    });
  }

  return {
    routeGraph: staticResult.routeGraph,
    capabilities,
    warnings: staticResult.warnings,
    meta,
    pendingReview: refineResult.pendingReview,
    ...(artifactPaths !== undefined ? { artifactPaths } : {}),
  };
};

export const runStaticAnalysisWithArtifacts = async (
  rootPath: string,
  generatedAt: string = new Date().toISOString(),
): Promise<FullAnalysisResult> => {
  const resolvedRoot = path.resolve(rootPath);
  const staticResult = await runStaticAnalysis(resolvedRoot);
  const artifactPaths = await writeAnalysisArtifacts(resolvedRoot, {
    capabilities: serializeCapabilitiesDraft([], generatedAt),
    pendingReview: {
      version: "1.0.0",
      generatedAt,
      entries: [],
    },
    analysisMeta: serializeAnalysisMetaArtifact(staticResult.meta, undefined),
    routeGraph: serializeRouteGraphArtifact(staticResult.routeGraph, generatedAt),
  });

  return {
    ...staticResult,
    pendingReview: {
      version: "1.0.0",
      generatedAt,
      entries: [],
    },
    artifactPaths,
  };
};

export const buildRouteGraphOnly = buildRouteGraph;
