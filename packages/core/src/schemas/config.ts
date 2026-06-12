import { z } from "zod";

export const llmConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini", "mock"]),
  model: z.string().min(1),
  apiKeyEnvVar: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
});

export const agentLayerConfigSchema = z.object({
  llm: llmConfigSchema,
  confidenceThreshold: z.number().min(0).max(1),
  excludeRoutes: z.array(z.string().min(1)),
  baseUrl: z.string().url(),
});

export const parseAgentLayerConfig = (input: unknown) =>
  agentLayerConfigSchema.parse(input);
