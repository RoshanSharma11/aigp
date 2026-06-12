import { z } from "zod";

import { isoDateTimeSchema, jsonSchemaValueSchema } from "./shared.js";

export const capabilityOperationSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  httpMethod: z.string().min(1),
  httpPath: z.string().min(1),
  inputSchema: jsonSchemaValueSchema,
  outputSchema: jsonSchemaValueSchema,
  sideEffects: z.enum(["read", "write", "delete"]),
});

export const capabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  operations: z.array(capabilityOperationSchema).min(1),
  defaultOperation: z.string().min(1),
  inputSchema: jsonSchemaValueSchema,
  outputSchema: jsonSchemaValueSchema,
  sideEffects: z.enum(["read", "write", "delete", "transactional"]),
  requiresAuth: z.boolean(),
  prerequisites: z.array(z.string().min(1)).optional(),
  followedBy: z.array(z.string().min(1)).optional(),
  reversible: z.boolean(),
  confirmationRequired: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  needsHumanReview: z.boolean(),
  sourceRoutes: z.array(z.string().min(1)),
  status: z.enum(["draft", "approved", "disabled"]),
});

export const capabilitiesArtifactSchema = z.object({
  version: z.string().min(1),
  generatedAt: isoDateTimeSchema,
  capabilities: z.array(capabilitySchema),
});

export const parseCapabilitiesArtifact = (input: unknown) =>
  capabilitiesArtifactSchema.parse(input);
