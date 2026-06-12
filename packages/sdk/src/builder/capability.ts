import {
  capabilitySchema,
  type Capability,
  type CapabilityOperation,
  type CapabilitySideEffects,
  type JsonSchema,
  type RiskLevel,
  type RouteGraphNode,
} from "@agent-layer/core";

import {
  computeCapabilityConfidence,
  computeRouteConfidenceScores,
  shouldNeedHumanReview,
} from "./confidence.js";
import type { RouteIntentLabelResult } from "../reasoner/prompts/intent.v1.js";
import type {
  PendingReviewArtifact,
  RefinedCapabilityGroup,
} from "../reasoner/prompts/refine.v1.js";

export const DEFAULT_JSON_SCHEMA: JsonSchema = {
  type: "object",
};

const sortUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const RISK_LEVEL_RANK: Readonly<Record<RiskLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

export interface BuildCapabilitiesInput {
  readonly routeGraph: readonly RouteGraphNode[];
  readonly intentLabels: readonly RouteIntentLabelResult[];
  readonly groups: readonly RefinedCapabilityGroup[];
  readonly pendingReview?: PendingReviewArtifact | undefined;
}

export const formatSourceRoute = (method: string, path: string): string =>
  `${method} ${path}`;

export const resolveInputSchema = (node: RouteGraphNode): JsonSchema =>
  node.requestSchema ?? DEFAULT_JSON_SCHEMA;

export const resolveOutputSchema = (node: RouteGraphNode): JsonSchema =>
  node.responseSchema ?? DEFAULT_JSON_SCHEMA;

export const buildCapabilityOperation = (
  node: RouteGraphNode,
  label: RouteIntentLabelResult,
): CapabilityOperation => ({
  id: label.intent,
  description: label.description,
  httpMethod: node.route.method,
  httpPath: node.route.path,
  inputSchema: resolveInputSchema(node),
  outputSchema: resolveOutputSchema(node),
  sideEffects: label.sideEffects,
});

export const aggregateCapabilitySideEffects = (
  operationSideEffects: readonly CapabilityOperation["sideEffects"][],
): CapabilitySideEffects => {
  const kinds = new Set(operationSideEffects);

  if (kinds.size === 1) {
    const only = [...kinds][0]!;

    return only;
  }

  return "transactional";
};

export const aggregateRiskLevel = (
  riskLevels: readonly RiskLevel[],
): RiskLevel => {
  let highest: RiskLevel = "low";

  for (const riskLevel of riskLevels) {
    if (RISK_LEVEL_RANK[riskLevel] > RISK_LEVEL_RANK[highest]) {
      highest = riskLevel;
    }
  }

  return highest;
};

export const selectDefaultOperation = (
  operations: readonly CapabilityOperation[],
): string => {
  const readOperation = operations.find((operation) => operation.sideEffects === "read");

  if (readOperation !== undefined) {
    return readOperation.id;
  }

  const sorted = [...operations].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  const first = sorted[0];

  if (first === undefined) {
    throw new Error("Cannot select default operation from an empty operation list");
  }

  return first.id;
};

export const isCapabilityReversible = (
  operations: readonly CapabilityOperation[],
  riskLevel: RiskLevel,
): boolean =>
  riskLevel !== "high" &&
  !operations.some((operation) => operation.sideEffects === "delete");

export const isConfirmationRequired = (
  operations: readonly CapabilityOperation[],
  riskLevel: RiskLevel,
): boolean =>
  riskLevel === "high" ||
  operations.some((operation) => operation.sideEffects === "delete");

const buildFollowedByMap = (
  groups: readonly RefinedCapabilityGroup[],
): ReadonlyMap<string, readonly string[]> => {
  const followedBy = new Map<string, Set<string>>();

  for (const group of groups) {
    for (const prerequisiteId of group.prerequisites ?? []) {
      const followers = followedBy.get(prerequisiteId) ?? new Set<string>();
      followers.add(group.id);
      followedBy.set(prerequisiteId, followers);
    }
  }

  return new Map(
    [...followedBy.entries()].map(([capabilityId, followers]) => [
      capabilityId,
      sortUnique([...followers]),
    ]),
  );
};

const buildRouteGraphMap = (
  routeGraph: readonly RouteGraphNode[],
): ReadonlyMap<string, RouteGraphNode> =>
  new Map(routeGraph.map((node) => [node.route.id, node]));

const buildIntentLabelMap = (
  intentLabels: readonly RouteIntentLabelResult[],
): ReadonlyMap<string, RouteIntentLabelResult> =>
  new Map(intentLabels.map((label) => [label.routeId, label]));

const buildPendingReviewMap = (
  pendingReview: PendingReviewArtifact | undefined,
): ReadonlyMap<string, true> =>
  new Map(
    (pendingReview?.entries ?? []).map((entry) => [entry.capabilityId, true] as const),
  );

export const buildCapabilityFromGroup = (
  group: RefinedCapabilityGroup,
  routeGraphById: ReadonlyMap<string, RouteGraphNode>,
  intentLabelByRouteId: ReadonlyMap<string, RouteIntentLabelResult>,
  followedByByCapabilityId: ReadonlyMap<string, readonly string[]>,
  isPendingReview: boolean,
): Capability => {
  const operations: CapabilityOperation[] = [];
  const routeConfidenceScores = [];
  const riskLevels: RiskLevel[] = [];
  const sourceRoutes: string[] = [];

  for (const routeId of group.routeIds) {
    const node = routeGraphById.get(routeId);
    const label = intentLabelByRouteId.get(routeId);

    if (node === undefined) {
      throw new Error(`RouteGraph is missing routeId referenced by capability group: ${routeId}`);
    }

    if (label === undefined) {
      throw new Error(`Intent labels are missing routeId referenced by capability group: ${routeId}`);
    }

    operations.push(buildCapabilityOperation(node, label));
    routeConfidenceScores.push(computeRouteConfidenceScores(node, label));
    riskLevels.push(label.riskLevel);
    sourceRoutes.push(formatSourceRoute(node.route.method, node.route.path));
  }

  const sortedOperations = [...operations].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const defaultOperation = selectDefaultOperation(sortedOperations);
  const defaultOperationEntry = sortedOperations.find(
    (operation) => operation.id === defaultOperation,
  );

  if (defaultOperationEntry === undefined) {
    throw new Error(`Default operation ${defaultOperation} is missing from capability ${group.id}`);
  }

  const riskLevel = aggregateRiskLevel(riskLevels);
  const confidence = computeCapabilityConfidence(
    routeConfidenceScores,
    group.adjustedConfidence,
  );
  const followedBy = followedByByCapabilityId.get(group.id);

  const capability = {
    id: group.id,
    name: group.name,
    description: group.description,
    category: group.category,
    operations: sortedOperations,
    defaultOperation,
    inputSchema: defaultOperationEntry.inputSchema,
    outputSchema: defaultOperationEntry.outputSchema,
    sideEffects: aggregateCapabilitySideEffects(
      sortedOperations.map((operation) => operation.sideEffects),
    ),
    requiresAuth: group.requiresAuth,
    ...(group.prerequisites !== undefined && group.prerequisites.length > 0
      ? { prerequisites: sortUnique(group.prerequisites) }
      : {}),
    ...(followedBy !== undefined && followedBy.length > 0 ? { followedBy } : {}),
    reversible: isCapabilityReversible(sortedOperations, riskLevel),
    confirmationRequired: isConfirmationRequired(sortedOperations, riskLevel),
    riskLevel,
    confidence,
    needsHumanReview: shouldNeedHumanReview(confidence, riskLevel, isPendingReview),
    sourceRoutes: sortUnique(sourceRoutes),
    status: "draft" as const,
  };

  return capabilitySchema.parse(capability) as Capability;
};

export const buildCapabilities = (input: BuildCapabilitiesInput): Capability[] => {
  const routeGraphById = buildRouteGraphMap(input.routeGraph);
  const intentLabelByRouteId = buildIntentLabelMap(input.intentLabels);
  const pendingReviewByCapabilityId = buildPendingReviewMap(input.pendingReview);
  const followedByByCapabilityId = buildFollowedByMap(input.groups);

  return [...input.groups]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((group) =>
      buildCapabilityFromGroup(
        group,
        routeGraphById,
        intentLabelByRouteId,
        followedByByCapabilityId,
        pendingReviewByCapabilityId.has(group.id),
      ),
    );
};
