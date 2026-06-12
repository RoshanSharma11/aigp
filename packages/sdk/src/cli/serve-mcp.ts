import path from "node:path";

import {
  ConfigError,
  createDefaultAgentLayerConfig,
  loadAgentLayerConfig,
  type Capability,
} from "@agent-layer/core";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { generateMcpTools } from "../generators/mcp.js";
import { loadPublishedCapabilities } from "../store/reader.js";
import { StoreError } from "../store/errors.js";
import { buildCapabilityEndpoint } from "../generators/types.js";

export interface ServeMcpOptions {
  readonly rootPath: string;
  readonly baseUrl?: string | undefined;
  readonly fetchImpl?: typeof fetch | undefined;
}

export interface ServeMcpCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

const SERVE_MCP_FLAGS = new Set(["--help", "-h", "--verbose"]);

const parseServeMcpOptions = (
  args: readonly string[],
  cwd: string = process.cwd(),
):
  | { readonly ok: true; readonly options: ServeMcpOptions }
  | { readonly ok: false; readonly message: string; readonly exitCode: number } => {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      ok: false,
      message: [
        "agent-layer serve-mcp [path] [--base-url <url>]",
        "",
        "Start a stdio MCP server backed by published capabilities.json",
        "  --base-url  Origin used to execute capabilities (defaults to config.baseUrl)",
      ].join("\n"),
      exitCode: 0,
    };
  }

  const positionalArguments = args.filter(
    (argument) => !argument.startsWith("-") && !SERVE_MCP_FLAGS.has(argument),
  );
  const baseUrlFlagIndex = args.indexOf("--base-url");
  const baseUrl =
    baseUrlFlagIndex >= 0 ? args[baseUrlFlagIndex + 1] : undefined;

  if (baseUrlFlagIndex >= 0 && baseUrl === undefined) {
    return {
      ok: false,
      message: "--base-url requires a value",
      exitCode: 2,
    };
  }

  return {
    ok: true,
    options: {
      rootPath: path.resolve(positionalArguments[0] ?? cwd),
      ...(baseUrl !== undefined ? { baseUrl } : {}),
    },
  };
};

const buildTools = (capabilities: readonly Capability[]): Tool[] =>
  generateMcpTools(capabilities, {
    baseUrl: "http://localhost",
    generatedAt: new Date().toISOString(),
  }).tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as Tool["inputSchema"],
  }));

const resolveBaseUrl = async (
  rootPath: string,
  override?: string | undefined,
): Promise<string> => {
  if (override !== undefined) {
    return override;
  }

  try {
    const config = await loadAgentLayerConfig(rootPath);
    return config.baseUrl;
  } catch (error) {
    if (error instanceof ConfigError && error.code === "CONFIG_NOT_FOUND") {
      return createDefaultAgentLayerConfig().baseUrl;
    }

    throw error;
  }
};

export interface McpToolExecutionResult {
  readonly content: readonly { readonly type: "text"; readonly text: string }[];
  readonly isError?: boolean;
}

export const executeMcpToolCall = async (
  capabilities: readonly Capability[],
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<McpToolExecutionResult> => {
  const capability = capabilities.find((entry) => entry.id === toolName);

  if (capability === undefined) {
    return {
      content: [{ type: "text", text: `Unknown capability: ${toolName}` }],
      isError: true,
    };
  }

  const operation =
    typeof args.operation === "string" ? args.operation : capability.defaultOperation;
  const input = args.input ?? {};

  const response = await fetchImpl(
    buildCapabilityEndpoint(
      { baseUrl, generatedAt: new Date().toISOString() },
      capability.id,
    ),
    {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation, input }),
  });

  const payload = (await response.json()) as {
    readonly success?: boolean;
    readonly error?: { readonly message?: string };
    readonly data?: unknown;
  };

  if (!response.ok || payload.success === false) {
    return {
      content: [
        {
          type: "text",
          text: payload.error?.message ?? `Capability execution failed (${response.status})`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload.data ?? payload, null, 2),
      },
    ],
  };
};

export const createMcpServer = (
  capabilities: readonly Capability[],
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Server => {
  const tools = buildTools(capabilities);

  const server = new Server(
    {
      name: "agent-layer",
      version: "0.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const args =
      typeof request.params.arguments === "object" && request.params.arguments !== null
        ? (request.params.arguments as Record<string, unknown>)
        : {};

    const result = await executeMcpToolCall(
      capabilities,
      baseUrl,
      request.params.name,
      args,
      fetchImpl,
    );

    return {
      content: [...result.content],
      ...(result.isError === true ? { isError: true } : {}),
    };
  });

  return server;
};

export const startMcpServer = async (options: ServeMcpOptions): Promise<void> => {
  const loaded = await loadPublishedCapabilities(options.rootPath);
  const baseUrl = await resolveBaseUrl(options.rootPath, options.baseUrl);
  const server = createMcpServer(
    loaded.approvedCapabilities,
    baseUrl,
    options.fetchImpl ?? fetch,
  );
  const transport = new StdioServerTransport();

  await server.connect(transport);
};

export const runServeMcpCommand = async (
  args: readonly string[],
  cwd: string = process.cwd(),
): Promise<ServeMcpCommandResult> => {
  const parsed = parseServeMcpOptions(args, cwd);

  if (!parsed.ok) {
    return {
      exitCode: parsed.exitCode,
      stdout: "",
      stderr: `${parsed.message}\n`,
    };
  }

  try {
    await startMcpServer(parsed.options);

    return {
      exitCode: 0,
      stdout: "",
      stderr: "",
    };
  } catch (error) {
    if (error instanceof StoreError) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${error.message}\n`,
      };
    }

    throw error;
  }
};
