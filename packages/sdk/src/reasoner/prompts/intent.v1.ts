import { z } from "zod";

export const INTENT_PROMPT_VERSION = "v1" as const;
export const DEFAULT_INTENT_BATCH_SIZE = 8;
export const INTENT_LOW_CONFIDENCE_THRESHOLD = 0.8;
export const MAX_SOURCE_CODE_SNIPPET_LENGTH = 500;

const operationSideEffectsSchema = z.enum(["read", "write", "delete"]);
const riskLevelSchema = z.enum(["low", "medium", "high"]);

export interface IntentLabelingRouteInput {
  readonly routeId: string;
  readonly method: string;
  readonly path: string;
  readonly handlerName: string;
  readonly controllerName: string;
  readonly databaseEntities: readonly string[];
  readonly middleware: readonly string[];
  readonly sourceCodeSnippet?: string | undefined;
}

export interface IntentLabelingBatchInput {
  readonly domain: string;
  readonly routes: readonly IntentLabelingRouteInput[];
}

export const routeIntentLabelSchema = z.object({
  routeId: z.string().min(1),
  intent: z
    .string()
    .min(1)
    .describe("Snake_case business intent label for the route"),
  description: z
    .string()
    .min(1)
    .describe("One-sentence description of what the route does for an agent"),
  sideEffects: operationSideEffectsSchema.describe(
    "Whether the route reads, writes, or deletes persistent state",
  ),
  requiresAuth: z.boolean(),
  riskLevel: riskLevelSchema,
  confidence: z.number().min(0).max(1),
});

export const intentBatchResponseSchema = z.object({
  labels: z.array(routeIntentLabelSchema).min(1),
});

export type RouteIntentLabel = z.infer<typeof routeIntentLabelSchema>;
export type IntentBatchResponse = z.infer<typeof intentBatchResponseSchema>;

export interface RouteIntentLabelResult extends RouteIntentLabel {
  readonly lowConfidence: boolean;
}

export interface IntentLabelingResult {
  readonly labels: readonly RouteIntentLabelResult[];
  readonly lowConfidenceRouteIds: readonly string[];
}

export const buildIntentLabelingSystemPrompt = (): string =>
  [
    "You label backend API routes with business intent metadata for agent capability generation.",
    "Respond with JSON only. No markdown fences or commentary.",
    "",
    "For each route in the batch, infer:",
    "- intent: snake_case verb_noun label (e.g. search_products, add_cart_item, login)",
    "- description: concise agent-facing summary",
    "- sideEffects: read | write | delete based on HTTP method and handler behavior",
    "- requiresAuth: true when route is protected by auth middleware/guards",
    "- riskLevel: low for reads, medium for writes, high for auth/payment/destructive actions",
    "- confidence: 0-1; lower when intent is ambiguous",
    "",
    "Return exactly one label per input routeId. Do not omit or invent route IDs.",
    "Prefer precision: if uncertain, lower confidence rather than guessing.",
  ].join("\n");

export const buildIntentLabelingUserPrompt = (
  input: IntentLabelingBatchInput,
): string =>
  JSON.stringify(
    {
      domain: input.domain,
      routes: input.routes.map((route) => ({
        routeId: route.routeId,
        method: route.method,
        path: route.path,
        handler: route.handlerName,
        controller: route.controllerName,
        entities: route.databaseEntities,
        middleware: route.middleware,
        ...(route.sourceCodeSnippet !== undefined
          ? { sourceCodeSnippet: route.sourceCodeSnippet }
          : {}),
      })),
    },
    null,
    2,
  );
