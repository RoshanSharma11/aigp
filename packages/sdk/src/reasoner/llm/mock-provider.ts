import type {
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmProvider,
} from "./types.js";

export type MockLlmResponseFactory = (
  request: LlmCompletionRequest,
  callIndex: number,
) => string;

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock";
  private callIndex = 0;

  constructor(
    private readonly responses:
      | readonly string[]
      | MockLlmResponseFactory = [],
    private readonly defaultModel = "mock-model-v1",
  ) {}

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    const index = this.callIndex;
    this.callIndex += 1;

    const content =
      typeof this.responses === "function"
        ? this.responses(request, index)
        : (this.responses[index] ?? this.responses.at(-1) ?? "{}");

    return {
      content,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  getCallCount(): number {
    return this.callIndex;
  }
}
