import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createDefaultAgentLayerConfig } from "@agent-layer/core";

import { createEcommerceFixtureMockProvider } from "./ecommerce-fixture-mock.js";
import {
  isEcommerceFixtureProject,
  resolveAnalyzeLlmProvider,
} from "./resolve-llm-provider.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("resolveAnalyzeLlmProvider", () => {
  it("should detect the ecommerce fixture project", async () => {
    await expect(isEcommerceFixtureProject(fixtureRoot)).resolves.toBe(true);
  });

  it("should auto-use the ecommerce fixture mock for mock config on the fixture", async () => {
    const provider = await resolveAnalyzeLlmProvider(
      fixtureRoot,
      createDefaultAgentLayerConfig(),
    );

    expect(provider).toBeDefined();

    const response = await provider!.complete({
      model: "mock-model-v1",
      system: "test",
      user: "package_name: @agent-layer/fixture-nestjs-ecommerce",
    });

    expect(JSON.parse(response.content)).toMatchObject({
      domain: "ecommerce",
    });
  });

  it("should prefer an explicit provider override", async () => {
    const explicitProvider = createEcommerceFixtureMockProvider();
    const provider = await resolveAnalyzeLlmProvider(
      fixtureRoot,
      createDefaultAgentLayerConfig(),
      explicitProvider,
    );

    expect(provider).toBe(explicitProvider);
  });
});
