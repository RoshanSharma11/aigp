import type { z } from "zod";

export interface LlmMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface LlmCompletionRequest {
  readonly system: string;
  readonly user: string;
  readonly model: string;
  readonly temperature?: number | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface LlmTokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface LlmCompletionResponse {
  readonly content: string;
  readonly usage: LlmTokenUsage;
}

export interface LlmProvider {
  readonly name: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

export interface LlmJsonRequest<T> {
  readonly system: string;
  readonly user: string;
  readonly schema: z.ZodType<T>;
  readonly temperature?: number | undefined;
}

export interface LlmUsageStats {
  readonly provider: string;
  readonly model: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly costUsd: number;
  readonly callCount: number;
}

export interface LlmClientOptions {
  readonly stage?: string | undefined;
  readonly maxRetries?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly model?: string | undefined;
}
