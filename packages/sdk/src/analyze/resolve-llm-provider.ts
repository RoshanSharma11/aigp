import { readFile } from "node:fs/promises";
import path from "node:path";

import type { AgentLayerConfig } from "@agent-layer/core";

import { createEcommerceFixtureMockProvider } from "./ecommerce-fixture-mock.js";
import type { LlmProvider } from "../reasoner/llm/types.js";

export const isEcommerceFixtureProject = async (rootPath: string): Promise<boolean> => {
  try {
    const groundTruthPath = path.join(rootPath, "ground-truth.json");
    const groundTruth = JSON.parse(await readFile(groundTruthPath, "utf8")) as {
      readonly fixture?: string | undefined;
    };

    return groundTruth.fixture === "nestjs-ecommerce";
  } catch {
    return false;
  }
};

export const resolveAnalyzeLlmProvider = async (
  rootPath: string,
  config: AgentLayerConfig,
  explicitProvider?: LlmProvider | undefined,
): Promise<LlmProvider | undefined> => {
  if (explicitProvider !== undefined) {
    return explicitProvider;
  }

  if (config.llm.provider !== "mock") {
    return undefined;
  }

  if (await isEcommerceFixtureProject(rootPath)) {
    return createEcommerceFixtureMockProvider();
  }

  return undefined;
};
