import { LlmError } from "./errors.js";
import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
} from "./types.js";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_API_KEY_HEADER = "x-goog-api-key";
const GEMINI_MAX_OUTPUT_TOKENS = 4096;
const GEMINI_JSON_SYSTEM_SUFFIX =
  "\n\nRespond with valid JSON only. Do not wrap the JSON in markdown fences.";

interface GeminiContent {
  readonly role: string;
  readonly parts: readonly { readonly text: string }[];
}

interface GeminiGenerateResponse {
  readonly candidates?: readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string }[];
    };
    readonly finishReason?: string;
  }[];
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
    readonly totalTokenCount?: number;
  };
  readonly error?: {
    readonly message?: string;
    readonly code?: number;
  };
}

export interface GeminiLlmProviderOptions {
  readonly apiKey: string;
  readonly defaultModel: string;
  readonly fetchImpl?: typeof fetch;
}

export class GeminiLlmProvider implements LlmProvider {
  readonly name = "gemini";
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GeminiLlmProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    };

    if (request.temperature !== undefined) {
      generationConfig.temperature = request.temperature;
    }

    const body: Record<string, unknown> = {
      systemInstruction: {
        parts: [
          {
            text: `${request.system}${GEMINI_JSON_SYSTEM_SUFFIX}`,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: request.user }],
        },
      ] satisfies GeminiContent[],
      generationConfig,
    };

    const url = `${GEMINI_API_URL}/${request.model}:generateContent`;

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          [GEMINI_API_KEY_HEADER]: this.options.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      throw new LlmError("Gemini request failed", {
        code: "LLM_PROVIDER_ERROR",
        cause: error,
      });
    }

    let payload: GeminiGenerateResponse;
    try {
      payload = (await response.json()) as GeminiGenerateResponse;
    } catch (error) {
      throw new LlmError("Gemini response is not valid JSON", {
        code: "LLM_PROVIDER_ERROR",
        cause: error,
      });
    }

    if (!response.ok) {
      throw new LlmError(
        payload.error?.message ?? `Gemini request failed with ${response.status}`,
        {
          code: "LLM_PROVIDER_ERROR",
          context: { status: String(response.status) },
        },
      );
    }

    const firstCandidate = payload.candidates?.[0];
    if (!firstCandidate) {
      throw new LlmError("Gemini response did not include candidates", {
        code: "LLM_EMPTY_RESPONSE",
      });
    }

    if (
      firstCandidate.finishReason !== undefined &&
      firstCandidate.finishReason !== "STOP"
    ) {
      throw new LlmError(
        `Gemini response finished with reason: ${firstCandidate.finishReason}`,
        {
          code: "LLM_EMPTY_RESPONSE",
          context: { finishReason: firstCandidate.finishReason },
        },
      );
    }

    const textPart = firstCandidate.content?.parts?.find(
      (part) => part.text !== undefined,
    );
    const content = textPart?.text;

    if (!content) {
      throw new LlmError("Gemini response did not include text content", {
        code: "LLM_EMPTY_RESPONSE",
      });
    }

    const promptTokens = payload.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;

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
