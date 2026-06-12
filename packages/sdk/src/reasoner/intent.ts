import type { RouteGraphNode } from "@agent-layer/core";

import { LlmError } from "./llm/errors.js";
import type { LlmClient } from "./llm/client.js";
import {
  buildIntentLabelingSystemPrompt,
  buildIntentLabelingUserPrompt,
  DEFAULT_INTENT_BATCH_SIZE,
  intentBatchResponseSchema,
  INTENT_LOW_CONFIDENCE_THRESHOLD,
  MAX_SOURCE_CODE_SNIPPET_LENGTH,
  type IntentLabelingBatchInput,
  type IntentLabelingResult,
  type IntentLabelingRouteInput,
  type RouteIntentLabel,
  type RouteIntentLabelResult,
} from "./prompts/intent.v1.js";

const INTENT_LABELING_STAGE = "intent-labeling";

export const truncateSourceCodeSnippet = (
  sourceCode: string | undefined,
  maxLength: number = MAX_SOURCE_CODE_SNIPPET_LENGTH,
): string | undefined => {
  if (sourceCode === undefined || sourceCode.length === 0) {
    return undefined;
  }

  if (sourceCode.length <= maxLength) {
    return sourceCode;
  }

  return `${sourceCode.slice(0, maxLength)}...`;
};

export const buildIntentLabelingRouteInput = (
  node: RouteGraphNode,
): IntentLabelingRouteInput => {
  const sourceCodeSnippet = truncateSourceCodeSnippet(node.sourceCode);

  return {
    routeId: node.route.id,
    method: node.route.method,
    path: node.route.path,
    handlerName: node.route.handlerName,
    controllerName: node.route.controllerName,
    databaseEntities: node.databaseEntities,
    middleware: node.middleware.map((entry) => entry.name),
    ...(sourceCodeSnippet !== undefined ? { sourceCodeSnippet } : {}),
  };
};

export const batchRoutesForIntentLabeling = <T>(
  routes: readonly T[],
  batchSize: number = DEFAULT_INTENT_BATCH_SIZE,
): readonly (readonly T[])[] => {
  const batches: T[][] = [];

  for (let index = 0; index < routes.length; index += batchSize) {
    batches.push(routes.slice(index, index + batchSize));
  }

  return batches;
};

const assertBatchLabelCoverage = (
  routes: readonly IntentLabelingRouteInput[],
  labels: readonly RouteIntentLabel[],
): void => {
  const expectedRouteIds = new Set(routes.map((route) => route.routeId));
  const returnedRouteIds = new Set(labels.map((label) => label.routeId));

  for (const routeId of expectedRouteIds) {
    if (!returnedRouteIds.has(routeId)) {
      throw new LlmError(`Intent labeling response missing routeId: ${routeId}`, {
        code: "LLM_SCHEMA_VALIDATION_FAILED",
        context: { routeId },
      });
    }
  }

  for (const label of labels) {
    if (!expectedRouteIds.has(label.routeId)) {
      throw new LlmError(
        `Intent labeling response includes unknown routeId: ${label.routeId}`,
        {
          code: "LLM_SCHEMA_VALIDATION_FAILED",
          context: { routeId: label.routeId },
        },
      );
    }
  }
};

export const annotateLowConfidenceLabels = (
  labels: readonly RouteIntentLabel[],
  threshold: number = INTENT_LOW_CONFIDENCE_THRESHOLD,
): IntentLabelingResult => {
  const annotated: RouteIntentLabelResult[] = labels.map((label) => ({
    ...label,
    lowConfidence: label.confidence < threshold,
  }));

  return {
    labels: annotated,
    lowConfidenceRouteIds: annotated
      .filter((label) => label.lowConfidence)
      .map((label) => label.routeId),
  };
};

export interface LabelIntentBatchOptions {
  readonly temperature?: number | undefined;
}

export const labelIntentBatch = async (
  input: IntentLabelingBatchInput,
  client: LlmClient,
  options: LabelIntentBatchOptions = {},
): Promise<readonly RouteIntentLabel[]> => {
  const response = await client.completeJson({
    system: buildIntentLabelingSystemPrompt(),
    user: buildIntentLabelingUserPrompt(input),
    schema: intentBatchResponseSchema,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
  });

  assertBatchLabelCoverage(input.routes, response.labels);

  return response.labels;
};

export interface LabelRouteIntentsOptions extends LabelIntentBatchOptions {
  readonly batchSize?: number | undefined;
}

export const labelRouteIntents = async (
  routeGraph: readonly RouteGraphNode[],
  domain: string,
  client: LlmClient,
  options: LabelRouteIntentsOptions = {},
): Promise<IntentLabelingResult> => {
  const batchSize = options.batchSize ?? DEFAULT_INTENT_BATCH_SIZE;
  const routeInputs = routeGraph.map(buildIntentLabelingRouteInput);
  const batches = batchRoutesForIntentLabeling(routeInputs, batchSize);
  const labels: RouteIntentLabel[] = [];

  for (const batch of batches) {
    const batchLabels = await labelIntentBatch(
      { domain, routes: batch },
      client,
      options,
    );
    labels.push(...batchLabels);
  }

  return annotateLowConfidenceLabels(labels);
};

export { INTENT_LABELING_STAGE };
