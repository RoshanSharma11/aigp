export interface LlmConfig {
  readonly provider: "openai" | "anthropic" | "mock";
  readonly model: string;
  readonly apiKeyEnvVar?: string | undefined;
  readonly temperature?: number | undefined;
}

export interface AgentLayerConfig {
  readonly llm: LlmConfig;
  readonly confidenceThreshold: number;
  readonly excludeRoutes: readonly string[];
  readonly baseUrl: string;
}
