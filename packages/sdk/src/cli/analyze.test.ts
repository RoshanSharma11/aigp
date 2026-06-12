import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  parseAnalyzeCommandOptions,
  runAnalyzeCommand,
} from "./analyze.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("analyze CLI command", () => {
  it("should require --static-only", () => {
    const parsed = parseAnalyzeCommandOptions(["analyze"]);

    expect(parsed.ok).toBe(false);

    if (!parsed.ok) {
      expect(parsed.exitCode).toBe(2);
      expect(parsed.message).toContain("--static-only");
    }
  });

  it("should run static analysis and write route-graph.json", async () => {
    const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
    const artifactPath = path.join(artifactDirectory, "route-graph.json");

    await rm(artifactDirectory, { recursive: true, force: true });

    const result = await runAnalyzeCommand(
      ["--static-only", fixtureRoot],
      fixtureRoot,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Static analysis complete: 7 routes, 0 warnings");
    expect(result.stderr).toContain("route-graph.json");
    expect(result.stdout).toBe("");

    await expect(access(artifactPath)).resolves.toBeUndefined();

    const artifact = JSON.parse(await readFile(artifactPath, "utf8")) as {
      readonly routes: readonly unknown[];
    };

    expect(artifact.routes).toHaveLength(7);

    await rm(artifactDirectory, { recursive: true, force: true });
  }, 15_000);

  it("should emit JSON analysis output when --json is provided", async () => {
    const artifactDirectory = path.join(fixtureRoot, ".agent-layer");

    await rm(artifactDirectory, { recursive: true, force: true });

    const result = await runAnalyzeCommand(
      ["--static-only", "--json", fixtureRoot],
      fixtureRoot,
    );

    expect(result.exitCode).toBe(0);

    const payload = JSON.parse(result.stdout) as {
      readonly meta: { readonly routeCount: number };
      readonly routeGraph: readonly unknown[];
    };

    expect(payload.meta.routeCount).toBe(7);
    expect(payload.routeGraph).toHaveLength(7);
    expect(result.stderr).toContain("Static analysis complete: 7 routes, 0 warnings");

    await rm(artifactDirectory, { recursive: true, force: true });
  }, 15_000);
});
