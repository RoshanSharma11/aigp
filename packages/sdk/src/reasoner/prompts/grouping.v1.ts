import { z } from "zod";

export const GROUPING_PROMPT_VERSION = "v1" as const;
export const GROUPING_LOW_CONFIDENCE_THRESHOLD = 0.85;

export interface GroupingRouteInput {
  readonly routeId: string;
  readonly method: string;
  readonly path: string;
  readonly intent: string;
  readonly description: string;
  readonly databaseEntities: readonly string[];
  readonly requiresAuth: boolean;
  readonly riskLevel: "low" | "medium" | "high";
  readonly confidence: number;
}

export interface PreClusterSeed {
  readonly seedId: string;
  readonly entityKey: string;
  readonly routeIds: readonly string[];
  readonly suggestedCategory: string;
}

export interface CapabilityGroupingInput {
  readonly domain: string;
  readonly suggestedCategories: readonly string[];
  readonly routes: readonly GroupingRouteInput[];
  readonly preClusters: readonly PreClusterSeed[];
}

export const capabilityGroupSchema = z.object({
  id: z
    .string()
    .min(1)
    .describe("Snake_case capability identifier (e.g. product_catalog)"),
  name: z.string().min(1).describe("Human-readable capability name"),
  description: z
    .string()
    .min(1)
    .describe("Agent-facing summary of what this capability does"),
  category: z
    .string()
    .min(1)
    .describe("Business category from suggested categories"),
  routeIds: z
    .array(z.string().min(1))
    .min(1)
    .describe("Route IDs grouped into this capability"),
  prerequisites: z
    .array(z.string().min(1))
    .optional()
    .describe("Capability IDs that must succeed before this one"),
  requiresAuth: z.boolean(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence in this grouping from 0 to 1"),
});

export const groupingResponseSchema = z.object({
  groups: z.array(capabilityGroupSchema).min(1),
});

export type CapabilityGroup = z.infer<typeof capabilityGroupSchema>;

export interface CapabilityGroupResult extends CapabilityGroup {
  readonly lowConfidence: boolean;
}

export interface CapabilityGroupingResult {
  readonly groups: readonly CapabilityGroupResult[];
  readonly excludedRouteIds: readonly string[];
  readonly lowConfidenceGroupIds: readonly string[];
}

export const buildCapabilityGroupingSystemPrompt = (): string =>
  [
    "You merge backend API routes into business-level agent capabilities.",
    "Respond with JSON only. No markdown fences or commentary.",
    "",
    "Rules:",
    "- Group routes by business entity and workflow, not by HTTP method alone.",
    "- Merge CRUD routes for the same entity into one capability.",
    "- Do not create one capability per route unless routes are unrelated.",
    "- Use snake_case capability IDs (e.g. product_catalog, cart_management).",
    "- category should match one of the suggested categories when possible.",
    "- prerequisites lists capability IDs that must run first (e.g. login before cart).",
    "- requiresAuth is true when any grouped route requires authentication.",
    "- confidence: lower when grouping is ambiguous.",
    "",
    "Use pre_clusters as starting hints but refine them when business logic suggests merges or splits.",
    "Every non-utility input routeId must appear in exactly one group. Do not omit or duplicate route IDs.",
    "Prefer precision: if uncertain, lower confidence rather than guessing.",
  ].join("\n");

export const buildCapabilityGroupingUserPrompt = (
  input: CapabilityGroupingInput,
): string =>
  JSON.stringify(
    {
      domain: input.domain,
      suggested_categories: input.suggestedCategories,
      pre_clusters: input.preClusters.map((cluster) => ({
        seed_id: cluster.seedId,
        entity_key: cluster.entityKey,
        route_ids: cluster.routeIds,
        suggested_category: cluster.suggestedCategory,
      })),
      routes: input.routes.map((route) => ({
        routeId: route.routeId,
        method: route.method,
        path: route.path,
        intent: route.intent,
        description: route.description,
        entities: route.databaseEntities,
        requiresAuth: route.requiresAuth,
        riskLevel: route.riskLevel,
        confidence: route.confidence,
      })),
    },
    null,
    2,
  );
