import { z } from "zod";

import { capabilityGroupSchema } from "./grouping.v1.js";

export const REFINE_PROMPT_VERSION = "v1" as const;
export const REFINE_LOW_CONFIDENCE_THRESHOLD = 0.85;
export const REFINE_CONFIDENCE_PENALTY = 0.1;

export const refineIssueCodeSchema = z.enum([
  "duplicate_capability_id",
  "orphan_route",
  "auth_conflict",
  "low_confidence",
]);

export type RefineIssueCode = z.infer<typeof refineIssueCodeSchema>;

export interface RefineIssue {
  readonly code: RefineIssueCode;
  readonly message: string;
  readonly capabilityId?: string | undefined;
  readonly routeId?: string | undefined;
}

export interface PendingReviewEntry {
  readonly capabilityId: string;
  readonly reasons: readonly string[];
  readonly confidence: number;
  readonly flags: readonly string[];
}

export interface PendingReviewArtifact {
  readonly version: string;
  readonly generatedAt: string;
  readonly entries: readonly PendingReviewEntry[];
}

export const refinedCapabilityGroupSchema = capabilityGroupSchema.extend({
  adjustedConfidence: z.number().min(0).max(1),
  refineFlags: z.array(z.string().min(1)),
});

export type RefinedCapabilityGroup = z.infer<typeof refinedCapabilityGroupSchema>;

export interface RefineGroupingInput {
  readonly domain: string;
  readonly groups: readonly RefinedCapabilityGroup[];
  readonly issues: readonly RefineIssue[];
  readonly routeIds: readonly string[];
  readonly excludedRouteIds: readonly string[];
}

export const refineResponseSchema = z.object({
  groups: z.array(refinedCapabilityGroupSchema).min(1),
  resolvedIssueCodes: z.array(refineIssueCodeSchema),
});

export type RefineResponse = z.infer<typeof refineResponseSchema>;

export interface RefineCapabilityGroupsResult {
  readonly groups: readonly RefinedCapabilityGroup[];
  readonly issues: readonly RefineIssue[];
  readonly pendingReview: PendingReviewArtifact;
  readonly resolvedIssueCodes: readonly RefineIssueCode[];
}

export const buildRefineSystemPrompt = (): string =>
  [
    "You refine grouped agent capabilities for consistency before human review.",
    "Respond with JSON only. No markdown fences or commentary.",
    "",
    "Fix the reported issues while preserving business-level grouping:",
    "- duplicate_capability_id: merge or rename so every capability ID is unique",
    "- orphan_route: assign orphan routes to the best matching capability",
    "- auth_conflict: align requiresAuth with the routes in the group",
    "- low_confidence: keep grouping but lower adjustedConfidence when uncertain",
    "",
    "Return every input routeId in exactly one group unless it is listed as excluded.",
    "Do not invent route IDs. Preserve snake_case capability IDs when possible.",
    "Update adjustedConfidence and refineFlags to reflect fixes applied.",
    "List resolved issue codes in resolvedIssueCodes.",
  ].join("\n");

export const buildRefineUserPrompt = (input: RefineGroupingInput): string =>
  JSON.stringify(
    {
      domain: input.domain,
      route_ids: input.routeIds,
      excluded_route_ids: input.excludedRouteIds,
      issues: input.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        ...(issue.capabilityId !== undefined
          ? { capabilityId: issue.capabilityId }
          : {}),
        ...(issue.routeId !== undefined ? { routeId: issue.routeId } : {}),
      })),
      groups: input.groups,
    },
    null,
    2,
  );
