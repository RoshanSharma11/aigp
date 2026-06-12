import { writeFile } from "node:fs/promises";
import path from "node:path";

import type { Capability } from "@agent-layer/core";

import { ensureAgentLayerDirectory } from "../store/writer.js";
import {
  AGENT_CARD_FILE,
  AGENT_JSON_FILE,
  MCP_TOOLS_FILE,
  OPENAPI_FILE,
} from "../store/writer.js";
import { generateAgentCard } from "./agent-card.js";
import { generateAgentJson } from "./agent-json.js";
import { generateMcpTools } from "./mcp.js";
import { generateOpenApi } from "./openapi.js";
import type { DiscoveryGeneratorContext } from "./types.js";

export interface DiscoveryArtifacts {
  readonly agentJson: ReturnType<typeof generateAgentJson>;
  readonly agentCard: ReturnType<typeof generateAgentCard>;
  readonly openApi: ReturnType<typeof generateOpenApi>;
  readonly mcpTools: ReturnType<typeof generateMcpTools>;
}

export interface WriteDiscoveryArtifactsResult {
  readonly agentJsonPath: string;
  readonly agentCardPath: string;
  readonly openApiPath: string;
  readonly mcpToolsPath: string;
}

const serializeJsonArtifact = (artifact: unknown): string =>
  `${JSON.stringify(artifact, null, 2)}\n`;

export const generateDiscoveryArtifacts = (
  capabilities: readonly Capability[],
  context: DiscoveryGeneratorContext,
): DiscoveryArtifacts => ({
  agentJson: generateAgentJson(capabilities, context),
  agentCard: generateAgentCard(capabilities, context),
  openApi: generateOpenApi(capabilities, context),
  mcpTools: generateMcpTools(capabilities, context),
});

export const writeDiscoveryArtifacts = async (
  rootPath: string,
  artifacts: DiscoveryArtifacts,
): Promise<WriteDiscoveryArtifactsResult> => {
  const agentLayerDirectory = await ensureAgentLayerDirectory(rootPath);

  const agentJsonPath = path.join(agentLayerDirectory, AGENT_JSON_FILE);
  const agentCardPath = path.join(agentLayerDirectory, AGENT_CARD_FILE);
  const openApiPath = path.join(agentLayerDirectory, OPENAPI_FILE);
  const mcpToolsPath = path.join(agentLayerDirectory, MCP_TOOLS_FILE);

  await Promise.all([
    writeFile(agentJsonPath, serializeJsonArtifact(artifacts.agentJson), "utf8"),
    writeFile(agentCardPath, serializeJsonArtifact(artifacts.agentCard), "utf8"),
    writeFile(openApiPath, serializeJsonArtifact(artifacts.openApi), "utf8"),
    writeFile(mcpToolsPath, serializeJsonArtifact(artifacts.mcpTools), "utf8"),
  ]);

  return {
    agentJsonPath,
    agentCardPath,
    openApiPath,
    mcpToolsPath,
  };
};

export const generateAndWriteDiscoveryArtifacts = async (
  rootPath: string,
  capabilities: readonly Capability[],
  context: DiscoveryGeneratorContext,
): Promise<WriteDiscoveryArtifactsResult> => {
  const artifacts = generateDiscoveryArtifacts(capabilities, context);
  return writeDiscoveryArtifacts(rootPath, artifacts);
};
