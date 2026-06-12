import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createDefaultAgentLayerConfig,
  loadAgentLayerConfig,
  resolveAgentLayerConfigPath,
  serializeAgentLayerConfig,
  writeDefaultAgentLayerConfig,
} from "./loader.js";

const tempDirectories: string[] = [];

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), "agent-layer-config-"));
  tempDirectories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("config loader", () => {
  it("should write and load the default config", async () => {
    const rootPath = await createTempDirectory();
    const expected = createDefaultAgentLayerConfig();

    const configPath = await writeDefaultAgentLayerConfig(rootPath, expected);
    const loaded = await loadAgentLayerConfig(rootPath);
    const rawConfig = await readFile(configPath, "utf8");

    expect(configPath).toBe(resolveAgentLayerConfigPath(rootPath));
    expect(loaded).toEqual(expected);
    expect(rawConfig).toBe(serializeAgentLayerConfig(expected));
  });

  it("should throw a ConfigError when the config file is missing", async () => {
    const rootPath = await createTempDirectory();

    await expect(loadAgentLayerConfig(rootPath)).rejects.toMatchObject({
      name: "ConfigError",
      code: "CONFIG_NOT_FOUND",
    });
  });

  it("should throw a ConfigError when the config file fails schema validation", async () => {
    const rootPath = await createTempDirectory();
    const configPath = resolveAgentLayerConfigPath(rootPath);

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      JSON.stringify({
        llm: { provider: "mock", model: "mock-model-v1" },
        confidenceThreshold: 7,
        excludeRoutes: [],
        baseUrl: "https://example.com",
      }),
      "utf8",
    );

    await expect(loadAgentLayerConfig(rootPath)).rejects.toMatchObject({
      name: "ConfigError",
      code: "CONFIG_INVALID_SCHEMA",
    });
  });
});
