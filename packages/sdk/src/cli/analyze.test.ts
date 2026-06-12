import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCapabilitiesArtifact } from "@agent-layer/core";

import { describe, expect, it } from "vitest";

import { createEcommerceFixtureMockProvider } from "../analyze/ecommerce-fixture-mock.js";
import {
  parseAnalyzeCommandOptions,
  runAnalyzeCommand,
} from "./analyze.js";
import {
  ANALYSIS_META_FILE,
  CAPABILITIES_DRAFT_FILE,
  PENDING_REVIEW_FILE,
  ROUTE_GRAPH_FILE,
} from "../store/writer.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("analyze CLI command", () => {
  it("should accept full analysis by default", () => {
    const parsed = parseAnalyzeCommandOptions([fixtureRoot]);

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.options.staticOnly).toBe(false);
      expect(parsed.options.eval).toBe(false);
    }
  });

  it("should run static analysis and write route-graph.json", async () => {
    const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
    const artifactPath = path.join(artifactDirectory, ROUTE_GRAPH_FILE);

    await rm(artifactDirectory, { recursive: true, force: true });

    const result = await runAnalyzeCommand(
      ["--static-only", fixtureRoot],
      fixtureRoot,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("Static analysis complete: 7 routes, 0 warnings");
    expect(result.stderr).toContain(ROUTE_GRAPH_FILE);
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

  it(
    "should run the full pipeline and write draft artifacts",
    async () => {
      const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
      const capabilitiesPath = path.join(artifactDirectory, CAPABILITIES_DRAFT_FILE);
      const pendingReviewPath = path.join(artifactDirectory, PENDING_REVIEW_FILE);
      const analysisMetaPath = path.join(artifactDirectory, ANALYSIS_META_FILE);
      const routeGraphPath = path.join(artifactDirectory, ROUTE_GRAPH_FILE);

      await rm(artifactDirectory, { recursive: true, force: true });

      const result = await runAnalyzeCommand(
        [fixtureRoot],
        fixtureRoot,
        { llmProvider: createEcommerceFixtureMockProvider() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Analysis complete: 7 routes → 3 capabilities");
      expect(result.stderr).toContain(CAPABILITIES_DRAFT_FILE);
      expect(result.stderr).toContain(PENDING_REVIEW_FILE);
      expect(result.stderr).toContain(ANALYSIS_META_FILE);

      await expect(access(capabilitiesPath)).resolves.toBeUndefined();
      await expect(access(pendingReviewPath)).resolves.toBeUndefined();
      await expect(access(analysisMetaPath)).resolves.toBeUndefined();
      await expect(access(routeGraphPath)).resolves.toBeUndefined();

      const capabilities = parseCapabilitiesArtifact(
        JSON.parse(await readFile(capabilitiesPath, "utf8")),
      );
      expect(capabilities.capabilities).toHaveLength(3);

      await rm(artifactDirectory, { recursive: true, force: true });
    },
    30_000,
  );

  it(
    "should auto-use the ecommerce fixture mock when no explicit provider is supplied",
    async () => {
      const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
      await rm(artifactDirectory, { recursive: true, force: true });

      const result = await runAnalyzeCommand([fixtureRoot], fixtureRoot);

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("Analysis complete: 7 routes → 3 capabilities");

      await rm(artifactDirectory, { recursive: true, force: true });
    },
    30_000,
  );

  it(
    "should report eval metrics with --eval and pass precision gate",
    async () => {
      const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
      await rm(artifactDirectory, { recursive: true, force: true });

      const result = await runAnalyzeCommand(
        ["--eval", "--json", fixtureRoot],
        fixtureRoot,
        { llmProvider: createEcommerceFixtureMockProvider() },
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("precision=1.000");
      expect(result.stderr).toContain("G2 precision gate (0.9): pass");
      expect(result.stderr).toContain("G2 count ratio gate (0.3): fail");

      const payload = JSON.parse(result.stdout) as {
        readonly eval: { readonly precision: number; readonly recall: number };
      };
      expect(payload.eval.precision).toBe(1);
      expect(payload.eval.recall).toBe(1);

      await rm(artifactDirectory, { recursive: true, force: true });
    },
    30_000,
  );

  it(
    "should fail publish when no approved capabilities exist",
    async () => {
      const artifactDirectory = path.join(fixtureRoot, ".agent-layer");
      await rm(artifactDirectory, { recursive: true, force: true });

      const result = await runAnalyzeCommand(
        ["--publish", fixtureRoot],
        fixtureRoot,
        { llmProvider: createEcommerceFixtureMockProvider() },
      );

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("No approved capabilities to publish");

      await rm(artifactDirectory, { recursive: true, force: true });
    },
    30_000,
  );
});
