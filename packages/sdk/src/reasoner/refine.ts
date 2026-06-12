import { LlmError } from "./llm/errors.js";
import type { LlmClient } from "./llm/client.js";
import type { CapabilityGroupResult, CapabilityGroupingResult } from "./prompts/grouping.v1.js";
import {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  REFINE_CONFIDENCE_PENALTY,
  REFINE_LOW_CONFIDENCE_THRESHOLD,
  refineResponseSchema,
  type PendingReviewArtifact,
  type PendingReviewEntry,
  type RefineCapabilityGroupsResult,
  type RefineGroupingInput,
  type RefineIssue,
  type RefineIssueCode,
  type RefinedCapabilityGroup,
} from "./prompts/refine.v1.js";

const CAPABILITY_REFINE_STAGE = "capability-refine";

const sortUnique = (values: readonly string[]): readonly string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const findDuplicateCapabilityIds = (
  groups: readonly CapabilityGroupResult[],
): readonly RefineIssue[] => {
  const seen = new Map<string, number>();
  const issues: RefineIssue[] = [];

  for (const group of groups) {
    const count = (seen.get(group.id) ?? 0) + 1;
    seen.set(group.id, count);

    if (count === 2) {
      issues.push({
        code: "duplicate_capability_id",
        message: `Duplicate capability ID: ${group.id}`,
        capabilityId: group.id,
      });
    }
  }

  return issues;
};

export const findOrphanRoutes = (
  routeIds: readonly string[],
  groups: readonly CapabilityGroupResult[],
  excludedRouteIds: readonly string[],
): readonly RefineIssue[] => {
  const excluded = new Set(excludedRouteIds);
  const assigned = new Set(groups.flatMap((group) => group.routeIds));
  const issues: RefineIssue[] = [];

  for (const routeId of routeIds) {
    if (excluded.has(routeId)) {
      continue;
    }

    if (!assigned.has(routeId)) {
      issues.push({
        code: "orphan_route",
        message: `Route is not assigned to any capability: ${routeId}`,
        routeId,
      });
    }
  }

  return issues;
};

export const findAuthConflicts = (
  groups: readonly CapabilityGroupResult[],
  routeRequiresAuth: ReadonlyMap<string, boolean>,
): readonly RefineIssue[] => {
  const issues: RefineIssue[] = [];

  for (const group of groups) {
    const routeAuthFlags = group.routeIds.map(
      (routeId) => routeRequiresAuth.get(routeId) ?? false,
    );
    const anyRequiresAuth = routeAuthFlags.some(Boolean);
    const allRequireAuth = routeAuthFlags.every(Boolean);

    if (group.requiresAuth && !anyRequiresAuth) {
      issues.push({
        code: "auth_conflict",
        message: `Capability ${group.id} requires auth but none of its routes do`,
        capabilityId: group.id,
      });
    }

    if (!group.requiresAuth && allRequireAuth && routeAuthFlags.length > 0) {
      issues.push({
        code: "auth_conflict",
        message: `Capability ${group.id} does not require auth but all routes do`,
        capabilityId: group.id,
      });
    }
  }

  return issues;
};

export const findLowConfidenceGroups = (
  groups: readonly CapabilityGroupResult[],
): readonly RefineIssue[] =>
  groups
    .filter((group) => group.lowConfidence)
    .map((group) => ({
      code: "low_confidence" as const,
      message: `Capability ${group.id} has grouping confidence below ${REFINE_LOW_CONFIDENCE_THRESHOLD}`,
      capabilityId: group.id,
    }));

export const runConsistencyChecks = (
  grouping: CapabilityGroupingResult,
  routeIds: readonly string[],
  routeRequiresAuth: ReadonlyMap<string, boolean>,
): readonly RefineIssue[] => [
  ...findDuplicateCapabilityIds(grouping.groups),
  ...findOrphanRoutes(routeIds, grouping.groups, grouping.excludedRouteIds),
  ...findAuthConflicts(grouping.groups, routeRequiresAuth),
  ...findLowConfidenceGroups(grouping.groups),
];

export const toRefinedGroups = (
  groups: readonly CapabilityGroupResult[],
  issues: readonly RefineIssue[],
): readonly RefinedCapabilityGroup[] => {
  const issueCountByCapability = new Map<string, number>();

  for (const issue of issues) {
    if (issue.capabilityId === undefined) {
      continue;
    }

    issueCountByCapability.set(
      issue.capabilityId,
      (issueCountByCapability.get(issue.capabilityId) ?? 0) + 1,
    );
  }

  return groups.map((group) => {
    const issueCount = issueCountByCapability.get(group.id) ?? 0;
    const refineFlags: string[] = [];

    if (group.lowConfidence) {
      refineFlags.push("low_confidence");
    }

    if (issueCount > 0) {
      refineFlags.push("consistency_issue");
    }

    const adjustedConfidence = Math.max(
      0,
      group.confidence - issueCount * REFINE_CONFIDENCE_PENALTY,
    );

    return {
      ...group,
      adjustedConfidence,
      refineFlags: [...refineFlags],
    };
  });
};

export const buildPendingReviewArtifact = (
  groups: readonly RefinedCapabilityGroup[],
  issues: readonly RefineIssue[],
  generatedAt: string = new Date().toISOString(),
): PendingReviewArtifact => {
  const issueCodesByCapability = new Map<string, Set<RefineIssueCode>>();

  for (const issue of issues) {
    if (issue.capabilityId === undefined) {
      continue;
    }

    const codes = issueCodesByCapability.get(issue.capabilityId) ?? new Set();
    codes.add(issue.code);
    issueCodesByCapability.set(issue.capabilityId, codes);
  }

  const entries: PendingReviewEntry[] = [];

  for (const group of groups) {
    const issueCodes = issueCodesByCapability.get(group.id);
    const reasons: string[] = [];
    const flags = [...group.refineFlags];

    if (group.adjustedConfidence < REFINE_LOW_CONFIDENCE_THRESHOLD) {
      reasons.push(
        `Adjusted confidence ${group.adjustedConfidence.toFixed(2)} is below ${REFINE_LOW_CONFIDENCE_THRESHOLD}`,
      );
      if (!flags.includes("low_confidence")) {
        flags.push("low_confidence");
      }
    }

    if (issueCodes !== undefined) {
      for (const code of issueCodes) {
        reasons.push(`Consistency issue: ${code}`);
      }
    }

    if (reasons.length === 0) {
      continue;
    }

    entries.push({
      capabilityId: group.id,
      reasons: sortUnique(reasons),
      confidence: group.adjustedConfidence,
      flags: sortUnique(flags),
    });
  }

  return {
    version: "1.0.0",
    generatedAt,
    entries: entries.sort((left, right) =>
      left.capabilityId.localeCompare(right.capabilityId),
    ),
  };
};

const assertRefineCoverage = (
  routeIds: readonly string[],
  excludedRouteIds: readonly string[],
  groups: readonly RefinedCapabilityGroup[],
): void => {
  const expectedRouteIds = new Set(
    routeIds.filter((routeId) => !excludedRouteIds.includes(routeId)),
  );
  const assignedRouteIds = new Set<string>();

  for (const group of groups) {
    for (const routeId of group.routeIds) {
      if (assignedRouteIds.has(routeId)) {
        throw new LlmError(
          `Capability refine assigned routeId to multiple groups: ${routeId}`,
          {
            code: "LLM_SCHEMA_VALIDATION_FAILED",
            context: { routeId },
          },
        );
      }

      assignedRouteIds.add(routeId);

      if (!expectedRouteIds.has(routeId)) {
        throw new LlmError(
          `Capability refine response includes unknown routeId: ${routeId}`,
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
      throw new LlmError(`Capability refine response missing routeId: ${routeId}`, {
        code: "LLM_SCHEMA_VALIDATION_FAILED",
        context: { routeId },
      });
    }
  }

  const capabilityIds = groups.map((group) => group.id);
  const uniqueCapabilityIds = new Set(capabilityIds);

  if (uniqueCapabilityIds.size !== capabilityIds.length) {
    throw new LlmError("Capability refine response contains duplicate capability IDs", {
      code: "LLM_SCHEMA_VALIDATION_FAILED",
    });
  }
};

export interface RefineCapabilityGroupsOptions {
  readonly temperature?: number | undefined;
  readonly generatedAt?: string | undefined;
}

export const refineCapabilityGroupsWithLlm = async (
  input: RefineGroupingInput,
  client: LlmClient,
  options: RefineCapabilityGroupsOptions = {},
): Promise<RefineCapabilityGroupsResult> => {
  const response = await client.completeJson({
    system: buildRefineSystemPrompt(),
    user: buildRefineUserPrompt(input),
    schema: refineResponseSchema,
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
  });

  assertRefineCoverage(input.routeIds, input.excludedRouteIds, response.groups);

  const pendingReview = buildPendingReviewArtifact(
    response.groups,
    input.issues,
    options.generatedAt,
  );

  return {
    groups: response.groups,
    issues: input.issues,
    pendingReview,
    resolvedIssueCodes: response.resolvedIssueCodes,
  };
};

export const refineCapabilityGroups = async (
  grouping: CapabilityGroupingResult,
  routeIds: readonly string[],
  routeRequiresAuth: ReadonlyMap<string, boolean>,
  domain: string,
  client: LlmClient,
  options: RefineCapabilityGroupsOptions = {},
): Promise<RefineCapabilityGroupsResult> => {
  const issues = runConsistencyChecks(grouping, routeIds, routeRequiresAuth);
  const refinedSeedGroups = toRefinedGroups(grouping.groups, issues);

  if (issues.length === 0) {
    return {
      groups: refinedSeedGroups,
      issues,
      pendingReview: buildPendingReviewArtifact(
        refinedSeedGroups,
        issues,
        options.generatedAt,
      ),
      resolvedIssueCodes: [],
    };
  }

  return refineCapabilityGroupsWithLlm(
    {
      domain,
      groups: refinedSeedGroups,
      issues,
      routeIds,
      excludedRouteIds: grouping.excludedRouteIds,
    },
    client,
    options,
  );
};

export {
  CAPABILITY_REFINE_STAGE,
  REFINE_CONFIDENCE_PENALTY,
  REFINE_LOW_CONFIDENCE_THRESHOLD,
};
