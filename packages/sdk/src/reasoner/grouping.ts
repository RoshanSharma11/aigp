import type { RouteGraphNode } from "@agent-layer/core";

import { LlmError } from "./llm/errors.js";
import type { LlmClient } from "./llm/client.js";
import type { DomainClassificationResult } from "./prompts/domain.v1.js";
import type { RouteIntentLabelResult } from "./prompts/intent.v1.js";
import {
  buildCapabilityGroupingSystemPrompt,
  buildCapabilityGroupingUserPrompt,
  GROUPING_LOW_CONFIDENCE_THRESHOLD,
  groupingResponseSchema,
  type CapabilityGroup,
  type CapabilityGroupingInput,
  type CapabilityGroupingResult,
  type CapabilityGroupResult,
  type GroupingRouteInput,
  type PreClusterSeed,
} from "./prompts/grouping.v1.js";

const CAPABILITY_GROUPING_STAGE = "capability-grouping";

const UTILITY_ROUTE_PATTERNS = [
  /\/health(?:z)?(?:\/|$)/i,
  /\/ready(?:z)?(?:\/|$)/i,
  /\/live(?:z)?(?:\/|$)/i,
  /\/metrics(?:\/|$)/i,
  /\/webhooks?(?:\/|$)/i,
  /\/ping(?:\/|$)/i,
  /\/status(?:\/|$)/i,
] as const;

const UTILITY_HANDLER_PATTERNS = [
  /^health(?:Check|z)?$/i,
  /^getMetrics$/i,
  /^metrics$/i,
  /^ping$/i,
  /^readiness(?:Check)?$/i,
  /^liveness(?:Check)?$/i,
] as const;

const AUTH_PATH_PATTERN = /\/auth(?:\/|$)/i;
const AUTH_ENTITY_SUFFIX = "SessionEntity";

const sortUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const isUtilityRoute = (
  path: string,
  handlerName: string,
): boolean =>
  UTILITY_ROUTE_PATTERNS.some((pattern) => pattern.test(path)) ||
  UTILITY_HANDLER_PATTERNS.some((pattern) => pattern.test(handlerName));

export const normalizeEntityKey = (entityName: string): string =>
  entityName
    .replace(/Entity$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();

export const inferRouteEntityKey = (
  node: RouteGraphNode,
): string => {
  const primaryEntity = node.databaseEntities[0];

  if (primaryEntity !== undefined) {
    return normalizeEntityKey(primaryEntity);
  }

  const segments = node.route.path.split("/").filter((segment) => segment.length > 0);

  if (segments.length >= 2) {
    return segments[1]!.replace(/[:]/g, "").toLowerCase();
  }

  if (segments.length === 1) {
    return segments[0]!.replace(/[:]/g, "").toLowerCase();
  }

  return "misc";
};

export const inferSuggestedCategory = (
  entityKey: string,
  routePath: string,
  suggestedCategories: readonly string[],
): string => {
  if (AUTH_PATH_PATTERN.test(routePath) || entityKey.includes("session")) {
    const authCategory = suggestedCategories.find((category) =>
      /auth|account|access|login/i.test(category),
    );
    return authCategory ?? "auth";
  }

  if (/product|catalog|item|inventory/i.test(entityKey)) {
    const catalogCategory = suggestedCategories.find((category) =>
      /catalog|product/i.test(category),
    );
    return catalogCategory ?? "catalog";
  }

  if (/cart|order|checkout/i.test(entityKey)) {
    const cartCategory = suggestedCategories.find((category) =>
      /cart|order|checkout/i.test(category),
    );
    return cartCategory ?? "cart";
  }

  return suggestedCategories[0] ?? "general";
};

export const buildPreClusters = (
  routes: readonly GroupingRouteInput[],
  suggestedCategories: readonly string[],
): readonly PreClusterSeed[] => {
  const clusters = new Map<string, PreClusterSeed>();

  for (const route of routes) {
    const entityKey = inferRouteEntityKeyFromInput(route);
    const seedId = `${entityKey}_cluster`;
    const existing = clusters.get(seedId);

    if (existing !== undefined) {
      clusters.set(seedId, {
        ...existing,
        routeIds: sortUnique([...existing.routeIds, route.routeId]),
      });
      continue;
    }

    clusters.set(seedId, {
      seedId,
      entityKey,
      routeIds: [route.routeId],
      suggestedCategory: inferSuggestedCategory(
        entityKey,
        route.path,
        suggestedCategories,
      ),
    });
  }

  return [...clusters.values()].sort((left, right) =>
    left.seedId.localeCompare(right.seedId),
  );
};

const inferRouteEntityKeyFromInput = (route: GroupingRouteInput): string => {
  const primaryEntity = route.databaseEntities[0];

  if (primaryEntity !== undefined) {
    return normalizeEntityKey(primaryEntity);
  }

  const segments = route.path.split("/").filter((segment) => segment.length > 0);

  if (segments.length >= 2) {
    return segments[1]!.replace(/[:]/g, "").toLowerCase();
  }

  if (segments.length === 1) {
    return segments[0]!.replace(/[:]/g, "").toLowerCase();
  }

  return "misc";
};

export const buildGroupingRouteInput = (
  node: RouteGraphNode,
  label: RouteIntentLabelResult,
): GroupingRouteInput => ({
  routeId: node.route.id,
  method: node.route.method,
  path: node.route.path,
  intent: label.intent,
  description: label.description,
  databaseEntities: node.databaseEntities,
  requiresAuth: label.requiresAuth,
  riskLevel: label.riskLevel,
  confidence: label.confidence,
});

export const partitionUtilityRoutes = (
  routeGraph: readonly RouteGraphNode[],
): {
  readonly activeRoutes: readonly RouteGraphNode[];
  readonly excludedRouteIds: readonly string[];
} => {
  const activeRoutes: RouteGraphNode[] = [];
  const excludedRouteIds: string[] = [];

  for (const node of routeGraph) {
    if (isUtilityRoute(node.route.path, node.route.handlerName)) {
      excludedRouteIds.push(node.route.id);
      continue;
    }

    activeRoutes.push(node);
  }

  return {
    activeRoutes,
    excludedRouteIds: sortUnique(excludedRouteIds),
  };
};

export const buildCapabilityGroupingInput = (
  routes: readonly GroupingRouteInput[],
  domain: DomainClassificationResult,
): CapabilityGroupingInput => ({
  domain: domain.domain,
  suggestedCategories: domain.suggestedCategories,
  routes,
  preClusters: buildPreClusters(routes, domain.suggestedCategories),
});

export const isAuthCapabilityGroup = (
  group: CapabilityGroup,
  routePathById: ReadonlyMap<string, string>,
): boolean => {
  if (
    group.category.toLowerCase().includes("auth") ||
    group.id.includes("auth") ||
    group.id.includes("account") ||
    group.id.includes("login")
  ) {
    return true;
  }

  return group.routeIds.some((routeId) => {
    const path = routePathById.get(routeId);
    return path !== undefined && AUTH_PATH_PATTERN.test(path);
  });
};

export const detectWorkflowPrerequisites = (
  groups: readonly CapabilityGroup[],
  routes: readonly GroupingRouteInput[],
): readonly CapabilityGroup[] => {
  const routePathById = new Map(routes.map((route) => [route.routeId, route.path]));
  const authCapabilityIds = groups
    .filter((group) => isAuthCapabilityGroup(group, routePathById))
    .map((group) => group.id);

  const loginCapabilityId =
    authCapabilityIds.find((id) => id.includes("login") || id.includes("auth")) ??
    authCapabilityIds[0];

  if (loginCapabilityId === undefined) {
    return groups;
  }

  return groups.map((group) => {
    if (!group.requiresAuth || group.id === loginCapabilityId) {
      return group;
    }

    const prerequisites = [...(group.prerequisites ?? []), loginCapabilityId].sort(
      (left, right) => left.localeCompare(right),
    );

    return {
      ...group,
      prerequisites: [...new Set(prerequisites)],
    };
  });
};

const assertGroupingCoverage = (
  routeIds: readonly string[],
  groups: readonly CapabilityGroup[],
): void => {
  const expectedRouteIds = new Set(routeIds);
  const assignedRouteIds = new Set<string>();

  for (const group of groups) {
    for (const routeId of group.routeIds) {
      if (assignedRouteIds.has(routeId)) {
        throw new LlmError(
          `Capability grouping assigned routeId to multiple groups: ${routeId}`,
          {
            code: "LLM_SCHEMA_VALIDATION_FAILED",
            context: { routeId },
          },
        );
      }

      assignedRouteIds.add(routeId);

      if (!expectedRouteIds.has(routeId)) {
        throw new LlmError(
          `Capability grouping response includes unknown routeId: ${routeId}`,
          {
            code: "LLM_SCHEMA_VALIDATION_FAILED",
            context: { routeId },
          },
        );
      }
    }
  }

  for (const routeId of expectedRouteIds) {
    if (!assignedRouteIds.has(routeId)) {
      throw new LlmError(
        `Capability grouping response missing routeId: ${routeId}`,
        {
          code: "LLM_SCHEMA_VALIDATION_FAILED",
          context: { routeId },
        },
      );
    }
  }
};

export const annotateLowConfidenceGroups = (
  groups: readonly CapabilityGroup[],
  threshold: number = GROUPING_LOW_CONFIDENCE_THRESHOLD,
): CapabilityGroupingResult => {
  const annotated: CapabilityGroupResult[] = groups.map((group) => ({
    ...group,
    lowConfidence: group.confidence < threshold,
  }));

  return {
    groups: annotated,
    excludedRouteIds: [],
    lowConfidenceGroupIds: annotated
      .filter((group) => group.lowConfidence)
      .map((group) => group.id),
  };
};

export interface GroupCapabilitiesOptions {
  readonly temperature?: number | undefined;
}

const GROUPING_COVERAGE_MAX_RETRIES = 2;

export const groupCapabilitiesWithLlm = async (
  input: CapabilityGroupingInput,
  client: LlmClient,
  options: GroupCapabilitiesOptions = {},
): Promise<readonly CapabilityGroup[]> => {
  const maxAttempts = GROUPING_COVERAGE_MAX_RETRIES + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await client.completeJson({
        system: buildCapabilityGroupingSystemPrompt(),
        user: buildCapabilityGroupingUserPrompt(input),
        schema: groupingResponseSchema,
        ...(options.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
      });

      assertGroupingCoverage(
        input.routes.map((route) => route.routeId),
        response.groups,
      );

      return detectWorkflowPrerequisites(response.groups, input.routes);
    } catch (error) {
      lastError = error;

      const isCoverageError =
        error instanceof LlmError &&
        error.code === "LLM_SCHEMA_VALIDATION_FAILED" &&
        error.message.includes("Capability grouping response missing routeId");

      const canRetry = attempt < maxAttempts - 1 && isCoverageError;
      if (!canRetry) {
        throw error;
      }
    }
  }

  throw lastError;
};

export const groupRouteCapabilities = async (
  routeGraph: readonly RouteGraphNode[],
  intentLabels: readonly RouteIntentLabelResult[],
  domain: DomainClassificationResult,
  client: LlmClient,
  options: GroupCapabilitiesOptions = {},
): Promise<CapabilityGroupingResult> => {
  const labelByRouteId = new Map(
    intentLabels.map((label) => [label.routeId, label]),
  );
  const { activeRoutes, excludedRouteIds } = partitionUtilityRoutes(routeGraph);

  const routes = activeRoutes.map((node) => {
    const label = labelByRouteId.get(node.route.id);

    if (label === undefined) {
      throw new LlmError(
        `Missing intent label for routeId: ${node.route.id}`,
        {
          code: "LLM_SCHEMA_VALIDATION_FAILED",
          context: { routeId: node.route.id },
        },
      );
    }

    return buildGroupingRouteInput(node, label);
  });

  const input = buildCapabilityGroupingInput(routes, domain);
  const groups = await groupCapabilitiesWithLlm(input, client, options);
  const annotated = annotateLowConfidenceGroups(groups);

  return {
    ...annotated,
    excludedRouteIds,
  };
};

export {
  AUTH_ENTITY_SUFFIX,
  AUTH_PATH_PATTERN,
  CAPABILITY_GROUPING_STAGE,
  GROUPING_LOW_CONFIDENCE_THRESHOLD,
};
