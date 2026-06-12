import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_LLM_MAX_RETRIES,
  DEFAULT_LLM_RETRY_BACKOFF_MS,
  LlmClient,
} from "./client.js";
import { LlmError } from "./errors.js";
import { extractJsonContent, parseJsonContent } from "./json.js";
import { AnthropicLlmProvider } from "./anthropic-provider.js";
import {
  createLlmClient,
  createLlmClientFromProvider,
  createLlmProvider,
} from "./factory.js";
import { MockLlmProvider } from "./mock-provider.js";
import { OpenAiLlmProvider } from "./openai-provider.js";
import { estimateLlmCostUsd, LlmUsageTracker } from "./usage.js";
import type { LlmCompletionRequest, LlmCompletionResponse } from "./types.js";

const domainSchema = z.object({
  domain: z.string(),
  confidence: z.number(),
});

describe("llm json helpers", () => {
  it("should strip markdown fences before parsing JSON", () => {
    expect(extractJsonContent('```json\n{"domain":"ecommerce"}\n```')).toBe(
      '{"domain":"ecommerce"}',
    );
    expect(parseJsonContent('```json\n{"domain":"ecommerce"}\n```')).toEqual({
      domain: "ecommerce",
    });
  });

  it("should throw LlmError when content is not JSON", () => {
    expect(() => parseJsonContent("not-json")).toThrow(LlmError);
  });
});

describe("llm usage tracker", () => {
  it("should accumulate token usage and cost across calls", () => {
    const tracker = new LlmUsageTracker("mock", "mock-model-v1");

    tracker.record({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    tracker.record({
      promptTokens: 200,
      completionTokens: 100,
      totalTokens: 300,
    });

    expect(tracker.snapshot()).toEqual({
      provider: "mock",
      model: "mock-model-v1",
      promptTokens: 300,
      completionTokens: 150,
      totalTokens: 450,
      costUsd: 0,
      callCount: 2,
    });
  });

  it("should estimate OpenAI model cost", () => {
    const cost = estimateLlmCostUsd("gpt-4o-mini", {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    });

    expect(cost).toBeCloseTo(0.75, 5);
  });
});

describe("MockLlmProvider", () => {
  it("should return configured responses in order", async () => {
    const provider = new MockLlmProvider([
      '{"domain":"ecommerce","confidence":0.95}',
      '{"domain":"saas","confidence":0.80}',
    ]);

    const first = await provider.complete({
      system: "system",
      user: "user",
      model: "mock-model-v1",
    });
    const second = await provider.complete({
      system: "system",
      user: "user",
      model: "mock-model-v1",
    });

    expect(first.content).toContain("ecommerce");
    expect(second.content).toContain("saas");
    expect(provider.getCallCount()).toBe(2);
  });
});

describe("LlmClient", () => {
  it("should parse and validate structured JSON responses", async () => {
    const provider = new MockLlmProvider([
      '{"domain":"ecommerce","confidence":0.95}',
    ]);
    const client = createLlmClientFromProvider(provider, {
      model: "mock-model-v1",
    });

    const result = await client.completeJson({
      system: "Classify the app domain",
      user: "entities: Product, Cart",
      schema: domainSchema,
    });

    expect(result).toEqual({
      domain: "ecommerce",
      confidence: 0.95,
    });
    expect(client.getUsage().callCount).toBe(1);
    expect(client.getUsage().totalTokens).toBe(150);
  });

  it("should retry invalid JSON and schema failures before failing", async () => {
    vi.useFakeTimers();

    const provider = new MockLlmProvider([
      "not-json",
      '{"domain":"ecommerce"}',
      '{"domain":"ecommerce","confidence":0.95}',
    ]);
    const client = new LlmClient(provider, {
      model: "mock-model-v1",
      maxRetries: 2,
    });

    const resultPromise = client.completeJson({
      system: "Classify the app domain",
      user: "entities: Product, Cart",
      schema: domainSchema,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.domain).toBe("ecommerce");
    expect(provider.getCallCount()).toBe(3);

    vi.useRealTimers();
  });

  it("should fail with stage context after retries are exhausted", async () => {
    vi.useFakeTimers();

    const provider = new MockLlmProvider(["not-json", "still-not-json", "{"]);
    const client = new LlmClient(provider, {
      model: "mock-model-v1",
      stage: "domain-classification",
      maxRetries: 2,
    });

    const resultPromise = client.completeJson({
      system: "Classify the app domain",
      user: "entities: Product, Cart",
      schema: domainSchema,
    });

    const expectation = expect(resultPromise).rejects.toMatchObject({
      name: "LlmError",
      code: "LLM_INVALID_JSON",
      message: "domain-classification: LLM response is not valid JSON",
    });

    await vi.runAllTimersAsync();
    await expectation;

    expect(provider.getCallCount()).toBe(DEFAULT_LLM_MAX_RETRIES + 1);

    vi.useRealTimers();
  });

  it("should retry provider errors with exponential backoff", async () => {
    vi.useFakeTimers();

    let attempts = 0;
    const provider = {
      name: "flaky",
      complete: vi.fn(async (): Promise<LlmCompletionResponse> => {
        attempts += 1;
        if (attempts < 2) {
          throw new LlmError("temporary outage", {
            code: "LLM_PROVIDER_ERROR",
          });
        }

        return {
          content: '{"domain":"ecommerce","confidence":0.95}',
          usage: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          },
        };
      }),
    };

    const client = new LlmClient(provider, {
      model: "mock-model-v1",
      maxRetries: 2,
    });

    const resultPromise = client.completeJson({
      system: "Classify the app domain",
      user: "entities: Product, Cart",
      schema: domainSchema,
    });

    await vi.advanceTimersByTimeAsync(DEFAULT_LLM_RETRY_BACKOFF_MS);
    const result = await resultPromise;

    expect(result.domain).toBe("ecommerce");
    expect(provider.complete).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("should reset usage stats", async () => {
    const provider = new MockLlmProvider([
      '{"domain":"ecommerce","confidence":0.95}',
    ]);
    const client = createLlmClientFromProvider(provider, {
      model: "mock-model-v1",
    });

    await client.completeJson({
      system: "Classify the app domain",
      user: "entities: Product, Cart",
      schema: domainSchema,
    });

    client.resetUsage();

    expect(client.getUsage()).toEqual({
      provider: "mock",
      model: "mock-model-v1",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      costUsd: 0,
      callCount: 0,
    });
  });
});

describe("createLlmProvider", () => {
  it("should create a mock provider from config", () => {
    const provider = createLlmProvider({
      provider: "mock",
      model: "mock-model-v1",
    });

    expect(provider.name).toBe("mock");
  });

  it("should create an OpenAI provider when API key env is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");

    const provider = createLlmProvider({
      provider: "openai",
      model: "gpt-4o-mini",
    });

    expect(provider).toBeInstanceOf(OpenAiLlmProvider);

    vi.unstubAllEnvs();
  });

  it("should throw when real provider API key env is missing", () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(() =>
      createLlmProvider({
        provider: "openai",
        model: "gpt-4o-mini",
      }),
    ).toThrow(LlmError);

    vi.unstubAllEnvs();
  });

  it("should create a client from config", () => {
    const client = createLlmClient({
      provider: "mock",
      model: "mock-model-v1",
    });

    expect(client.getUsage().provider).toBe("mock");
    expect(client.getUsage().model).toBe("mock-model-v1");
  });
});

describe("OpenAiLlmProvider", () => {
  it("should request JSON mode and parse usage from API response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        choices: [{ message: { content: '{"domain":"ecommerce"}' } }],
        usage: {
          prompt_tokens: 12,
          completion_tokens: 8,
          total_tokens: 20,
        },
      }),
    );

    const provider = new OpenAiLlmProvider({
      apiKey: "test-key",
      defaultModel: "gpt-4o-mini",
      fetchImpl,
    });

    const response = await provider.complete({
      system: "system",
      user: "user",
      model: "gpt-4o-mini",
      temperature: 0,
    });

    expect(response.content).toBe('{"domain":"ecommerce"}');
    expect(response.usage.totalTokens).toBe(20);

    expect(fetchImpl).toHaveBeenCalledOnce();

    const callArgs = fetchImpl.mock.calls[0];
    expect(callArgs).toBeDefined();

    const requestInit = callArgs?.[1];
    expect(requestInit?.body).toBeDefined();

    const body = JSON.parse(String(requestInit?.body)) as {
      response_format: { type: string };
    };

    expect(body.response_format).toEqual({ type: "json_object" });
  });
});

describe("AnthropicLlmProvider", () => {
  it("should parse text blocks and token usage from API response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({
        content: [{ type: "text", text: '{"domain":"ecommerce"}' }],
        usage: {
          input_tokens: 30,
          output_tokens: 20,
        },
      }),
    );

    const provider = new AnthropicLlmProvider({
      apiKey: "test-key",
      defaultModel: "claude-3-5-haiku-20241022",
      fetchImpl,
    });

    const response = await provider.complete({
      system: "system",
      user: "user",
      model: "claude-3-5-haiku-20241022",
    });

    expect(response.content).toBe('{"domain":"ecommerce"}');
    expect(response.usage).toEqual({
      promptTokens: 30,
      completionTokens: 20,
      totalTokens: 50,
    });
  });
});

describe("MockLlmProvider factory responses", () => {
  it("should support response factories for dynamic mock output", async () => {
    const provider = new MockLlmProvider(
      (request: LlmCompletionRequest) =>
        `{"domain":"${request.user}","confidence":0.9}`,
    );

    const response = await provider.complete({
      system: "system",
      user: "ecommerce",
      model: "mock-model-v1",
    });

    expect(JSON.parse(response.content)).toEqual({
      domain: "ecommerce",
      confidence: 0.9,
    });
  });
});
