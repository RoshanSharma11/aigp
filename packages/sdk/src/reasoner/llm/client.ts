import { ZodError } from "zod";

import { LlmError } from "./errors.js";
import { parseJsonContent } from "./json.js";
import { LlmUsageTracker } from "./usage.js";
import type {
  LlmClientOptions,
  LlmCompletionRequest,
  LlmJsonRequest,
  LlmProvider,
  LlmUsageStats,
} from "./types.js";

export const DEFAULT_LLM_MAX_RETRIES = 2;
export const DEFAULT_LLM_TIMEOUT_MS = 60_000;
export const DEFAULT_LLM_RETRY_BACKOFF_MS = 1_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof LlmError) {
    return (
      error.code === "LLM_PROVIDER_ERROR" ||
      error.code === "LLM_INVALID_JSON" ||
      error.code === "LLM_SCHEMA_VALIDATION_FAILED" ||
      error.code === "LLM_EMPTY_RESPONSE"
    );
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return true;
  }

  return false;
};

export class LlmClient {
  private readonly usageTracker: LlmUsageTracker;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly stage: string | undefined;
  private readonly model: string;

  constructor(
    private readonly provider: LlmProvider,
    options: LlmClientOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? DEFAULT_LLM_MAX_RETRIES;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;
    this.stage = options.stage;
    this.model = options.model ?? "unknown-model";
    this.usageTracker = new LlmUsageTracker(provider.name, this.model);
  }

  async completeJson<T>(request: LlmJsonRequest<T>): Promise<T> {
    const maxAttempts = this.maxRetries + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const completionRequest: LlmCompletionRequest = {
          system: request.system,
          user: request.user,
          model: this.model,
          signal: AbortSignal.timeout(this.timeoutMs),
          ...(request.temperature !== undefined
            ? { temperature: request.temperature }
            : {}),
        };

        const response = await this.provider.complete(completionRequest);
        this.usageTracker.record(response.usage);

        const parsed = parseJsonContent(response.content);

        try {
          return request.schema.parse(parsed);
        } catch (error) {
          if (error instanceof ZodError) {
            throw new LlmError("LLM response failed schema validation", {
              code: "LLM_SCHEMA_VALIDATION_FAILED",
              cause: error,
            });
          }

          throw error;
        }
      } catch (error) {
        lastError = error;

        const canRetry = attempt < maxAttempts - 1 && isRetryableError(error);
        if (!canRetry) {
          break;
        }

        await sleep(DEFAULT_LLM_RETRY_BACKOFF_MS * 2 ** attempt);
      }
    }

    throw this.wrapFailure(lastError);
  }

  getUsage(): LlmUsageStats {
    return this.usageTracker.snapshot();
  }

  resetUsage(): void {
    this.usageTracker.reset();
  }

  private wrapFailure(error: unknown): LlmError {
    if (error instanceof LlmError) {
      if (this.stage) {
        return new LlmError(`${this.stage}: ${error.message}`, {
          code: error.code,
          ...(error.context ? { context: error.context } : {}),
          cause: error,
        });
      }

      return error;
    }

    const message =
      error instanceof Error ? error.message : "Unknown LLM failure";

    return new LlmError(this.stage ? `${this.stage}: ${message}` : message, {
      code: "LLM_PROVIDER_ERROR",
      cause: error,
    });
  }
}
