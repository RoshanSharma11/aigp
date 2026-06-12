import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseAgentLayerConfig } from "../schemas/config.js";
import type { AgentLayerConfig } from "../types/config.js";

const AGENT_LAYER_DIRECTORY = ".agent-layer";
const CONFIG_FILE_NAME = "config.json";

export class ConfigError extends Error {
  readonly code: string;
  readonly context: Record<string, string> | undefined;

  constructor(
    message: string,
    options: {
      code?: string;
      context?: Record<string, string>;
      cause?: unknown;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ConfigError";
    this.code = options.code ?? "CONFIG_ERROR";
    this.context = options.context;
  }
}

export const createDefaultAgentLayerConfig = (): AgentLayerConfig => ({
  llm: {
    provider: "mock",
    model: "mock-model-v1",
  },
  confidenceThreshold: 0.85,
  excludeRoutes: ["/health", "/metrics"],
  baseUrl: "https://example.com",
});

export const serializeAgentLayerConfig = (
  config: AgentLayerConfig,
): string => `${JSON.stringify(config, null, 2)}\n`;

export const resolveAgentLayerConfigPath = (rootPath: string): string =>
  path.join(rootPath, AGENT_LAYER_DIRECTORY, CONFIG_FILE_NAME);

export const loadAgentLayerConfig = async (
  rootPath: string,
): Promise<AgentLayerConfig> => {
  const configPath = resolveAgentLayerConfigPath(rootPath);

  let rawConfig: string;
  try {
    rawConfig = await readFile(configPath, "utf8");
  } catch (error) {
    throw new ConfigError(`Config file not found at ${configPath}`, {
      code: "CONFIG_NOT_FOUND",
      context: { configPath },
      cause: error,
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawConfig) as unknown;
  } catch (error) {
    throw new ConfigError(`Config file is not valid JSON: ${configPath}`, {
      code: "CONFIG_INVALID_JSON",
      context: { configPath },
      cause: error,
    });
  }

  try {
    return parseAgentLayerConfig(parsedJson);
  } catch (error) {
    throw new ConfigError(`Config file failed schema validation: ${configPath}`, {
      code: "CONFIG_INVALID_SCHEMA",
      context: { configPath },
      cause: error,
    });
  }
};

export const writeDefaultAgentLayerConfig = async (
  rootPath: string,
  config: AgentLayerConfig = createDefaultAgentLayerConfig(),
): Promise<string> => {
  const configPath = resolveAgentLayerConfigPath(rootPath);

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, serializeAgentLayerConfig(config), "utf8");

  return configPath;
};
