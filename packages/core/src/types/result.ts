import type { Capability } from "./capability.js";
import type { RouteGraphNode } from "./analysis.js";

export interface AnalysisWarning {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly route?: string;
}

export interface AnalysisMeta {
  readonly generatedAt: string;
  readonly framework: "nestjs" | "unknown";
  readonly routeCount: number;
  readonly capabilityCount: number;
  readonly warningCount: number;
  readonly llmCostUsd: number;
}

export interface AnalysisResult {
  readonly routeGraph: readonly RouteGraphNode[];
  readonly capabilities: readonly Capability[];
  readonly warnings: readonly AnalysisWarning[];
  readonly meta: AnalysisMeta;
}
