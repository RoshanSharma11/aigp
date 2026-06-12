import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createEcommerceFixtureMockProvider } from "../analyze/ecommerce-fixture-mock.js";
import { runAnalyzeCommand } from "./analyze.js";
import { runDoctorCommand, runValidateCommand } from "./utilities.js";
import { runDoctorChecks } from "./doctor.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("CLI utilities", () => {
  it("should validate artifacts after analyze", async () => {
    const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
    await rm(artifactDirectory, { recursive: true, force: true });

    const analyzeResult = await runAnalyzeCommand([fixtureRoot], fixtureRoot, {
      llmProvider: createEcommerceFixtureMockProvider(),
    });

    expect(analyzeResult.exitCode).toBe(0);

    const result = await runValidateCommand([fixtureRoot], fixtureRoot);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("All artifacts valid");

    await rm(artifactDirectory, { recursive: true, force: true });
  }, 30_000);

  it("should report doctor checks for the fixture project", async () => {
    const result = await runDoctorChecks(fixtureRoot);

    expect(result.checks.some((check) => check.name === "framework-detection")).toBe(true);
    expect(result.checks.find((check) => check.name === "framework-detection")?.status).toBe(
      "pass",
    );
  });

  it("should expose doctor through the CLI", async () => {
    const result = await runDoctorCommand([fixtureRoot], fixtureRoot);

    expect(result.stderr).toContain("framework-detection");
  });
});
