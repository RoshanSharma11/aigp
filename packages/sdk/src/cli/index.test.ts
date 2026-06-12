import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { formatHelpText, runCli, runCliAsync } from "./index.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("agent-layer CLI", () => {
  it("should print help text when no arguments are provided", () => {
    expect(runCli([])).toBe(formatHelpText());
  });

  it("should print help text for the help flag", () => {
    expect(runCli(["--help"])).toBe(formatHelpText());
  });

  it("should print a helpful fallback for unknown commands", () => {
    expect(runCli(["ship-it"])).toContain("Unknown command: ship-it");
  });

  it("should run analyze --static-only through the async CLI entrypoint", async () => {
    const artifactDirectory = path.join(fixtureRoot, ".agent-layer");

    await rm(artifactDirectory, { recursive: true, force: true });

    const result = await runCliAsync([
      "analyze",
      "--static-only",
      fixtureRoot,
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Static analysis complete: 7 routes, 0 warnings");

    await rm(artifactDirectory, { recursive: true, force: true });
  }, 15_000);
});
