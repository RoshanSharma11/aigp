import { readFile } from "node:fs/promises";

import type { Capability } from "@agent-layer/core";

export const CAPABILITY_PRECISION_GATE = 0.9;
export const CAPABILITY_COUNT_RATIO_GATE = 0.3;

export const CAPABILITY_HINT_ALIASES: Readonly<Record<string, string>> = {
  search_products: "product_catalog",
};

export interface GroundTruthRoute {
  readonly id: string;
  readonly method: string;
  readonly path: string;
  readonly futureCapabilityHint: string;
}

export interface GroundTruthDocument {
  readonly fixture: string;
  readonly version: string;
  readonly generatedAt?: string | undefined;
  readonly routes: readonly GroundTruthRoute[];
}

export interface CapabilityEvalReport {
  readonly precision: number;
  readonly recall: number;
  readonly capabilityCountRatio: number;
  readonly routeCount: number;
  readonly capabilityCount: number;
  readonly expectedCapabilityCount: number;
  readonly correctCapabilities: number;
  readonly generatedCapabilities: number;
  readonly matchedExpectedCapabilities: readonly string[];
  readonly missedExpectedCapabilities: readonly string[];
  readonly incorrectCapabilities: readonly string[];
  readonly blockers: readonly string[];
  readonly passesPrecisionGate: boolean;
  readonly passesCountRatioGate: boolean;
  readonly passesG2Gate: boolean;
}

export const normalizeCapabilityHint = (hint: string): string =>
  CAPABILITY_HINT_ALIASES[hint] ?? hint;

export const resolveGroundTruthPath = (rootPath: string): string =>
  `${rootPath}/ground-truth.json`;

export const loadGroundTruth = async (
  groundTruthPath: string,
): Promise<GroundTruthDocument> => {
  const document = JSON.parse(await readFile(groundTruthPath, "utf8")) as GroundTruthDocument;

  if (!Array.isArray(document.routes) || document.routes.length === 0) {
    throw new Error(`Ground truth document has no routes: ${groundTruthPath}`);
  }

  return document;
};

const buildExpectedRouteMap = (
  groundTruth: GroundTruthDocument,
): ReadonlyMap<string, string> => {
  const routeMap = new Map<string, string>();

  for (const route of groundTruth.routes) {
    routeMap.set(
      `${route.method} ${route.path}`,
      normalizeCapabilityHint(route.futureCapabilityHint),
    );
  }

  return routeMap;
};

const collectExpectedCapabilities = (
  groundTruth: GroundTruthDocument,
): readonly string[] => {
  const expected = new Set<string>();

  for (const route of groundTruth.routes) {
    expected.add(normalizeCapabilityHint(route.futureCapabilityHint));
  }

  return [...expected].sort((left, right) => left.localeCompare(right));
};

const isCapabilityCorrect = (
  capability: Capability,
  expectedRouteMap: ReadonlyMap<string, string>,
): boolean => {
  if (capability.sourceRoutes.length === 0) {
    return false;
  }

  for (const sourceRoute of capability.sourceRoutes) {
    const expectedCapabilityId = expectedRouteMap.get(sourceRoute);

    if (expectedCapabilityId === undefined) {
      return false;
    }

    if (expectedCapabilityId !== capability.id) {
      return false;
    }
  }

  return true;
};

export const evaluateCapabilityPrecision = (
  capabilities: readonly Capability[],
  groundTruth: GroundTruthDocument,
): CapabilityEvalReport => {
  const expectedRouteMap = buildExpectedRouteMap(groundTruth);
  const expectedCapabilities = collectExpectedCapabilities(groundTruth);
  const incorrectCapabilities = capabilities
    .filter((capability) => !isCapabilityCorrect(capability, expectedRouteMap))
    .map((capability) => capability.id)
    .sort((left, right) => left.localeCompare(right));
  const correctCapabilities = capabilities.length - incorrectCapabilities.length;
  const generatedCapabilities = capabilities.length;
  const precision =
    generatedCapabilities === 0 ? 0 : correctCapabilities / generatedCapabilities;

  const generatedCapabilityIds = new Set(capabilities.map((capability) => capability.id));
  const matchedExpectedCapabilities = expectedCapabilities.filter((capabilityId) => {
    if (!generatedCapabilityIds.has(capabilityId)) {
      return false;
    }

    const capability = capabilities.find((candidate) => candidate.id === capabilityId);

    return capability !== undefined && isCapabilityCorrect(capability, expectedRouteMap);
  });
  const missedExpectedCapabilities = expectedCapabilities.filter(
    (capabilityId) => !matchedExpectedCapabilities.includes(capabilityId),
  );
  const recall =
    expectedCapabilities.length === 0
      ? 1
      : matchedExpectedCapabilities.length / expectedCapabilities.length;

  const routeCount = groundTruth.routes.length;
  const capabilityCount = capabilities.length;
  const capabilityCountRatio = routeCount === 0 ? 0 : capabilityCount / routeCount;

  const blockers: string[] = [];

  if (precision < CAPABILITY_PRECISION_GATE) {
    blockers.push(
      `Precision ${precision.toFixed(3)} is below gate ${CAPABILITY_PRECISION_GATE}`,
    );
  }

  if (capabilityCountRatio > CAPABILITY_COUNT_RATIO_GATE) {
    blockers.push(
      `Capability count ratio ${capabilityCountRatio.toFixed(3)} exceeds gate ${CAPABILITY_COUNT_RATIO_GATE}`,
    );
  }

  if (incorrectCapabilities.length > 0) {
    blockers.push(`Incorrect capabilities: ${incorrectCapabilities.join(", ")}`);
  }

  if (missedExpectedCapabilities.length > 0) {
    blockers.push(`Missed expected capabilities: ${missedExpectedCapabilities.join(", ")}`);
  }

  const passesPrecisionGate = precision >= CAPABILITY_PRECISION_GATE;
  const passesCountRatioGate = capabilityCountRatio <= CAPABILITY_COUNT_RATIO_GATE;

  return {
    precision,
    recall,
    capabilityCountRatio,
    routeCount,
    capabilityCount,
    expectedCapabilityCount: expectedCapabilities.length,
    correctCapabilities,
    generatedCapabilities,
    matchedExpectedCapabilities,
    missedExpectedCapabilities,
    incorrectCapabilities,
    blockers,
    passesPrecisionGate,
    passesCountRatioGate,
    passesG2Gate: passesPrecisionGate && passesCountRatioGate,
  };
};

export const formatCapabilityEvalReport = (report: CapabilityEvalReport): string => {
  const lines = [
    `Capability evaluation: precision=${report.precision.toFixed(3)} recall=${report.recall.toFixed(3)} ratio=${report.capabilityCountRatio.toFixed(3)}`,
    `Generated ${report.generatedCapabilities} capabilities from ${report.routeCount} routes (expected ${report.expectedCapabilityCount})`,
    `G2 precision gate (${CAPABILITY_PRECISION_GATE}): ${report.passesPrecisionGate ? "pass" : "fail"}`,
    `G2 count ratio gate (${CAPABILITY_COUNT_RATIO_GATE}): ${report.passesCountRatioGate ? "pass" : "fail"}`,
    `G2 overall: ${report.passesG2Gate ? "pass" : "fail"}`,
  ];

  if (report.blockers.length > 0) {
    lines.push(`Blockers: ${report.blockers.join("; ")}`);
  }

  return lines.join("\n");
};
