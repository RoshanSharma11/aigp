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
export {
  DEFAULT_LLM_MAX_RETRIES,
  DEFAULT_LLM_RETRY_BACKOFF_MS,
  DEFAULT_LLM_TIMEOUT_MS,
  LlmClient,
} from "./reasoner/llm/client.js";
export { LlmError } from "./reasoner/llm/errors.js";
export {
  createLlmClient,
  createLlmClientFromProvider,
  createLlmProvider,
} from "./reasoner/llm/factory.js";
export { extractJsonContent, parseJsonContent } from "./reasoner/llm/json.js";
export {
  AnthropicLlmProvider,
  type AnthropicLlmProviderOptions,
} from "./reasoner/llm/anthropic-provider.js";
export {
  MockLlmProvider,
  type MockLlmResponseFactory,
} from "./reasoner/llm/mock-provider.js";
export {
  OpenAiLlmProvider,
  type OpenAiLlmProviderOptions,
} from "./reasoner/llm/openai-provider.js";
export {
  estimateLlmCostUsd,
  LlmUsageTracker,
} from "./reasoner/llm/usage.js";
export type {
  LlmClientOptions,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmJsonRequest,
  LlmMessage,
  LlmProvider,
  LlmTokenUsage,
  LlmUsageStats,
} from "./reasoner/llm/types.js";
export {
  buildDomainClassificationInput,
  classifyDomain,
  classifyDomainFromRouteGraph,
  DOMAIN_CLASSIFICATION_STAGE,
  extractEntityNames,
  extractRoutePrefixes,
  type ClassifyDomainOptions,
} from "./reasoner/domain.js";
export {
  buildDomainClassificationSystemPrompt,
  buildDomainClassificationUserPrompt,
  DOMAIN_PROMPT_VERSION,
  domainClassificationSchema,
  type DomainClassificationInput,
  type DomainClassificationResult,
} from "./reasoner/prompts/domain.v1.js";
