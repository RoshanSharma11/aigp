import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Capability, RouteGraphNode } from "@agent-layer/core";

import { mergeCapabilityOverrides } from "../builder/merger.js";
import { loadOverridesArtifact, loadPublishedCapabilities } from "./reader.js";
import { loadCapabilitiesDraftArtifact } from "./reader.js";
import { StoreError } from "./errors.js";

export type RouteFileHashMap = Readonly<Record<string, string>>;

export interface IncrementalAnalysisState {
  readonly routeFileHashes: RouteFileHashMap;
  readonly preservedCapabilities: readonly Capability[];
  readonly changedRouteIds: readonly string[];
  readonly unchangedRouteIds: readonly string[];
}

export const hashFileContents = (contents: string): string =>
  createHash("sha256").update(contents).digest("hex");

export const computeRouteFileHash = async (
  rootPath: string,
  relativeFilePath: string,
): Promise<string> => {
  const absolutePath = path.join(rootPath, relativeFilePath);
  const contents = await readFile(absolutePath, "utf8");
  return hashFileContents(contents);
};

export const buildRouteFileHashMap = async (
  rootPath: string,
  routeGraph: readonly RouteGraphNode[],
): Promise<RouteFileHashMap> => {
  const uniqueFiles = [...new Set(routeGraph.map((node) => node.route.sourceLocation.filePath))];
  const entries = await Promise.all(
    uniqueFiles.map(async (filePath) => [filePath, await computeRouteFileHash(rootPath, filePath)] as const),
  );

  return Object.fromEntries(entries);
};

export const findChangedRouteFiles = (
  currentHashes: RouteFileHashMap,
  previousHashes: RouteFileHashMap | undefined,
): readonly string[] => {
  if (previousHashes === undefined) {
    return Object.keys(currentHashes);
  }

  return Object.keys(currentHashes).filter(
    (filePath) => previousHashes[filePath] !== currentHashes[filePath],
  );
};

export const mapRoutesToSourceFiles = (
  routeGraph: readonly RouteGraphNode[],
): Map<string, string> =>
  new Map(
    routeGraph.map((node) => [node.route.id, node.route.sourceLocation.filePath] as const),
  );

export const findChangedRouteIds = (
  routeGraph: readonly RouteGraphNode[],
  changedFiles: readonly string[],
): readonly string[] => {
  const changedFileSet = new Set(changedFiles);

  return routeGraph
    .filter((node) => changedFileSet.has(node.route.sourceLocation.filePath))
    .map((node) => node.route.id);
};

export const capabilityIsAffectedByRoutes = (
  capability: Capability,
  changedRouteIds: ReadonlySet<string>,
  routeGraph: readonly RouteGraphNode[],
): boolean => {
  const routeIdBySource = new Map<string, string>(
    routeGraph.map((node) => [`${node.route.method} ${node.route.path}`, node.route.id]),
  );

  return capability.sourceRoutes.some((sourceRoute) => {
    const routeId = routeIdBySource.get(sourceRoute);

    if (routeId === undefined) {
      return false;
    }

    return changedRouteIds.has(routeId);
  });
};

export const selectPreservedCapabilities = (
  existingCapabilities: readonly Capability[],
  overrides: Awaited<ReturnType<typeof loadOverridesArtifact>>,
  changedRouteIds: ReadonlySet<string>,
  routeGraph: readonly RouteGraphNode[],
): Capability[] => {
  const mergedCapabilities = mergeCapabilityOverrides(existingCapabilities, overrides.capabilities);

  return mergedCapabilities.filter((capability) => {
    if (capability.status !== "approved") {
      return false;
    }

    return !capabilityIsAffectedByRoutes(capability, changedRouteIds, routeGraph);
  });
};

export const mergeIncrementalCapabilities = (
  preservedCapabilities: readonly Capability[],
  regeneratedCapabilities: readonly Capability[],
): Capability[] => {
  const capabilityById = new Map(
    preservedCapabilities.map((capability) => [capability.id, capability] as const),
  );

  for (const capability of regeneratedCapabilities) {
    capabilityById.set(capability.id, capability);
  }

  return [...capabilityById.values()].sort((left, right) => left.id.localeCompare(right.id));
};

export const loadPreviousRouteFileHashes = async (
  rootPath: string,
): Promise<RouteFileHashMap | undefined> => {
  try {
    const metaPath = path.join(rootPath, ".agent-layer", "analysis-meta.json");
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as {
      readonly routeFileHashes?: RouteFileHashMap;
    };

    return meta.routeFileHashes;
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return undefined;
    }

    throw error;
  }
};

export const resolveIncrementalAnalysisState = async (
  rootPath: string,
  routeGraph: readonly RouteGraphNode[],
): Promise<IncrementalAnalysisState> => {
  const currentHashes = await buildRouteFileHashMap(rootPath, routeGraph);
  const previousHashes = await loadPreviousRouteFileHashes(rootPath);
  const changedFiles = findChangedRouteFiles(currentHashes, previousHashes);
  const changedRouteIds = findChangedRouteIds(routeGraph, changedFiles);
  const changedRouteIdSet = new Set(changedRouteIds);
  const unchangedRouteIds = routeGraph
    .map((node) => node.route.id)
    .filter((routeId) => !changedRouteIdSet.has(routeId));

  let existingCapabilities: readonly Capability[] = [];

  try {
    const draft = await loadCapabilitiesDraftArtifact(rootPath);
    existingCapabilities = draft.capabilities;
  } catch (error) {
    if (!(error instanceof StoreError && error.code === "CAPABILITIES_DRAFT_NOT_FOUND")) {
      throw error;
    }
  }

  if (existingCapabilities.length === 0) {
    try {
      const published = await loadPublishedCapabilities(rootPath);
      existingCapabilities = published.capabilities;
    } catch (error) {
      if (!(error instanceof StoreError && error.code === "CAPABILITIES_NOT_FOUND")) {
        throw error;
      }
    }
  }

  const overrides = await loadOverridesArtifact(rootPath);
  const preservedCapabilities = selectPreservedCapabilities(
    existingCapabilities,
    overrides,
    changedRouteIdSet,
    routeGraph,
  );

  return {
    routeFileHashes: currentHashes,
    preservedCapabilities,
    changedRouteIds,
    unchangedRouteIds,
  };
};

export const filterRouteGraphForIncremental = (
  routeGraph: readonly RouteGraphNode[],
  changedRouteIds: ReadonlySet<string>,
): RouteGraphNode[] =>
  routeGraph.filter((node) => changedRouteIds.has(node.route.id));
