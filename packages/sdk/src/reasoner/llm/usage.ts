import type { LlmTokenUsage, LlmUsageStats } from "./types.js";

interface ModelPricing {
  readonly inputUsdPer1M: number;
  readonly outputUsdPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4o": { inputUsdPer1M: 2.5, outputUsdPer1M: 10 },
  "gpt-4o-mini": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
  "claude-3-5-sonnet-20241022": { inputUsdPer1M: 3, outputUsdPer1M: 15 },
  "claude-3-5-haiku-20241022": { inputUsdPer1M: 0.8, outputUsdPer1M: 4 },
  "gemini-2.0-flash": { inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
  "gemini-1.5-pro": { inputUsdPer1M: 1.25, outputUsdPer1M: 5 },
  "gemini-1.5-flash": { inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
  "mock-model-v1": { inputUsdPer1M: 0, outputUsdPer1M: 0 },
};

const DEFAULT_PRICING: ModelPricing = { inputUsdPer1M: 0, outputUsdPer1M: 0 };

export const estimateLlmCostUsd = (
  model: string,
  usage: LlmTokenUsage,
): number => {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.inputUsdPer1M;
  const outputCost =
    (usage.completionTokens / 1_000_000) * pricing.outputUsdPer1M;

  return inputCost + outputCost;
};

export class LlmUsageTracker {
  private promptTokens = 0;
  private completionTokens = 0;
  private totalTokens = 0;
  private costUsd = 0;
  private callCount = 0;

  constructor(
    private readonly provider: string,
    private readonly model: string,
  ) {}

  record(usage: LlmTokenUsage): void {
    this.promptTokens += usage.promptTokens;
    this.completionTokens += usage.completionTokens;
    this.totalTokens += usage.totalTokens;
    this.costUsd += estimateLlmCostUsd(this.model, usage);
    this.callCount += 1;
  }

  reset(): void {
    this.promptTokens = 0;
    this.completionTokens = 0;
    this.totalTokens = 0;
    this.costUsd = 0;
    this.callCount = 0;
  }

  snapshot(): LlmUsageStats {
    return {
      provider: this.provider,
      model: this.model,
      promptTokens: this.promptTokens,
      completionTokens: this.completionTokens,
      totalTokens: this.totalTokens,
      costUsd: this.costUsd,
      callCount: this.callCount,
    };
  }
}
