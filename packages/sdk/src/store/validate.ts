import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseAgentLayerConfig,
  parseCapabilitiesArtifact,
  parseOverridesArtifact,
} from "@agent-layer/core";

import { StoreError } from "./errors.js";
import {
  loadCapabilitiesArtifact,
  loadCapabilitiesDraftArtifact,
  loadOverridesArtifact,
  resolveCapabilitiesDraftPath,
  resolveCapabilitiesPath,
  resolveOverridesPath,
} from "./reader.js";
import {
  ANALYSIS_META_FILE,
  PENDING_REVIEW_FILE,
  ROUTE_GRAPH_FILE,
  resolveAgentLayerDirectory,
} from "./writer.js";

export interface ArtifactValidationIssue {
  readonly file: string;
  readonly message: string;
}

export interface ValidateArtifactsResult {
  readonly valid: boolean;
  readonly checkedFiles: readonly string[];
  readonly issues: readonly ArtifactValidationIssue[];
}

const readOptionalJsonFile = async (filePath: string): Promise<unknown | undefined> => {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
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

const validateJsonFile = async (
  filePath: string,
  label: string,
  validate: (input: unknown) => unknown,
): Promise<ArtifactValidationIssue[]> => {
  const payload = await readOptionalJsonFile(filePath);

  if (payload === undefined) {
    return [];
  }

  try {
    validate(payload);
    return [];
  } catch (error) {
    return [
      {
        file: label,
        message: error instanceof Error ? error.message : "Invalid artifact",
      },
    ];
  }
};

export const validateProjectArtifacts = async (
  rootPath: string,
): Promise<ValidateArtifactsResult> => {
  const agentLayerDirectory = resolveAgentLayerDirectory(rootPath);
  const checkedFiles: string[] = [];
  const issues: ArtifactValidationIssue[] = [];

  const configPath = path.join(agentLayerDirectory, "config.json");
  checkedFiles.push("config.json");
  issues.push(
    ...(await validateJsonFile(configPath, "config.json", parseAgentLayerConfig)),
  );

  const artifactChecks: Array<{
    readonly fileName: string;
    readonly validate: (input: unknown) => unknown;
  }> = [
    { fileName: "capabilities.json", validate: parseCapabilitiesArtifact },
    { fileName: "capabilities.draft.json", validate: parseCapabilitiesArtifact },
    { fileName: "overrides.json", validate: parseOverridesArtifact },
  ];

  for (const check of artifactChecks) {
    const filePath = path.join(agentLayerDirectory, check.fileName);
    checkedFiles.push(check.fileName);
    issues.push(
      ...(await validateJsonFile(filePath, check.fileName, check.validate)),
    );
  }

  const pendingReviewPath = path.join(agentLayerDirectory, PENDING_REVIEW_FILE);
  checkedFiles.push(PENDING_REVIEW_FILE);
  const pendingReview = await readOptionalJsonFile(pendingReviewPath);

  if (pendingReview !== undefined) {
    if (
      typeof pendingReview !== "object" ||
      pendingReview === null ||
      !Array.isArray((pendingReview as { readonly entries?: unknown }).entries)
    ) {
      issues.push({
        file: PENDING_REVIEW_FILE,
        message: "pending-review.json must include an entries array",
      });
    }
  }

  const routeGraphPath = path.join(agentLayerDirectory, ROUTE_GRAPH_FILE);
  checkedFiles.push(ROUTE_GRAPH_FILE);
  const routeGraph = await readOptionalJsonFile(routeGraphPath);

  if (routeGraph !== undefined) {
    if (
      typeof routeGraph !== "object" ||
      routeGraph === null ||
      !Array.isArray((routeGraph as { readonly routes?: unknown }).routes)
    ) {
      issues.push({
        file: ROUTE_GRAPH_FILE,
        message: "route-graph.json must include a routes array",
      });
    }
  }

  const analysisMetaPath = path.join(agentLayerDirectory, ANALYSIS_META_FILE);
  checkedFiles.push(ANALYSIS_META_FILE);
  const analysisMeta = await readOptionalJsonFile(analysisMetaPath);

  if (analysisMeta !== undefined) {
    if (typeof analysisMeta !== "object" || analysisMeta === null) {
      issues.push({
        file: ANALYSIS_META_FILE,
        message: "analysis-meta.json must be an object",
      });
    }
  }

  return {
    valid: issues.length === 0,
    checkedFiles,
    issues,
  };
};

export type CapabilityDiffChangeType = "added" | "removed" | "changed" | "unchanged";

export interface CapabilityDiffEntry {
  readonly id: string;
  readonly changeType: CapabilityDiffChangeType;
  readonly fields?: readonly string[];
}

export interface DiffCapabilitiesResult {
  readonly draftCount: number;
  readonly publishedCount: number;
  readonly changes: readonly CapabilityDiffEntry[];
}

const CAPABILITY_DIFF_FIELDS = [
  "name",
  "description",
  "category",
  "status",
  "confidence",
  "needsHumanReview",
  "requiresAuth",
  "riskLevel",
  "defaultOperation",
] as const;

const findChangedFields = (
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): string[] =>
  CAPABILITY_DIFF_FIELDS.filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field]));

export const diffCapabilitiesSincePublish = async (
  rootPath: string,
): Promise<DiffCapabilitiesResult> => {
  let draftCapabilities: Awaited<ReturnType<typeof loadCapabilitiesDraftArtifact>>;
  let publishedCapabilities: Awaited<ReturnType<typeof loadCapabilitiesArtifact>>;

  try {
    draftCapabilities = await loadCapabilitiesDraftArtifact(rootPath);
  } catch (error) {
    if (error instanceof StoreError && error.code === "CAPABILITIES_DRAFT_NOT_FOUND") {
      throw new StoreError(
        "Cannot diff without capabilities.draft.json. Run analyze first.",
        { code: "CAPABILITIES_DRAFT_NOT_FOUND" },
      );
    }

    throw error;
  }

  try {
    publishedCapabilities = await loadCapabilitiesArtifact(rootPath);
  } catch (error) {
    if (error instanceof StoreError && error.code === "CAPABILITIES_NOT_FOUND") {
      return {
        draftCount: draftCapabilities.capabilities.length,
        publishedCount: 0,
        changes: draftCapabilities.capabilities.map((capability) => ({
          id: capability.id,
          changeType: "added",
        })),
      };
    }

    throw error;
  }

  const draftById = new Map(
    draftCapabilities.capabilities.map((capability) => [capability.id, capability] as const),
  );
  const publishedById = new Map(
    publishedCapabilities.capabilities.map((capability) => [capability.id, capability] as const),
  );
  const allIds = [...new Set([...draftById.keys(), ...publishedById.keys()])].sort();
  const changes: CapabilityDiffEntry[] = [];

  for (const id of allIds) {
    const draft = draftById.get(id);
    const published = publishedById.get(id);

    if (draft === undefined && published !== undefined) {
      changes.push({ id, changeType: "removed" });
      continue;
    }

    if (draft !== undefined && published === undefined) {
      changes.push({ id, changeType: "added" });
      continue;
    }

    if (draft === undefined || published === undefined) {
      continue;
    }

    const changedFields = findChangedFields(
      draft as unknown as Record<string, unknown>,
      published as unknown as Record<string, unknown>,
    );

    if (changedFields.length === 0) {
      changes.push({ id, changeType: "unchanged" });
      continue;
    }

    changes.push({ id, changeType: "changed", fields: changedFields });
  }

  return {
    draftCount: draftCapabilities.capabilities.length,
    publishedCount: publishedCapabilities.capabilities.length,
    changes,
  };
};

export const resolveArtifactPaths = (rootPath: string) => ({
  agentLayerDirectory: resolveAgentLayerDirectory(rootPath),
  capabilitiesPath: resolveCapabilitiesPath(rootPath),
  capabilitiesDraftPath: resolveCapabilitiesDraftPath(rootPath),
  overridesPath: resolveOverridesPath(rootPath),
});
