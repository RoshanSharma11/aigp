import { z } from "zod";

import { isoDateTimeSchema, jsonSchemaValueSchema } from "./shared.js";

export const capabilityOverrideSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    defaultOperation: z.string().min(1).optional(),
    inputSchema: jsonSchemaValueSchema.optional(),
    outputSchema: jsonSchemaValueSchema.optional(),
    sideEffects: z
      .enum(["read", "write", "delete", "transactional"])
      .optional(),
    requiresAuth: z.boolean().optional(),
    prerequisites: z.array(z.string().min(1)).optional(),
    followedBy: z.array(z.string().min(1)).optional(),
    reversible: z.boolean().optional(),
    confirmationRequired: z.boolean().optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
    confidence: z.number().min(0).max(1).optional(),
    needsHumanReview: z.boolean().optional(),
    sourceRoutes: z.array(z.string().min(1)).optional(),
    status: z.enum(["draft", "approved", "disabled"]).optional(),
  })
  .strict();

export const overridesArtifactSchema = z.object({
  version: z.string().min(1),
  updatedAt: isoDateTimeSchema,
  capabilities: z.array(capabilityOverrideSchema),
});

export const parseOverridesArtifact = (input: unknown) =>
  overridesArtifactSchema.parse(input);
