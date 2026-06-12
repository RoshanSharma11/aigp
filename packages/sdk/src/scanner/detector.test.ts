import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  detectAdapter,
  getRegisteredAdapters,
} from "./adapters/registry.js";
import { nestJsFrameworkAdapter } from "./adapters/nestjs.adapter.js";
import { detectFramework } from "./detector.js";

const tempDirectories: string[] = [];

const createTempDirectory = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), "agent-layer-scanner-"));
  tempDirectories.push(directory);
  return directory;
};

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("framework adapter registry", () => {
  it("should register the NestJS adapter", () => {
    const adapters = getRegisteredAdapters();

    expect(adapters).toContain(nestJsFrameworkAdapter);
    expect(adapters.map((adapter) => adapter.name)).toEqual(["nestjs"]);
  });

  it("should resolve the NestJS adapter for the ecommerce fixture", async () => {
    const adapter = await detectAdapter(fixtureRoot);

    expect(adapter).toBe(nestJsFrameworkAdapter);
  });
});

describe("framework detector", () => {
  it("should detect nestjs for the ecommerce fixture", async () => {
    await expect(detectFramework(fixtureRoot)).resolves.toBe("nestjs");
  });

  it("should return unknown when package.json is missing", async () => {
    const rootPath = await createTempDirectory();

    await expect(detectFramework(rootPath)).resolves.toBe("unknown");
  });

  it("should return unknown when @nestjs/core is not listed in dependencies", async () => {
    const rootPath = await createTempDirectory();

    await writeFile(
      path.join(rootPath, "package.json"),
      JSON.stringify({
        name: "plain-app",
        dependencies: {
          express: "^5.0.0",
        },
      }),
      "utf8",
    );

    await expect(detectFramework(rootPath)).resolves.toBe("unknown");
  });

  it("should detect nestjs when @nestjs/core is listed in devDependencies", async () => {
    const rootPath = await createTempDirectory();

    await writeFile(
      path.join(rootPath, "package.json"),
      JSON.stringify({
        name: "nestjs-dev-app",
        devDependencies: {
          "@nestjs/core": "^11.1.6",
        },
      }),
      "utf8",
    );

    await expect(detectFramework(rootPath)).resolves.toBe("nestjs");
  });
});

describe("nestjs framework adapter", () => {
  it("should expose unimplemented extraction methods for later phases", () => {
    const emptyContext = {
      rootPath: fixtureRoot,
      framework: "nestjs" as const,
      routeFiles: [],
      dtoFiles: [],
      entityFiles: [],
      fileGraph: { nodes: [] },
    };

    expect(() => nestJsFrameworkAdapter.extractRoutes(emptyContext)).toThrow(
      "extractRoutes is not implemented yet",
    );
  });
});
