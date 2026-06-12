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
  runStaticAnalysisWithArtifacts,
  type AnalyzeCommandHooks,
  type AnalyzeCommandOptions,
  type AnalyzeCommandResult,
} from "./cli/analyze.js";
export { runCliAsync } from "./cli/index.js";
export {
  createEcommerceFixtureMockProvider,
  ECOMMERCE_DOMAIN_CLASSIFICATION,
  buildEcommerceMockGroupingResponse,
  buildEcommerceMockGroupingRoutes,
} from "./analyze/ecommerce-fixture-mock.js";
export {
  runFullAnalysis,
  runStaticAnalysisWithArtifacts as runStaticAnalysisArtifacts,
  type FullAnalysisResult,
  type RunFullAnalysisOptions,
} from "./analyze/pipeline.js";
export {
  CAPABILITY_COUNT_RATIO_GATE,
  CAPABILITY_HINT_ALIASES,
  CAPABILITY_PRECISION_GATE,
  evaluateCapabilityPrecision,
  formatCapabilityEvalReport,
  loadGroundTruth,
  normalizeCapabilityHint,
  resolveGroundTruthPath,
  type CapabilityEvalReport,
  type GroundTruthDocument,
  type GroundTruthRoute,
} from "./eval/precision.js";
export {
  AGENT_LAYER_DIRECTORY,
  ANALYSIS_META_ARTIFACT_VERSION,
  ANALYSIS_META_FILE,
  CAPABILITIES_ARTIFACT_VERSION,
  CAPABILITIES_DRAFT_FILE,
  ensureAgentLayerDirectory,
  PENDING_REVIEW_FILE,
  resolveAgentLayerDirectory,
  ROUTE_GRAPH_FILE,
  serializeAnalysisMetaArtifact,
  serializeCapabilitiesDraft,
  writeAnalysisArtifacts,
  writeAnalysisMetaArtifact,
  writeCapabilitiesDraft,
  writePendingReviewArtifact,
  type AnalysisArtifacts,
  type AnalysisMetaArtifact,
  type WriteAnalysisArtifactsResult,
} from "./store/writer.js";
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
export {
  annotateLowConfidenceLabels,
  batchRoutesForIntentLabeling,
  buildIntentLabelingRouteInput,
  INTENT_LABELING_STAGE,
  labelIntentBatch,
  labelRouteIntents,
  truncateSourceCodeSnippet,
  type LabelIntentBatchOptions,
  type LabelRouteIntentsOptions,
} from "./reasoner/intent.js";
export {
  buildIntentLabelingSystemPrompt,
  buildIntentLabelingUserPrompt,
  DEFAULT_INTENT_BATCH_SIZE,
  INTENT_LOW_CONFIDENCE_THRESHOLD,
  INTENT_PROMPT_VERSION,
  intentBatchResponseSchema,
  MAX_SOURCE_CODE_SNIPPET_LENGTH,
  routeIntentLabelSchema,
  type IntentBatchResponse,
  type IntentLabelingBatchInput,
  type IntentLabelingResult,
  type IntentLabelingRouteInput,
  type RouteIntentLabel,
  type RouteIntentLabelResult,
} from "./reasoner/prompts/intent.v1.js";
export {
  annotateLowConfidenceGroups,
  buildCapabilityGroupingInput,
  buildGroupingRouteInput,
  buildPreClusters,
  CAPABILITY_GROUPING_STAGE,
  detectWorkflowPrerequisites,
  groupCapabilitiesWithLlm,
  groupRouteCapabilities,
  inferRouteEntityKey,
  inferSuggestedCategory,
  isAuthCapabilityGroup,
  isUtilityRoute,
  normalizeEntityKey,
  partitionUtilityRoutes,
  type GroupCapabilitiesOptions,
} from "./reasoner/grouping.js";
export {
  buildCapabilityGroupingSystemPrompt,
  buildCapabilityGroupingUserPrompt,
  capabilityGroupSchema,
  GROUPING_LOW_CONFIDENCE_THRESHOLD,
  GROUPING_PROMPT_VERSION,
  groupingResponseSchema,
  type CapabilityGroup,
  type CapabilityGroupingInput,
  type CapabilityGroupingResult,
  type CapabilityGroupResult,
  type GroupingRouteInput,
  type PreClusterSeed,
} from "./reasoner/prompts/grouping.v1.js";
export {
  buildPendingReviewArtifact,
  CAPABILITY_REFINE_STAGE,
  findAuthConflicts,
  findDuplicateCapabilityIds,
  findLowConfidenceGroups,
  findOrphanRoutes,
  refineCapabilityGroups,
  refineCapabilityGroupsWithLlm,
  runConsistencyChecks,
  toRefinedGroups,
  type RefineCapabilityGroupsOptions,
} from "./reasoner/refine.js";
export {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  REFINE_CONFIDENCE_PENALTY,
  REFINE_LOW_CONFIDENCE_THRESHOLD,
  REFINE_PROMPT_VERSION,
  refineIssueCodeSchema,
  refineResponseSchema,
  refinedCapabilityGroupSchema,
  type PendingReviewArtifact,
  type PendingReviewEntry,
  type RefineCapabilityGroupsResult,
  type RefineGroupingInput,
  type RefineIssue,
  type RefineIssueCode,
  type RefineResponse,
  type RefinedCapabilityGroup,
} from "./reasoner/prompts/refine.v1.js";
export {
  aggregateCapabilitySideEffects,
  aggregateRiskLevel,
  buildCapabilities,
  buildCapabilityFromGroup,
  buildCapabilityOperation,
  DEFAULT_JSON_SCHEMA,
  formatSourceRoute,
  isCapabilityReversible,
  isConfirmationRequired,
  resolveInputSchema,
  resolveOutputSchema,
  selectDefaultOperation,
  type BuildCapabilitiesInput,
} from "./builder/capability.js";
export {
  CAPABILITY_CONFIDENCE_WEIGHTS,
  CAPABILITY_HUMAN_REVIEW_THRESHOLD,
  computeCapabilityConfidence,
  computeRouteConfidenceScores,
  scoreRouteAnalysis,
  scoreRouteSchema,
  scoreRouteIntent,
  shouldNeedHumanReview,
  type RouteConfidenceScores,
} from "./builder/confidence.js";
