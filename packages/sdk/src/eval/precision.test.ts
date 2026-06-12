import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { runFullAnalysis } from "../analyze/pipeline.js";
import { createEcommerceFixtureMockProvider } from "../analyze/ecommerce-fixture-mock.js";
import {
  CAPABILITY_COUNT_RATIO_GATE,
  CAPABILITY_PRECISION_GATE,
  evaluateCapabilityPrecision,
  loadGroundTruth,
  resolveGroundTruthPath,
} from "./precision.js";

const fixtureRoot = path.resolve(
  fileURLToPath(import.meta.url),
  "../../../../../fixtures/nestjs-ecommerce",
);

describe("capability precision evaluation", () => {
  it(
    "should compute precision and recall against ground truth",
    async () => {
    const groundTruth = await loadGroundTruth(resolveGroundTruthPath(fixtureRoot));
    const analysis = await runFullAnalysis(fixtureRoot, {
      llmProvider: createEcommerceFixtureMockProvider(),
      writeArtifacts: false,
    });

    const report = evaluateCapabilityPrecision(analysis.capabilities, groundTruth);

    expect(report.generatedCapabilities).toBe(3);
    expect(report.routeCount).toBe(7);
    expect(report.correctCapabilities).toBe(3);
    expect(report.incorrectCapabilities).toEqual([]);
    expect(report.precision).toBe(1);
    expect(report.recall).toBe(1);
    expect(report.matchedExpectedCapabilities).toEqual([
      "account_access",
      "cart_management",
      "product_catalog",
    ]);
    expect(report.passesPrecisionGate).toBe(true);
    expect(CAPABILITY_PRECISION_GATE).toBe(0.9);
    },
    30_000,
  );

  it(
    "should document the G2 count-ratio blocker for the small ecommerce fixture",
    async () => {
      const groundTruth = await loadGroundTruth(resolveGroundTruthPath(fixtureRoot));
      const analysis = await runFullAnalysis(fixtureRoot, {
        llmProvider: createEcommerceFixtureMockProvider(),
        writeArtifacts: false,
      });

      const report = evaluateCapabilityPrecision(analysis.capabilities, groundTruth);

      expect(report.capabilityCountRatio).toBeCloseTo(3 / 7, 5);
      expect(report.passesCountRatioGate).toBe(false);
      expect(report.passesG2Gate).toBe(false);
      expect(report.blockers.some((blocker) => blocker.includes("count ratio"))).toBe(
        true,
      );
      expect(CAPABILITY_COUNT_RATIO_GATE).toBe(0.3);
    },
    30_000,
  );
});
