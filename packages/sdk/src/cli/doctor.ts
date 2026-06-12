import { access } from "node:fs/promises";
import path from "node:path";

import {
  ConfigError,
  createDefaultAgentLayerConfig,
  loadAgentLayerConfig,
} from "@agent-layer/core";

import { detectFramework } from "../scanner/detector.js";
import { resolveArtifactPaths, validateProjectArtifacts } from "../store/validate.js";
import { loadCapabilitiesDraftArtifact } from "../store/reader.js";
import { StoreError } from "../store/errors.js";

export type DoctorCheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  readonly name: string;
  readonly status: DoctorCheckStatus;
  readonly message: string;
}

export interface DoctorResult {
  readonly healthy: boolean;
  readonly checks: readonly DoctorCheck[];
}

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const runDoctorChecks = async (rootPath: string): Promise<DoctorResult> => {
  const resolvedRoot = path.resolve(rootPath);
  const checks: DoctorCheck[] = [];
  const artifactPaths = resolveArtifactPaths(resolvedRoot);

  const agentLayerExists = await fileExists(artifactPaths.agentLayerDirectory);
  checks.push({
    name: "agent-layer-directory",
    status: agentLayerExists ? "pass" : "warn",
    message: agentLayerExists
      ? `.agent-layer directory found at ${artifactPaths.agentLayerDirectory}`
      : `.agent-layer directory missing — run analyze first`,
  });

  try {
    const config = await loadAgentLayerConfig(resolvedRoot);
    checks.push({
      name: "config",
      status: "pass",
      message: `config.json valid (llm.provider=${config.llm.provider}, baseUrl=${config.baseUrl})`,
    });

    if (config.llm.provider === "mock") {
      checks.push({
        name: "llm-connectivity",
        status: "pass",
        message: "mock LLM provider selected — no API key required",
      });
    } else {
      const apiKeyEnvVar = config.llm.apiKeyEnvVar ?? `${config.llm.provider.toUpperCase()}_API_KEY`;
      const apiKeyPresent = process.env[apiKeyEnvVar] !== undefined;

      checks.push({
        name: "llm-connectivity",
        status: apiKeyPresent ? "pass" : "warn",
        message: apiKeyPresent
          ? `${apiKeyEnvVar} is set for ${config.llm.provider} provider`
          : `${apiKeyEnvVar} is not set — real LLM analysis will fail`,
      });
    }
  } catch (error) {
    if (error instanceof ConfigError && error.code === "CONFIG_NOT_FOUND") {
      const defaults = createDefaultAgentLayerConfig();
      checks.push({
        name: "config",
        status: "warn",
        message: `config.json missing — defaults will be used (llm.provider=${defaults.llm.provider})`,
      });
      checks.push({
        name: "llm-connectivity",
        status: "pass",
        message: "mock LLM provider is the default when config.json is absent",
      });
    } else {
      checks.push({
        name: "config",
        status: "fail",
        message: error instanceof Error ? error.message : "Invalid config.json",
      });
    }
  }

  const framework = await detectFramework(resolvedRoot);
  checks.push({
    name: "framework-detection",
    status: framework === "unknown" ? "fail" : "pass",
    message:
      framework === "unknown"
        ? "No supported framework detected in project dependencies"
        : `Detected framework: ${framework}`,
  });

  try {
    const draft = await loadCapabilitiesDraftArtifact(resolvedRoot);
    checks.push({
      name: "capabilities-draft",
      status: "pass",
      message: `capabilities.draft.json contains ${draft.capabilities.length} capabilities`,
    });
  } catch (error) {
    if (error instanceof StoreError && error.code === "CAPABILITIES_DRAFT_NOT_FOUND") {
      checks.push({
        name: "capabilities-draft",
        status: "warn",
        message: "capabilities.draft.json missing — run analyze to generate draft capabilities",
      });
    } else {
      checks.push({
        name: "capabilities-draft",
        status: "fail",
        message: error instanceof Error ? error.message : "Invalid capabilities.draft.json",
      });
    }
  }

  const validation = await validateProjectArtifacts(resolvedRoot);

  if (validation.issues.length === 0) {
    checks.push({
      name: "artifact-validation",
      status: agentLayerExists ? "pass" : "warn",
      message: agentLayerExists
        ? `Validated ${validation.checkedFiles.length} artifact files`
        : "No artifacts to validate yet",
    });
  } else {
    checks.push({
      name: "artifact-validation",
      status: "fail",
      message: validation.issues.map((issue) => `${issue.file}: ${issue.message}`).join("; "),
    });
  }

  const healthy = !checks.some((check) => check.status === "fail");

  return { healthy, checks };
};
