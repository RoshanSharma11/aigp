export interface SdkModuleMarker {
  readonly name: "@agent-layer/sdk";
}

export const SDK_MODULE_MARKER: SdkModuleMarker = {
  name: "@agent-layer/sdk",
};

export type { FrameworkAdapter, FrameworkName } from "./scanner/adapters/types.js";
export { nestJsFrameworkAdapter } from "./scanner/adapters/nestjs.adapter.js";
export {
  detectAdapter,
  getRegisteredAdapters,
} from "./scanner/adapters/registry.js";
export {
  detectFramework,
  type DetectedFramework,
} from "./scanner/detector.js";
export { scanProject } from "./scanner/scanner.js";
export {
  buildFileGraph,
  classifyProjectFiles,
  listProjectSourceFiles,
  scanProjectFiles,
} from "./scanner/file-graph.js";
export {
  resolvePathAlias,
  resolveTsConfig,
  type TsConfigResolution,
} from "./scanner/tsconfig.js";
export {
  extractNestJsRoutes,
  extractNestJsMiddleware,
} from "./analyzer/tree-sitter/nestjs.js";
export { extractNestJsRouteTypes } from "./analyzer/types/nestjs.js";
export { extractNestJsCallGraph } from "./analyzer/call-graph/nestjs.js";
export {
  buildRouteGraph,
  computeRouteRecall,
  runStaticAnalysis,
  serializeRouteGraphArtifact,
  writeRouteGraphArtifact,
  type BuildRouteGraphResult,
  type RouteGraphArtifact,
} from "./analyzer/route-graph.js";
export {
  parseAnalyzeCommandOptions,
  runAnalyzeCommand,
  type AnalyzeCommandOptions,
  type AnalyzeCommandResult,
} from "./cli/analyze.js";
export { runCliAsync } from "./cli/index.js";
