import type { RouteGraphNode, RiskLevel } from "@agent-layer/core";

import type { RouteIntentLabelResult } from "../reasoner/prompts/intent.v1.js";

export const CAPABILITY_CONFIDENCE_WEIGHTS = {
  route: 0.2,
  schema: 0.25,
  intent: 0.3,
  grouping: 0.25,
} as const;

export const CAPABILITY_HUMAN_REVIEW_THRESHOLD = 0.85;

export interface RouteConfidenceScores {
  readonly route: number;
  readonly schema: number;
  readonly intent: number;
}

export const scoreRouteAnalysis = (node: RouteGraphNode): number => {
  let score = 0.5;

  if (node.callChain.length > 0) {
    score += 0.2;
  }

  if (node.databaseEntities.length > 0) {
    score += 0.15;
  }

  if (node.sourceCode !== undefined && node.sourceCode.length > 0) {
    score += 0.15;
  }

  return Math.min(1, score);
};

export const scoreRouteSchema = (node: RouteGraphNode): number => {
  const hasRequest = node.requestSchema !== undefined;
  const hasResponse = node.responseSchema !== undefined;

  if (hasRequest && hasResponse) {
    return 1;
  }

  if (hasRequest || hasResponse) {
    return 0.65;
  }

  return 0.35;
};

export const scoreRouteIntent = (label: RouteIntentLabelResult): number =>
  label.confidence;

export const computeRouteConfidenceScores = (
  node: RouteGraphNode,
  label: RouteIntentLabelResult,
): RouteConfidenceScores => ({
  route: scoreRouteAnalysis(node),
  schema: scoreRouteSchema(node),
  intent: scoreRouteIntent(label),
});

const average = (values: readonly number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const computeCapabilityConfidence = (
  routeScores: readonly RouteConfidenceScores[],
  groupingConfidence: number,
): number => {
  if (routeScores.length === 0) {
    return Math.min(1, Math.max(0, groupingConfidence));
  }

  const weighted =
    CAPABILITY_CONFIDENCE_WEIGHTS.route * average(routeScores.map((score) => score.route)) +
    CAPABILITY_CONFIDENCE_WEIGHTS.schema * average(routeScores.map((score) => score.schema)) +
    CAPABILITY_CONFIDENCE_WEIGHTS.intent * average(routeScores.map((score) => score.intent)) +
    CAPABILITY_CONFIDENCE_WEIGHTS.grouping * groupingConfidence;

  return Math.round(Math.min(1, Math.max(0, weighted)) * 1000) / 1000;
};

export const shouldNeedHumanReview = (
  confidence: number,
  riskLevel: RiskLevel,
  isPendingReview: boolean,
): boolean =>
  confidence < CAPABILITY_HUMAN_REVIEW_THRESHOLD ||
  riskLevel === "high" ||
  isPendingReview;
