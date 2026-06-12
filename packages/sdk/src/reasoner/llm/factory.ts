import type { LlmConfig } from "@agent-layer/core";

import { LlmError } from "./errors.js";
import { AnthropicLlmProvider } from "./anthropic-provider.js";
import { MockLlmProvider } from "./mock-provider.js";
import { OpenAiLlmProvider } from "./openai-provider.js";
import { LlmClient } from "./client.js";
import type { LlmClientOptions, LlmProvider } from "./types.js";

const DEFAULT_OPENAI_API_KEY_ENV = "OPENAI_API_KEY";
const DEFAULT_ANTHROPIC_API_KEY_ENV = "ANTHROPIC_API_KEY";

const resolveApiKey = (
  config: LlmConfig,
  defaultEnvVar: string,
): string => {
  const envVar = config.apiKeyEnvVar ?? defaultEnvVar;
  const apiKey = process.env[envVar];

  if (!apiKey) {
    throw new LlmError(`Missing API key environment variable: ${envVar}`, {
      code: "LLM_MISSING_API_KEY",
      context: { envVar },
    });
  }

  return apiKey;
};

export const createLlmProvider = (config: LlmConfig): LlmProvider => {
  switch (config.provider) {
    case "mock":
      return new MockLlmProvider([], config.model);
    case "openai":
      return new OpenAiLlmProvider({
        apiKey: resolveApiKey(config, DEFAULT_OPENAI_API_KEY_ENV),
        defaultModel: config.model,
      });
    case "anthropic":
      return new AnthropicLlmProvider({
        apiKey: resolveApiKey(config, DEFAULT_ANTHROPIC_API_KEY_ENV),
        defaultModel: config.model,
      });
    default: {
      const exhaustiveCheck: never = config.provider;
      throw new LlmError(`Unsupported LLM provider: ${String(exhaustiveCheck)}`, {
        code: "LLM_UNSUPPORTED_PROVIDER",
      });
    }
  }
};

export const createLlmClient = (
  config: LlmConfig,
  options: LlmClientOptions = {},
): LlmClient =>
  new LlmClient(createLlmProvider(config), {
    ...options,
    model: options.model ?? config.model,
  });

export const createLlmClientFromProvider = (
  provider: LlmProvider,
  options: LlmClientOptions = {},
): LlmClient => new LlmClient(provider, options);
