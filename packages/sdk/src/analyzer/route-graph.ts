import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  AnalysisMeta,
  AnalysisResult,
  AnalysisWarning,
  RouteGraphNode,
  ScanContext,
} from "@agent-layer/core";

import { detectAdapter } from "../scanner/adapters/registry.js";
import type { FrameworkAdapter } from "../scanner/adapters/types.js";
import { scanProject } from "../scanner/scanner.js";

export interface RouteGraphArtifact {
  readonly version: "1.0.0";
  readonly generatedAt: string;
  readonly routes: readonly RouteGraphNode[];
}

export interface BuildRouteGraphResult {
  readonly routeGraph: readonly RouteGraphNode[];
  readonly warnings: readonly AnalysisWarning[];
}

const isResolvableHandler = (
  callChainLength: number,
  sourceCode: string,
): boolean => callChainLength > 0 || sourceCode.length > 0;

const mergeDatabaseEntities = (
  typeEntities: readonly string[],
  callGraphEntities: readonly string[],
): readonly string[] => [...new Set([...typeEntities, ...callGraphEntities])];

export const buildRouteGraph = (
  ctx: ScanContext,
  adapter: FrameworkAdapter,
): BuildRouteGraphResult => {
  const rawRoutes = adapter.extractRoutes(ctx);
  const routeGraph: RouteGraphNode[] = [];
  const warnings: AnalysisWarning[] = [];

  for (const route of rawRoutes) {
    const callGraph = adapter.extractCallGraph(ctx, route);

    if (!isResolvableHandler(callGraph.callChain.length, callGraph.sourceCode)) {
      warnings.push({
        code: "UNRESOLVABLE_HANDLER",
        message: `Could not resolve handler ${route.handlerName} on ${route.controllerName}`,
        file: route.sourceLocation.filePath,
        route: `${route.method} ${route.path}`,
      });
      continue;
    }

    const typeInfo = adapter.extractTypes(ctx, route);
    const middleware = adapter.extractMiddleware(ctx, route);
    const databaseEntities = mergeDatabaseEntities(
      typeInfo.databaseEntities,
      callGraph.databaseEntities,
    );

    routeGraph.push({
      route,
      ...(typeInfo.request !== undefined
        ? { requestSchema: typeInfo.request.schema }
        : {}),
      ...(typeInfo.response !== undefined
        ? { responseSchema: typeInfo.response.schema }
        : {}),
      middleware,
      callChain: callGraph.callChain,
      databaseEntities,
      ...(callGraph.sourceCode.length > 0
        ? { sourceCode: callGraph.sourceCode }
        : {}),
    });
  }

  return {
    routeGraph,
    warnings,
  };
};

const buildAnalysisMeta = (
  framework: ScanContext["framework"],
  routeCount: number,
  warningCount: number,
): AnalysisMeta => ({
  generatedAt: new Date().toISOString(),
  framework,
  routeCount,
  capabilityCount: 0,
  warningCount,
  llmCostUsd: 0,
});

export const runStaticAnalysis = async (
  rootPath: string,
): Promise<AnalysisResult> => {
  const resolvedRoot = path.resolve(rootPath);
  const ctx = await scanProject(resolvedRoot);
  const adapter = await detectAdapter(resolvedRoot);

  if (adapter === null || ctx.framework === "unknown") {
    const warnings: AnalysisWarning[] = [
      {
        code: "FRAMEWORK_NOT_DETECTED",
        message: "No supported framework adapter detected for this project",
      },
    ];

    return {
      routeGraph: [],
      capabilities: [],
      warnings,
      meta: buildAnalysisMeta("unknown", 0, warnings.length),
    };
  }

  const { routeGraph, warnings } = buildRouteGraph(ctx, adapter);

  return {
    routeGraph,
    capabilities: [],
    warnings,
    meta: buildAnalysisMeta(ctx.framework, routeGraph.length, warnings.length),
  };
};

export const serializeRouteGraphArtifact = (
  routeGraph: readonly RouteGraphNode[],
  generatedAt: string,
): RouteGraphArtifact => ({
  version: "1.0.0",
  generatedAt,
  routes: routeGraph,
});

export const writeRouteGraphArtifact = async (
  rootPath: string,
  routeGraph: readonly RouteGraphNode[],
  generatedAt: string,
): Promise<string> => {
  const agentLayerDirectory = path.join(rootPath, ".agent-layer");
  await mkdir(agentLayerDirectory, { recursive: true });

  const artifactPath = path.join(agentLayerDirectory, "route-graph.json");
  const artifact = serializeRouteGraphArtifact(routeGraph, generatedAt);

  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  return artifactPath;
};

export const computeRouteRecall = (
  routeGraph: readonly RouteGraphNode[],
  expectedRoutes: readonly { readonly method: string; readonly path: string }[],
): number => {
  if (expectedRoutes.length === 0) {
    return 1;
  }

  const discoveredRoutes = new Set(
    routeGraph.map((node) => `${node.route.method} ${node.route.path}`),
  );

  const matchedCount = expectedRoutes.filter((expectedRoute) =>
    discoveredRoutes.has(`${expectedRoute.method} ${expectedRoute.path}`),
  ).length;

  return matchedCount / expectedRoutes.length;
};
