import type { Capability, JsonSchema } from "@agent-layer/core";

import { resolveAgentPrefix, type DiscoveryGeneratorContext } from "./types.js";

export const OPENAPI_SPEC_VERSION = "3.1.0";

export interface OpenApiDocument {
  readonly openapi: typeof OPENAPI_SPEC_VERSION;
  readonly info: {
    readonly title: string;
    readonly description: string;
    readonly version: string;
  };
  readonly servers: readonly [{ readonly url: string }];
  readonly paths: Record<string, OpenApiPathItem>;
}

interface OpenApiPathItem {
  readonly get?: OpenApiOperation;
  readonly post?: OpenApiOperation;
}

interface OpenApiOperation {
  readonly operationId: string;
  readonly summary: string;
  readonly description?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly requestBody?: {
    readonly required: boolean;
    readonly content: {
      readonly "application/json": {
        readonly schema: JsonSchema;
      };
    };
  };
  readonly responses: {
    readonly "200": {
      readonly description: string;
      readonly content: {
        readonly "application/json": {
          readonly schema: JsonSchema;
        };
      };
    };
  };
}

const executionRequestSchema = (capability: Capability): JsonSchema => ({
  type: "object",
  properties: {
    operation: {
      type: "string",
      description: "Capability operation to execute.",
      enum: capability.operations.map((operation) => operation.id),
    },
    input: capability.inputSchema,
  },
  required: ["input"],
});

const executionResponseSchema = (): JsonSchema => ({
  type: "object",
  properties: {
    capabilityId: { type: "string" },
    operation: { type: "string" },
    success: { type: "boolean" },
    data: {},
    metadata: {
      type: "object",
      properties: {
        executedAt: { type: "string", format: "date-time" },
      },
    },
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
      },
    },
  },
  required: ["capabilityId", "operation", "success"],
});

export const generateOpenApi = (
  capabilities: readonly Capability[],
  context: DiscoveryGeneratorContext,
): OpenApiDocument => {
  const agentPrefix = resolveAgentPrefix(context);
  const paths: Record<string, OpenApiPathItem> = {
    [`${agentPrefix}/capabilities`]: {
      get: {
        operationId: "listCapabilities",
        summary: "List approved capabilities",
        description: "Returns a summary of approved capabilities available to agents.",
        responses: {
          "200": {
            description: "Approved capability summaries",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      description: { type: "string" },
                      category: { type: "string" },
                      defaultOperation: { type: "string" },
                      requiresAuth: { type: "boolean" },
                    },
                    required: [
                      "id",
                      "name",
                      "description",
                      "category",
                      "defaultOperation",
                      "requiresAuth",
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  for (const capability of capabilities) {
    paths[`${agentPrefix}/capabilities/${capability.id}`] = {
      get: {
        operationId: `get_${capability.id}`,
        summary: `Get ${capability.name}`,
        description: capability.description,
        tags: [capability.category],
        responses: {
          "200": {
            description: "Full capability definition",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                },
              },
            },
          },
        },
      },
      post: {
        operationId: `execute_${capability.id}`,
        summary: `Execute ${capability.name}`,
        description: capability.description,
        tags: [capability.category],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: executionRequestSchema(capability),
            },
          },
        },
        responses: {
          "200": {
            description: "Structured capability execution response",
            content: {
              "application/json": {
                schema: executionResponseSchema(),
              },
            },
          },
        },
      },
    };
  }

  return {
    openapi: OPENAPI_SPEC_VERSION,
    info: {
      title: context.agentName ?? "Agent Layer",
      description:
        context.agentDescription ??
        "Agent-facing capability discovery and execution interface.",
      version: "1.0.0",
    },
    servers: [{ url: context.baseUrl }],
    paths,
  };
};
