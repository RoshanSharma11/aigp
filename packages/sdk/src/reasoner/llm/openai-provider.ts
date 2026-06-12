import { LlmError } from "./errors.js";
import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
} from "./types.js";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

interface OpenAiChatCompletionResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string | null;
    };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
  readonly error?: {
    readonly message?: string;
  };
}

export interface OpenAiLlmProviderOptions {
  readonly apiKey: string;
  readonly defaultModel: string;
  readonly fetchImpl?: typeof fetch;
}

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiLlmProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      response_format: { type: "json_object" },
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      throw new LlmError("OpenAI request failed", {
        code: "LLM_PROVIDER_ERROR",
        cause: error,
      });
    }

    let payload: OpenAiChatCompletionResponse;
    try {
      payload = (await response.json()) as OpenAiChatCompletionResponse;
    } catch (error) {
      throw new LlmError("OpenAI response is not valid JSON", {
        code: "LLM_PROVIDER_ERROR",
        cause: error,
      });
    }

    if (!response.ok) {
      throw new LlmError(
        payload.error?.message ?? `OpenAI request failed with ${response.status}`,
        {
          code: "LLM_PROVIDER_ERROR",
          context: { status: String(response.status) },
        },
      );
    }

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new LlmError("OpenAI response did not include message content", {
        code: "LLM_EMPTY_RESPONSE",
      });
    }

    return {
      content,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      },
    };
  }

  getDefaultModel(): string {
    return this.options.defaultModel;
  }
}
