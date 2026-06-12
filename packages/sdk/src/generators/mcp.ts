import type { Capability, JsonSchema } from "@agent-layer/core";

import type { DiscoveryGeneratorContext } from "./types.js";

export const MCP_TOOLS_ARTIFACT_VERSION = "1.0.0";

export interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

export interface McpToolsDocument {
  readonly version: typeof MCP_TOOLS_ARTIFACT_VERSION;
  readonly generatedAt: string;
  readonly baseUrl: string;
  readonly tools: readonly McpToolDefinition[];
}

const buildMcpInputSchema = (capability: Capability): JsonSchema => {
  const operationIds = capability.operations.map((operation) => operation.id);

  return {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description:
          operationIds.length === 1
            ? `Operation to execute. Defaults to ${capability.defaultOperation}.`
            : "Operation to execute.",
        ...(operationIds.length > 1 ? { enum: operationIds } : {}),
        default: capability.defaultOperation,
      },
      input: capability.inputSchema,
    },
    required: ["input"],
  };
};

export const generateMcpTools = (
  capabilities: readonly Capability[],
  context: DiscoveryGeneratorContext,
): McpToolsDocument => ({
  version: MCP_TOOLS_ARTIFACT_VERSION,
  generatedAt: context.generatedAt,
  baseUrl: context.baseUrl,
  tools: capabilities.map((capability) => ({
    name: capability.id,
    description: capability.description,
    inputSchema: buildMcpInputSchema(capability),
  })),
});
