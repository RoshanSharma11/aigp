import { LlmError } from "./errors.js";
import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
} from "./types.js";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

interface AnthropicMessageResponse {
  readonly content?: readonly {
    readonly type?: string;
    readonly text?: string;
  }[];
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
  };
  readonly error?: {
    readonly message?: string;
  };
}

export interface AnthropicLlmProviderOptions {
  readonly apiKey: string;
  readonly defaultModel: string;
  readonly fetchImpl?: typeof fetch;
}

export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: AnthropicLlmProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      max_tokens: 4096,
      system: `${request.system}\n\nRespond with valid JSON only. Do not wrap the JSON in markdown fences.`,
      messages: [{ role: "user", content: request.user }],
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.options.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      throw new LlmError("Anthropic request failed", {
        code: "LLM_PROVIDER_ERROR",
        cause: error,
      });
    }

    let payload: AnthropicMessageResponse;
    try {
      payload = (await response.json()) as AnthropicMessageResponse;
    } catch (error) {
      throw new LlmError("Anthropic response is not valid JSON", {
        code: "LLM_PROVIDER_ERROR",
        cause: error,
      });
    }

    if (!response.ok) {
      throw new LlmError(
        payload.error?.message ??
          `Anthropic request failed with ${response.status}`,
        {
          code: "LLM_PROVIDER_ERROR",
          context: { status: String(response.status) },
        },
      );
    }

    const textBlock = payload.content?.find((block) => block.type === "text");
    const content = textBlock?.text;
    if (!content) {
      throw new LlmError("Anthropic response did not include text content", {
        code: "LLM_EMPTY_RESPONSE",
      });
    }

    const promptTokens = payload.usage?.input_tokens ?? 0;
    const completionTokens = payload.usage?.output_tokens ?? 0;

    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  getDefaultModel(): string {
    return this.options.defaultModel;
  }
}
